<?php
/**
 * Plugin Name: Kandi Seller Centre
 * Description: Multi-vendor backend for the Kandi storefront — seller registration and approval, seller-owned products, per-order commission ledger, payout requests, and a wp-admin panel to monitor it all. Exposes the kandi/v1/seller/* REST API consumed by the Next.js Seller Centre.
 * Version: 1.0.0
 * Author: Kandi UG
 * Requires Plugins: woocommerce
 *
 * HOW TO INSTALL
 *  Upload this file to wp-content/plugins/kandi-seller-api/kandi-seller-api.php and
 *  activate "Kandi Seller Centre" in wp-admin > Plugins. (Activation creates the two
 *  ledger tables; if you paste this into the Code Snippets plugin instead, the tables
 *  are created on the next page load by kandi_seller_maybe_install().)
 *
 *  Add the shared secret to wp-config.php — it must match KANDI_API_SECRET in the
 *  Next.js .env.local, and it is what proves a request came from your storefront:
 *      define( 'KANDI_API_SECRET', 'a-long-random-string' );
 *
 * Requires WooCommerce, and the companion "Kandi Store API" plugin for the
 * storefront's product endpoints.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'KANDI_SELLER_DB_VERSION', '1.0.0' );
define( 'KANDI_SELLER_ROLE', 'kandi_seller' );
define( 'KANDI_SELLER_TOKEN_TTL', 14 * DAY_IN_SECONDS );

/* -------------------------------------------------------------------------
 * 1. Install — roles and ledger tables
 * ---------------------------------------------------------------------- */

function kandi_seller_commissions_table() {
	global $wpdb;
	return $wpdb->prefix . 'kandi_commissions';
}

function kandi_seller_payouts_table() {
	global $wpdb;
	return $wpdb->prefix . 'kandi_payouts';
}

/**
 * Creates the seller role and the two ledger tables. Safe to call repeatedly —
 * dbDelta only applies differences.
 */
function kandi_seller_install() {
	global $wpdb;

	add_role(
		KANDI_SELLER_ROLE,
		'Kandi Seller',
		array(
			'read'                   => true,
			'upload_files'           => true,
			'edit_posts'             => false,
			'kandi_manage_own_store' => true,
		)
	);

	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	$charset = $wpdb->get_charset_collate();

	$commissions = kandi_seller_commissions_table();
	dbDelta(
		"CREATE TABLE {$commissions} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			seller_id BIGINT UNSIGNED NOT NULL,
			order_id BIGINT UNSIGNED NOT NULL,
			order_item_id BIGINT UNSIGNED NOT NULL,
			product_id BIGINT UNSIGNED NOT NULL,
			qty INT NOT NULL DEFAULT 1,
			gross DECIMAL(18,4) NOT NULL DEFAULT 0,
			rate DECIMAL(6,3) NOT NULL DEFAULT 0,
			commission DECIMAL(18,4) NOT NULL DEFAULT 0,
			net DECIMAL(18,4) NOT NULL DEFAULT 0,
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			created_at DATETIME NOT NULL,
			paid_at DATETIME NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY order_item (order_item_id),
			KEY seller_created (seller_id, created_at),
			KEY seller_status (seller_id, status)
		) {$charset};"
	);

	$payouts = kandi_seller_payouts_table();
	dbDelta(
		"CREATE TABLE {$payouts} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			seller_id BIGINT UNSIGNED NOT NULL,
			amount DECIMAL(18,4) NOT NULL DEFAULT 0,
			method VARCHAR(80) NOT NULL DEFAULT '',
			account VARCHAR(120) NOT NULL DEFAULT '',
			status VARCHAR(20) NOT NULL DEFAULT 'requested',
			note TEXT NULL,
			requested_at DATETIME NOT NULL,
			paid_at DATETIME NULL,
			PRIMARY KEY  (id),
			KEY seller_status (seller_id, status)
		) {$charset};"
	);

	update_option( 'kandi_seller_db_version', KANDI_SELLER_DB_VERSION );

	if ( false === get_option( 'kandi_default_commission_rate' ) ) {
		add_option( 'kandi_default_commission_rate', 12 );
	}
	if ( false === get_option( 'kandi_seller_auto_approve_products' ) ) {
		add_option( 'kandi_seller_auto_approve_products', 0 );
	}
}
register_activation_hook( __FILE__, 'kandi_seller_install' );

/** Covers the Code Snippets install path, where the activation hook never runs. */
function kandi_seller_maybe_install() {
	if ( get_option( 'kandi_seller_db_version' ) !== KANDI_SELLER_DB_VERSION ) {
		kandi_seller_install();
	}
}
add_action( 'plugins_loaded', 'kandi_seller_maybe_install' );

/* -------------------------------------------------------------------------
 * 2. Seller profile helpers
 * ---------------------------------------------------------------------- */

function kandi_default_commission_rate() {
	return (float) get_option( 'kandi_default_commission_rate', 12 );
}

function kandi_is_seller( $user_id ) {
	$user = get_userdata( $user_id );
	return $user && in_array( KANDI_SELLER_ROLE, (array) $user->roles, true );
}

/** Shapes a WP user into the seller object the Next.js client expects. */
function kandi_format_seller( $user_id ) {
	$user = get_userdata( $user_id );
	if ( ! $user ) {
		return null;
	}

	return array(
		'id'              => (int) $user->ID,
		'store_name'      => (string) get_user_meta( $user->ID, '_kandi_store_name', true ),
		'store_slug'      => (string) get_user_meta( $user->ID, '_kandi_store_slug', true ),
		'email'           => $user->user_email,
		'phone'           => (string) get_user_meta( $user->ID, '_kandi_phone', true ),
		'owner_name'      => (string) get_user_meta( $user->ID, '_kandi_owner_name', true ),
		'status'          => (string) ( get_user_meta( $user->ID, '_kandi_status', true ) ?: 'pending' ),
		'commission_rate' => (float) ( get_user_meta( $user->ID, '_kandi_commission_rate', true ) ?: kandi_default_commission_rate() ),
		'payout_method'   => (string) get_user_meta( $user->ID, '_kandi_payout_method', true ),
		'payout_account'  => (string) get_user_meta( $user->ID, '_kandi_payout_account', true ),
		'registered_at'   => mysql2date( 'c', $user->user_registered ),
		'logo'            => (string) get_user_meta( $user->ID, '_kandi_logo', true ),
	);
}

function kandi_seller_commission_rate( $seller_id ) {
	$rate = get_user_meta( $seller_id, '_kandi_commission_rate', true );
	return '' === $rate ? kandi_default_commission_rate() : (float) $rate;
}

/* -------------------------------------------------------------------------
 * 3. Authentication — shared secret + bearer token
 * ---------------------------------------------------------------------- */

function kandi_seller_secret() {
	if ( defined( 'KANDI_API_SECRET' ) ) {
		return KANDI_API_SECRET;
	}
	return (string) get_option( 'kandi_api_secret', '' );
}

/** True when the caller presented the storefront's shared secret. */
function kandi_seller_check_secret( WP_REST_Request $request ) {
	$secret = kandi_seller_secret();
	if ( empty( $secret ) ) {
		return new WP_Error( 'kandi_no_secret', 'KANDI_API_SECRET is not configured on the server.', array( 'status' => 500 ) );
	}
	$sent = (string) $request->get_header( 'x-kandi-secret' );
	if ( '' === $sent || ! hash_equals( $secret, $sent ) ) {
		return new WP_Error( 'kandi_forbidden', 'Invalid API secret.', array( 'status' => 403 ) );
	}
	return true;
}

function kandi_seller_token_key( $token ) {
	return 'kandi_seller_tok_' . hash( 'sha256', $token );
}

function kandi_seller_issue_token( $user_id ) {
	$token = bin2hex( random_bytes( 32 ) );
	set_transient( kandi_seller_token_key( $token ), (int) $user_id, KANDI_SELLER_TOKEN_TTL );
	return $token;
}

function kandi_seller_bearer_token( WP_REST_Request $request ) {
	$header = (string) $request->get_header( 'authorization' );
	if ( 0 === stripos( $header, 'bearer ' ) ) {
		return trim( substr( $header, 7 ) );
	}
	return '';
}

/** Resolves the seller behind the bearer token, or 0. */
function kandi_seller_current_id( WP_REST_Request $request ) {
	$token = kandi_seller_bearer_token( $request );
	if ( '' === $token ) {
		return 0;
	}
	$user_id = (int) get_transient( kandi_seller_token_key( $token ) );
	return kandi_is_seller( $user_id ) ? $user_id : 0;
}

/** Permission callback for public seller endpoints (register, login). */
function kandi_seller_public_permission( WP_REST_Request $request ) {
	return kandi_seller_check_secret( $request );
}

/** Permission callback for everything that acts on a signed-in seller. */
function kandi_seller_permission( WP_REST_Request $request ) {
	$secret = kandi_seller_check_secret( $request );
	if ( is_wp_error( $secret ) ) {
		return $secret;
	}

	$seller_id = kandi_seller_current_id( $request );
	if ( ! $seller_id ) {
		return new WP_Error( 'kandi_unauthorised', 'Your session has expired. Please sign in again.', array( 'status' => 401 ) );
	}

	$status = get_user_meta( $seller_id, '_kandi_status', true );
	if ( 'suspended' === $status || 'rejected' === $status ) {
		return new WP_Error( 'kandi_store_blocked', 'This seller account is not active. Contact Kandi support.', array( 'status' => 403 ) );
	}

	return true;
}

/* -------------------------------------------------------------------------
 * 4. Date-range parsing shared by stats and commissions
 * ---------------------------------------------------------------------- */

/**
 * Turns "7d" / "30d" / "90d" / "mtd" / "ytd" into a start/end pair plus the
 * equally long preceding window used for the change figures.
 */
function kandi_parse_range( $range ) {
	$now   = current_time( 'timestamp' );
	$end   = $now;
	$range = is_string( $range ) ? strtolower( $range ) : '30d';

	switch ( $range ) {
		case '7d':
			$start = strtotime( '-6 days', strtotime( gmdate( 'Y-m-d', $now ) ) );
			break;
		case '90d':
			$start = strtotime( '-89 days', strtotime( gmdate( 'Y-m-d', $now ) ) );
			break;
		case 'mtd':
			$start = strtotime( gmdate( 'Y-m-01', $now ) );
			break;
		case 'ytd':
			$start = strtotime( gmdate( 'Y-01-01', $now ) );
			break;
		case '30d':
		default:
			$start = strtotime( '-29 days', strtotime( gmdate( 'Y-m-d', $now ) ) );
			break;
	}

	$span              = max( DAY_IN_SECONDS, $end - $start );
	$previous_end      = $start - 1;
	$previous_start    = $start - $span;

	return array(
		'start'          => gmdate( 'Y-m-d H:i:s', $start ),
		'end'            => gmdate( 'Y-m-d H:i:s', $end ),
		'previous_start' => gmdate( 'Y-m-d H:i:s', $previous_start ),
		'previous_end'   => gmdate( 'Y-m-d H:i:s', $previous_end ),
		'start_ts'       => $start,
		'end_ts'         => $end,
	);
}

function kandi_percent_change( $current, $previous ) {
	if ( $previous <= 0 ) {
		return $current > 0 ? 100.0 : 0.0;
	}
	return round( ( ( $current - $previous ) / $previous ) * 100, 1 );
}

/* -------------------------------------------------------------------------
 * 5. Commission ledger — written from WooCommerce order status changes
 * ---------------------------------------------------------------------- */

/**
 * Writes one ledger row per order line item that belongs to a seller.
 * Keyed on order_item_id, so re-running on a later status change is a no-op.
 */
function kandi_record_order_commissions( $order_id ) {
	global $wpdb;

	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return;
	}

	$table = kandi_seller_commissions_table();

	foreach ( $order->get_items() as $item_id => $item ) {
		$product_id = $item->get_product_id();
		$seller_id  = (int) get_post_meta( $product_id, '_kandi_seller_id', true );

		if ( ! $seller_id || ! kandi_is_seller( $seller_id ) ) {
			continue;
		}

		$exists = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT id FROM {$table} WHERE order_item_id = %d", $item_id )
		);
		if ( $exists ) {
			continue;
		}

		$gross      = (float) $item->get_total() + (float) $item->get_total_tax();
		$rate       = kandi_seller_commission_rate( $seller_id );
		$commission = round( $gross * ( $rate / 100 ), 2 );

		$wpdb->insert(
			$table,
			array(
				'seller_id'     => $seller_id,
				'order_id'      => $order->get_id(),
				'order_item_id' => $item_id,
				'product_id'    => $product_id,
				'qty'           => (int) $item->get_quantity(),
				'gross'         => $gross,
				'rate'          => $rate,
				'commission'    => $commission,
				'net'           => round( $gross - $commission, 2 ),
				'status'        => 'pending',
				'created_at'    => $order->get_date_created()
					? $order->get_date_created()->date( 'Y-m-d H:i:s' )
					: current_time( 'mysql' ),
			),
			array( '%d', '%d', '%d', '%d', '%d', '%f', '%f', '%f', '%f', '%s', '%s' )
		);
	}
}

/** Moves an order's ledger rows between pending / payable / cancelled. */
function kandi_sync_commission_status( $order_id, $new_status ) {
	global $wpdb;
	$table = kandi_seller_commissions_table();

	if ( in_array( $new_status, array( 'cancelled', 'refunded', 'failed' ), true ) ) {
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET status = 'cancelled' WHERE order_id = %d AND status <> 'paid'",
				$order_id
			)
		);
		return;
	}

	if ( 'completed' === $new_status ) {
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET status = 'payable' WHERE order_id = %d AND status = 'pending'",
				$order_id
			)
		);
		return;
	}

	// Back to an in-flight status (processing, on-hold): re-open cancelled rows.
	$wpdb->query(
		$wpdb->prepare(
			"UPDATE {$table} SET status = 'pending' WHERE order_id = %d AND status = 'cancelled'",
			$order_id
		)
	);
}

add_action(
	'woocommerce_order_status_changed',
	function ( $order_id, $from_status, $to_status ) {
		if ( in_array( $to_status, array( 'processing', 'on-hold', 'completed' ), true ) ) {
			kandi_record_order_commissions( $order_id );
		}
		kandi_sync_commission_status( $order_id, $to_status );
	},
	10,
	3
);

/* -------------------------------------------------------------------------
 * 6. Product formatting for the Seller Centre
 * ---------------------------------------------------------------------- */

function kandi_format_seller_product( $product ) {
	$image_id = $product->get_image_id();

	$categories = array();
	$terms      = get_the_terms( $product->get_id(), 'product_cat' );
	if ( $terms && ! is_wp_error( $terms ) ) {
		foreach ( $terms as $term ) {
			$categories[] = $term->name;
		}
	}

	$regular = (float) $product->get_regular_price();
	$sale    = '' !== $product->get_sale_price() ? (float) $product->get_sale_price() : null;

	return array(
		'id'             => $product->get_id(),
		'name'           => $product->get_name(),
		'sku'            => $product->get_sku(),
		'status'         => $product->get_status(),
		'price'          => (float) ( $product->get_price() !== '' ? $product->get_price() : $regular ),
		'regular_price'  => $regular,
		'sale_price'     => $sale,
		'stock_status'   => $product->get_stock_status(),
		'stock_quantity' => $product->get_stock_quantity(),
		'image'          => $image_id ? wp_get_attachment_image_url( $image_id, 'medium' ) : '',
		'categories'     => $categories,
		'units_sold'     => (int) get_post_meta( $product->get_id(), 'total_sales', true ),
		'created_at'     => $product->get_date_created() ? $product->get_date_created()->date( 'c' ) : null,
	);
}

/** Applies size/colour lists as custom (non-taxonomy) product attributes. */
function kandi_apply_product_attributes( $product, $sizes, $colors ) {
	$attributes = array();
	$position   = 0;

	foreach ( array( 'Size' => $sizes, 'Color' => $colors ) as $label => $values ) {
		$values = array_values( array_filter( array_map( 'sanitize_text_field', (array) $values ) ) );
		if ( empty( $values ) ) {
			continue;
		}
		$attribute = new WC_Product_Attribute();
		$attribute->set_name( $label );
		$attribute->set_options( $values );
		$attribute->set_position( $position++ );
		$attribute->set_visible( true );
		$attribute->set_variation( false );
		$attributes[] = $attribute;
	}

	$product->set_attributes( $attributes );
}

/** Sideloads remote image URLs into the media library and attaches them. */
function kandi_attach_product_images( $product_id, $urls ) {
	$urls = array_values( array_filter( array_map( 'esc_url_raw', (array) $urls ) ) );
	if ( empty( $urls ) ) {
		return;
	}

	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	$attachment_ids = array();
	foreach ( array_slice( $urls, 0, 8 ) as $url ) {
		$attachment_id = media_sideload_image( $url, $product_id, null, 'id' );
		if ( ! is_wp_error( $attachment_id ) ) {
			$attachment_ids[] = (int) $attachment_id;
		}
	}

	if ( empty( $attachment_ids ) ) {
		return;
	}

	set_post_thumbnail( $product_id, array_shift( $attachment_ids ) );
	if ( ! empty( $attachment_ids ) ) {
		update_post_meta( $product_id, '_product_image_gallery', implode( ',', $attachment_ids ) );
	}
}

/* -------------------------------------------------------------------------
 * 7. REST API — kandi/v1/seller/*
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', function () {

	/* ---- POST /seller/register ---- */
	register_rest_route( 'kandi/v1', '/seller/register', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_public_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$body  = (array) $request->get_json_params();
			$email = sanitize_email( $body['email'] ?? '' );

			if ( ! is_email( $email ) ) {
				return new WP_Error( 'kandi_bad_email', 'Enter a valid email address.', array( 'status' => 400 ) );
			}
			if ( email_exists( $email ) ) {
				return new WP_Error( 'kandi_email_taken', 'An account already uses that email address. Try signing in instead.', array( 'status' => 409 ) );
			}

			$password = (string) ( $body['password'] ?? '' );
			if ( strlen( $password ) < 8 ) {
				return new WP_Error( 'kandi_weak_password', 'Choose a password of at least 8 characters.', array( 'status' => 400 ) );
			}

			$store_name = sanitize_text_field( $body['store_name'] ?? '' );
			if ( '' === $store_name ) {
				return new WP_Error( 'kandi_missing_store', 'Your store needs a name.', array( 'status' => 400 ) );
			}

			$username = sanitize_user( 'seller_' . strtok( $email, '@' ), true );
			$suffix   = 1;
			$base     = $username;
			while ( username_exists( $username ) ) {
				$username = $base . $suffix++;
			}

			$user_id = wp_insert_user( array(
				'user_login'   => $username,
				'user_email'   => $email,
				'user_pass'    => $password,
				'display_name' => $store_name,
				'first_name'   => sanitize_text_field( $body['owner_name'] ?? '' ),
				'role'         => KANDI_SELLER_ROLE,
			) );

			if ( is_wp_error( $user_id ) ) {
				return $user_id;
			}

			$slug = sanitize_title( $store_name );
			update_user_meta( $user_id, '_kandi_store_name', $store_name );
			update_user_meta( $user_id, '_kandi_store_slug', $slug );
			update_user_meta( $user_id, '_kandi_owner_name', sanitize_text_field( $body['owner_name'] ?? '' ) );
			update_user_meta( $user_id, '_kandi_phone', sanitize_text_field( $body['phone'] ?? '' ) );
			update_user_meta( $user_id, '_kandi_city', sanitize_text_field( $body['city'] ?? '' ) );
			update_user_meta( $user_id, '_kandi_category', sanitize_text_field( $body['category'] ?? '' ) );
			update_user_meta( $user_id, '_kandi_status', 'pending' );
			update_user_meta( $user_id, '_kandi_commission_rate', kandi_default_commission_rate() );

			// Tell the marketplace team a store is waiting.
			wp_mail(
				get_option( 'admin_email' ),
				sprintf( 'New Kandi seller awaiting approval: %s', $store_name ),
				sprintf(
					"%s (%s) applied to sell on Kandi.\n\nReview the application: %s",
					$store_name,
					$email,
					admin_url( 'admin.php?page=kandi-sellers' )
				)
			);

			return rest_ensure_response( array(
				'seller'  => kandi_format_seller( $user_id ),
				'message' => 'Your application has been received and is awaiting approval.',
			) );
		},
	) );

	/* ---- POST /seller/login ---- */
	register_rest_route( 'kandi/v1', '/seller/login', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_public_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$body     = (array) $request->get_json_params();
			$email    = sanitize_email( $body['email'] ?? '' );
			$password = (string) ( $body['password'] ?? '' );

			$user = get_user_by( 'email', $email );
			if ( ! $user || ! wp_check_password( $password, $user->user_pass, $user->ID ) ) {
				return new WP_Error( 'kandi_bad_credentials', 'That email and password combination is not recognised.', array( 'status' => 401 ) );
			}
			if ( ! kandi_is_seller( $user->ID ) ) {
				return new WP_Error( 'kandi_not_seller', 'This account is not registered as a Kandi seller.', array( 'status' => 403 ) );
			}

			$status = get_user_meta( $user->ID, '_kandi_status', true );
			if ( 'rejected' === $status ) {
				return new WP_Error( 'kandi_rejected', 'This seller application was not approved. Contact Kandi support.', array( 'status' => 403 ) );
			}
			if ( 'suspended' === $status ) {
				return new WP_Error( 'kandi_suspended', 'This seller account is suspended. Contact Kandi support.', array( 'status' => 403 ) );
			}

			return rest_ensure_response( array(
				'token'      => kandi_seller_issue_token( $user->ID ),
				'expires_in' => KANDI_SELLER_TOKEN_TTL,
				'seller'     => kandi_format_seller( $user->ID ),
			) );
		},
	) );

	/* ---- POST /seller/logout ---- */
	register_rest_route( 'kandi/v1', '/seller/logout', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_public_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$token = kandi_seller_bearer_token( $request );
			if ( '' !== $token ) {
				delete_transient( kandi_seller_token_key( $token ) );
			}
			return rest_ensure_response( array( 'ok' => true ) );
		},
	) );

	/* ---- GET /seller/me ---- */
	register_rest_route( 'kandi/v1', '/seller/me', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_seller_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			return rest_ensure_response( array(
				'seller' => kandi_format_seller( kandi_seller_current_id( $request ) ),
			) );
		},
	) );

	/* ---- PUT /seller/settings ---- */
	register_rest_route( 'kandi/v1', '/seller/settings', array(
		'methods'             => WP_REST_Server::EDITABLE,
		'permission_callback' => 'kandi_seller_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$seller_id = kandi_seller_current_id( $request );
			$body      = (array) $request->get_json_params();

			// Commission rate and status are deliberately NOT writable here —
			// only the marketplace team can change those from wp-admin.
			$fields = array(
				'store_name'     => '_kandi_store_name',
				'owner_name'     => '_kandi_owner_name',
				'phone'          => '_kandi_phone',
				'payout_method'  => '_kandi_payout_method',
				'payout_account' => '_kandi_payout_account',
			);

			foreach ( $fields as $key => $meta_key ) {
				if ( isset( $body[ $key ] ) ) {
					update_user_meta( $seller_id, $meta_key, sanitize_text_field( (string) $body[ $key ] ) );
				}
			}

			if ( isset( $body['logo'] ) ) {
				update_user_meta( $seller_id, '_kandi_logo', esc_url_raw( (string) $body['logo'] ) );
			}
			if ( isset( $body['store_name'] ) ) {
				update_user_meta( $seller_id, '_kandi_store_slug', sanitize_title( (string) $body['store_name'] ) );
			}

			return rest_ensure_response( array( 'seller' => kandi_format_seller( $seller_id ) ) );
		},
	) );

	/* ---- GET|POST /seller/products ---- */
	register_rest_route( 'kandi/v1', '/seller/products', array(
		array(
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => 'kandi_seller_permission',
			'callback'            => function ( WP_REST_Request $request ) {
				$seller_id = kandi_seller_current_id( $request );

				$products = wc_get_products( array(
					'limit'      => 200,
					'status'     => array( 'publish', 'pending', 'draft' ),
					'orderby'    => 'date',
					'order'      => 'DESC',
					'meta_key'   => '_kandi_seller_id',
					'meta_value' => $seller_id,
				) );

				return rest_ensure_response( array(
					'products' => array_map( 'kandi_format_seller_product', $products ),
				) );
			},
		),
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'permission_callback' => 'kandi_seller_permission',
			'callback'            => function ( WP_REST_Request $request ) {
				$seller_id = kandi_seller_current_id( $request );

				if ( 'approved' !== get_user_meta( $seller_id, '_kandi_status', true ) ) {
					return new WP_Error(
						'kandi_not_approved',
						'Your store is still awaiting approval, so listings cannot be submitted yet.',
						array( 'status' => 403 )
					);
				}

				$body = (array) $request->get_json_params();
				$name = sanitize_text_field( $body['name'] ?? '' );
				if ( '' === $name ) {
					return new WP_Error( 'kandi_missing_name', 'The product needs a name.', array( 'status' => 400 ) );
				}

				$regular = (float) ( $body['regular_price'] ?? 0 );
				if ( $regular <= 0 ) {
					return new WP_Error( 'kandi_bad_price', 'Enter a regular price greater than zero.', array( 'status' => 400 ) );
				}

				$sale = isset( $body['sale_price'] ) && null !== $body['sale_price'] ? (float) $body['sale_price'] : 0;
				if ( $sale > 0 && $sale >= $regular ) {
					return new WP_Error( 'kandi_bad_sale_price', 'The sale price must be lower than the regular price.', array( 'status' => 400 ) );
				}

				$product = new WC_Product_Simple();
				$product->set_name( $name );
				$product->set_status( get_option( 'kandi_seller_auto_approve_products' ) ? 'publish' : 'pending' );
				$product->set_sku( sanitize_text_field( $body['sku'] ?? '' ) );
				$product->set_regular_price( (string) $regular );
				if ( $sale > 0 ) {
					$product->set_sale_price( (string) $sale );
				}
				$product->set_description( wp_kses_post( $body['description'] ?? '' ) );
				$product->set_short_description( wp_kses_post( $body['short_description'] ?? '' ) );
				$product->set_manage_stock( true );
				$product->set_stock_quantity( max( 0, (int) ( $body['stock_quantity'] ?? 0 ) ) );
				$product->set_stock_status( (int) ( $body['stock_quantity'] ?? 0 ) > 0 ? 'instock' : 'outofstock' );

				kandi_apply_product_attributes( $product, $body['sizes'] ?? array(), $body['colors'] ?? array() );

				try {
					$product_id = $product->save();
				} catch ( Exception $exception ) {
					return new WP_Error( 'kandi_save_failed', $exception->getMessage(), array( 'status' => 500 ) );
				}

				if ( ! $product_id ) {
					return new WP_Error( 'kandi_save_failed', 'The product could not be saved.', array( 'status' => 500 ) );
				}

				update_post_meta( $product_id, '_kandi_seller_id', $seller_id );

				$category = sanitize_text_field( $body['category'] ?? '' );
				if ( '' !== $category ) {
					$term = term_exists( $category, 'product_cat' );
					if ( ! $term ) {
						$term = wp_insert_term( $category, 'product_cat' );
					}
					if ( ! is_wp_error( $term ) ) {
						wp_set_object_terms( $product_id, (int) $term['term_id'], 'product_cat' );
					}
				}

				kandi_attach_product_images( $product_id, $body['image_urls'] ?? array() );

				return rest_ensure_response( array(
					'product' => kandi_format_seller_product( wc_get_product( $product_id ) ),
				) );
			},
		),
	) );

	/* ---- PUT|DELETE /seller/products/{id} ---- */
	register_rest_route( 'kandi/v1', '/seller/products/(?P<id>\d+)', array(
		array(
			'methods'             => WP_REST_Server::EDITABLE,
			'permission_callback' => 'kandi_seller_permission',
			'callback'            => function ( WP_REST_Request $request ) {
				$seller_id  = kandi_seller_current_id( $request );
				$product_id = (int) $request['id'];

				if ( (int) get_post_meta( $product_id, '_kandi_seller_id', true ) !== $seller_id ) {
					return new WP_Error( 'kandi_not_yours', 'That product does not belong to your store.', array( 'status' => 403 ) );
				}

				$product = wc_get_product( $product_id );
				if ( ! $product ) {
					return new WP_Error( 'kandi_not_found', 'Product not found.', array( 'status' => 404 ) );
				}

				$body = (array) $request->get_json_params();

				if ( isset( $body['name'] ) ) {
					$product->set_name( sanitize_text_field( $body['name'] ) );
				}
				if ( isset( $body['sku'] ) ) {
					$product->set_sku( sanitize_text_field( $body['sku'] ) );
				}
				if ( isset( $body['description'] ) ) {
					$product->set_description( wp_kses_post( $body['description'] ) );
				}
				if ( isset( $body['short_description'] ) ) {
					$product->set_short_description( wp_kses_post( $body['short_description'] ) );
				}
				if ( isset( $body['regular_price'] ) ) {
					$product->set_regular_price( (string) (float) $body['regular_price'] );
				}
				if ( array_key_exists( 'sale_price', $body ) ) {
					$product->set_sale_price( null === $body['sale_price'] ? '' : (string) (float) $body['sale_price'] );
				}
				if ( isset( $body['stock_quantity'] ) ) {
					$quantity = max( 0, (int) $body['stock_quantity'] );
					$product->set_manage_stock( true );
					$product->set_stock_quantity( $quantity );
					$product->set_stock_status( $quantity > 0 ? 'instock' : 'outofstock' );
				}
				if ( isset( $body['sizes'] ) || isset( $body['colors'] ) ) {
					kandi_apply_product_attributes( $product, $body['sizes'] ?? array(), $body['colors'] ?? array() );
				}
				// A seller may unpublish their own listing, but never self-publish one.
				if ( isset( $body['status'] ) && 'draft' === $body['status'] ) {
					$product->set_status( 'draft' );
				}

				$product->save();

				return rest_ensure_response( array(
					'product' => kandi_format_seller_product( wc_get_product( $product_id ) ),
				) );
			},
		),
		array(
			'methods'             => WP_REST_Server::DELETABLE,
			'permission_callback' => 'kandi_seller_permission',
			'callback'            => function ( WP_REST_Request $request ) {
				$seller_id  = kandi_seller_current_id( $request );
				$product_id = (int) $request['id'];

				if ( (int) get_post_meta( $product_id, '_kandi_seller_id', true ) !== $seller_id ) {
					return new WP_Error( 'kandi_not_yours', 'That product does not belong to your store.', array( 'status' => 403 ) );
				}

				// Trash rather than force-delete, so past orders keep their line items.
				wp_trash_post( $product_id );

				return rest_ensure_response( array( 'ok' => true ) );
			},
		),
	) );

	/* ---- GET /seller/stats ---- */
	register_rest_route( 'kandi/v1', '/seller/stats', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_seller_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			global $wpdb;

			$seller_id = kandi_seller_current_id( $request );
			$range     = kandi_parse_range( $request->get_param( 'range' ) );
			$table     = kandi_seller_commissions_table();

			$live = "status <> 'cancelled'";

			// Headline totals for the window.
			$totals = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT COALESCE(SUM(gross),0) AS revenue,
					        COALESCE(SUM(qty),0) AS units,
					        COUNT(DISTINCT order_id) AS orders
					   FROM {$table}
					  WHERE seller_id = %d AND {$live} AND created_at BETWEEN %s AND %s",
					$seller_id,
					$range['start'],
					$range['end']
				)
			);

			$previous = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT COALESCE(SUM(gross),0) AS revenue,
					        COUNT(DISTINCT order_id) AS orders
					   FROM {$table}
					  WHERE seller_id = %d AND {$live} AND created_at BETWEEN %s AND %s",
					$seller_id,
					$range['previous_start'],
					$range['previous_end']
				)
			);

			// Money owed / already settled, across all time.
			$ledger = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT COALESCE(SUM(CASE WHEN status IN ('pending','payable') THEN commission ELSE 0 END),0) AS commission_owed,
					        COALESCE(SUM(CASE WHEN status = 'paid' THEN commission ELSE 0 END),0) AS commission_paid,
					        COALESCE(SUM(CASE WHEN status = 'payable' THEN net ELSE 0 END),0) AS payout_due
					   FROM {$table}
					  WHERE seller_id = %d",
					$seller_id
				)
			);

			// Daily series — zero-filled so the line never skips a day.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT DATE(created_at) AS day,
					        COALESCE(SUM(gross),0) AS revenue,
					        COUNT(DISTINCT order_id) AS orders
					   FROM {$table}
					  WHERE seller_id = %d AND {$live} AND created_at BETWEEN %s AND %s
					  GROUP BY DATE(created_at)
					  ORDER BY day ASC",
					$seller_id,
					$range['start'],
					$range['end']
				),
				OBJECT_K
			);

			$series = array();
			for ( $day = $range['start_ts']; $day <= $range['end_ts']; $day += DAY_IN_SECONDS ) {
				$key      = gmdate( 'Y-m-d', $day );
				$series[] = array(
					'date'    => $key,
					'revenue' => isset( $rows[ $key ] ) ? (float) $rows[ $key ]->revenue : 0.0,
					'orders'  => isset( $rows[ $key ] ) ? (int) $rows[ $key ]->orders : 0,
				);
			}

			// Best sellers in the window.
			$top_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT product_id,
					        COALESCE(SUM(qty),0) AS units,
					        COALESCE(SUM(gross),0) AS revenue
					   FROM {$table}
					  WHERE seller_id = %d AND {$live} AND created_at BETWEEN %s AND %s
					  GROUP BY product_id
					  ORDER BY revenue DESC
					  LIMIT 6",
					$seller_id,
					$range['start'],
					$range['end']
				)
			);

			$top_products   = array();
			$category_split = array();

			foreach ( $top_rows as $row ) {
				$product        = wc_get_product( (int) $row->product_id );
				$top_products[] = array(
					'id'      => (int) $row->product_id,
					'name'    => $product ? $product->get_name() : sprintf( 'Product #%d', $row->product_id ),
					'units'   => (int) $row->units,
					'revenue' => (float) $row->revenue,
				);
			}

			// Revenue by category, resolved from each sold product's terms.
			$category_rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT product_id, COALESCE(SUM(gross),0) AS revenue
					   FROM {$table}
					  WHERE seller_id = %d AND {$live} AND created_at BETWEEN %s AND %s
					  GROUP BY product_id",
					$seller_id,
					$range['start'],
					$range['end']
				)
			);

			$by_category = array();
			foreach ( $category_rows as $row ) {
				$terms = get_the_terms( (int) $row->product_id, 'product_cat' );
				$name  = ( $terms && ! is_wp_error( $terms ) ) ? $terms[0]->name : 'Uncategorised';
				if ( ! isset( $by_category[ $name ] ) ) {
					$by_category[ $name ] = 0.0;
				}
				$by_category[ $name ] += (float) $row->revenue;
			}
			arsort( $by_category );
			foreach ( $by_category as $name => $revenue ) {
				$category_split[] = array( 'name' => $name, 'revenue' => round( $revenue, 2 ) );
			}

			// Catalogue counts.
			$counts = array( 'publish' => 0, 'pending' => 0, 'outofstock' => 0 );
			$owned  = wc_get_products( array(
				'limit'      => -1,
				'status'     => array( 'publish', 'pending', 'draft' ),
				'return'     => 'objects',
				'meta_key'   => '_kandi_seller_id',
				'meta_value' => $seller_id,
			) );
			foreach ( $owned as $product ) {
				if ( 'publish' === $product->get_status() ) {
					$counts['publish']++;
				} elseif ( 'pending' === $product->get_status() ) {
					$counts['pending']++;
				}
				if ( 'outofstock' === $product->get_stock_status() ) {
					$counts['outofstock']++;
				}
			}

			return rest_ensure_response( array(
				'currency'               => get_woocommerce_currency(),
				'revenue'                => (float) $totals->revenue,
				'revenue_change'         => kandi_percent_change( (float) $totals->revenue, (float) $previous->revenue ),
				'orders'                 => (int) $totals->orders,
				'orders_change'          => kandi_percent_change( (int) $totals->orders, (int) $previous->orders ),
				'units_sold'             => (int) $totals->units,
				'commission_owed'        => (float) $ledger->commission_owed,
				'commission_paid'        => (float) $ledger->commission_paid,
				'payout_due'             => (float) $ledger->payout_due,
				'products_live'          => $counts['publish'],
				'products_pending'       => $counts['pending'],
				'products_out_of_stock'  => $counts['outofstock'],
				'revenue_series'         => $series,
				'top_products'           => $top_products,
				'category_split'         => $category_split,
			) );
		},
	) );

	/* ---- GET /seller/orders ---- */
	register_rest_route( 'kandi/v1', '/seller/orders', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_seller_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			global $wpdb;

			$seller_id = kandi_seller_current_id( $request );
			$status    = sanitize_key( (string) $request->get_param( 'status' ) );
			$table     = kandi_seller_commissions_table();

			$order_ids = $wpdb->get_col(
				$wpdb->prepare(
					"SELECT DISTINCT order_id FROM {$table} WHERE seller_id = %d ORDER BY order_id DESC LIMIT 200",
					$seller_id
				)
			);

			$orders = array();
			foreach ( $order_ids as $order_id ) {
				$order = wc_get_order( (int) $order_id );
				if ( ! $order ) {
					continue;
				}
				if ( $status && 'any' !== $status && $order->get_status() !== $status ) {
					continue;
				}

				$lines = $wpdb->get_results(
					$wpdb->prepare(
						"SELECT product_id, qty, gross, commission, net
						   FROM {$table}
						  WHERE seller_id = %d AND order_id = %d",
						$seller_id,
						$order_id
					)
				);

				$items        = array();
				$seller_total = 0.0;
				$commission   = 0.0;
				$net          = 0.0;

				foreach ( $lines as $line ) {
					$product = wc_get_product( (int) $line->product_id );
					$items[] = array(
						'product_id' => (int) $line->product_id,
						'name'       => $product ? $product->get_name() : sprintf( 'Product #%d', $line->product_id ),
						'quantity'   => (int) $line->qty,
						'total'      => (float) $line->gross,
						'commission' => (float) $line->commission,
					);
					$seller_total += (float) $line->gross;
					$commission   += (float) $line->commission;
					$net          += (float) $line->net;
				}

				$orders[] = array(
					'id'           => $order->get_id(),
					'number'       => $order->get_order_number(),
					'status'       => $order->get_status(),
					'customer'     => trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() ),
					'city'         => $order->get_billing_city(),
					'date'         => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : null,
					'seller_total' => round( $seller_total, 2 ),
					'commission'   => round( $commission, 2 ),
					'net_payout'   => round( $net, 2 ),
					'items'        => $items,
				);
			}

			return rest_ensure_response( array( 'orders' => $orders ) );
		},
	) );

	/* ---- GET /seller/commissions ---- */
	register_rest_route( 'kandi/v1', '/seller/commissions', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_seller_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			global $wpdb;

			$seller_id = kandi_seller_current_id( $request );
			$range     = kandi_parse_range( $request->get_param( 'range' ) );
			$table     = kandi_seller_commissions_table();

			// One row per order in the window, so the statement reads like an invoice.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT MIN(id) AS id,
					        order_id,
					        MIN(created_at) AS created_at,
					        COALESCE(SUM(gross),0) AS gross,
					        MAX(rate) AS rate,
					        COALESCE(SUM(commission),0) AS commission,
					        COALESCE(SUM(net),0) AS net,
					        MIN(status) AS status
					   FROM {$table}
					  WHERE seller_id = %d AND status <> 'cancelled' AND created_at BETWEEN %s AND %s
					  GROUP BY order_id
					  ORDER BY created_at DESC",
					$seller_id,
					$range['start'],
					$range['end']
				)
			);

			$entries = array();
			foreach ( $rows as $row ) {
				$entries[] = array(
					'id'         => (int) $row->id,
					'order_id'   => (int) $row->order_id,
					'date'       => mysql2date( 'c', $row->created_at ),
					'gross'      => (float) $row->gross,
					'rate'       => (float) $row->rate,
					'commission' => (float) $row->commission,
					'net'        => (float) $row->net,
					'status'     => (string) $row->status,
				);
			}

			$buckets = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT COALESCE(SUM(CASE WHEN status = 'paid' THEN net ELSE 0 END),0) AS paid,
					        COALESCE(SUM(CASE WHEN status = 'payable' THEN net ELSE 0 END),0) AS payable,
					        COALESCE(SUM(CASE WHEN status = 'pending' THEN net ELSE 0 END),0) AS pending
					   FROM {$table}
					  WHERE seller_id = %d",
					$seller_id
				)
			);

			$gross      = array_sum( wp_list_pluck( $entries, 'gross' ) );
			$commission = array_sum( wp_list_pluck( $entries, 'commission' ) );

			return rest_ensure_response( array(
				'currency'         => get_woocommerce_currency(),
				'rate'             => kandi_seller_commission_rate( $seller_id ),
				'gross'            => round( $gross, 2 ),
				'commission_total' => round( $commission, 2 ),
				'net_total'        => round( $gross - $commission, 2 ),
				'paid'             => (float) $buckets->paid,
				'payable'          => (float) $buckets->payable,
				'pending'          => (float) $buckets->pending,
				'entries'          => $entries,
			) );
		},
	) );

	/* ---- POST /seller/payouts ---- */
	register_rest_route( 'kandi/v1', '/seller/payouts', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			global $wpdb;

			$seller_id = kandi_seller_current_id( $request );
			$table     = kandi_seller_commissions_table();

			$open = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COUNT(*) FROM " . kandi_seller_payouts_table() . " WHERE seller_id = %d AND status = 'requested'",
					$seller_id
				)
			);
			if ( $open > 0 ) {
				return new WP_Error( 'kandi_payout_open', 'You already have a payout request being processed.', array( 'status' => 409 ) );
			}

			$payable = (float) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COALESCE(SUM(net),0) FROM {$table} WHERE seller_id = %d AND status = 'payable'",
					$seller_id
				)
			);

			if ( $payable <= 0 ) {
				return new WP_Error( 'kandi_nothing_payable', 'You have no cleared earnings to pay out yet.', array( 'status' => 400 ) );
			}

			$wpdb->insert(
				kandi_seller_payouts_table(),
				array(
					'seller_id'    => $seller_id,
					'amount'       => $payable,
					'method'       => (string) get_user_meta( $seller_id, '_kandi_payout_method', true ),
					'account'      => (string) get_user_meta( $seller_id, '_kandi_payout_account', true ),
					'status'       => 'requested',
					'requested_at' => current_time( 'mysql' ),
				),
				array( '%d', '%f', '%s', '%s', '%s', '%s' )
			);

			wp_mail(
				get_option( 'admin_email' ),
				'Kandi seller payout requested',
				sprintf(
					"%s requested a payout of %s.\n\nReview it: %s",
					get_user_meta( $seller_id, '_kandi_store_name', true ),
					wc_price( $payable ),
					admin_url( 'admin.php?page=kandi-seller-payouts' )
				)
			);

			return rest_ensure_response( array(
				'ok'      => true,
				'message' => 'Payout requested. Our finance team settles requests every Friday.',
			) );
		},
	) );
} );

/* -------------------------------------------------------------------------
 * 8. Storefront: expose the seller on each product
 * ---------------------------------------------------------------------- */

/**
 * Adds the owning store to the product payload served by the Kandi Store API,
 * so the storefront can show "Sold by <store>" and link to the seller page.
 */
add_filter( 'kandi_product_payload', function ( $data, $product ) {
	$seller_id = (int) get_post_meta( $product->get_id(), '_kandi_seller_id', true );
	if ( $seller_id ) {
		$data['seller'] = array(
			'id'         => $seller_id,
			'store_name' => (string) get_user_meta( $seller_id, '_kandi_store_name', true ),
			'store_slug' => (string) get_user_meta( $seller_id, '_kandi_store_slug', true ),
			'logo'       => (string) get_user_meta( $seller_id, '_kandi_logo', true ),
		);
	}
	return $data;
}, 10, 2 );

/* -------------------------------------------------------------------------
 * 9. wp-admin — the marketplace control panel
 * ---------------------------------------------------------------------- */

add_action( 'admin_menu', function () {
	add_menu_page(
		'Kandi Sellers',
		'Kandi Sellers',
		'manage_woocommerce',
		'kandi-sellers',
		'kandi_admin_sellers_page',
		'dashicons-store',
		56
	);
	add_submenu_page( 'kandi-sellers', 'Sellers', 'Sellers', 'manage_woocommerce', 'kandi-sellers', 'kandi_admin_sellers_page' );
	add_submenu_page( 'kandi-sellers', 'Product Approvals', 'Product Approvals', 'manage_woocommerce', 'kandi-seller-products', 'kandi_admin_products_page' );
	add_submenu_page( 'kandi-sellers', 'Commissions', 'Commissions', 'manage_woocommerce', 'kandi-seller-commissions', 'kandi_admin_commissions_page' );
	add_submenu_page( 'kandi-sellers', 'Payouts', 'Payouts', 'manage_woocommerce', 'kandi-seller-payouts', 'kandi_admin_payouts_page' );
	add_submenu_page( 'kandi-sellers', 'Settings', 'Settings', 'manage_woocommerce', 'kandi-seller-settings', 'kandi_admin_settings_page' );
} );

/** Guard shared by every admin action handler. */
function kandi_admin_guard( $nonce_action ) {
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		wp_die( 'You do not have permission to manage Kandi sellers.' );
	}
	check_admin_referer( $nonce_action );
}

/* ---- Sellers ---- */

function kandi_admin_sellers_page() {
	global $wpdb;

	// Handle actions.
	if ( isset( $_POST['kandi_seller_action'] ) ) {
		kandi_admin_guard( 'kandi_seller_action' );

		$seller_id = (int) $_POST['seller_id'];
		$action    = sanitize_key( $_POST['kandi_seller_action'] );

		if ( in_array( $action, array( 'approve', 'suspend', 'reject', 'reinstate' ), true ) ) {
			$map = array(
				'approve'   => 'approved',
				'suspend'   => 'suspended',
				'reject'    => 'rejected',
				'reinstate' => 'approved',
			);
			update_user_meta( $seller_id, '_kandi_status', $map[ $action ] );

			if ( 'approve' === $action || 'reinstate' === $action ) {
				$user = get_userdata( $seller_id );
				if ( $user ) {
					wp_mail(
						$user->user_email,
						'Your Kandi seller account is approved',
						sprintf(
							"Good news — %s is now live on Kandi.\n\nSign in to add products: %s",
							get_user_meta( $seller_id, '_kandi_store_name', true ),
							home_url( '/seller/login' )
						)
					);
				}
			}
			echo '<div class="notice notice-success is-dismissible"><p>Seller updated.</p></div>';
		}

		if ( 'set_rate' === $action ) {
			$rate = max( 0, min( 100, (float) $_POST['commission_rate'] ) );
			update_user_meta( $seller_id, '_kandi_commission_rate', $rate );
			echo '<div class="notice notice-success is-dismissible"><p>Commission rate updated.</p></div>';
		}
	}

	$sellers = get_users( array( 'role' => KANDI_SELLER_ROLE, 'orderby' => 'registered', 'order' => 'DESC' ) );
	$table   = kandi_seller_commissions_table();

	echo '<div class="wrap"><h1>Kandi Sellers</h1>';
	echo '<p>Approve applications, set commission rates and monitor each store.</p>';
	echo '<table class="wp-list-table widefat fixed striped"><thead><tr>
			<th>Store</th><th>Contact</th><th>Status</th><th>Commission</th>
			<th>Products</th><th>Gross sales</th><th>Owed to Kandi</th><th>Actions</th>
		  </tr></thead><tbody>';

	if ( empty( $sellers ) ) {
		echo '<tr><td colspan="8">No sellers have registered yet.</td></tr>';
	}

	foreach ( $sellers as $seller ) {
		$status  = get_user_meta( $seller->ID, '_kandi_status', true ) ?: 'pending';
		$rate    = kandi_seller_commission_rate( $seller->ID );
		$product_count = count( wc_get_products( array(
			'limit'      => -1,
			'status'     => array( 'publish', 'pending', 'draft' ),
			'return'     => 'ids',
			'meta_key'   => '_kandi_seller_id',
			'meta_value' => $seller->ID,
		) ) );

		$money = $wpdb->get_row( $wpdb->prepare(
			"SELECT COALESCE(SUM(gross),0) AS gross,
			        COALESCE(SUM(CASE WHEN status IN ('pending','payable') THEN commission ELSE 0 END),0) AS owed
			   FROM {$table} WHERE seller_id = %d AND status <> 'cancelled'",
			$seller->ID
		) );

		echo '<tr>';
		printf(
			'<td><strong>%s</strong><br><span class="description">%s</span></td>',
			esc_html( get_user_meta( $seller->ID, '_kandi_store_name', true ) ),
			esc_html( get_user_meta( $seller->ID, '_kandi_city', true ) )
		);
		printf(
			'<td>%s<br><a href="mailto:%s">%s</a><br>%s</td>',
			esc_html( get_user_meta( $seller->ID, '_kandi_owner_name', true ) ),
			esc_attr( $seller->user_email ),
			esc_html( $seller->user_email ),
			esc_html( get_user_meta( $seller->ID, '_kandi_phone', true ) )
		);
		printf( '<td><span class="kandi-status kandi-status-%1$s">%1$s</span></td>', esc_html( $status ) );

		// Inline commission-rate editor.
		echo '<td><form method="post" style="display:flex;gap:4px;align-items:center">';
		wp_nonce_field( 'kandi_seller_action' );
		printf( '<input type="hidden" name="seller_id" value="%d">', (int) $seller->ID );
		echo '<input type="hidden" name="kandi_seller_action" value="set_rate">';
		printf( '<input type="number" step="0.5" min="0" max="100" name="commission_rate" value="%s" style="width:70px">', esc_attr( $rate ) );
		echo '<button class="button button-small">%</button></form></td>';

		printf( '<td>%d</td>', (int) $product_count );
		echo '<td>' . wp_kses_post( wc_price( (float) $money->gross ) ) . '</td>';
		echo '<td>' . wp_kses_post( wc_price( (float) $money->owed ) ) . '</td>';

		echo '<td>';
		foreach ( kandi_seller_actions_for_status( $status ) as $action => $label ) {
			echo '<form method="post" style="display:inline-block;margin:0 4px 4px 0">';
			wp_nonce_field( 'kandi_seller_action' );
			printf( '<input type="hidden" name="seller_id" value="%d">', (int) $seller->ID );
			printf( '<input type="hidden" name="kandi_seller_action" value="%s">', esc_attr( $action ) );
			printf( '<button class="button button-small">%s</button>', esc_html( $label ) );
			echo '</form>';
		}
		echo '</td></tr>';
	}

	echo '</tbody></table>';
	kandi_admin_status_styles();
	echo '</div>';
}

function kandi_seller_actions_for_status( $status ) {
	switch ( $status ) {
		case 'approved':
			return array( 'suspend' => 'Suspend' );
		case 'suspended':
		case 'rejected':
			return array( 'reinstate' => 'Reinstate' );
		default:
			return array( 'approve' => 'Approve', 'reject' => 'Reject' );
	}
}

/* ---- Product approvals ---- */

function kandi_admin_products_page() {
	if ( isset( $_POST['kandi_product_action'] ) ) {
		kandi_admin_guard( 'kandi_product_action' );

		$product_id = (int) $_POST['product_id'];
		$action     = sanitize_key( $_POST['kandi_product_action'] );

		if ( 'approve' === $action ) {
			wp_update_post( array( 'ID' => $product_id, 'post_status' => 'publish' ) );
			echo '<div class="notice notice-success is-dismissible"><p>Product published.</p></div>';
		} elseif ( 'reject' === $action ) {
			wp_update_post( array( 'ID' => $product_id, 'post_status' => 'draft' ) );
			echo '<div class="notice notice-warning is-dismissible"><p>Product sent back to draft.</p></div>';
		}
	}

	$pending = wc_get_products( array(
		'limit'        => 100,
		'status'       => 'pending',
		'meta_key'     => '_kandi_seller_id',
		'meta_compare' => 'EXISTS',
		'orderby'      => 'date',
		'order'        => 'ASC',
	) );

	echo '<div class="wrap"><h1>Seller product approvals</h1>';
	echo '<p>Listings submitted by sellers. Publishing makes them visible on the storefront immediately.</p>';
	echo '<table class="wp-list-table widefat fixed striped"><thead><tr>
			<th>Product</th><th>Seller</th><th>Price</th><th>Stock</th><th>Submitted</th><th>Actions</th>
		  </tr></thead><tbody>';

	if ( empty( $pending ) ) {
		echo '<tr><td colspan="6">Nothing is waiting for approval.</td></tr>';
	}

	foreach ( $pending as $product ) {
		$seller_id = (int) get_post_meta( $product->get_id(), '_kandi_seller_id', true );

		echo '<tr>';
		printf(
			'<td><strong>%s</strong><br><span class="description">SKU %s</span></td>',
			esc_html( $product->get_name() ),
			esc_html( $product->get_sku() ?: '—' )
		);
		printf(
			'<td><a href="%s">%s</a></td>',
			esc_url( admin_url( 'admin.php?page=kandi-sellers' ) ),
			esc_html( get_user_meta( $seller_id, '_kandi_store_name', true ) )
		);
		echo '<td>' . wp_kses_post( wc_price( (float) $product->get_price() ) ) . '</td>';
		printf( '<td>%s</td>', esc_html( (string) $product->get_stock_quantity() ) );
		printf(
			'<td>%s</td>',
			esc_html( $product->get_date_created() ? $product->get_date_created()->date( 'j M Y' ) : '' )
		);

		echo '<td>';
		printf(
			'<a class="button button-small" href="%s" target="_blank" rel="noopener">Preview</a> ',
			esc_url( get_edit_post_link( $product->get_id() ) )
		);
		foreach ( array( 'approve' => 'Publish', 'reject' => 'Send back' ) as $action => $label ) {
			echo '<form method="post" style="display:inline-block;margin-right:4px">';
			wp_nonce_field( 'kandi_product_action' );
			printf( '<input type="hidden" name="product_id" value="%d">', (int) $product->get_id() );
			printf( '<input type="hidden" name="kandi_product_action" value="%s">', esc_attr( $action ) );
			printf( '<button class="button button-small">%s</button>', esc_html( $label ) );
			echo '</form>';
		}
		echo '</td></tr>';
	}

	echo '</tbody></table></div>';
}

/* ---- Commissions ---- */

function kandi_admin_commissions_page() {
	global $wpdb;
	$table = kandi_seller_commissions_table();

	$totals = $wpdb->get_row(
		"SELECT COALESCE(SUM(gross),0) AS gross,
		        COALESCE(SUM(commission),0) AS commission,
		        COALESCE(SUM(CASE WHEN status IN ('pending','payable') THEN commission ELSE 0 END),0) AS outstanding,
		        COALESCE(SUM(CASE WHEN status = 'payable' THEN net ELSE 0 END),0) AS owed_to_sellers
		   FROM {$table} WHERE status <> 'cancelled'"
	);

	$rows = $wpdb->get_results(
		"SELECT seller_id,
		        COALESCE(SUM(gross),0) AS gross,
		        COALESCE(SUM(commission),0) AS commission,
		        COALESCE(SUM(CASE WHEN status = 'payable' THEN net ELSE 0 END),0) AS payable,
		        COUNT(DISTINCT order_id) AS orders
		   FROM {$table}
		  WHERE status <> 'cancelled'
		  GROUP BY seller_id
		  ORDER BY commission DESC"
	);

	echo '<div class="wrap"><h1>Marketplace commissions</h1>';

	echo '<div style="display:flex;gap:16px;flex-wrap:wrap;margin:16px 0">';
	foreach ( array(
		'Gross marketplace sales' => (float) $totals->gross,
		'Commission earned'       => (float) $totals->commission,
		'Commission outstanding'  => (float) $totals->outstanding,
		'Owed to sellers'         => (float) $totals->owed_to_sellers,
	) as $label => $value ) {
		printf(
			'<div style="background:#fff;border:1px solid #dcdcde;padding:14px 18px;min-width:190px">
				<div style="color:#646970;font-size:12px">%s</div>
				<div style="font-size:20px;font-weight:600;margin-top:4px">%s</div>
			</div>',
			esc_html( $label ),
			wp_kses_post( wc_price( $value ) )
		);
	}
	echo '</div>';

	echo '<table class="wp-list-table widefat fixed striped"><thead><tr>
			<th>Seller</th><th>Orders</th><th>Gross</th><th>Commission</th><th>Ready to pay out</th>
		  </tr></thead><tbody>';

	if ( empty( $rows ) ) {
		echo '<tr><td colspan="5">No commission has been recorded yet.</td></tr>';
	}

	foreach ( $rows as $row ) {
		printf(
			'<tr><td><strong>%s</strong></td><td>%d</td><td>%s</td><td>%s</td><td>%s</td></tr>',
			esc_html( get_user_meta( (int) $row->seller_id, '_kandi_store_name', true ) ),
			(int) $row->orders,
			wp_kses_post( wc_price( (float) $row->gross ) ),
			wp_kses_post( wc_price( (float) $row->commission ) ),
			wp_kses_post( wc_price( (float) $row->payable ) )
		);
	}

	echo '</tbody></table></div>';
}

/* ---- Payouts ---- */

function kandi_admin_payouts_page() {
	global $wpdb;

	$payouts_table     = kandi_seller_payouts_table();
	$commissions_table = kandi_seller_commissions_table();

	if ( isset( $_POST['kandi_payout_action'] ) ) {
		kandi_admin_guard( 'kandi_payout_action' );

		$payout_id = (int) $_POST['payout_id'];
		$action    = sanitize_key( $_POST['kandi_payout_action'] );
		$payout    = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$payouts_table} WHERE id = %d", $payout_id ) );

		if ( $payout && 'mark_paid' === $action ) {
			// Settling a payout closes every cleared ledger row for that seller.
			$wpdb->query( $wpdb->prepare(
				"UPDATE {$commissions_table} SET status = 'paid', paid_at = %s WHERE seller_id = %d AND status = 'payable'",
				current_time( 'mysql' ),
				(int) $payout->seller_id
			) );
			$wpdb->update(
				$payouts_table,
				array( 'status' => 'paid', 'paid_at' => current_time( 'mysql' ) ),
				array( 'id' => $payout_id ),
				array( '%s', '%s' ),
				array( '%d' )
			);
			echo '<div class="notice notice-success is-dismissible"><p>Payout marked as paid.</p></div>';
		} elseif ( $payout && 'cancel' === $action ) {
			$wpdb->update( $payouts_table, array( 'status' => 'cancelled' ), array( 'id' => $payout_id ), array( '%s' ), array( '%d' ) );
			echo '<div class="notice notice-warning is-dismissible"><p>Payout request cancelled.</p></div>';
		}
	}

	$payouts = $wpdb->get_results( "SELECT * FROM {$payouts_table} ORDER BY requested_at DESC LIMIT 200" );

	echo '<div class="wrap"><h1>Seller payouts</h1>';
	echo '<p>Marking a payout as paid closes all cleared commission entries for that seller.</p>';
	echo '<table class="wp-list-table widefat fixed striped"><thead><tr>
			<th>Seller</th><th>Amount</th><th>Method</th><th>Account</th><th>Requested</th><th>Status</th><th>Actions</th>
		  </tr></thead><tbody>';

	if ( empty( $payouts ) ) {
		echo '<tr><td colspan="7">No payout requests yet.</td></tr>';
	}

	foreach ( $payouts as $payout ) {
		echo '<tr>';
		printf( '<td><strong>%s</strong></td>', esc_html( get_user_meta( (int) $payout->seller_id, '_kandi_store_name', true ) ) );
		echo '<td>' . wp_kses_post( wc_price( (float) $payout->amount ) ) . '</td>';
		printf( '<td>%s</td>', esc_html( $payout->method ?: '—' ) );
		printf( '<td>%s</td>', esc_html( $payout->account ?: '—' ) );
		printf( '<td>%s</td>', esc_html( mysql2date( 'j M Y, H:i', $payout->requested_at ) ) );
		printf( '<td><span class="kandi-status kandi-status-%1$s">%1$s</span></td>', esc_html( $payout->status ) );

		echo '<td>';
		if ( 'requested' === $payout->status ) {
			foreach ( array( 'mark_paid' => 'Mark paid', 'cancel' => 'Cancel' ) as $action => $label ) {
				echo '<form method="post" style="display:inline-block;margin-right:4px">';
				wp_nonce_field( 'kandi_payout_action' );
				printf( '<input type="hidden" name="payout_id" value="%d">', (int) $payout->id );
				printf( '<input type="hidden" name="kandi_payout_action" value="%s">', esc_attr( $action ) );
				printf( '<button class="button button-small">%s</button>', esc_html( $label ) );
				echo '</form>';
			}
		} else {
			echo '—';
		}
		echo '</td></tr>';
	}

	echo '</tbody></table>';
	kandi_admin_status_styles();
	echo '</div>';
}

/* ---- Settings ---- */

function kandi_admin_settings_page() {
	if ( isset( $_POST['kandi_settings_submit'] ) ) {
		kandi_admin_guard( 'kandi_seller_settings' );

		update_option( 'kandi_default_commission_rate', max( 0, min( 100, (float) $_POST['default_rate'] ) ) );
		update_option( 'kandi_seller_auto_approve_products', isset( $_POST['auto_approve'] ) ? 1 : 0 );

		if ( ! defined( 'KANDI_API_SECRET' ) && isset( $_POST['api_secret'] ) ) {
			update_option( 'kandi_api_secret', sanitize_text_field( wp_unslash( $_POST['api_secret'] ) ) );
		}

		echo '<div class="notice notice-success is-dismissible"><p>Settings saved.</p></div>';
	}

	$rate         = kandi_default_commission_rate();
	$auto_approve = (int) get_option( 'kandi_seller_auto_approve_products', 0 );

	echo '<div class="wrap"><h1>Kandi Seller settings</h1><form method="post">';
	wp_nonce_field( 'kandi_seller_settings' );
	echo '<table class="form-table"><tbody>';

	printf(
		'<tr><th scope="row"><label for="default_rate">Default commission rate</label></th>
		 <td><input type="number" step="0.5" min="0" max="100" id="default_rate" name="default_rate" value="%s" class="small-text"> %%
		 <p class="description">Applied to new sellers. Existing sellers keep their own rate.</p></td></tr>',
		esc_attr( $rate )
	);

	printf(
		'<tr><th scope="row">New listings</th>
		 <td><label><input type="checkbox" name="auto_approve" value="1" %s> Publish seller products immediately (skip approval)</label></td></tr>',
		checked( 1, $auto_approve, false )
	);

	if ( defined( 'KANDI_API_SECRET' ) ) {
		echo '<tr><th scope="row">Storefront API secret</th>
			  <td><code>Defined in wp-config.php</code>
			  <p class="description">Remove the constant to manage the secret here instead.</p></td></tr>';
	} else {
		printf(
			'<tr><th scope="row"><label for="api_secret">Storefront API secret</label></th>
			 <td><input type="text" id="api_secret" name="api_secret" value="%s" class="regular-text">
			 <p class="description">Must match KANDI_API_SECRET in the Next.js .env.local.</p></td></tr>',
			esc_attr( get_option( 'kandi_api_secret', '' ) )
		);
	}

	echo '</tbody></table>';
	echo '<p><button class="button button-primary" name="kandi_settings_submit" value="1">Save settings</button></p>';
	echo '</form></div>';
}

function kandi_admin_status_styles() {
	echo '<style>
		.kandi-status{display:inline-block;padding:2px 8px;border-radius:3px;font-size:12px;font-weight:600;text-transform:capitalize}
		.kandi-status-approved,.kandi-status-paid{background:#e7f7ea;color:#0a7a2f}
		.kandi-status-pending,.kandi-status-requested{background:#fff6dd;color:#8a6100}
		.kandi-status-suspended,.kandi-status-rejected,.kandi-status-cancelled{background:#fdeaea;color:#a51f1f}
	</style>';
}

/* -------------------------------------------------------------------------
 * 10. Keep sellers out of wp-admin
 * ---------------------------------------------------------------------- */

add_action( 'admin_init', function () {
	if (
		is_user_logged_in()
		&& kandi_is_seller( get_current_user_id() )
		&& ! current_user_can( 'manage_woocommerce' )
		&& ! wp_doing_ajax()
	) {
		wp_safe_redirect( home_url( '/seller' ) );
		exit;
	}
} );

add_filter( 'show_admin_bar', function ( $show ) {
	return kandi_is_seller( get_current_user_id() ) ? false : $show;
} );
