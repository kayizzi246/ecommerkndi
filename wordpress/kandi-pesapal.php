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

const KANDI_PESAPAL_SANDBOX = 'https://cybqa.pesapal.com/pesapalv3';
const KANDI_PESAPAL_LIVE    = 'https://pay.pesapal.com/v3';

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

/** Writes to the WordPress debug log, prefixed so it can be grepped. */
function kandi_pesapal_log( $message, $context = null ) {
	if ( null !== $context ) {
		$message .= ' ' . wp_json_encode( $context );
	}
	error_log( '[kandi-pesapal] ' . $message );
}

/* -------------------------------------------------------------------------
 * 2. The Pesapal API
 * ---------------------------------------------------------------------- */

/**
 * An access token, cached for the four minutes Pesapal gives it minus a margin.
 *
 * Cached in a transient rather than a static: PHP hands each request its own
 * process, so a static would re-authenticate on every single call.
 */
function kandi_pesapal_token( $config ) {
	$cached = get_transient( 'kandi_pesapal_token' );
	if ( $cached ) {
		return $cached;
	}

	$response = wp_remote_post( $config['base'] . '/api/Auth/RequestToken', array(
		'timeout' => 20,
		'headers' => array( 'Content-Type' => 'application/json', 'Accept' => 'application/json' ),
		'body'    => wp_json_encode( array(
			'consumer_key'    => $config['key'],
			'consumer_secret' => $config['secret'],
		) ),
	) );

	if ( is_wp_error( $response ) ) {
		kandi_pesapal_log( 'token request failed', $response->get_error_message() );
		return new WP_Error( 'kandi_pesapal_unreachable', 'Could not reach Pesapal. Please try again.', array( 'status' => 502 ) );
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

/** One authenticated call to Pesapal. Returns the decoded body or a WP_Error. */
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

	$response = wp_remote_request( $config['base'] . $path, $args );

	if ( is_wp_error( $response ) ) {
		kandi_pesapal_log( 'call failed ' . $path, $response->get_error_message() );
		return new WP_Error( 'kandi_pesapal_unreachable', 'Could not reach Pesapal. Please try again.', array( 'status' => 502 ) );
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

/**
 * The IPN id to attach to payments.
 *
 * Prefers a pinned id, then looks for our URL among those already registered,
 * and only registers a new one when it is genuinely absent — otherwise every
 * payment would add another duplicate to the merchant account.
 */
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

/* -------------------------------------------------------------------------
 * 3. References
 *
 * The merchant reference encodes what is being paid for, so the IPN needs no
 * table of its own to know what it is confirming. Same format the storefront
 * used, so payments started before this plugin still settle.
 * ---------------------------------------------------------------------- */

function kandi_pesapal_reference( $kind, $id ) {
	return sprintf( '%s-%d-%s', 'order' === $kind ? 'ORD' : 'SEL', (int) $id, strtolower( base_convert( (string) time(), 10, 36 ) ) );
}

function kandi_pesapal_parse_reference( $reference ) {
	if ( ! preg_match( '/^(ORD|SEL)-(\d+)-/', (string) $reference, $match ) ) {
		return null;
	}
	return array(
		'kind' => 'ORD' === $match[1] ? 'order' : 'seller-fee',
		'id'   => (int) $match[2],
	);
}

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

			if ( ! in_array( $kind, array( 'order', 'seller-fee' ), true ) || $id <= 0 ) {
				return new WP_Error( 'kandi_pesapal_no_purpose', 'Nothing to pay for.', array( 'status' => 400 ) );
			}

			// The price, from our own records.
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

			$ipn_id = kandi_pesapal_ipn_id( $config );
			if ( is_wp_error( $ipn_id ) ) {
				return $ipn_id;
			}

			$storefront = function_exists( 'kandi_storefront_url' ) && kandi_storefront_url()
				? kandi_storefront_url()
				: home_url();

			$reference = kandi_pesapal_reference( $kind, $id );

			$result = kandi_pesapal_call( $config, '/api/Transactions/SubmitOrderRequest', 'POST', array(
				'id'              => $reference,
				'currency'        => function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'UGX',
				'amount'          => round( $amount, 2 ),
				'description'     => mb_substr( $description, 0, 100 ),
				'callback_url'    => $storefront . '/payment/callback',
				'cancellation_url' => $storefront . '/payment/callback?cancelled=1',
				'notification_id' => $ipn_id,
				'billing_address' => array_filter( $billing ),
			) );

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

			$status = kandi_pesapal_call(
				$config,
				'/api/Transactions/GetTransactionStatus?orderTrackingId=' . rawurlencode( $tracking )
			);

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

			$status = kandi_pesapal_call(
				$config,
				'/api/Transactions/GetTransactionStatus?orderTrackingId=' . rawurlencode( $tracking )
			);
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
 * 6. Settings screen — wp-admin > Kandi Storefront > Pesapal
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
		<p>Checks that Pesapal accepts these credentials. No money moves and no payment is created.</p>
		<form method="post">
			<?php wp_nonce_field( 'kandi_pesapal_test', 'kandi_pesapal_test_nonce' ); ?>
			<?php submit_button( 'Test Pesapal connection', 'secondary', 'kandi_pesapal_test', false ); ?>
		</form>

		<?php
		if ( isset( $_POST['kandi_pesapal_test'] ) && isset( $_POST['kandi_pesapal_test_nonce'] )
			&& wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['kandi_pesapal_test_nonce'] ) ), 'kandi_pesapal_test' ) ) {

			delete_transient( 'kandi_pesapal_token' );
			$config = kandi_pesapal_config();

			if ( ! $config ) {
				echo '<div class="notice notice-error"><p>No credentials saved yet.</p></div>';
			} else {
				$token = kandi_pesapal_token( $config );
				if ( is_wp_error( $token ) ) {
					printf(
						'<div class="notice notice-error"><p><strong>Failed:</strong> %s</p><p>Check the keys and that the environment above matches the keys you pasted.</p></div>',
						esc_html( $token->get_error_message() )
					);
				} else {
					$ipn = kandi_pesapal_ipn_id( $config );
					if ( is_wp_error( $ipn ) ) {
						printf(
							'<div class="notice notice-warning"><p>Signed in to Pesapal, but the IPN could not be registered: %s</p></div>',
							esc_html( $ipn->get_error_message() )
						);
					} else {
						printf(
							'<div class="notice notice-success"><p><strong>Working.</strong> Signed in to Pesapal (%s) and the IPN is registered as <code>%s</code>.</p></div>',
							$config['live'] ? 'live' : 'sandbox',
							esc_html( $ipn )
						);
					}
				}
			}
		}
		?>
	</div>
	<?php
}
