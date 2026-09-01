<?php
/**
 * Plugin Name: Kandi Pesapal
 * Description: Talks to Pesapal from WordPress — starts payments, receives the IPN, and settles the order or the seller fee. The Next.js storefront calls this instead of calling Pesapal itself.
 * Version: 1.0.0
 * Author: Kandi UG
 * Requires Plugins: woocommerce
 *
 * HOW TO INSTALL
 *  Upload to wp-content/plugins/kandi-pesapal/kandi-pesapal.php and activate
 *  "Kandi Pesapal" in wp-admin > Plugins. Then fill in the keys under
 *  wp-admin > Kandi Storefront > Pesapal, or define them in wp-config.php:
 *
 *      define( 'KANDI_PESAPAL_KEY',    '…' );
 *      define( 'KANDI_PESAPAL_SECRET', '…' );
 *      define( 'KANDI_PESAPAL_ENV',    'live' );   // or 'sandbox'
 *
 * WHY THIS EXISTS
 *  The storefront used to call Pesapal directly from a Next.js route. On the
 *  shop's hosting that function died before it could answer — the browser got a
 *  bare 502 with no message, and the shopper was told only that "the payment
 *  window would not open". Serverless functions there run behind a proxy with a
 *  short leash and no visible logs, which makes a payment failure both likely
 *  and impossible to diagnose.
 *
 *  WordPress has neither problem: it is an ordinary PHP process on the same
 *  host as the shop's data, with no execution ceiling worth worrying about and
 *  a log file you can read. Pesapal is also happier here, because the IPN it
 *  calls back is a plain URL on a server that is always awake.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Loads once, however this file arrives.
 *
 * It can be installed as a plugin or pasted into Code Snippets, and on this
 * shop it has been both at once. PHP will not declare the same function twice,
 * so the second copy is not a duplicate — it is a fatal error that takes down
 * wp-admin along with the shop. Bailing here costs nothing and makes the mistake
 * survivable.
 */
if ( defined( 'KANDI_PESAPAL_LOADED' ) ) {
	return;
}
define( 'KANDI_PESAPAL_LOADED', true );

// `define` rather than `const`: Code Snippets runs a snippet through eval(),
// where a top-level `const` is not always legal. `define` behaves identically
// and works in every context this file gets loaded from.
define( 'KANDI_PESAPAL_SANDBOX', 'https://cybqa.pesapal.com/pesapalv3' );
define( 'KANDI_PESAPAL_LIVE', 'https://pay.pesapal.com/v3' );

/* -------------------------------------------------------------------------
 * 1. Configuration
 * ---------------------------------------------------------------------- */

/**
 * The Pesapal credentials, from wp-config constants first and the settings
 * screen second — the same order every other secret in this shop uses.
 *
 * Returns null when the shop has not been set up, so callers can say "payments
 * are not configured" rather than failing halfway through one.
 */
if ( ! function_exists( 'kandi_pesapal_config' ) ) :
function kandi_pesapal_config() {
	$settings = get_option( 'kandi_pesapal_settings', array() );
	$settings = is_array( $settings ) ? $settings : array();

	$key    = defined( 'KANDI_PESAPAL_KEY' ) && KANDI_PESAPAL_KEY
		? (string) KANDI_PESAPAL_KEY
		: (string) ( $settings['consumer_key'] ?? '' );
	$secret = defined( 'KANDI_PESAPAL_SECRET' ) && KANDI_PESAPAL_SECRET
		? (string) KANDI_PESAPAL_SECRET
		: (string) ( $settings['consumer_secret'] ?? '' );
	$env    = defined( 'KANDI_PESAPAL_ENV' ) && KANDI_PESAPAL_ENV
		? (string) KANDI_PESAPAL_ENV
		: (string) ( $settings['environment'] ?? 'sandbox' );

	if ( '' === $key || '' === $secret ) {
		return null;
	}

	return array(
		// Anything but an explicit "live" stays on the sandbox: a misspelt
		// setting must not start taking real money.
		'base'   => 'live' === strtolower( $env ) ? KANDI_PESAPAL_LIVE : KANDI_PESAPAL_SANDBOX,
		'key'    => $key,
		'secret' => $secret,
		'ipn_id' => (string) ( $settings['ipn_id'] ?? '' ),
		'live'   => 'live' === strtolower( $env ),
	);
}
endif;

/** Writes to the WordPress debug log, prefixed so it can be grepped. */
if ( ! function_exists( 'kandi_pesapal_log' ) ) :
function kandi_pesapal_log( $message, $context = null ) {
	if ( null !== $context ) {
		$message .= ' ' . wp_json_encode( $context );
	}
	error_log( '[kandi-pesapal] ' . $message );
}
endif;

/**
 * Runs a payment step and turns *anything* that goes wrong into a readable
 * WP_Error — including the failures PHP would otherwise treat as fatal.
 *
 * This exists because of how the first attempt at this failed. A payment would
 * die somewhere inside the Pesapal call and the shopper would get a bare `502`
 * from the CDN: no message, no JSON, and nothing in any log we could reach. A
 * fatal error kills the process before it can say a word, so every diagnosis
 * was guesswork.
 *
 * `Throwable` catches both exceptions and the errors PHP 7 raises for things
 * like a missing extension, so the worst case is now a sentence naming the file
 * and line rather than silence. Payments must never fail invisibly.
 */
if ( ! function_exists( 'kandi_pesapal_guard' ) ) :
function kandi_pesapal_guard( callable $work ) {
	try {
		return $work();
	} catch ( Throwable $error ) {
		kandi_pesapal_log(
			'FATAL ' . $error->getMessage(),
			array( 'file' => $error->getFile(), 'line' => $error->getLine() )
		);
		return new WP_Error(
			'kandi_pesapal_crash',
			sprintf(
				'The payment could not be started: %s (%s line %d)',
				$error->getMessage(),
				basename( $error->getFile() ),
				$error->getLine()
			),
			array( 'status' => 500 )
		);
	}
}
endif;

/* -------------------------------------------------------------------------
 * 2. Getting a request out of this server
 * ---------------------------------------------------------------------- */

/**
 * An outbound request, tried over PHP streams and then over cURL.
 *
 * WordPress can speak HTTP two ways, and on shared hosting exactly one of them
 * is often broken: cURL compiled without the right CA bundle, or an outbound
 * firewall that drops libcurl's traffic while leaving stream wrappers alone, or
 * the reverse. The usual symptom is precisely what this shop saw — every
 * payment failing at the first call to the gateway while nothing else on the
 * site looked wrong.
 *
 * So a failure on the first transport is not the end of it: the same request is
 * retried on the other one, and whichever answers is remembered for the hour so
 * the next payment does not pay the cost of discovering it again.
 */
if ( ! function_exists( 'kandi_pesapal_http' ) ) :
function kandi_pesapal_http( $url, $args ) {
	$settings = get_option( 'kandi_pesapal_settings', array() );
	$mode     = is_array( $settings ) ? ( $settings['transport'] ?? 'auto' ) : 'auto';

	/**
	 * "Streams only" exists for the failure that cannot be caught.
	 *
	 * A broken libcurl does not raise an error a `catch` can see — it takes the
	 * whole PHP worker down, the web server has nothing to return, and the CDN
	 * in front prints a bare `502`. No log line, no exception, no clue. That is
	 * exactly what this shop was seeing, and no amount of error handling inside
	 * PHP can help: the process is gone before any of it runs.
	 *
	 * The only defence is not to call libcurl at all. Setting this to streams
	 * routes every Pesapal request through PHP's own HTTPS instead, which is a
	 * completely separate code path — slower by a few milliseconds and entirely
	 * unaffected by whatever is wrong with cURL on this host.
	 */
	if ( 'streams' === $mode ) {
		add_filter( 'use_curl_transport', '__return_false' );
		$only = wp_remote_request( $url, $args );
		remove_filter( 'use_curl_transport', '__return_false' );
		return $only;
	}

	if ( 'curl' === $mode ) {
		return wp_remote_request( $url, $args );
	}

	/**
	 * Automatic: streams first, cURL only as a fallback.
	 *
	 * This order is the opposite of the obvious one, and it is deliberate.
	 *
	 * cURL is normally the better transport, so trying it first is what every
	 * WordPress install does. But on this host cURL is the prime suspect for
	 * killing the PHP process outright during a Pesapal call, and that failure
	 * has a property no ordering can recover from: it never returns. There is
	 * no error to inspect and no chance to retry, because the worker is gone.
	 * A fallback that runs after cURL therefore protects against every cURL
	 * failure except the one actually happening here.
	 *
	 * Streams first inverts that. If PHP's own HTTPS can reach Pesapal — and on
	 * this server it can — the crashing path is never entered at all, and the
	 * shop works without anyone having to find a settings page first. cURL
	 * remains as the fallback for hosts with `allow_url_fopen` switched off,
	 * where streams cannot work.
	 *
	 * The cost is a few milliseconds per call. The alternative is a shop that
	 * takes no money.
	 */
	add_filter( 'use_curl_transport', '__return_false' );
	$response = wp_remote_request( $url, $args );
	remove_filter( 'use_curl_transport', '__return_false' );

	if ( ! is_wp_error( $response ) ) {
		return $response;
	}

	$first = $response->get_error_message();
	kandi_pesapal_log( 'streams transport failed, retrying over cURL', $first );

	$retry = wp_remote_request( $url, $args );

	if ( ! is_wp_error( $retry ) ) {
		return $retry;
	}

	// Both failed. Report both reasons — they are usually different, and the
	// pair is what tells a host which of their rules is in the way.
	return new WP_Error(
		'kandi_pesapal_unreachable',
		sprintf(
			'Could not reach Pesapal. PHP streams said: %s. cURL said: %s.',
			$first,
			$retry->get_error_message()
		),
		array( 'status' => 502 )
	);
}
endif;

/* -------------------------------------------------------------------------
 * 3. The Pesapal API
 * ---------------------------------------------------------------------- */

/**
 * An access token, cached for the four minutes Pesapal gives it minus a margin.
 *
 * Cached in a transient rather than a static: PHP hands each request its own
 * process, so a static would re-authenticate on every single call.
 */
if ( ! function_exists( 'kandi_pesapal_token' ) ) :
function kandi_pesapal_token( $config ) {
	$cached = get_transient( 'kandi_pesapal_token' );
	if ( $cached ) {
		return $cached;
	}

	$response = kandi_pesapal_http( $config['base'] . '/api/Auth/RequestToken', array(
		'method'  => 'POST',
		'timeout' => 20,
		'headers' => array( 'Content-Type' => 'application/json', 'Accept' => 'application/json' ),
		'body'    => wp_json_encode( array(
			'consumer_key'    => $config['key'],
			'consumer_secret' => $config['secret'],
		) ),
	) );

	if ( is_wp_error( $response ) ) {
		kandi_pesapal_log( 'token request failed', $response->get_error_message() );
		return $response;
	}

	$body = json_decode( wp_remote_retrieve_body( $response ), true );

	if ( empty( $body['token'] ) ) {
		// Pesapal reports a wrong key as a 200 with an error object, so the
		// status code alone would look like success.
		$message = $body['error']['message'] ?? ( $body['message'] ?? 'Pesapal rejected the credentials.' );
		kandi_pesapal_log( 'token rejected', $body );
		return new WP_Error( 'kandi_pesapal_auth', $message, array( 'status' => 502 ) );
	}

	set_transient( 'kandi_pesapal_token', $body['token'], 4 * MINUTE_IN_SECONDS );
	return $body['token'];
}
endif;

/** One authenticated call to Pesapal. Returns the decoded body or a WP_Error. */
if ( ! function_exists( 'kandi_pesapal_call' ) ) :
function kandi_pesapal_call( $config, $path, $method = 'GET', $payload = null ) {
	$token = kandi_pesapal_token( $config );
	if ( is_wp_error( $token ) ) {
		return $token;
	}

	$args = array(
		'method'  => $method,
		'timeout' => 25,
		'headers' => array(
			'Content-Type'  => 'application/json',
			'Accept'        => 'application/json',
			'Authorization' => 'Bearer ' . $token,
		),
	);
	if ( null !== $payload ) {
		$args['body'] = wp_json_encode( $payload );
	}

	$response = kandi_pesapal_http( $config['base'] . $path, $args );

	if ( is_wp_error( $response ) ) {
		kandi_pesapal_log( 'call failed ' . $path, $response->get_error_message() );
		return $response;
	}

	$raw  = wp_remote_retrieve_body( $response );
	$body = json_decode( $raw, true );

	if ( null === $body ) {
		kandi_pesapal_log( 'non-JSON reply from ' . $path, substr( $raw, 0, 300 ) );
		return new WP_Error( 'kandi_pesapal_bad_reply', 'Pesapal returned something unreadable.', array( 'status' => 502 ) );
	}

	if ( ! empty( $body['error'] ) && ! empty( $body['error']['message'] ) ) {
		kandi_pesapal_log( 'business error from ' . $path, $body['error'] );
		return new WP_Error( 'kandi_pesapal_error', $body['error']['message'], array( 'status' => 502 ) );
	}

	return $body;
}
endif;

/**
 * The IPN id to attach to payments.
 *
 * Prefers a pinned id, then looks for our URL among those already registered,
 * and only registers a new one when it is genuinely absent — otherwise every
 * payment would add another duplicate to the merchant account.
 */
if ( ! function_exists( 'kandi_pesapal_ipn_id' ) ) :
function kandi_pesapal_ipn_id( $config ) {
	if ( $config['ipn_id'] ) {
		return $config['ipn_id'];
	}

	$cached = get_transient( 'kandi_pesapal_ipn_id' );
	if ( $cached ) {
		return $cached;
	}

	$url  = rest_url( 'kandi/v1/payments/ipn' );
	$list = kandi_pesapal_call( $config, '/api/URLSetup/GetIpnList' );

	if ( ! is_wp_error( $list ) && is_array( $list ) ) {
		foreach ( $list as $entry ) {
			if ( isset( $entry['url'], $entry['ipn_id'] ) && $entry['url'] === $url ) {
				set_transient( 'kandi_pesapal_ipn_id', $entry['ipn_id'], WEEK_IN_SECONDS );
				return $entry['ipn_id'];
			}
		}
	}

	$created = kandi_pesapal_call( $config, '/api/URLSetup/RegisterIPN', 'POST', array(
		'url'                   => $url,
		'ipn_notification_type' => 'POST',
	) );

	if ( is_wp_error( $created ) ) {
		return $created;
	}
	if ( empty( $created['ipn_id'] ) ) {
		return new WP_Error( 'kandi_pesapal_no_ipn', 'Pesapal did not return an IPN id.', array( 'status' => 502 ) );
	}

	set_transient( 'kandi_pesapal_ipn_id', $created['ipn_id'], WEEK_IN_SECONDS );
	return $created['ipn_id'];
}
endif;

/* -------------------------------------------------------------------------
 * 3. References
 *
 * The merchant reference encodes what is being paid for, so the IPN needs no
 * table of its own to know what it is confirming. Same format the storefront
 * used, so payments started before this plugin still settle.
 * ---------------------------------------------------------------------- */

if ( ! function_exists( 'kandi_pesapal_reference' ) ) :
function kandi_pesapal_reference( $kind, $id ) {
	return sprintf( '%s-%d-%s', 'order' === $kind ? 'ORD' : 'SEL', (int) $id, strtolower( base_convert( (string) time(), 10, 36 ) ) );
}
endif;

if ( ! function_exists( 'kandi_pesapal_parse_reference' ) ) :
function kandi_pesapal_parse_reference( $reference ) {
	if ( ! preg_match( '/^(ORD|SEL)-(\d+)-/', (string) $reference, $match ) ) {
		return null;
	}
	return array(
		'kind' => 'ORD' === $match[1] ? 'order' : 'seller-fee',
		'id'   => (int) $match[2],
	);
}
endif;

/* -------------------------------------------------------------------------
 * 3b. What is being paid, and how much
 * ---------------------------------------------------------------------- */

/**
 * Reads the real price and payer for an order or a seller fee.
 *
 * Split out of the payment route so it can also be served on its own, without
 * this server having to talk to Pesapal at all. That matters here: outbound
 * HTTPS from this host kills the PHP process, while reading a WooCommerce order
 * is perfectly reliable. Separating the two lets the storefront take over only
 * the part that is broken, and still get the amount from a source a shopper
 * cannot edit.
 *
 * Returns a WP_Error the REST layer can hand straight back.
 */
if ( ! function_exists( 'kandi_pesapal_quote' ) ) :
function kandi_pesapal_quote( $kind, $id ) {
	$id = (int) $id;

	if ( ! in_array( $kind, array( 'order', 'seller-fee' ), true ) || $id <= 0 ) {
		return new WP_Error( 'kandi_pesapal_no_purpose', 'Nothing to pay for.', array( 'status' => 400 ) );
	}

	if ( 'order' === $kind ) {
		$order = function_exists( 'wc_get_order' ) ? wc_get_order( $id ) : null;
		if ( ! $order ) {
			return new WP_Error( 'kandi_not_found', 'Order not found.', array( 'status' => 404 ) );
		}
		if ( $order->is_paid() ) {
			return new WP_Error( 'kandi_already_paid', 'That order is already paid.', array( 'status' => 409 ) );
		}

		$amount      = (float) $order->get_total();
		$description = sprintf( 'Order #%s', $order->get_order_number() );
		$billing     = array(
			'email_address' => $order->get_billing_email(),
			'phone_number'  => $order->get_billing_phone(),
			'first_name'    => $order->get_billing_first_name(),
			'last_name'     => $order->get_billing_last_name(),
			'line_1'        => $order->get_billing_address_1(),
			'city'          => $order->get_billing_city(),
			'country_code'  => $order->get_billing_country() ?: 'UG',
		);
	} else {
		$user = get_userdata( $id );
		if ( ! $user ) {
			return new WP_Error( 'kandi_not_found', 'Seller not found.', array( 'status' => 404 ) );
		}

		$amount      = (float) get_user_meta( $id, '_kandi_fee_amount', true );
		$description = 'Kandi seller registration fee';
		$billing     = array(
			'email_address' => $user->user_email,
			'phone_number'  => (string) get_user_meta( $id, '_kandi_phone', true ),
			'first_name'    => (string) get_user_meta( $id, '_kandi_owner_name', true ),
			'country_code'  => 'UG',
		);
	}

	if ( $amount <= 0 ) {
		return new WP_Error( 'kandi_bad_amount', 'There is nothing to pay.', array( 'status' => 400 ) );
	}

	$storefront = function_exists( 'kandi_storefront_url' ) && kandi_storefront_url()
		? kandi_storefront_url()
		: home_url();

	return array(
		'reference'   => kandi_pesapal_reference( $kind, $id ),
		'amount'      => round( $amount, 2 ),
		'currency'    => function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'UGX',
		'description' => function_exists( 'mb_substr' )
			? mb_substr( $description, 0, 100 )
			: substr( $description, 0, 100 ),
		'billing'     => array_filter( $billing ),
		'storefront'  => $storefront,
		'ipn_url'     => rest_url( 'kandi/v1/payments/ipn' ),
	);
}
endif;

/* -------------------------------------------------------------------------
 * 4. Settling
 * ---------------------------------------------------------------------- */

/**
 * Applies a finished payment: pays the order, or marks the seller fee paid.
 *
 * Idempotent by necessity — the shopper's callback and Pesapal's IPN routinely
 * both arrive for the same payment, and an order must never be paid twice nor
 * have its stock taken twice.
 */
if ( ! function_exists( 'kandi_pesapal_settle' ) ) :
function kandi_pesapal_settle( $reference, $status ) {
	$purpose = kandi_pesapal_parse_reference( $reference );
	if ( ! $purpose ) {
		kandi_pesapal_log( 'unrecognised reference', $reference );
		return false;
	}

	$paid   = isset( $status['payment_status_description'] )
		&& 0 === strcasecmp( (string) $status['payment_status_description'], 'Completed' );
	$method = sanitize_text_field( $status['payment_method'] ?? 'Pesapal' );
	$txn    = sanitize_text_field( $status['confirmation_code'] ?? '' );

	if ( 'order' === $purpose['kind'] ) {
		$order = function_exists( 'wc_get_order' ) ? wc_get_order( $purpose['id'] ) : null;
		if ( ! $order ) {
			kandi_pesapal_log( 'order not found', $purpose['id'] );
			return false;
		}

		if ( $order->is_paid() ) {
			return true;
		}

		if ( ! $paid ) {
			// Anything that is not "Completed" leaves the order where it is
			// unless Pesapal has actually failed it. A shopper who is still on
			// the payment page must not have their order cancelled underneath
			// them because the IPN fired early with "Pending".
			if ( isset( $status['payment_status_description'] )
				&& in_array( strtolower( (string) $status['payment_status_description'] ), array( 'failed', 'invalid', 'reversed' ), true ) ) {
				$order->update_status( 'failed', 'Pesapal: ' . $status['payment_status_description'] );
			}
			return false;
		}

		// A draft is not a status WooCommerce will complete a payment from, so
		// it is released first. Without this the money lands and the order
		// stays invisible for ever.
		if ( $order->has_status( 'checkout-draft' ) ) {
			$order->update_status( 'pending', 'Payment confirmed; releasing the draft.' );
		}

		$order->set_payment_method( 'pesapal' );
		$order->set_payment_method_title( $method );
		$order->payment_complete( $txn );
		$order->add_order_note( sprintf( 'Paid via Pesapal (%s). Confirmation: %s', $method, $txn ?: 'n/a' ) );
		$order->save();

		return true;
	}

	// Seller registration fee.
	if ( ! $paid ) {
		return false;
	}

	$seller_id = $purpose['id'];
	if ( 'paid' !== get_user_meta( $seller_id, '_kandi_fee_status', true ) ) {
		update_user_meta( $seller_id, '_kandi_fee_status', 'paid' );
		update_user_meta( $seller_id, '_kandi_fee_reference', $txn );
		update_user_meta( $seller_id, '_kandi_fee_method', $method );
	}

	return true;
}
endif;

/* -------------------------------------------------------------------------
 * 5. REST — kandi/v1/payments/*
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', function () {

	/* ---- POST /payments/start ----
	 *
	 * Opens a payment and hands back the URL the storefront loads in its frame.
	 *
	 * The amount is taken from the order or from the seller's recorded fee —
	 * never from the request — so a tampered call pays the real figure or
	 * nothing at all.
	 */
	register_rest_route( 'kandi/v1', '/payments/start', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_check_secret',
		'callback'            => function ( WP_REST_Request $request ) {
			$config = kandi_pesapal_config();
			if ( ! $config ) {
				return new WP_Error(
					'kandi_pesapal_off',
					'Card and mobile money payments are not set up on this shop yet.',
					array( 'status' => 503 )
				);
			}

			$body = (array) $request->get_json_params();
			$kind = sanitize_text_field( $body['kind'] ?? '' );
			$id   = (int) ( $body['id'] ?? 0 );

			// The price, from our own records — never from the request.
			$quote = kandi_pesapal_quote( $kind, $id );
			if ( is_wp_error( $quote ) ) {
				return $quote;
			}

			$ipn_id = kandi_pesapal_guard( function () use ( $config ) {
				return kandi_pesapal_ipn_id( $config );
			} );
			if ( is_wp_error( $ipn_id ) ) {
				return $ipn_id;
			}

			$reference = $quote['reference'];

			$submission = array(
				'id'              => $reference,
				'currency'        => $quote['currency'],
				'amount'          => $quote['amount'],
				'description'     => $quote['description'],
				'callback_url'    => $quote['storefront'] . '/payment/callback',
				'cancellation_url' => $quote['storefront'] . '/payment/callback?cancelled=1',
				'notification_id' => $ipn_id,
				'billing_address' => $quote['billing'],
			);

			$result = kandi_pesapal_guard( function () use ( $config, $submission ) {
				return kandi_pesapal_call( $config, '/api/Transactions/SubmitOrderRequest', 'POST', $submission );
			} );

			if ( is_wp_error( $result ) ) {
				return $result;
			}
			if ( empty( $result['redirect_url'] ) ) {
				kandi_pesapal_log( 'no redirect_url in reply', $result );
				return new WP_Error( 'kandi_pesapal_no_url', 'Pesapal did not return a payment page.', array( 'status' => 502 ) );
			}

			// Remembered so the callback can settle by tracking id alone.
			set_transient( 'kandi_pp_' . $result['order_tracking_id'], $reference, DAY_IN_SECONDS );

			return rest_ensure_response( array(
				'redirect_url'      => $result['redirect_url'],
				'order_tracking_id' => $result['order_tracking_id'],
				'merchant_reference' => $reference,
			) );
		},
	) );

	/* ---- POST /payments/quote ----
	 *
	 * What is owed, and by whom — without contacting Pesapal.
	 *
	 * This is the escape hatch for a server that cannot make outbound HTTPS
	 * calls. On this host the PHP process dies the moment it opens a connection
	 * to Pesapal, which takes `/payments/start` down with it; reading a
	 * WooCommerce order, by contrast, has never once failed. So the storefront
	 * can ask for the figures here and place the Pesapal call from its own
	 * server instead.
	 *
	 * The point of doing it this way, rather than letting the checkout name a
	 * price, is that the amount still comes from WooCommerce. A shopper editing
	 * the request gets the real total or an error — never a discount.
	 */
	register_rest_route( 'kandi/v1', '/payments/quote', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_check_secret',
		'callback'            => function ( WP_REST_Request $request ) {
			$body = (array) $request->get_json_params();

			return kandi_pesapal_quote(
				sanitize_text_field( $body['kind'] ?? '' ),
				(int) ( $body['id'] ?? 0 )
			);
		},
	) );

	/* ---- GET /payments/enabled ----
	 *
	 * Whether this shop can take card and mobile money at all, so the checkout
	 * can grey those options out up front rather than letting a shopper fill in
	 * the whole form and only then discover there are no keys. Returns nothing
	 * but a boolean — the credentials never leave this server.
	 */
	register_rest_route( 'kandi/v1', '/payments/enabled', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_customer_check_secret',
		'callback'            => function () {
			return rest_ensure_response( array( 'enabled' => null !== kandi_pesapal_config() ) );
		},
	) );

	/* ---- POST|GET /payments/ipn ----
	 *
	 * Pesapal's server-to-server notification. Public by necessity — Pesapal
	 * has no secret of ours — but it carries no payment status, so nothing is
	 * trusted from it: the tracking id is used to *ask* Pesapal what happened.
	 *
	 * This is what makes payment reliable. It fires even when the shopper
	 * closes the tab the instant they pay, which is exactly the case a
	 * callback-only integration loses the order in.
	 */
	register_rest_route( 'kandi/v1', '/payments/ipn', array(
		'methods'             => array( 'GET', 'POST' ),
		'permission_callback' => '__return_true',
		'callback'            => function ( WP_REST_Request $request ) {
			$tracking  = sanitize_text_field( $request->get_param( 'OrderTrackingId' ) ?: $request->get_param( 'orderTrackingId' ) );
			$reference = sanitize_text_field( $request->get_param( 'OrderMerchantReference' ) ?: $request->get_param( 'orderMerchantReference' ) );

			if ( '' === $tracking ) {
				return rest_ensure_response( array( 'orderNotificationType' => 'IPNCHANGE', 'status' => 500 ) );
			}

			$config = kandi_pesapal_config();
			if ( ! $config ) {
				return rest_ensure_response( array( 'orderNotificationType' => 'IPNCHANGE', 'status' => 500 ) );
			}

			$status = kandi_pesapal_guard( function () use ( $config, $tracking ) {
				return kandi_pesapal_call(
					$config,
					'/api/Transactions/GetTransactionStatus?orderTrackingId=' . rawurlencode( $tracking )
				);
			} );

			if ( is_wp_error( $status ) ) {
				kandi_pesapal_log( 'IPN status lookup failed', $status->get_error_message() );
				// Answering 500 asks Pesapal to try again later.
				return rest_ensure_response( array( 'orderNotificationType' => 'IPNCHANGE', 'status' => 500 ) );
			}

			if ( '' === $reference ) {
				$reference = (string) ( $status['merchant_reference'] ?? get_transient( 'kandi_pp_' . $tracking ) );
			}

			kandi_pesapal_settle( $reference, $status );

			// Pesapal keeps retrying until it gets this shape back.
			return rest_ensure_response( array(
				'orderNotificationType' => 'IPNCHANGE',
				'orderTrackingId'       => $tracking,
				'orderMerchantReference' => $reference,
				'status'                => 200,
			) );
		},
	) );

	/* ---- GET /payments/status ----
	 *
	 * What the shopper's callback page asks after the payment window closes.
	 * Settles as a side effect, so a shopper who waits on the page does not
	 * depend on the IPN arriving first.
	 */
	register_rest_route( 'kandi/v1', '/payments/status', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_customer_check_secret',
		'callback'            => function ( WP_REST_Request $request ) {
			$config = kandi_pesapal_config();
			if ( ! $config ) {
				return new WP_Error( 'kandi_pesapal_off', 'Payments are not configured.', array( 'status' => 503 ) );
			}

			$tracking = sanitize_text_field( $request->get_param( 'tracking_id' ) );
			if ( '' === $tracking ) {
				return new WP_Error( 'kandi_no_tracking', 'No payment to check.', array( 'status' => 400 ) );
			}

			$status = kandi_pesapal_guard( function () use ( $config, $tracking ) {
				return kandi_pesapal_call(
					$config,
					'/api/Transactions/GetTransactionStatus?orderTrackingId=' . rawurlencode( $tracking )
				);
			} );
			if ( is_wp_error( $status ) ) {
				return $status;
			}

			$reference = (string) ( $status['merchant_reference'] ?? get_transient( 'kandi_pp_' . $tracking ) );
			$settled   = kandi_pesapal_settle( $reference, $status );
			$purpose   = kandi_pesapal_parse_reference( $reference );

			$description = (string) ( $status['payment_status_description'] ?? '' );

			return rest_ensure_response( array(
				'paid'        => 0 === strcasecmp( $description, 'Completed' ),
				'settled'     => (bool) $settled,
				'status'      => $description,
				'description' => (string) ( $status['description'] ?? '' ),
				'method'      => (string) ( $status['payment_method'] ?? '' ),
				'reference'   => $reference,
				'order_id'    => $purpose && 'order' === $purpose['kind'] ? $purpose['id'] : null,
			) );
		},
	) );
} );

/* -------------------------------------------------------------------------
 * 6. Diagnosis
 * ---------------------------------------------------------------------- */

/**
 * Walks the same chain a payment walks and reports where it stops.
 *
 * Written because the failure that prompted it was invisible: a payment died
 * somewhere between this server and Pesapal, and every layer in between — the
 * CDN, the host, PHP — answered with the same content-free `502`. Guessing
 * cost days. Each step below is one link in that chain, checked in order, and
 * the first FAIL is the answer.
 *
 * Nothing here charges anything or creates a payment.
 */
if ( ! function_exists( 'kandi_pesapal_diagnose' ) ) :
function kandi_pesapal_diagnose() {
	/**
	 * Prints one row and pushes it to the browser immediately.
	 *
	 * Deliberately not collected into an array and returned at the end: if a
	 * step kills the PHP process — which is the very failure being hunted — a
	 * returned array would never be printed and the screen would go blank. Row
	 * by row, the last line shown is the one that killed it.
	 */
	$add = function ( $name, $ok, $detail ) {
		printf(
			'<tr><td style="width:210px"><strong>%s</strong></td><td style="width:90px">%s</td><td>%s</td></tr>',
			esc_html( $name ),
			$ok ? '<span style="color:#0a7a2f;font-weight:600">PASS</span>' : '<span style="color:#a51f1f;font-weight:600">FAIL</span>',
			wp_kses_post( $detail )
		);
		// Out of PHP and down the wire now, not at the end of the request.
		if ( function_exists( 'ob_get_level' ) ) {
			while ( ob_get_level() > 0 ) {
				ob_end_flush();
			}
		}
		flush();
	};

	/* ---- The server itself ---- */

	$add(
		'PHP version',
		version_compare( PHP_VERSION, '7.2', '>=' ),
		esc_html( PHP_VERSION ) . ( version_compare( PHP_VERSION, '7.2', '>=' ) ? '' : ' — too old for this plugin; ask your host for PHP 7.4 or newer.' )
	);

	$curl = function_exists( 'curl_version' );
	$add(
		'cURL extension',
		$curl,
		$curl
			? esc_html( curl_version()['version'] ?? 'present' )
			: 'Missing. WordPress will fall back to PHP streams, which this plugin supports — but ask your host to enable <code>php-curl</code>.'
	);

	$ssl = extension_loaded( 'openssl' );
	$add(
		'OpenSSL',
		$ssl,
		$ssl ? 'present' : '<strong>Missing — no HTTPS is possible at all.</strong> Ask your host to enable <code>php-openssl</code>.'
	);

	$streams = (bool) ini_get( 'allow_url_fopen' );
	$add(
		'allow_url_fopen',
		$streams || $curl,
		$streams ? 'on' : 'off — fine as long as cURL works, since that is the other way out.'
	);

	/* ---- Can this server reach the internet at all? ---- */

	$blocked = defined( 'WP_HTTP_BLOCK_EXTERNAL' ) && WP_HTTP_BLOCK_EXTERNAL;
	$add(
		'External requests',
		! $blocked,
		$blocked
			? '<strong>Blocked by <code>WP_HTTP_BLOCK_EXTERNAL</code> in wp-config.php.</strong> Remove it, or add <code>pesapal.com</code> to <code>WP_ACCESSIBLE_HOSTS</code>.'
			: 'allowed'
	);

	$config = kandi_pesapal_config();
	$host   = $config ? $config['base'] : KANDI_PESAPAL_SANDBOX;

	// DNS first: a name that will not resolve is a different problem from a
	// connection that is refused, and the fixes are not the same.
	$hostname = wp_parse_url( $host, PHP_URL_HOST );
	$ip       = $hostname ? gethostbyname( $hostname ) : '';
	$resolved = $ip && $ip !== $hostname;
	$add(
		'DNS for ' . esc_html( (string) $hostname ),
		$resolved,
		$resolved ? esc_html( $ip ) : 'Could not resolve. The server has no working DNS, or outbound lookups are blocked.'
	);

	/* ---- The two ways out, tried separately ----
	 *
	 * Streams goes first, and cURL last, on purpose. A broken libcurl does not
	 * return an error — it takes the process with it — so if this page stops
	 * printing at the cURL row, that silence *is* the diagnosis, and everything
	 * above it has already reached the screen.
	 */

	$probe = array( 'timeout' => 15, 'method' => 'GET' );

	add_filter( 'use_curl_transport', '__return_false' );
	$via_streams = kandi_pesapal_guard( function () use ( $host, $probe ) {
		return wp_remote_request( $host, $probe );
	} );
	remove_filter( 'use_curl_transport', '__return_false' );

	$streams_ok = ! is_wp_error( $via_streams );
	$add(
		'HTTPS over PHP streams',
		$streams_ok,
		$streams_ok
			? 'HTTP ' . wp_remote_retrieve_response_code( $via_streams ) . ' — this route out works.'
			: esc_html( $via_streams->get_error_message() )
	);

	if ( $streams_ok ) {
		$add(
			'Recommended setting',
			true,
			'PHP streams can reach Pesapal. If payments have been failing with a blank error, set '
			. '<strong>Connection method → PHP streams only</strong> above and they should start working.'
		);
	}

	$curl_ok = false;
	if ( $curl ) {
		$add(
			'About to test cURL',
			true,
			'If this page stops here and shows nothing further, <strong>cURL on this server is what '
			. 'crashes payments</strong> — set <strong>Connection method → PHP streams only</strong> above.'
		);

		$via_curl = kandi_pesapal_guard( function () use ( $host, $probe ) {
			return wp_remote_request( $host, $probe );
		} );
		$curl_ok = ! is_wp_error( $via_curl );

		$add(
			'HTTPS over cURL',
			$curl_ok,
			$curl_ok
				? 'HTTP ' . wp_remote_retrieve_response_code( $via_curl )
				: esc_html( $via_curl->get_error_message() )
		);
	}

	if ( ! $streams_ok && ! $curl_ok ) {
		$add(
			'What this means',
			false,
			'<strong>This server cannot reach Pesapal by any route.</strong> That is a hosting matter, not a '
			. 'setting in WordPress. Send your host this line: <em>"Please allow outbound HTTPS (port 443) from '
			. 'PHP to pay.pesapal.com and cybqa.pesapal.com — our payment gateway is being blocked."</em>'
		);
		return;
	}

	/* ---- Pesapal's own answer ---- */

	if ( ! $config ) {
		$add( 'Pesapal credentials', false, 'No consumer key and secret saved yet.' );
		return;
	}

	$add(
		'Environment',
		true,
		$config['live']
			? '<strong>LIVE</strong> — these must be your live keys.'
			: 'Sandbox — these must be your sandbox keys. Live keys will be rejected here.'
	);

	delete_transient( 'kandi_pesapal_token' );
	$token = kandi_pesapal_guard( function () use ( $config ) {
		return kandi_pesapal_token( $config );
	} );

	$add(
		'Pesapal sign-in',
		! is_wp_error( $token ),
		is_wp_error( $token )
			? esc_html( $token->get_error_message() ) . ' — check the keys, and that they match the environment above.'
			: 'accepted'
	);

	if ( is_wp_error( $token ) ) {
		return;
	}

	$ipn = kandi_pesapal_guard( function () use ( $config ) {
		return kandi_pesapal_ipn_id( $config );
	} );

	$add(
		'IPN registration',
		! is_wp_error( $ipn ),
		is_wp_error( $ipn ) ? esc_html( $ipn->get_error_message() ) : '<code>' . esc_html( $ipn ) . '</code>'
	);

	if ( ! is_wp_error( $ipn ) ) {
		$add( 'Ready', true, '<strong>Payments should work.</strong> Try a real checkout.' );
	}

	return;
}
endif;

/* -------------------------------------------------------------------------
 * 7. Settings screen — wp-admin > Kandi Storefront > Pesapal
 * ---------------------------------------------------------------------- */

add_action( 'admin_menu', function () {
	add_submenu_page(
		'kandi-storefront',
		'Pesapal',
		'Pesapal',
		'manage_options',
		'kandi-pesapal',
		'kandi_pesapal_settings_page'
	);
}, 20 );

if ( ! function_exists( 'kandi_pesapal_settings_page' ) ) :
function kandi_pesapal_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'You do not have permission to manage payments.' );
	}

	$saved = false;

	if ( isset( $_POST['kandi_pesapal_nonce'] ) && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['kandi_pesapal_nonce'] ) ), 'kandi_pesapal_save' ) ) {
		$current = get_option( 'kandi_pesapal_settings', array() );
		$current = is_array( $current ) ? $current : array();

		// A blank key field means "leave it alone" — the inputs render empty on
		// every load, so treating blank as a value would wipe the credentials
		// on any save.
		foreach ( array( 'consumer_key', 'consumer_secret' ) as $field ) {
			$value = trim( (string) wp_unslash( $_POST[ $field ] ?? '' ) );
			if ( '' !== $value ) {
				$current[ $field ] = sanitize_text_field( $value );
			}
		}

		$current['environment'] = 'live' === ( $_POST['environment'] ?? '' ) ? 'live' : 'sandbox';
		$current['ipn_id']      = sanitize_text_field( wp_unslash( $_POST['ipn_id'] ?? '' ) );

		$transport = sanitize_text_field( wp_unslash( $_POST['transport'] ?? 'auto' ) );
		$current['transport'] = in_array( $transport, array( 'auto', 'streams', 'curl' ), true )
			? $transport
			: 'auto';

		update_option( 'kandi_pesapal_settings', $current );

		// The environment or the keys may have changed; nothing cached under
		// the old ones is still valid.
		delete_transient( 'kandi_pesapal_token' );
		delete_transient( 'kandi_pesapal_ipn_id' );

		$saved = true;
	}

	$settings = get_option( 'kandi_pesapal_settings', array() );
	$settings = is_array( $settings ) ? $settings : array();
	$config   = kandi_pesapal_config();
	?>
	<div class="wrap">
		<h1>Pesapal</h1>
		<p>Card and mobile money payments for the storefront. WordPress talks to Pesapal — the shop only asks it to.</p>

		<?php if ( $saved ) : ?>
			<div class="notice notice-success is-dismissible"><p>Saved.</p></div>
		<?php endif; ?>

		<?php if ( $config ) : ?>
			<div class="notice notice-info">
				<p>
					Payments are configured and pointing at
					<strong><?php echo $config['live'] ? 'LIVE — real money' : 'the sandbox — test money only'; ?></strong>.
					Your IPN URL is <code><?php echo esc_html( rest_url( 'kandi/v1/payments/ipn' ) ); ?></code>
				</p>
			</div>
		<?php else : ?>
			<div class="notice notice-warning">
				<p>Payments are <strong>not</strong> configured yet — the storefront will only offer cash on delivery.</p>
			</div>
		<?php endif; ?>

		<form method="post">
			<?php wp_nonce_field( 'kandi_pesapal_save', 'kandi_pesapal_nonce' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="consumer_key">Consumer key</label></th>
					<td>
						<input type="password" id="consumer_key" name="consumer_key" value="" class="regular-text" autocomplete="new-password"
							placeholder="<?php echo ! empty( $settings['consumer_key'] ) ? '•••••••• (saved — type to replace)' : 'From your Pesapal dashboard'; ?>">
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="consumer_secret">Consumer secret</label></th>
					<td>
						<input type="password" id="consumer_secret" name="consumer_secret" value="" class="regular-text" autocomplete="new-password"
							placeholder="<?php echo ! empty( $settings['consumer_secret'] ) ? '•••••••• (saved — type to replace)' : 'From your Pesapal dashboard'; ?>">
						<p class="description">Leave both blank to keep the keys you already saved.</p>
					</td>
				</tr>
				<tr>
					<th scope="row">Environment</th>
					<td>
						<label style="margin-right:16px">
							<input type="radio" name="environment" value="sandbox" <?php checked( 'live' !== ( $settings['environment'] ?? 'sandbox' ) ); ?>>
							Sandbox — test payments
						</label>
						<label>
							<input type="radio" name="environment" value="live" <?php checked( 'live' === ( $settings['environment'] ?? '' ) ); ?>>
							Live — real money
						</label>
						<p class="description">
							<strong>Sandbox keys do not work on live and live keys do not work on sandbox.</strong>
							A mismatch here is the most common cause of "payments are not working": Pesapal
							rejects the credentials and every payment fails before it starts.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row">Connection method</th>
					<td>
						<?php $transport = $settings['transport'] ?? 'auto'; ?>
						<label style="display:block;margin-bottom:6px">
							<input type="radio" name="transport" value="auto" <?php checked( 'auto', $transport ); ?>>
							<strong>Automatic</strong> — try PHP streams, fall back to cURL <em>(recommended)</em>
						</label>
						<label style="display:block;margin-bottom:6px">
							<input type="radio" name="transport" value="streams" <?php checked( 'streams', $transport ); ?>>
							<strong>PHP streams only</strong> — never use cURL
						</label>
						<label style="display:block">
							<input type="radio" name="transport" value="curl" <?php checked( 'curl', $transport ); ?>>
							cURL only
						</label>
						<p class="description">
							<strong>Automatic already avoids cURL wherever it can</strong>, because a
							broken cURL does not fail politely — it kills the whole PHP process, so
							nothing reaches any log and the shopper sees an empty 502. Streams is a
							separate route out of the server and is unaffected by that.
							<br>
							Pick <strong>PHP streams only</strong> if a 502 somehow persists, so cURL is
							never tried even as a fallback. <strong>cURL only</strong> is for hosts with
							<code>allow_url_fopen</code> turned off.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="ipn_id">IPN id</label></th>
					<td>
						<input type="text" id="ipn_id" name="ipn_id" value="<?php echo esc_attr( $settings['ipn_id'] ?? '' ); ?>" class="regular-text">
						<p class="description">
							Optional. Leave blank and this registers
							<code><?php echo esc_html( rest_url( 'kandi/v1/payments/ipn' ) ); ?></code>
							with Pesapal by itself and remembers the id. Fill it in only to pin one from
							your Pesapal dashboard.
						</p>
					</td>
				</tr>
			</table>

			<?php submit_button( 'Save payment settings' ); ?>
		</form>

		<h2>Test the connection</h2>
		<p>
			Runs the whole chain a real payment runs — the PHP extensions, this
			server's ability to reach the internet, and Pesapal's answer to these
			keys — and says which step fails. No money moves and no payment is
			created.
		</p>
		<form method="post">
			<?php wp_nonce_field( 'kandi_pesapal_test', 'kandi_pesapal_test_nonce' ); ?>
			<?php submit_button( 'Test Pesapal connection', 'secondary', 'kandi_pesapal_test', false ); ?>
		</form>

		<?php
		if ( isset( $_POST['kandi_pesapal_test'] ) && isset( $_POST['kandi_pesapal_test_nonce'] )
			&& wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['kandi_pesapal_test_nonce'] ) ), 'kandi_pesapal_test' ) ) {

			delete_transient( 'kandi_pesapal_token' );
			delete_transient( 'kandi_pesapal_use_streams' );

			echo '<h3>Diagnosis</h3><table class="widefat striped" style="max-width:900px"><tbody>';
			// Prints as it goes, so a step that kills the process still leaves
			// every row before it on the screen.
			kandi_pesapal_diagnose();
			echo '</tbody></table>';
		}
		?>
	</div>
	<?php
}
endif;
