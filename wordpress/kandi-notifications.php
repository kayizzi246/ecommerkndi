<?php
/**
 * Plugin Name: Kandi Notifications
 * Description: Branded transactional email for the Kandi storefront — shopper order confirmations, and the shared mail template the Seller Centre uses for verification codes, order alerts and payout notices. Sends through wp_mail, so it obeys whatever SMTP plugin the site already uses.
 * Version: 1.0.0
 * Author: Kandi UG
 *
 * HOW TO INSTALL
 *  Upload this file to wp-content/plugins/kandi-notifications/kandi-notifications.php
 *  and activate "Kandi Notifications" in wp-admin > Plugins. No settings, no tables.
 *
 * WHY IT IS SEPARATE
 *  Shopper email is not a seller feature — a shop with no sellers still needs to
 *  tell someone their order arrived — and the Seller Centre plugin is already
 *  long. Both plugins work without this one installed: they fall back to plain
 *  wp_mail, which is uglier but still delivers.
 *
 * ON DUPLICATES
 *  WooCommerce sends its own shopper emails. Every shopper message here checks
 *  whether the matching WooCommerce email is switched on and stays quiet if it
 *  is, so nobody is told twice that their order is being processed. Turn a
 *  WooCommerce email off in WooCommerce > Settings > Emails and Kandi's version
 *  takes over automatically.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* -------------------------------------------------------------------------
 * 1. Branding, read from the storefront settings so email matches the shop
 * ---------------------------------------------------------------------- */

function kandi_mail_brand() {
	$settings = get_option( 'kandi_storefront_settings', array() );
	$settings = is_array( $settings ) ? $settings : array();

	$name   = isset( $settings['brand_name'] ) && '' !== $settings['brand_name'] ? $settings['brand_name'] : 'Kandi';
	$suffix = isset( $settings['brand_suffix'] ) && '' !== $settings['brand_suffix'] ? $settings['brand_suffix'] : 'For Less';

	return array(
		'name'    => trim( $name . ' ' . $suffix ),
		'logo'    => isset( $settings['logo_url'] ) ? (string) $settings['logo_url'] : '',
		'phone'   => isset( $settings['support_phone'] ) ? (string) $settings['support_phone'] : '',
		'email'   => isset( $settings['support_email'] ) ? (string) $settings['support_email'] : get_option( 'admin_email' ),
		// The Next.js shop, learned from the X-Kandi-Storefront header the
		// storefront sends on every read. Falls back to WordPress's own URL so
		// a link is never empty, even if it lands on the wrong half of the site.
		'url'     => function_exists( 'kandi_storefront_url' ) && kandi_storefront_url()
			? kandi_storefront_url()
			: home_url(),
	);
}

/* -------------------------------------------------------------------------
 * 2. The one email template
 * ---------------------------------------------------------------------- */

/**
 * Wraps a message in the shop's letterhead.
 *
 * Deliberately plain HTML with inline styles and a single table: email clients
 * are twenty years behind browsers, and Gmail strips <style> blocks from the
 * head. Anything cleverer than this renders as a mess in Outlook.
 *
 * @param string $heading  The one-line headline.
 * @param string $body     Pre-escaped HTML for the message body.
 * @param array  $cta      Optional array( 'label' => …, 'url' => … ).
 */
function kandi_mail_template( $heading, $body, $cta = null ) {
	$brand = kandi_mail_brand();

	$masthead = $brand['logo']
		? sprintf(
			'<img src="%s" alt="%s" style="max-height:38px;max-width:200px;display:block">',
			esc_url( $brand['logo'] ),
			esc_attr( $brand['name'] )
		)
		: sprintf(
			'<span style="font:700 22px/1 Helvetica,Arial,sans-serif;color:#ff6a00">%s</span>',
			esc_html( $brand['name'] )
		);

	$button = '';
	if ( is_array( $cta ) && ! empty( $cta['url'] ) && ! empty( $cta['label'] ) ) {
		$button = sprintf(
			'<tr><td style="padding:8px 32px 32px">
				<a href="%s" style="display:inline-block;background:#ff6a00;color:#ffffff;text-decoration:none;
					font:700 15px/1 Helvetica,Arial,sans-serif;padding:14px 28px;border-radius:8px">%s</a>
			</td></tr>',
			esc_url( $cta['url'] ),
			esc_html( $cta['label'] )
		);
	}

	return sprintf(
		'<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5">
		<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
			<tr><td align="center">
				<table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
					style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
					<tr><td style="padding:26px 32px 18px;border-bottom:1px solid #e5e7eb">%s</td></tr>
					<tr><td style="padding:28px 32px 6px">
						<h1 style="margin:0 0 14px;font:700 21px/1.3 Helvetica,Arial,sans-serif;color:#171717">%s</h1>
						<div style="font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#3f3f46">%s</div>
					</td></tr>
					%s
					<tr><td style="padding:20px 32px 26px;border-top:1px solid #e5e7eb;
						font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#71717a">
						%s%s<br>%s
					</td></tr>
				</table>
			</td></tr>
		</table></body></html>',
		$masthead,
		esc_html( $heading ),
		$body,
		$button,
		$brand['phone'] ? 'Questions? Call ' . esc_html( $brand['phone'] ) . '<br>' : '',
		$brand['email'] ? 'Email ' . esc_html( $brand['email'] ) : '',
		esc_html( $brand['name'] )
	);
}

/**
 * Sends one branded HTML email. Returns wp_mail's own result.
 *
 * The Seller Centre calls this when it is available and drops back to plain
 * wp_mail when it is not, so the two plugins stay independent.
 */
function kandi_send_mail( $to, $subject, $heading, $body, $cta = null ) {
	if ( ! $to || ! is_email( $to ) ) {
		return false;
	}

	$brand = kandi_mail_brand();

	$headers = array(
		'Content-Type: text/html; charset=UTF-8',
		sprintf( 'From: %s <%s>', $brand['name'], kandi_mail_from_address() ),
	);

	return wp_mail( $to, $subject, kandi_mail_template( $heading, $body, $cta ), $headers );
}

/**
 * The address mail is sent from.
 *
 * Must be on the site's own domain or the big providers treat it as forgery and
 * bin it — which is why this is the site domain rather than the shop's Gmail
 * support address. Replies still go where they should: `Reply-To` carries the
 * support address on messages a shopper might answer.
 */
function kandi_mail_from_address() {
	$host = wp_parse_url( home_url(), PHP_URL_HOST );
	$host = preg_replace( '/^www\./i', '', (string) $host );
	return apply_filters( 'kandi_mail_from_address', 'no-reply@' . $host );
}

/* -------------------------------------------------------------------------
 * 3. Small formatting helpers shared by the order emails
 * ---------------------------------------------------------------------- */

/** Renders order lines as a table. Used in both shopper and seller emails. */
function kandi_mail_items_table( $rows, $total_label = '', $total = null ) {
	$html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
		style="border-collapse:collapse;margin:6px 0 2px;font:400 14px/1.5 Helvetica,Arial,sans-serif">';

	foreach ( $rows as $row ) {
		$html .= sprintf(
			'<tr>
				<td style="padding:8px 0;border-bottom:1px solid #f1f1f4;color:#3f3f46">%s<br>
					<span style="color:#71717a;font-size:13px">Qty %d</span></td>
				<td style="padding:8px 0;border-bottom:1px solid #f1f1f4;text-align:right;color:#171717;white-space:nowrap">%s</td>
			</tr>',
			esc_html( $row['name'] ),
			(int) $row['quantity'],
			wp_kses_post( $row['total'] )
		);
	}

	if ( null !== $total ) {
		$html .= sprintf(
			'<tr><td style="padding:12px 0 0;font-weight:700;color:#171717">%s</td>
				<td style="padding:12px 0 0;text-align:right;font-weight:700;color:#171717;white-space:nowrap">%s</td></tr>',
			esc_html( $total_label ),
			wp_kses_post( $total )
		);
	}

	return $html . '</table>';
}

/** True when WooCommerce is already sending the shopper this message itself. */
function kandi_wc_email_enabled( $class ) {
	if ( ! function_exists( 'WC' ) || ! WC()->mailer() ) {
		return false;
	}
	$emails = WC()->mailer()->get_emails();
	return isset( $emails[ $class ] ) && $emails[ $class ]->is_enabled();
}

/** The shopper's address on an order, or '' when it is a guest with none. */
function kandi_order_email( $order ) {
	$email = $order->get_billing_email();
	return is_email( $email ) ? $email : '';
}

function kandi_order_first_name( $order ) {
	$name = trim( (string) $order->get_billing_first_name() );
	return '' !== $name ? $name : 'there';
}

/** Every line on an order, formatted for kandi_mail_items_table. */
function kandi_order_rows( $order ) {
	$rows = array();
	foreach ( $order->get_items() as $item ) {
		$rows[] = array(
			'name'     => $item->get_name(),
			'quantity' => $item->get_quantity(),
			'total'    => wc_price( (float) $item->get_total(), array( 'currency' => $order->get_currency() ) ),
		);
	}
	return $rows;
}

/** Where the shopper follows their order on the storefront. */
function kandi_order_tracking_url( $order ) {
	$brand = kandi_mail_brand();
	return sprintf(
		'%s/track-order?order=%s&email=%s',
		$brand['url'],
		rawurlencode( $order->get_order_number() ),
		rawurlencode( (string) $order->get_billing_email() )
	);
}

/* -------------------------------------------------------------------------
 * 4. Shopper email
 * ---------------------------------------------------------------------- */

/**
 * "We have your order" — sent the moment an order is placed.
 *
 * WooCommerce has no equivalent for a cash-on-delivery order that goes straight
 * to processing: its shopper email for that status is the *processing* notice,
 * which reads as an update to something you were never told about. This is the
 * receipt.
 */
function kandi_mail_order_placed( $order_id ) {
	$order = wc_get_order( $order_id );
	if ( ! $order || $order->get_meta( '_kandi_mailed_placed' ) ) {
		return false;
	}

	$to = kandi_order_email( $order );
	if ( '' === $to ) {
		return false;
	}

	$cod  = 'cod' === $order->get_payment_method();
	$body = sprintf(
		'<p style="margin:0 0 14px">Hi %s, thank you — your order <strong>#%s</strong> is in.</p>%s<p style="margin:14px 0 0">%s</p>',
		esc_html( kandi_order_first_name( $order ) ),
		esc_html( $order->get_order_number() ),
		kandi_mail_items_table(
			kandi_order_rows( $order ),
			'Total',
			wc_price( (float) $order->get_total(), array( 'currency' => $order->get_currency() ) )
		),
		$cod
			? 'You pay <strong>when it reaches you</strong> — cash, MTN MoMo or Airtel Money. Please have the exact amount ready for the rider.'
			: 'We have your payment. Packing starts now.'
	);

	kandi_send_mail(
		$to,
		sprintf( 'Order #%s confirmed', $order->get_order_number() ),
		'Thank you for your order',
		$body,
		array( 'label' => 'Track this order', 'url' => kandi_order_tracking_url( $order ) )
	);

	// Stamped on the order rather than kept in a transient: an order is only
	// placed once, and the flag has to survive as long as the order does.
	$order->update_meta_data( '_kandi_mailed_placed', 1 );
	$order->save();

	return true;
}

/** "We are packing it" / "It is on the way" / "Delivered". */
function kandi_mail_order_status( $order_id, $from_status, $to_status ) {
	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return;
	}

	$to = kandi_order_email( $order );
	if ( '' === $to ) {
		return;
	}

	$name  = esc_html( kandi_order_first_name( $order ) );
	$id    = esc_html( $order->get_order_number() );
	$track = array( 'label' => 'Track this order', 'url' => kandi_order_tracking_url( $order ) );

	// The receipt goes out here rather than on `woocommerce_new_order`, because
	// that hook fires inside wc_create_order() — before the storefront has added
	// a single line item or the delivery address, so the email would arrive
	// describing an empty order. By the first real status the order is complete.
	//
	// It is also why an order awaiting payment gets nothing: a Pesapal order
	// sits at `pending` until the money lands, and thanking somebody for an
	// order they abandoned at the payment screen is worse than silence.
	$just_placed = false;
	if ( in_array( $to_status, array( 'processing', 'on-hold', 'completed' ), true ) ) {
		$just_placed = kandi_mail_order_placed( $order_id );
	}

	if ( 'processing' === $to_status ) {
		// The receipt above already said this order is being prepared; a second
		// email a millisecond later saying the same thing is noise.
		if ( $just_placed ) {
			return;
		}
		if ( kandi_wc_email_enabled( 'WC_Email_Customer_Processing_Order' ) ) {
			return;
		}
		kandi_send_mail(
			$to,
			sprintf( 'Order #%s is being prepared', $order->get_order_number() ),
			'Your order is being packed',
			sprintf(
				'<p style="margin:0 0 14px">Hi %s, order <strong>#%s</strong> has been accepted and is being packed now. We will be in touch when the rider sets off.</p>',
				$name,
				$id
			),
			$track
		);
		return;
	}

	if ( 'completed' === $to_status ) {
		if ( kandi_wc_email_enabled( 'WC_Email_Customer_Completed_Order' ) ) {
			return;
		}
		$brand = kandi_mail_brand();
		kandi_send_mail(
			$to,
			sprintf( 'Order #%s delivered', $order->get_order_number() ),
			'Your order has been delivered',
			sprintf(
				'<p style="margin:0 0 14px">Hi %s, order <strong>#%s</strong> is complete. We hope it is exactly what you wanted.</p>
				 <p style="margin:0 0 14px">Something not right? You have %d days to return it, no questions asked — just reply to this email.</p>
				 <p style="margin:0">A review helps the next shopper decide, and it helps the seller more than you would think.</p>',
				$name,
				$id,
				kandi_returns_days()
			),
			array( 'label' => 'Shop again', 'url' => $brand['url'] )
		);
		return;
	}

	if ( 'cancelled' === $to_status ) {
		kandi_send_mail(
			$to,
			sprintf( 'Order #%s cancelled', $order->get_order_number() ),
			'Your order has been cancelled',
			sprintf(
				'<p style="margin:0 0 14px">Hi %s, order <strong>#%s</strong> has been cancelled and you have not been charged.</p>
				 <p style="margin:0">If this was not you, reply to this email and we will look into it straight away.</p>',
				$name,
				$id
			)
		);
	}
}
add_action( 'woocommerce_order_status_changed', 'kandi_mail_order_status', 20, 3 );

/** The shop's published returns window, for the delivery email. */
function kandi_returns_days() {
	$settings = get_option( 'kandi_storefront_settings', array() );
	if ( is_array( $settings ) && ! empty( $settings['returns_days'] ) ) {
		return (int) $settings['returns_days'];
	}
	return 14;
}
