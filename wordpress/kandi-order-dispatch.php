<?php
/**
 * Plugin Name: Kandi Order Dispatch
 * Description: One-click order acceptance from the seller's email, automatic completion once every seller has accepted, the shopper's "on its way" notice, and SMS + WhatsApp alerts to the seller. Companion to Kandi Seller Centre and Kandi Notifications.
 * Version: 1.0.0
 * Author: Kandi UG
 * Requires Plugins: woocommerce
 *
 * HOW TO INSTALL
 *  Upload to wp-content/plugins/kandi-order-dispatch/kandi-order-dispatch.php and
 *  activate. Settings live under Kandi Sellers > Dispatch.
 *
 * WHY IT IS A SEPARATE PLUGIN
 *  kandi-seller-api.php is ~140 KB and has already outgrown what the Code
 *  Snippets plugin can POST through admin-ajax.php in one request. Everything
 *  here could have lived in that file; none of it should, because the file it
 *  would have gone into can no longer be saved. Two smaller plugins are also two
 *  smaller things to reason about when one of them misbehaves.
 *
 *  It hooks the Seller Centre through two filters rather than editing it:
 *  `kandi_seller_order_cta` swaps the button in the seller's order email, and
 *  `kandi_seller_order_notified` fires the SMS and WhatsApp alerts.
 *
 * WHAT IT CHANGES ABOUT ORDER STATUS — READ THIS
 *  Accepting an order now takes it to `completed`, not `processing`. That is a
 *  deliberate instruction from the shop owner, and it has one consequence worth
 *  understanding: `kandi_sync_commission_status` in the Seller Centre flips
 *  commission rows to `payable` on `completed`, and payouts are requested
 *  against `payable`. So a seller can request money for an order that has been
 *  packed but not delivered — and on pay-on-delivery, before the shop has
 *  collected anything.
 *
 *  If that is not wanted, the fix is one line and it is in the OTHER plugin:
 *  change `kandi_sync_commission_status` to clear commission on a delivery flag
 *  instead of on 'completed'. This plugin sets `_kandi_dispatched_at` on the
 *  order when it auto-completes, which is the hook to key that off.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'KANDI_DISPATCH_VERSION', '1.0.0' );

/* -------------------------------------------------------------------------
 * 1. The one-click accept link
 * ---------------------------------------------------------------------- */

/**
 * The secret the accept links are signed with.
 *
 * Reuses the storefront's shared secret when the Seller Centre is installed, so
 * there is one secret to rotate rather than two. Falls back to a WordPress salt,
 * which is per-install and never leaves the server.
 */
function kandi_dispatch_secret() {
	if ( function_exists( 'kandi_seller_secret' ) ) {
		$secret = kandi_seller_secret();
		if ( $secret ) {
			return $secret;
		}
	}
	return wp_salt( 'auth' );
}

/**
 * The token proving a link came from the email we sent to this seller.
 *
 * An HMAC over the order and the seller, not a random value in a table. That
 * choice is worth explaining: a stored random token needs a row per link, an
 * expiry sweep, and a migration the day the scheme changes. An HMAC needs
 * nothing — it is verifiable from the two ids in the URL and the secret, so
 * there is no state to keep and nothing to clean up.
 *
 * It is scoped to one seller and one order, so a seller who forwards their email
 * cannot accept anybody else's orders, and it cannot be guessed without the
 * secret. It does NOT expire: an order sitting unaccepted for a week still has
 * to be acceptable from the original email, which is the whole point of sending
 * the link.
 */
function kandi_dispatch_token( $order_id, $seller_id ) {
	return hash_hmac(
		'sha256',
		'accept|' . (int) $order_id . '|' . (int) $seller_id,
		kandi_dispatch_secret()
	);
}

/** Constant-time check of a presented token. */
function kandi_dispatch_token_valid( $order_id, $seller_id, $token ) {
	return is_string( $token )
		&& '' !== $token
		&& hash_equals( kandi_dispatch_token( $order_id, $seller_id ), $token );
}

/** The URL that accepts one seller's part of one order in a single click. */
function kandi_dispatch_accept_url( $order_id, $seller_id ) {
	return add_query_arg(
		array(
			'seller' => (int) $seller_id,
			'token'  => kandi_dispatch_token( $order_id, $seller_id ),
		),
		rest_url( 'kandi/v1/dispatch/accept/' . (int) $order_id )
	);
}

/* -------------------------------------------------------------------------
 * 2. Accepting, and completing
 * ---------------------------------------------------------------------- */

/**
 * Records that one seller has accepted their part of an order.
 *
 * Returns an array describing what happened, so the caller can word its own
 * response — the REST link renders a page, and a future caller might not.
 *
 * Idempotent. A seller who taps the link twice, or whose mail client prefetches
 * it and then loads it again when they tap, accepts once and is told the same
 * thing both times. That matters more here than usual: this is a GET performed
 * by clicking a link in an email, and corporate mail scanners (Outlook Safe
 * Links, some antivirus gateways) follow links in messages to check them. A
 * scanner cannot do damage here — the worst it can do is accept an order the
 * seller was going to accept anyway — but it could do it *early*, which is the
 * one caveat worth knowing about one-click accept links.
 */
function kandi_dispatch_accept( $order, $seller_id ) {
	$seller_id = (int) $seller_id;

	$accepted = (array) $order->get_meta( '_kandi_accepted_by' );
	$already  = in_array( $seller_id, $accepted, true );

	if ( ! $already ) {
		$accepted[] = $seller_id;
		$order->update_meta_data( '_kandi_accepted_by', array_values( array_unique( $accepted ) ) );
		$order->add_order_note( sprintf(
			'%s accepted their part of this order from the emailed link.',
			kandi_dispatch_store_name( $seller_id )
		) );
		$order->save();
	}

	// Everyone who has something in this order.
	$sellers = array();
	foreach ( $order->get_items() as $item ) {
		$owner = (int) get_post_meta( $item->get_product_id(), '_kandi_seller_id', true );
		if ( $owner ) {
			$sellers[ $owner ] = true;
		}
	}

	$outstanding = array_diff( array_keys( $sellers ), $accepted );
	$completed   = false;

	/**
	 * All in — the order is done, by the shop's own definition.
	 *
	 * Guarded on the order not already being completed or cancelled, so a
	 * second click cannot re-complete a finished order and fire the shopper's
	 * email again, and an order cancelled between the alert and the click is
	 * not resurrected by a seller tapping an old link.
	 */
	if ( empty( $outstanding )
		&& ! in_array( $order->get_status(), array( 'completed', 'cancelled', 'refunded' ), true ) ) {

		// Stamped before the status change, so anything hooked on `completed`
		// can tell an auto-completion from a hand-completed order. This is the
		// flag to key commission clearing off if payouts should wait for
		// delivery — see the note at the head of this file.
		$order->update_meta_data( '_kandi_dispatched_at', current_time( 'mysql' ) );
		$order->save();

		$order->update_status( 'completed', 'All sellers accepted; order dispatched.' );
		$completed = true;
	}

	return array(
		'already'     => $already,
		'completed'   => $completed,
		'outstanding' => count( $outstanding ),
		'order'       => $order,
	);
}

/** A seller's store name, or something printable when the plugin is absent. */
function kandi_dispatch_store_name( $seller_id ) {
	$name = (string) get_user_meta( (int) $seller_id, '_kandi_store_name', true );
	return '' !== $name ? $name : sprintf( 'Seller #%d', (int) $seller_id );
}

/* -------------------------------------------------------------------------
 * 3. The endpoint behind the emailed link
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', function () {
	register_rest_route( 'kandi/v1', '/dispatch/accept/(?P<id>\d+)', array(
		'methods'             => WP_REST_Server::READABLE,
		// Public by necessity: this is opened from an email client with no
		// session and no storefront secret. The HMAC in the query string is the
		// entire authentication, which is why it is scoped to one seller and one
		// order and compared in constant time.
		'permission_callback' => '__return_true',
		'callback'            => function ( WP_REST_Request $request ) {
			$order_id  = (int) $request['id'];
			$seller_id = (int) $request->get_param( 'seller' );
			$token     = (string) $request->get_param( 'token' );

			if ( ! kandi_dispatch_token_valid( $order_id, $seller_id, $token ) ) {
				return kandi_dispatch_page(
					'That link is not valid',
					'The link may have been altered, or it belongs to a different order. Open the Seller Centre and accept the order there.',
					false
				);
			}

			$order = wc_get_order( $order_id );
			if ( ! $order ) {
				return kandi_dispatch_page(
					'Order not found',
					'This order no longer exists. Nothing has been changed.',
					false
				);
			}

			// The token proves who they are; this proves they have something in
			// the order. Both are needed — a valid token for an order whose
			// items were since deleted should not accept an empty part.
			$owns = false;
			foreach ( $order->get_items() as $item ) {
				if ( (int) get_post_meta( $item->get_product_id(), '_kandi_seller_id', true ) === $seller_id ) {
					$owns = true;
					break;
				}
			}
			if ( ! $owns ) {
				return kandi_dispatch_page(
					'Nothing here is yours',
					'None of the items on this order belong to your store.',
					false
				);
			}

			$result = kandi_dispatch_accept( $order, $seller_id );

			if ( $result['completed'] ) {
				kandi_dispatch_notify_buyer_dispatched( $order );
			}

			if ( $result['already'] ) {
				$message = 'You had already accepted this one. Nothing has changed.';
			} elseif ( $result['completed'] ) {
				$message = 'The buyer has been told it is on its way. Have it ready for the rider.';
			} else {
				$message = sprintf(
					'Thank you. %d other seller%s on this order still to accept before the buyer is notified.',
					$result['outstanding'],
					1 === $result['outstanding'] ? ' has' : 's have'
				);
			}

			return kandi_dispatch_page(
				sprintf( 'Order #%s accepted', $order->get_order_number() ),
				$message,
				true
			);
		},
	) );
} );

/**
 * The page a seller lands on after tapping the link.
 *
 * A real HTML response rather than REST JSON, because the audience is a phone
 * browser opened from an email — `{"ok":true}` on a white screen reads as a
 * failure to anybody who is not a programmer. Returned as a WP_REST_Response
 * with an HTML content type so it can be served from the REST route without
 * needing a page, a rewrite rule or a template.
 */
function kandi_dispatch_page( $title, $message, $ok ) {
	$brand = function_exists( 'kandi_mail_brand' ) ? kandi_mail_brand() : array( 'name' => 'Kandi', 'url' => home_url(), 'mark' => '' );
	$tint  = $ok ? '#16a34a' : '#e53935';

	$html = sprintf(
		'<!doctype html><html lang="en"><head><meta charset="utf-8">
		<meta name="viewport" content="width=device-width,initial-scale=1">
		<title>%s</title></head>
		<body style="margin:0;background:#f4f4f5;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;color:#3f3f46">
		<div style="max-width:520px;margin:0 auto;padding:48px 20px">
			<div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:32px;text-align:center">
				%s
				<div style="width:56px;height:56px;margin:0 auto 18px;border-radius:50%%;background:%s;
					color:#fff;font:700 30px/56px Arial,sans-serif">%s</div>
				<h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#171717">%s</h1>
				<p style="margin:0 0 26px">%s</p>
				<a href="%s" style="display:inline-block;background:#ff6a00;color:#fff;text-decoration:none;
					font-weight:700;padding:13px 26px;border-radius:8px">Open the Seller Centre</a>
			</div>
		</div></body></html>',
		esc_html( $title ),
		! empty( $brand['mark'] )
			? sprintf( '<img src="%s" alt="" width="48" height="48" style="width:48px;height:48px;border-radius:10px;margin:0 0 16px">', esc_url( $brand['mark'] ) )
			: '',
		esc_attr( $tint ),
		$ok ? '&#10003;' : '!',
		esc_html( $title ),
		esc_html( $message ),
		esc_url( ( $brand['url'] ?? home_url() ) . '/seller/orders' )
	);

	$response = new WP_REST_Response( $html );
	$response->header( 'Content-Type', 'text/html; charset=utf-8' );
	// Never cached: the same URL says something different once accepted, and a
	// proxy holding the first answer would tell the seller nothing happened.
	$response->header( 'Cache-Control', 'no-store, max-age=0' );

	return $response;
}

/* -------------------------------------------------------------------------
 * 4. Hooking the Seller Centre's order email
 * ---------------------------------------------------------------------- */

/**
 * Swaps the seller email's button from "Open the order" to one-click accept.
 *
 * A filter rather than an edit to the Seller Centre, so that plugin stays the
 * size it is and this behaviour can be switched off by deactivating this one.
 */
add_filter( 'kandi_seller_order_cta', function ( $cta, $order, $seller_id ) {
	if ( ! $order || ! $seller_id ) {
		return $cta;
	}

	return array(
		'label' => 'Accept this order',
		'url'   => kandi_dispatch_accept_url( $order->get_id(), $seller_id ),
	);
}, 10, 3 );

/* -------------------------------------------------------------------------
 * 5. The shopper's "on its way" notice
 * ---------------------------------------------------------------------- */

/**
 * Tells the buyer the order is dispatched.
 *
 * Sent from here rather than left to the `completed` status email, because the
 * two say different things: Kandi Notifications' completed message is written
 * for an order that has *arrived*, and under this plugin `completed` means
 * accepted and on its way. Sending both would tell one shopper their parcel had
 * been delivered and dispatched in the same minute.
 *
 * Stamped on the order so it cannot go twice — a multi-seller order reaches
 * "all accepted" exactly once, but a re-completed order should not re-announce.
 */
function kandi_dispatch_notify_buyer_dispatched( $order ) {
	if ( $order->get_meta( '_kandi_dispatch_emailed' ) ) {
		return;
	}

	$to = $order->get_billing_email();
	if ( ! $to || ! is_email( $to ) ) {
		return;
	}

	$order->update_meta_data( '_kandi_dispatch_emailed', current_time( 'mysql' ) );
	$order->save();

	$name  = $order->get_billing_first_name() ?: 'there';
	$id    = $order->get_order_number();
	$city  = $order->get_shipping_city() ?: $order->get_billing_city();
	$total = wp_strip_all_tags( $order->get_formatted_order_total() );

	$body = sprintf(
		'<p style="margin:0 0 14px">Hi %s, good news — order <strong>#%s</strong> has been accepted by the seller and is on its way to you.</p>
		 <p style="margin:0 0 14px">Delivery to <strong>%s</strong> usually takes 1–3 business days. Our rider will call the number on the order before arriving, so keep your phone nearby.</p>
		 <p style="margin:0">Paying on delivery? Have <strong>%s</strong> ready — cash, MTN MoMo or Airtel Money all work.</p>',
		esc_html( $name ),
		esc_html( $id ),
		esc_html( $city ?: 'your address' ),
		esc_html( $total )
	);

	if ( function_exists( 'kandi_send_mail' ) ) {
		kandi_send_mail(
			$to,
			sprintf( 'Order #%s is on its way', $id ),
			'Your order is on its way',
			$body,
			function_exists( 'kandi_order_tracking_url' )
				? array( 'label' => 'Track this order', 'url' => kandi_order_tracking_url( $order ) )
				: null,
			sprintf( 'Accepted and dispatched · %s · arriving in 1–3 days.', $total )
		);
		return;
	}

	wp_mail(
		$to,
		sprintf( 'Order #%s is on its way', $id ),
		wp_strip_all_tags( str_replace( '</p>', "\n\n", $body ) )
	);
}

/**
 * Suppresses the "your order has been delivered" email on an order this plugin
 * dispatched.
 *
 * Kandi Notifications sends that on `completed`, and it is written for an order
 * that has arrived. Here `completed` means accepted and on its way, and the
 * shopper has just been told exactly that — so without this they would be told
 * their parcel was dispatched and delivered in the same minute.
 *
 * Keyed on `_kandi_dispatch_emailed`, so an order a human genuinely marks
 * complete later — the real delivery — is untouched and still gets the arrival
 * email. Only the auto-completion is silenced.
 */
add_filter( 'kandi_send_completed_email', function ( $send, $order ) {
	return $order && $order->get_meta( '_kandi_dispatch_emailed' ) ? false : $send;
}, 10, 2 );

/* -------------------------------------------------------------------------
 * 6. SMS and WhatsApp
 *
 * Both are opt-in and both no-op silently when unconfigured, so installing this
 * plugin without credentials changes nothing except the email button.
 * ---------------------------------------------------------------------- */

/**
 * Normalises a Ugandan number to international format without the plus.
 *
 * Sellers type their number however they think of it — 0772 123456,
 * +256772123456, 256 772 123 456 — and every gateway wants one of those and
 * rejects the rest. Returns '' when there is nothing usable, which is what makes
 * the senders below skip rather than post rubbish to an API.
 */
function kandi_dispatch_msisdn( $raw ) {
	$digits = preg_replace( '/\D/', '', (string) $raw );
	if ( '' === $digits ) {
		return '';
	}

	if ( 0 === strpos( $digits, '256' ) ) {
		$digits = substr( $digits, 3 );
	} elseif ( 0 === strpos( $digits, '0' ) ) {
		$digits = substr( $digits, 1 );
	}

	// A Ugandan subscriber number is nine digits after the country code.
	return 9 === strlen( $digits ) ? '256' . $digits : '';
}

/** Dispatch settings, all optional. */
function kandi_dispatch_option( $key, $default = '' ) {
	$options = get_option( 'kandi_dispatch_settings', array() );
	return is_array( $options ) && isset( $options[ $key ] ) && '' !== $options[ $key ]
		? $options[ $key ]
		: $default;
}

/**
 * Sends one SMS through Africa's Talking, or through a generic URL template.
 *
 * Two providers rather than one because there is no single answer in this
 * market: Africa's Talking is what most Ugandan and Kenyan shops end up on, and
 * the local resellers (EgoSMS, SpeedaMobile and the rest) almost all expose a
 * plain GET URL with the number and the text in the query string. The template
 * form covers those without this file needing to know any of their names.
 *
 * Returns false and logs when unconfigured or when the gateway refuses. Never
 * throws: an SMS that does not send must not take the order email down with it.
 */
function kandi_dispatch_send_sms( $to, $text ) {
	$msisdn = kandi_dispatch_msisdn( $to );
	if ( '' === $msisdn ) {
		return false;
	}

	$at_key  = kandi_dispatch_option( 'at_api_key' );
	$at_user = kandi_dispatch_option( 'at_username' );

	if ( $at_key && $at_user ) {
		$response = wp_remote_post( 'https://api.africastalking.com/version1/messaging', array(
			'timeout' => 15,
			'headers' => array(
				'apiKey'       => $at_key,
				'Content-Type' => 'application/x-www-form-urlencoded',
				'Accept'       => 'application/json',
			),
			'body'    => array(
				'username' => $at_user,
				'to'       => '+' . $msisdn,
				'message'  => $text,
				'from'     => kandi_dispatch_option( 'at_sender_id' ),
			),
		) );

		return kandi_dispatch_ok( $response, 'SMS' );
	}

	// Generic gateway: a URL with {to} and {text} in it. Both are URL-encoded
	// on substitution, so a message containing & or # cannot truncate the query
	// string — which is the classic way these integrations half-work.
	$template = kandi_dispatch_option( 'sms_url_template' );
	if ( ! $template ) {
		return false;
	}

	$url = str_replace(
		array( '{to}', '{text}' ),
		array( rawurlencode( $msisdn ), rawurlencode( $text ) ),
		$template
	);

	return kandi_dispatch_ok( wp_remote_get( $url, array( 'timeout' => 15 ) ), 'SMS' );
}

/**
 * Sends one WhatsApp message through the Meta Cloud API.
 *
 * ---- The constraint that shapes this ----
 *
 * WhatsApp does not let a business send free-form text to someone who has not
 * messaged it in the last 24 hours. A brand-new order alert is always outside
 * that window, so it MUST go as a pre-approved template — you cannot simply
 * post the sentence you want. That is Meta's rule, not a limitation here, and it
 * is the thing that surprises everybody wiring this up for the first time.
 *
 * So this sends a template by name with positional body parameters. Create one
 * in WhatsApp Manager under the "Utility" category — utility templates are for
 * transactional notices like this and are approved quickly and charged cheaply —
 * with a body such as:
 *
 *     New order {{1}} on Kandi. {{2}} item(s), {{3}}. Deliver to {{4}}.
 *
 * and put its name in the Dispatch settings. The four parameters below are sent
 * in that order.
 *
 * Falls back to a plain text message when no template name is configured, which
 * works only inside an open 24-hour window — useful for testing against your own
 * number, not for production.
 */
function kandi_dispatch_send_whatsapp( $to, $params, $fallback_text ) {
	$msisdn = kandi_dispatch_msisdn( $to );
	$token  = kandi_dispatch_option( 'wa_token' );
	$phone  = kandi_dispatch_option( 'wa_phone_id' );

	if ( '' === $msisdn || ! $token || ! $phone ) {
		return false;
	}

	$template = kandi_dispatch_option( 'wa_template' );

	if ( $template ) {
		$payload = array(
			'messaging_product' => 'whatsapp',
			'to'                => $msisdn,
			'type'              => 'template',
			'template'          => array(
				'name'     => $template,
				'language' => array( 'code' => kandi_dispatch_option( 'wa_language', 'en' ) ),
				'components' => array(
					array(
						'type'       => 'body',
						'parameters' => array_map(
							function ( $value ) {
								return array( 'type' => 'text', 'text' => (string) $value );
							},
							array_values( $params )
						),
					),
				),
			),
		);
	} else {
		$payload = array(
			'messaging_product' => 'whatsapp',
			'to'                => $msisdn,
			'type'              => 'text',
			'text'              => array( 'body' => $fallback_text ),
		);
	}

	$response = wp_remote_post(
		sprintf( 'https://graph.facebook.com/%s/%s/messages', kandi_dispatch_option( 'wa_version', 'v21.0' ), rawurlencode( $phone ) ),
		array(
			'timeout' => 15,
			'headers' => array(
				'Authorization' => 'Bearer ' . $token,
				'Content-Type'  => 'application/json',
			),
			'body'    => wp_json_encode( $payload ),
		)
	);

	return kandi_dispatch_ok( $response, 'WhatsApp' );
}

/**
 * True when a gateway accepted the message; logs and returns false otherwise.
 *
 * Logging rather than surfacing: this runs inside the order pipeline, and a
 * failed SMS must never stop an order being recorded or an email going out. The
 * log line is what turns "the seller says they got nothing" into a five-minute
 * answer instead of an afternoon.
 */
function kandi_dispatch_ok( $response, $label ) {
	if ( is_wp_error( $response ) ) {
		error_log( sprintf( 'Kandi Dispatch: %s failed — %s', $label, $response->get_error_message() ) );
		return false;
	}

	$code = (int) wp_remote_retrieve_response_code( $response );
	if ( $code < 200 || $code >= 300 ) {
		error_log( sprintf(
			'Kandi Dispatch: %s rejected with HTTP %d — %s',
			$label,
			$code,
			substr( (string) wp_remote_retrieve_body( $response ), 0, 400 )
		) );
		return false;
	}

	return true;
}

/* -------------------------------------------------------------------------
 * 7. Alerting the seller when an order lands
 * ---------------------------------------------------------------------- */

/**
 * Fires the SMS and WhatsApp alerts alongside the Seller Centre's email.
 *
 * Hooked on `kandi_seller_order_notified`, which the Seller Centre fires once
 * per seller per order — the same guard that stops the email going three times
 * as an order moves on-hold → processing → completed therefore covers these too.
 *
 * The message carries what a seller needs to act without opening anything: how
 * many items, what it is worth to them, and where it is going. Sending "you have
 * a new order" and nothing else just moves the question to the next screen.
 */
add_action( 'kandi_seller_order_notified', function ( $order, $seller_id, $part ) {
	$phone = get_user_meta( (int) $seller_id, '_kandi_phone', true );
	if ( ! $phone ) {
		return;
	}

	$count    = count( $part['lines'] );
	$total    = wp_strip_all_tags( wc_price( $part['total'], array( 'currency' => $order->get_currency() ) ) );
	$number   = $order->get_order_number();
	$where    = trim( $order->get_shipping_address_1() . ' ' . $order->get_shipping_city() );
	$where    = $where ?: $order->get_billing_city();
	$customer = trim( $order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name() );

	$text = sprintf(
		'New order #%s on Kandi: %d item%s, %s. Deliver to %s%s. Accept it in the Seller Centre.',
		$number,
		$count,
		1 === $count ? '' : 's',
		$total,
		$customer ? $customer . ', ' : '',
		$where ?: 'the address on the order'
	);

	kandi_dispatch_send_sms( $phone, $text );

	kandi_dispatch_send_whatsapp(
		$phone,
		// Positional, matching the {{1}}..{{4}} of the utility template
		// documented on kandi_dispatch_send_whatsapp.
		array(
			'#' . $number,
			(string) $count,
			$total,
			trim( ( $customer ? $customer . ', ' : '' ) . ( $where ?: 'the address on the order' ) ),
		),
		$text
	);
}, 10, 3 );

/* -------------------------------------------------------------------------
 * 8. Settings
 * ---------------------------------------------------------------------- */

add_action( 'admin_menu', function () {
	// Nested under the Seller Centre's menu when it exists, standalone if not,
	// so this plugin is usable on its own and tidy when it is not.
	$parent = menu_page_url( 'kandi-sellers', false ) ? 'kandi-sellers' : 'options-general.php';

	add_submenu_page(
		$parent,
		'Dispatch',
		'Dispatch',
		'manage_woocommerce',
		'kandi-dispatch',
		'kandi_dispatch_settings_page'
	);
}, 20 );

function kandi_dispatch_settings_page() {
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		wp_die( 'You do not have permission to manage dispatch settings.' );
	}

	$fields = array(
		'at_username'      => array( 'Africa\'s Talking username', 'Leave blank to use the generic gateway below instead.' ),
		'at_api_key'       => array( 'Africa\'s Talking API key', '' ),
		'at_sender_id'     => array( 'SMS sender ID', 'The name messages appear from. Must be registered with the provider.' ),
		'sms_url_template' => array( 'Generic SMS URL', 'Used only when Africa\'s Talking is blank. Put <code>{to}</code> and <code>{text}</code> where the number and message go.' ),
		'wa_phone_id'      => array( 'WhatsApp phone number ID', 'From Meta &rsaquo; WhatsApp Manager &rsaquo; API Setup. Not the phone number itself.' ),
		'wa_token'         => array( 'WhatsApp access token', 'A permanent System User token, not the 24-hour test token.' ),
		'wa_template'      => array( 'WhatsApp template name', 'A <strong>Utility</strong> template with four body variables. Required — WhatsApp forbids free-form messages to someone who has not written to you in 24 hours.' ),
		'wa_language'      => array( 'Template language code', 'Usually <code>en</code> or <code>en_US</code>. Must match the template exactly.' ),
	);

	if ( isset( $_POST['kandi_dispatch_save'] ) ) {
		check_admin_referer( 'kandi_dispatch_settings' );

		$saved = array();
		foreach ( array_keys( $fields ) as $key ) {
			$saved[ $key ] = sanitize_text_field( wp_unslash( $_POST[ $key ] ?? '' ) );
		}
		update_option( 'kandi_dispatch_settings', $saved );

		echo '<div class="notice notice-success is-dismissible"><p>Dispatch settings saved.</p></div>';
	}

	echo '<div class="wrap"><h1>Dispatch notifications</h1>';
	echo '<p>Optional. Leave everything blank and sellers are alerted by email only — the one-click accept link works either way.</p>';
	echo '<form method="post"><table class="form-table"><tbody>';
	wp_nonce_field( 'kandi_dispatch_settings' );

	foreach ( $fields as $key => $meta ) {
		printf(
			'<tr><th scope="row"><label for="%1$s">%2$s</label></th>
			 <td><input type="text" id="%1$s" name="%1$s" value="%3$s" class="regular-text">
			 %4$s</td></tr>',
			esc_attr( $key ),
			esc_html( $meta[0] ),
			esc_attr( kandi_dispatch_option( $key ) ),
			$meta[1] ? '<p class="description">' . wp_kses_post( $meta[1] ) . '</p>' : ''
		);
	}

	echo '</tbody></table>';
	echo '<p><button class="button button-primary" name="kandi_dispatch_save" value="1">Save settings</button></p>';
	echo '</form></div>';
}
