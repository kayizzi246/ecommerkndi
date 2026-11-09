<?php
/**
 * Plugin Name: Kandi Mobile API
 * Description: The Kandi app's account, addresses, orders and reward points, kept in WooCommerce. Shoppers sign in with Google through Supabase; this plugin checks that sign-in and does everything else.
 * Version: 1.0.0
 * Author: Kandi UG
 *
 * HOW THE APP WORKS
 *  - Products and categories: read from Supabase (kept in step by
 *    kandi-supabase-sync.php).
 *  - Sign-in: Google, through Supabase Auth.
 *  - Everything else: here, in WooCommerce. Every request carries the
 *    shopper's Supabase access token in `X-Kandi-Token`; this plugin asks
 *    Supabase who it belongs to and links it to a WooCommerce customer by
 *    email (creating the customer the first time).
 *
 * ROUTES (all under /wp-json/kandi/v1/mobile)
 *   GET    /me                 the shopper, their points and phone
 *   GET    /addresses          saved delivery addresses
 *   POST   /addresses          add or update one (send "id" to update)
 *   DELETE /addresses/{id}     remove one
 *   GET    /orders             their orders, newest first
 *   POST   /orders             place an order (cash on delivery or Pesapal)
 *   GET    /points             balance, rules and history
 *
 * SETTINGS (wp-config.php, or WooCommerce > Settings is not needed):
 *   define( 'KANDI_SUPABASE_URL',      'https://xxxx.supabase.co' );
 *   define( 'KANDI_SUPABASE_ANON_KEY', 'eyJ...' );   // the public anon key
 *   Optional: KANDI_CHECKOUT_SECRET (only if the website sets one; otherwise
 *   the shared KANDI_API_SECRET is used, as the website does).
 *   Or fill them in at Settings > Kandi Mobile App.
 *
 * Requires WooCommerce and the Kandi Store API plugin (1.1.0 or later).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( defined( 'KANDI_MOBILE_API_LOADED' ) ) {
	return;
}
define( 'KANDI_MOBILE_API_LOADED', true );

/* -------------------------------------------------------------------------
 * Settings
 * ---------------------------------------------------------------------- */

if ( ! function_exists( 'kandi_mobile_setting' ) ) :
function kandi_mobile_setting( $name ) {
	$constant = 'KANDI_' . strtoupper( $name );
	if ( defined( $constant ) && constant( $constant ) ) {
		return (string) constant( $constant );
	}
	return (string) get_option( 'kandi_mobile_' . $name, '' );
}
endif;

/** Points rules. 1 point per UGX 1,000 of items; 100 points = UGX 1,000 off. */
if ( ! function_exists( 'kandi_mobile_points_rules' ) ) :
function kandi_mobile_points_rules() {
	return apply_filters( 'kandi_mobile_points_rules', array(
		'ugx_per_point'      => 1000,
		'point_value_ugx'    => 10,
		'min_redeem_points'  => 100,
		'max_redeem_percent' => 50,
	) );
}
endif;

/* -------------------------------------------------------------------------
 * Who is asking: the Supabase sign-in, checked with Supabase itself
 * ---------------------------------------------------------------------- */

/**
 * The Supabase user behind a token, or null. Asked of Supabase directly (no
 * signature maths to get wrong), and remembered for five minutes so a screen
 * that makes three calls does not ask three times.
 */
if ( ! function_exists( 'kandi_mobile_supabase_user' ) ) :
function kandi_mobile_supabase_user( $token ) {
	$token = trim( (string) $token );
	if ( '' === $token ) {
		return null;
	}
	$cache_key = 'kandi_sb_user_' . md5( $token );
	$cached    = get_transient( $cache_key );
	if ( is_array( $cached ) ) {
		return $cached;
	}

	$base = untrailingslashit( kandi_mobile_setting( 'supabase_url' ) );
	$anon = kandi_mobile_setting( 'supabase_anon_key' );
	if ( '' === $base || '' === $anon ) {
		return null;
	}

	$response = wp_remote_get( $base . '/auth/v1/user', array(
		'timeout' => 10,
		'headers' => array(
			'apikey'        => $anon,
			'Authorization' => 'Bearer ' . $token,
		),
	) );
	if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
		return null;
	}
	$user = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( empty( $user['id'] ) || empty( $user['email'] ) ) {
		return null;
	}

	$meta    = isset( $user['user_metadata'] ) && is_array( $user['user_metadata'] ) ? $user['user_metadata'] : array();
	$shopper = array(
		'id'    => (string) $user['id'],
		'email' => sanitize_email( $user['email'] ),
		'name'  => sanitize_text_field( $meta['full_name'] ?? ( $meta['name'] ?? '' ) ),
	);
	set_transient( $cache_key, $shopper, 5 * MINUTE_IN_SECONDS );
	return $shopper;
}
endif;

/** The WooCommerce customer for a Supabase user, created on first use. */
if ( ! function_exists( 'kandi_mobile_customer_id' ) ) :
function kandi_mobile_customer_id( $shopper ) {
	$existing = get_user_by( 'email', $shopper['email'] );
	if ( $existing ) {
		update_user_meta( $existing->ID, '_kandi_supabase_id', $shopper['id'] );
		return (int) $existing->ID;
	}

	$parts = preg_split( '/\s+/', trim( $shopper['name'] ) );
	$first = $parts ? array_shift( $parts ) : '';
	$id    = wc_create_new_customer( $shopper['email'], '', wp_generate_password( 24 ), array(
		'first_name' => $first,
		'last_name'  => implode( ' ', (array) $parts ),
	) );
	if ( is_wp_error( $id ) ) {
		return 0;
	}
	update_user_meta( $id, '_kandi_supabase_id', $shopper['id'] );
	return (int) $id;
}
endif;

/** Permission callback: a valid sign-in, linked to a customer. */
if ( ! function_exists( 'kandi_mobile_permission' ) ) :
function kandi_mobile_permission( WP_REST_Request $request ) {
	$token = $request->get_header( 'x-kandi-token' );
	if ( ! $token ) {
		$auth  = (string) $request->get_header( 'authorization' );
		$token = 0 === stripos( $auth, 'bearer ' ) ? substr( $auth, 7 ) : '';
	}
	$shopper = kandi_mobile_supabase_user( $token );
	if ( ! $shopper ) {
		return new WP_Error( 'kandi_signed_out', 'Please sign in again.', array( 'status' => 401 ) );
	}
	$customer_id = kandi_mobile_customer_id( $shopper );
	if ( ! $customer_id ) {
		return new WP_Error( 'kandi_no_customer', 'Could not open your account.', array( 'status' => 500 ) );
	}
	$request->set_param( '_kandi_customer', $customer_id );
	$request->set_param( '_kandi_shopper', $shopper );
	return true;
}
endif;

/* -------------------------------------------------------------------------
 * Addresses (customer meta) and points (customer meta + history)
 * ---------------------------------------------------------------------- */

if ( ! function_exists( 'kandi_mobile_addresses' ) ) :
function kandi_mobile_addresses( $customer_id ) {
	$list = get_user_meta( $customer_id, '_kandi_app_addresses', true );
	return is_array( $list ) ? array_values( $list ) : array();
}
endif;

if ( ! function_exists( 'kandi_mobile_points' ) ) :
function kandi_mobile_points( $customer_id ) {
	return max( 0, (int) get_user_meta( $customer_id, '_kandi_points', true ) );
}
endif;

/**
 * Moves points and records why. Each (order, reason) happens at most once, so
 * a status changed twice cannot award twice. Returns false if it would take
 * the balance below zero.
 */
if ( ! function_exists( 'kandi_mobile_move_points' ) ) :
function kandi_mobile_move_points( $customer_id, $delta, $reason, $order_id = 0, $note = '' ) {
	$history = get_user_meta( $customer_id, '_kandi_points_history', true );
	$history = is_array( $history ) ? $history : array();
	if ( $order_id ) {
		foreach ( $history as $entry ) {
			if ( (int) ( $entry['order_id'] ?? 0 ) === (int) $order_id && ( $entry['reason'] ?? '' ) === $reason ) {
				return true; // already done
			}
		}
	}
	$balance = kandi_mobile_points( $customer_id ) + (int) $delta;
	if ( $balance < 0 ) {
		return false;
	}
	update_user_meta( $customer_id, '_kandi_points', $balance );
	array_unshift( $history, array(
		'delta'    => (int) $delta,
		'reason'   => $reason,
		'order_id' => (int) $order_id,
		'note'     => $note,
		'date'     => gmdate( 'c' ),
	) );
	update_user_meta( $customer_id, '_kandi_points_history', array_slice( $history, 0, 200 ) );
	return true;
}
endif;

/* Order status drives points: completed earns, cancelled/refunded/failed returns. */
add_action( 'woocommerce_order_status_changed', function ( $order_id, $from, $to, $order ) {
	if ( ! $order || ! $order->get_meta( '_kandi_mobile_order' ) ) {
		return;
	}
	$customer_id = (int) $order->get_customer_id();
	if ( ! $customer_id ) {
		return;
	}
	$rules    = kandi_mobile_points_rules();
	$redeemed = (int) $order->get_meta( '_kandi_points_redeemed' );

	if ( 'completed' === $to ) {
		$goods  = (float) $order->get_subtotal() - (float) ( $redeemed * $rules['point_value_ugx'] );
		$earned = (int) floor( max( 0, $goods ) / max( 1, $rules['ugx_per_point'] ) );
		if ( $earned > 0 && kandi_mobile_move_points( $customer_id, $earned, 'earned', $order_id, 'Order #' . $order->get_order_number() . ' delivered' ) ) {
			$order->update_meta_data( '_kandi_points_earned', $earned );
			$order->save_meta_data();
		}
	} elseif ( in_array( $to, array( 'cancelled', 'refunded', 'failed' ), true ) ) {
		if ( $redeemed > 0 ) {
			kandi_mobile_move_points( $customer_id, $redeemed, 'refund', $order_id, 'Order #' . $order->get_order_number() . ' ' . $to );
		}
		$earned = (int) $order->get_meta( '_kandi_points_earned' );
		if ( $earned > 0 ) {
			kandi_mobile_move_points( $customer_id, -min( $earned, kandi_mobile_points( $customer_id ) ), 'reversed', $order_id, 'Order #' . $order->get_order_number() . ' ' . $to );
		}
	}
}, 10, 4 );

/* -------------------------------------------------------------------------
 * Helpers for placing an order
 * ---------------------------------------------------------------------- */

if ( ! function_exists( 'kandi_mobile_site_url' ) ) :
function kandi_mobile_site_url() {
	$url = function_exists( 'kandi_storefront_url' ) ? kandi_storefront_url() : '';
	return '' !== $url ? $url : 'https://kandiug.com';
}
endif;

/** The website's own delivery quote, so the app is charged what the website charges. */
if ( ! function_exists( 'kandi_mobile_quote' ) ) :
function kandi_mobile_quote( $subtotal, $address ) {
	$has_point = isset( $address['lat'], $address['lng'] ) && is_numeric( $address['lat'] ) && is_numeric( $address['lng'] );
	$body      = $has_point
		? array( 'subtotal' => $subtotal, 'point' => array( 'lat' => (float) $address['lat'], 'lng' => (float) $address['lng'] ) )
		: array( 'subtotal' => $subtotal, 'address' => implode( ', ', array_filter( array( $address['street'] ?? '', $address['area'] ?? '', $address['city'] ?? '' ) ) ) );

	$response = wp_remote_post( kandi_mobile_site_url() . '/api/delivery/quote', array(
		'timeout' => 15,
		'headers' => array( 'Content-Type' => 'application/json' ),
		'body'    => wp_json_encode( $body ),
	) );
	if ( is_wp_error( $response ) ) {
		return null;
	}
	$quote = json_decode( wp_remote_retrieve_body( $response ), true );
	return is_array( $quote ) && isset( $quote['fee'] ) ? $quote : null;
}
endif;

if ( ! function_exists( 'kandi_mobile_km' ) ) :
function kandi_mobile_km( $lat1, $lng1, $lat2, $lng2 ) {
	$r    = M_PI / 180;
	$dlat = ( $lat2 - $lat1 ) * $r;
	$dlng = ( $lng2 - $lng1 ) * $r;
	$h    = sin( $dlat / 2 ) ** 2 + cos( $lat1 * $r ) * cos( $lat2 * $r ) * sin( $dlng / 2 ) ** 2;
	return 2 * 6371 * asin( sqrt( $h ) );
}
endif;

if ( ! function_exists( 'kandi_mobile_b64url' ) ) :
function kandi_mobile_b64url( $bytes ) {
	return rtrim( strtr( base64_encode( $bytes ), '+/', '-_' ), '=' );
}
endif;

/**
 * The payment token the website's /api/payments/pesapal/start accepts — the
 * same format as lib/checkout-token.ts, signed with the same secret.
 */
if ( ! function_exists( 'kandi_mobile_payment_token' ) ) :
function kandi_mobile_payment_token( $order_id ) {
	$secret = kandi_mobile_setting( 'checkout_secret' );
	if ( '' === $secret && function_exists( 'kandi_shared_secret' ) ) {
		$secret = kandi_shared_secret();
	}
	if ( '' === $secret ) {
		return '';
	}
	$payload = kandi_mobile_b64url( wp_json_encode( array( 'k' => 'order', 'i' => (int) $order_id, 'e' => time() + HOUR_IN_SECONDS ) ) );
	return $payload . '.' . kandi_mobile_b64url( hash_hmac( 'sha256', $payload, $secret, true ) );
}
endif;

/** The shape an order takes in the app. */
if ( ! function_exists( 'kandi_mobile_order_row' ) ) :
function kandi_mobile_order_row( $order ) {
	$items = array();
	foreach ( $order->get_items() as $item ) {
		$product = $item->get_product();
		$image   = $product ? wp_get_attachment_image_url( $product->get_image_id(), 'thumbnail' ) : '';
		$items[] = array(
			'name'     => $item->get_name(),
			'quantity' => (int) $item->get_quantity(),
			'total'    => (float) $item->get_total(),
			'image'    => $image ? $image : '',
		);
	}
	return array(
		'id'            => $order->get_id(),
		'number'        => (string) $order->get_order_number(),
		'status'        => $order->get_status(),
		'total'         => (float) $order->get_total(),
		'created_at'    => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : null,
		'items'         => $items,
		'points_earned' => (int) $order->get_meta( '_kandi_points_earned' ),
	);
}
endif;

/* -------------------------------------------------------------------------
 * Routes
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', function () {
	$ns   = 'kandi/v1';
	$auth = 'kandi_mobile_permission';

	register_rest_route( $ns, '/mobile/me', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => $auth,
		'callback'            => function ( WP_REST_Request $request ) {
			$id      = (int) $request->get_param( '_kandi_customer' );
			$shopper = $request->get_param( '_kandi_shopper' );
			$user    = get_userdata( $id );
			return rest_ensure_response( array(
				'email'  => $shopper['email'],
				'name'   => trim( ( $user ? $user->first_name . ' ' . $user->last_name : '' ) ) ?: $shopper['name'],
				'phone'  => (string) get_user_meta( $id, 'billing_phone', true ),
				'points' => kandi_mobile_points( $id ),
			) );
		},
	) );

	register_rest_route( $ns, '/mobile/addresses', array(
		array(
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => $auth,
			'callback'            => function ( WP_REST_Request $request ) {
				return rest_ensure_response( array( 'addresses' => kandi_mobile_addresses( (int) $request->get_param( '_kandi_customer' ) ) ) );
			},
		),
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'permission_callback' => $auth,
			'callback'            => function ( WP_REST_Request $request ) {
				$id   = (int) $request->get_param( '_kandi_customer' );
				$body = (array) $request->get_json_params();
				$row  = array(
					'id'        => sanitize_key( $body['id'] ?? '' ) ?: wp_generate_uuid4(),
					'label'     => sanitize_text_field( $body['label'] ?? 'Home' ) ?: 'Home',
					'recipient' => sanitize_text_field( $body['recipient'] ?? '' ),
					'phone'     => sanitize_text_field( $body['phone'] ?? '' ),
					'street'    => sanitize_text_field( $body['street'] ?? '' ),
					'area'      => sanitize_text_field( $body['area'] ?? '' ),
					'city'      => sanitize_text_field( $body['city'] ?? 'Kampala' ) ?: 'Kampala',
					'landmark'  => sanitize_text_field( $body['landmark'] ?? '' ),
					'lat'       => isset( $body['lat'] ) && is_numeric( $body['lat'] ) ? (float) $body['lat'] : null,
					'lng'       => isset( $body['lng'] ) && is_numeric( $body['lng'] ) ? (float) $body['lng'] : null,
				);
				if ( '' === $row['recipient'] || '' === $row['phone'] || '' === $row['street'] ) {
					return new WP_Error( 'kandi_bad_address', 'Fill in the name, phone and street.', array( 'status' => 400 ) );
				}
				$list  = array_values( array_filter( kandi_mobile_addresses( $id ), function ( $a ) use ( $row ) {
					return ( $a['id'] ?? '' ) !== $row['id'];
				} ) );
				array_unshift( $list, $row );
				update_user_meta( $id, '_kandi_app_addresses', array_slice( $list, 0, 20 ) );
				update_user_meta( $id, 'billing_phone', $row['phone'] );
				return rest_ensure_response( array( 'address' => $row ) );
			},
		),
	) );

	register_rest_route( $ns, '/mobile/addresses/(?P<address>[a-z0-9\-]+)', array(
		'methods'             => WP_REST_Server::DELETABLE,
		'permission_callback' => $auth,
		'callback'            => function ( WP_REST_Request $request ) {
			$id     = (int) $request->get_param( '_kandi_customer' );
			$remove = (string) $request['address'];
			$list   = array_values( array_filter( kandi_mobile_addresses( $id ), function ( $a ) use ( $remove ) {
				return ( $a['id'] ?? '' ) !== $remove;
			} ) );
			update_user_meta( $id, '_kandi_app_addresses', $list );
			return rest_ensure_response( array( 'ok' => true ) );
		},
	) );

	register_rest_route( $ns, '/mobile/points', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => $auth,
		'callback'            => function ( WP_REST_Request $request ) {
			$id      = (int) $request->get_param( '_kandi_customer' );
			$history = get_user_meta( $id, '_kandi_points_history', true );
			return rest_ensure_response( array(
				'balance' => kandi_mobile_points( $id ),
				'rules'   => kandi_mobile_points_rules(),
				'history' => is_array( $history ) ? $history : array(),
			) );
		},
	) );

	register_rest_route( $ns, '/mobile/orders', array(
		array(
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => $auth,
			'callback'            => function ( WP_REST_Request $request ) {
				$orders = wc_get_orders( array(
					'customer_id' => (int) $request->get_param( '_kandi_customer' ),
					'limit'       => 50,
					'orderby'     => 'date',
					'order'       => 'DESC',
					'status'      => array( 'pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed' ),
				) );
				return rest_ensure_response( array( 'orders' => array_map( 'kandi_mobile_order_row', $orders ) ) );
			},
		),
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'permission_callback' => $auth,
			'callback'            => 'kandi_mobile_place_order',
		),
	) );
} );

/**
 * POST /mobile/orders
 *   { items: [{product_id, variation_id?, quantity, options?}], address_id,
 *     payment_method: "cod"|"pesapal", redeem_points?, notes? }
 *
 * Creates the order through the same kandi/v1/orders endpoint the website
 * uses (prices, stock and the delivery line all behave the same), then links
 * it to the customer and applies points.
 */
if ( ! function_exists( 'kandi_mobile_place_order' ) ) :
function kandi_mobile_place_order( WP_REST_Request $request ) {
	$customer_id = (int) $request->get_param( '_kandi_customer' );
	$shopper     = $request->get_param( '_kandi_shopper' );
	$body        = (array) $request->get_json_params();
	$method      = 'pesapal' === ( $body['payment_method'] ?? '' ) ? 'pesapal' : 'cod';

	// The address, from the customer's own saved list.
	$address = null;
	foreach ( kandi_mobile_addresses( $customer_id ) as $saved ) {
		if ( ( $saved['id'] ?? '' ) === (string) ( $body['address_id'] ?? '' ) ) {
			$address = $saved;
		}
	}
	if ( ! $address ) {
		return new WP_Error( 'kandi_no_address', 'Choose a delivery address.', array( 'status' => 400 ) );
	}

	// The items, priced from the store for the quote and the points cap.
	$lines    = array();
	$subtotal = 0.0;
	foreach ( array_slice( (array) ( $body['items'] ?? array() ), 0, 50 ) as $item ) {
		$product_id   = (int) ( $item['product_id'] ?? 0 );
		$variation_id = (int) ( $item['variation_id'] ?? 0 );
		$quantity     = min( 20, max( 1, (int) ( $item['quantity'] ?? 1 ) ) );
		$product      = wc_get_product( $variation_id ? $variation_id : $product_id );
		if ( ! $product || ! $product->is_purchasable() || ! $product->is_in_stock() ) {
			return new WP_Error( 'kandi_unavailable', 'An item in your cart is no longer available.', array( 'status' => 409 ) );
		}
		$subtotal += (float) $product->get_price() * $quantity;
		$lines[]   = array(
			'product_id'   => $product_id,
			'variation_id' => $variation_id ? $variation_id : null,
			'quantity'     => $quantity,
			'options'      => is_array( $item['options'] ?? null ) ? $item['options'] : array(),
		);
	}
	if ( empty( $lines ) ) {
		return new WP_Error( 'kandi_empty', 'Your cart is empty.', array( 'status' => 400 ) );
	}

	// Delivery, priced by the website exactly as its own checkout does.
	$quote = kandi_mobile_quote( $subtotal, $address );
	if ( ! $quote ) {
		return new WP_Error( 'kandi_no_quote', 'We could not price delivery to that address.', array( 'status' => 422 ) );
	}
	if ( isset( $quote['deliverable'] ) && false === $quote['deliverable'] ) {
		return new WP_Error( 'kandi_far', 'We do not deliver to that address yet.', array( 'status' => 422 ) );
	}
	$point = ( isset( $address['lat'], $address['lng'] ) && null !== $address['lat'] )
		? array( 'lat' => (float) $address['lat'], 'lng' => (float) $address['lng'] )
		: ( isset( $quote['point']['lat'] ) ? array( 'lat' => (float) $quote['point']['lat'], 'lng' => (float) $quote['point']['lng'] ) : null );

	// Cash on delivery only within 40 km of central Kampala (the website's rule).
	if ( 'cod' === $method && ( ! $point || kandi_mobile_km( 0.3476, 32.5825, $point['lat'], $point['lng'] ) > 40 ) ) {
		return new WP_Error( 'kandi_no_cod', 'Cash on delivery is available within 40 km of central Kampala. Please pay with Mobile Money or card.', array( 'status' => 422 ) );
	}

	// Points.
	$rules  = kandi_mobile_points_rules();
	$cap    = (int) floor( $subtotal * $rules['max_redeem_percent'] / 100 / max( 1, $rules['point_value_ugx'] ) );
	$redeem = min( max( 0, (int) ( $body['redeem_points'] ?? 0 ) ), kandi_mobile_points( $customer_id ), $cap );
	if ( $redeem < $rules['min_redeem_points'] ) {
		$redeem = 0;
	}
	$discount = $redeem * $rules['point_value_ugx'];

	// The order, through the website's own order endpoint.
	$name  = preg_split( '/\s+/', trim( $address['recipient'] ) );
	$inner = new WP_REST_Request( 'POST', '/kandi/v1/orders' );
	$inner->set_header( 'content-type', 'application/json' );
	$inner->set_header( 'x-kandi-secret', function_exists( 'kandi_shared_secret' ) ? kandi_shared_secret() : '' );
	$inner->set_body( wp_json_encode( array(
		'customer'         => array(
			'first_name' => array_shift( $name ),
			'last_name'  => implode( ' ', $name ),
			'email'      => $shopper['email'],
			'phone'      => $address['phone'],
			'address_1'  => trim( $address['street'] . ( $address['landmark'] ? ', ' . $address['landmark'] : '' ) ),
			'address_2'  => $address['area'],
			'city'       => $address['city'],
			'country'    => 'UG',
			'notes'      => sanitize_textarea_field( (string) ( $body['notes'] ?? '' ) ),
		),
		'line_items'       => $lines,
		'payment_method'   => $method,
		'awaiting_payment' => 'pesapal' === $method,
		'shipping'         => array( 'label' => 'Delivery (' . ( $quote['label'] ?? 'Kandi' ) . ')', 'total' => (float) $quote['fee'] ),
		'delivery_point'   => $point,
		'discount'         => $discount > 0 ? array( 'label' => 'Kandi points (' . $redeem . ')', 'amount' => $discount ) : null,
	) ) );
	$response = rest_do_request( $inner );
	$result   = $response->get_data();
	if ( $response->is_error() || empty( $result['id'] ) ) {
		$message = is_array( $result ) && ! empty( $result['message'] ) ? $result['message'] : 'The shop could not take your order right now.';
		return new WP_Error( 'kandi_order_failed', $message, array( 'status' => 409 ) );
	}

	$order = wc_get_order( (int) $result['id'] );
	$order->set_customer_id( $customer_id );
	$order->set_created_via( 'kandi-app' );
	$order->update_meta_data( '_kandi_mobile_order', 1 );
	if ( $redeem > 0 ) {
		if ( ! kandi_mobile_move_points( $customer_id, -$redeem, 'redeemed', $order->get_id(), 'Used on order #' . $order->get_order_number() ) ) {
			$order->update_status( 'cancelled', 'Not enough points.' );
			return new WP_Error( 'kandi_points', 'You do not have enough points for that.', array( 'status' => 409 ) );
		}
		$order->update_meta_data( '_kandi_points_redeemed', $redeem );
	}
	$order->save();

	return rest_ensure_response( array(
		'order_id'      => $order->get_id(),
		'number'        => (string) $order->get_order_number(),
		'status'        => $order->get_status(),
		'total'         => (float) $order->get_total(),
		'delivery_fee'  => (float) $quote['fee'],
		'discount'      => (float) $discount,
		'payment_token' => 'pesapal' === $method ? kandi_mobile_payment_token( $order->get_id() ) : '',
	) );
}
endif;

/* -------------------------------------------------------------------------
 * Settings > Kandi Mobile App
 * ---------------------------------------------------------------------- */

add_action( 'admin_menu', function () {
	add_options_page( 'Kandi Mobile App', 'Kandi Mobile App', 'manage_options', 'kandi-mobile', function () {
		if ( isset( $_POST['kandi_mobile_save'] ) && check_admin_referer( 'kandi_mobile' ) ) {
			update_option( 'kandi_mobile_supabase_url', esc_url_raw( wp_unslash( $_POST['supabase_url'] ?? '' ) ) );
			update_option( 'kandi_mobile_supabase_anon_key', sanitize_text_field( wp_unslash( $_POST['supabase_anon_key'] ?? '' ) ) );
			$checkout = sanitize_text_field( wp_unslash( $_POST['checkout_secret'] ?? '' ) );
			if ( '' !== $checkout ) {
				update_option( 'kandi_mobile_checkout_secret', $checkout, false );
			}
			echo '<div class="notice notice-success"><p>Saved.</p></div>';
		}
		?>
		<div class="wrap">
			<h1>Kandi Mobile App</h1>
			<p>The app signs shoppers in with Google through Supabase. These two values let WordPress check that sign-in.</p>
			<form method="post">
				<?php wp_nonce_field( 'kandi_mobile' ); ?>
				<table class="form-table" role="presentation">
					<tr><th><label for="supabase_url">Supabase project URL</label></th>
						<td><input class="regular-text" id="supabase_url" name="supabase_url" value="<?php echo esc_attr( kandi_mobile_setting( 'supabase_url' ) ); ?>" placeholder="https://xxxx.supabase.co" /></td></tr>
					<tr><th><label for="supabase_anon_key">Supabase anon key</label></th>
						<td><input class="large-text" id="supabase_anon_key" name="supabase_anon_key" value="<?php echo esc_attr( kandi_mobile_setting( 'supabase_anon_key' ) ); ?>" /></td></tr>
					<tr><th><label for="checkout_secret">Checkout secret (optional)</label></th>
						<td><input class="regular-text" type="password" id="checkout_secret" name="checkout_secret" placeholder="Only if the website sets KANDI_CHECKOUT_SECRET" /></td></tr>
				</table>
				<?php submit_button( 'Save', 'primary', 'kandi_mobile_save' ); ?>
			</form>
		</div>
		<?php
	} );
} );
