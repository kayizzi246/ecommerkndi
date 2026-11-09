<?php
/**
 * Plugin Name: Kandi Owner API
 * Description: Owner-only REST endpoints (kandi/v1/owner) that let the shop owner add, edit and delete ANY product from the Kandi storefront without a seller account.
 * Version: 1.2.0
 * Author: Kandi UG
 *
 * WHY THIS EXISTS
 * The Seller Centre endpoints in kandi-seller-api.php are scoped to one seller:
 * every query filters on the `_kandi_seller_id` post meta, and creating a
 * listing requires an approved seller account. Products added in wp-admin carry
 * no such meta, so the shop owner's own catalogue is invisible to that API and
 * cannot be edited through it. These endpoints are the owner's way in: they see
 * every product regardless of who owns it, and anything created here is
 * published immediately rather than queued for approval.
 *
 * HOW TO INSTALL (choose ONE):
 *  A) Code Snippets plugin: copy everything BELOW this comment block into a new
 *     snippet and activate it.
 *  B) Plugin: upload this file to
 *     wp-content/plugins/kandi-owner-api/kandi-owner-api.php and activate
 *     "Kandi Owner API" in wp-admin > Plugins.
 *
 * THEN add BOTH secrets to wp-config.php:
 *     define( 'KANDI_API_SECRET',      'the-same-value-the-storefront-uses' );
 *     define( 'KANDI_OWNER_PASSCODE',  'a-long-random-passcode-only-you-know' );
 * The same two values go in the Next.js .env.local as KANDI_API_SECRET and
 * KANDI_OWNER_PASSCODE.
 *
 * Requires WooCommerce to be active.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* -------------------------------------------------------------------------
 * Loading twice must not be fatal.
 *
 * Uploading a plugin to two paths — inside its own directory and loose in
 * wp-content/plugins/ — makes wp-admin list it twice, and activating the idle
 * copy used to die with "Cannot redeclare kandi_…()", which wp-admin reports
 * only as "Plugin could not be activated because it triggered a fatal error."
 *
 * Two guards, and the one below is the lesser of them: it stops the hook
 * registrations at the foot of this file running twice. It does NOT stop a
 * redeclare, because PHP early-binds functions declared unconditionally at the
 * top level while the file is COMPILED — before any statement here executes.
 * What actually prevents that is the `if ( ! function_exists( … ) ) :` wrapper
 * around every function in this file. See kandi-notifications.php for the long
 * version of the argument.
 * ---------------------------------------------------------------------- */

if ( defined( 'KANDI_OWNER_API_LOADED' ) ) {
	return;
}
define( 'KANDI_OWNER_API_LOADED', true );

/* -------------------------------------------------------------------------
 * 1. Authentication
 *
 * Two credentials, both required. The shared secret proves the request came
 * from the storefront's server (it never reaches the browser); the owner
 * passcode proves the person driving it is the owner. Neither is a session, so
 * there is nothing to expire or refresh — the storefront keeps the passcode in
 * an httpOnly cookie and replays it on each call.
 * ---------------------------------------------------------------------- */

if ( ! function_exists( 'kandi_owner_shared_secret' ) ) :
function kandi_owner_shared_secret() {
	// kandi-store-api.php owns the resolution order (wp-config constant, then
	// the settings screen, then the legacy fallback).
	if ( function_exists( 'kandi_shared_secret' ) ) {
		return kandi_shared_secret();
	}
	if ( defined( 'KANDI_API_SECRET' ) && KANDI_API_SECRET ) {
		return (string) KANDI_API_SECRET;
	}
	return (string) get_option( 'kandi_api_secret', '' );
}
endif;

if ( ! function_exists( 'kandi_owner_passcode' ) ) :
function kandi_owner_passcode() {
	if ( defined( 'KANDI_OWNER_PASSCODE' ) ) {
		return (string) KANDI_OWNER_PASSCODE;
	}
	return (string) get_option( 'kandi_owner_passcode', '' );
}
endif;

/**
 * Permission callback for every owner endpoint.
 *
 * Comparisons use hash_equals so a wrong passcode takes the same time to reject
 * however many leading characters it got right.
 */
if ( ! function_exists( 'kandi_owner_permission' ) ) :
function kandi_owner_permission( WP_REST_Request $request ) {
	$secret = kandi_owner_shared_secret();
	if ( '' === $secret ) {
		return new WP_Error( 'kandi_no_secret', 'KANDI_API_SECRET is not configured on the server.', array( 'status' => 500 ) );
	}
	if ( ! hash_equals( $secret, (string) $request->get_header( 'x-kandi-secret' ) ) ) {
		return new WP_Error( 'kandi_forbidden', 'Invalid API secret.', array( 'status' => 403 ) );
	}

	$passcode = kandi_owner_passcode();
	if ( '' === $passcode ) {
		return new WP_Error(
			'kandi_no_passcode',
			'KANDI_OWNER_PASSCODE is not set in wp-config.php, so owner access is switched off.',
			array( 'status' => 500 )
		);
	}
	if ( ! hash_equals( $passcode, (string) $request->get_header( 'x-kandi-owner-passcode' ) ) ) {
		return new WP_Error( 'kandi_owner_denied', 'That passcode is not right.', array( 'status' => 401 ) );
	}

	return true;
}
endif;

/* -------------------------------------------------------------------------
 * 2. Formatting + write helpers
 *
 * Deliberately self-contained: this file must work whether or not the Seller
 * Centre plugin is installed alongside it.
 * ---------------------------------------------------------------------- */

/** Turns a WC_Product into the shape the storefront's admin screen consumes. */
if ( ! function_exists( 'kandi_owner_format_product' ) ) :
function kandi_owner_format_product( $product ) {
	if ( ! $product ) {
		return null;
	}

	$image_id = $product->get_image_id();

	$categories = array();
	$terms      = get_the_terms( $product->get_id(), 'product_cat' );
	if ( $terms && ! is_wp_error( $terms ) ) {
		foreach ( $terms as $term ) {
			$categories[] = $term->name;
		}
	}

	$gallery = array();
	foreach ( $product->get_gallery_image_ids() as $gallery_id ) {
		$url = wp_get_attachment_image_url( $gallery_id, 'medium' );
		if ( $url ) {
			$gallery[] = $url;
		}
	}

	// A listing may belong to a marketplace seller, or to the shop itself. The
	// admin screen shows which, so the owner does not edit a seller's product
	// without realising it.
	$seller_id   = (int) get_post_meta( $product->get_id(), '_kandi_seller_id', true );
	$seller_name = '';
	if ( $seller_id ) {
		$seller_name = (string) get_user_meta( $seller_id, '_kandi_store_name', true );
		if ( '' === $seller_name ) {
			$seller      = get_userdata( $seller_id );
			$seller_name = $seller ? $seller->display_name : '';
		}
	}

	$regular = (float) $product->get_regular_price();
	$sale    = '' !== $product->get_sale_price() ? (float) $product->get_sale_price() : null;

	return array(
		'id'                => $product->get_id(),
		'name'              => $product->get_name(),
		'sku'               => (string) $product->get_sku(),
		'status'            => $product->get_status(),
		'price'             => (float) ( '' !== $product->get_price() ? $product->get_price() : $regular ),
		'regular_price'     => $regular,
		'sale_price'        => $sale,
		'stock_status'      => $product->get_stock_status(),
		'stock_quantity'    => $product->get_stock_quantity(),
		'image'             => $image_id ? wp_get_attachment_image_url( $image_id, 'medium' ) : '',
		'gallery'           => $gallery,
		'categories'        => $categories,
		'description'       => $product->get_description(),
		'short_description' => $product->get_short_description(),
		'units_sold'        => (int) get_post_meta( $product->get_id(), 'total_sales', true ),
		'permalink'         => get_permalink( $product->get_id() ),
		'created_at'        => $product->get_date_created() ? $product->get_date_created()->date( 'c' ) : null,
		'seller_id'         => $seller_id,
		'seller_name'       => $seller_name,
	);
}
endif;

/** Applies size/colour lists as custom (non-taxonomy) product attributes. */
if ( ! function_exists( 'kandi_owner_apply_attributes' ) ) :
function kandi_owner_apply_attributes( $product, $sizes, $colors ) {
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
endif;

/**
 * Sideloads remote image URLs into the media library. The first becomes the
 * main image, the rest the gallery. Existing images are replaced, so sending
 * the list a product already has is a no-op from the shopper's point of view.
 */
if ( ! function_exists( 'kandi_owner_attach_images' ) ) :
function kandi_owner_attach_images( $product_id, $urls ) {
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

	$product = wc_get_product( $product_id );
	if ( ! $product ) {
		return;
	}

	$product->set_image_id( array_shift( $attachment_ids ) );
	$product->set_gallery_image_ids( $attachment_ids );
	$product->save();
}
endif;

/** Assigns a product to a category by name, creating the term if it is new. */
if ( ! function_exists( 'kandi_owner_set_category' ) ) :
function kandi_owner_set_category( $product_id, $category ) {
	$category = sanitize_text_field( (string) $category );
	if ( '' === $category ) {
		return;
	}

	$term = term_exists( $category, 'product_cat' );
	if ( ! $term ) {
		$term = wp_insert_term( $category, 'product_cat' );
	}
	if ( ! is_wp_error( $term ) ) {
		wp_set_object_terms( $product_id, (int) $term['term_id'], 'product_cat' );
		// The owner chose this by hand: automatic filing must not undo it.
		update_post_meta( $product_id, '_kandi_autocat_done', 'owner' );
	}
}
endif;

/** The statuses the owner is allowed to set. */
if ( ! function_exists( 'kandi_owner_clean_status' ) ) :
function kandi_owner_clean_status( $status ) {
	$status = (string) $status;
	return in_array( $status, array( 'publish', 'draft', 'pending' ), true ) ? $status : '';
}
endif;

/* -------------------------------------------------------------------------
 * 3. Routes
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', function () {

	/* ---- GET /owner/me — used to check a passcode at sign-in ---- */
	register_rest_route( 'kandi/v1', '/owner/me', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_owner_permission',
		'callback'            => function () {
			return rest_ensure_response( array(
				'ok'         => true,
				'site_name'  => get_bloginfo( 'name' ),
				'currency'   => function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : '',
				'products'   => (int) wp_count_posts( 'product' )->publish,
			) );
		},
	) );

	/* ---- GET /owner/categories — for the category picker ---- */
	register_rest_route( 'kandi/v1', '/owner/categories', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_owner_permission',
		'callback'            => function () {
			$terms = get_terms( array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => false,
				'orderby'    => 'name',
			) );

			if ( is_wp_error( $terms ) ) {
				return rest_ensure_response( array( 'categories' => array() ) );
			}

			return rest_ensure_response( array(
				'categories' => array_map(
					function ( $term ) {
						return array(
							'id'    => $term->term_id,
							'name'  => $term->name,
							'slug'  => $term->slug,
							'count' => (int) $term->count,
						);
					},
					$terms
				),
			) );
		},
	) );

	/* ---- GET|POST /owner/products ---- */
	register_rest_route( 'kandi/v1', '/owner/products', array(
		array(
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => 'kandi_owner_permission',
			'callback'            => function ( WP_REST_Request $request ) {
				// No `_kandi_seller_id` filter anywhere in this query: that
				// filter is exactly what hides the owner's own catalogue from
				// the Seller Centre.
				$args = array(
					'limit'   => min( 500, max( 1, (int) ( $request->get_param( 'per_page' ) ?: 200 ) ) ),
					'status'  => array( 'publish', 'pending', 'draft', 'private' ),
					'orderby' => 'date',
					'order'   => 'DESC',
				);

				$search = sanitize_text_field( (string) $request->get_param( 'search' ) );
				if ( '' !== $search ) {
					$args['s'] = $search;
				}

				$products = wc_get_products( $args );

				return rest_ensure_response( array(
					'products' => array_values( array_filter( array_map( 'kandi_owner_format_product', $products ) ) ),
				) );
			},
		),
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'permission_callback' => 'kandi_owner_permission',
			'callback'            => function ( WP_REST_Request $request ) {
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

				$quantity = max( 0, (int) ( $body['stock_quantity'] ?? 0 ) );

				$product = new WC_Product_Simple();
				$product->set_name( $name );
				// The owner does not queue for their own approval.
				$product->set_status( kandi_owner_clean_status( $body['status'] ?? '' ) ?: 'publish' );
				$product->set_sku( sanitize_text_field( $body['sku'] ?? '' ) );
				$product->set_regular_price( (string) $regular );
				if ( $sale > 0 ) {
					$product->set_sale_price( (string) $sale );
				}
				$product->set_description( wp_kses_post( $body['description'] ?? '' ) );
				$product->set_short_description( wp_kses_post( $body['short_description'] ?? '' ) );
				$product->set_manage_stock( true );
				$product->set_stock_quantity( $quantity );
				$product->set_stock_status( $quantity > 0 ? 'instock' : 'outofstock' );

				kandi_owner_apply_attributes( $product, $body['sizes'] ?? array(), $body['colors'] ?? array() );

				try {
					$product_id = $product->save();
				} catch ( Exception $exception ) {
					return new WP_Error( 'kandi_save_failed', $exception->getMessage(), array( 'status' => 500 ) );
				}

				if ( ! $product_id ) {
					return new WP_Error( 'kandi_save_failed', 'The product could not be saved.', array( 'status' => 500 ) );
				}

				kandi_owner_set_category( $product_id, $body['category'] ?? '' );
				kandi_owner_attach_images( $product_id, $body['image_urls'] ?? array() );

				return rest_ensure_response( array(
					'product' => kandi_owner_format_product( wc_get_product( $product_id ) ),
				) );
			},
		),
	) );

	/* ---- PUT|DELETE /owner/products/{id} ---- */
	register_rest_route( 'kandi/v1', '/owner/products/(?P<id>\d+)', array(
		array(
			'methods'             => WP_REST_Server::EDITABLE,
			'permission_callback' => 'kandi_owner_permission',
			'callback'            => function ( WP_REST_Request $request ) {
				$product_id = (int) $request['id'];
				$product    = wc_get_product( $product_id );

				// No ownership check: every product on the site is the owner's
				// to edit, seller-listed or not.
				if ( ! $product ) {
					return new WP_Error( 'kandi_not_found', 'Product not found.', array( 'status' => 404 ) );
				}

				$body = (array) $request->get_json_params();

				if ( isset( $body['name'] ) ) {
					$name = sanitize_text_field( $body['name'] );
					if ( '' === $name ) {
						return new WP_Error( 'kandi_missing_name', 'The product needs a name.', array( 'status' => 400 ) );
					}
					$product->set_name( $name );
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

				// Price validation reads whichever of the pair is not being
				// changed off the product, so raising the regular price alone
				// cannot leave a sale price sitting above it.
				$regular = isset( $body['regular_price'] ) ? (float) $body['regular_price'] : (float) $product->get_regular_price();
				$sale    = array_key_exists( 'sale_price', $body )
					? ( null === $body['sale_price'] ? 0 : (float) $body['sale_price'] )
					: ( '' !== $product->get_sale_price() ? (float) $product->get_sale_price() : 0 );

				if ( isset( $body['regular_price'] ) && $regular <= 0 ) {
					return new WP_Error( 'kandi_bad_price', 'Enter a regular price greater than zero.', array( 'status' => 400 ) );
				}
				if ( $sale > 0 && $sale >= $regular ) {
					return new WP_Error( 'kandi_bad_sale_price', 'The sale price must be lower than the regular price.', array( 'status' => 400 ) );
				}

				if ( isset( $body['regular_price'] ) ) {
					$product->set_regular_price( (string) $regular );
				}
				if ( array_key_exists( 'sale_price', $body ) ) {
					$product->set_sale_price( $sale > 0 ? (string) $sale : '' );
				}

				if ( isset( $body['stock_quantity'] ) ) {
					$quantity = max( 0, (int) $body['stock_quantity'] );
					$product->set_manage_stock( true );
					$product->set_stock_quantity( $quantity );
					$product->set_stock_status( $quantity > 0 ? 'instock' : 'outofstock' );
				}
				if ( isset( $body['sizes'] ) || isset( $body['colors'] ) ) {
					kandi_owner_apply_attributes( $product, $body['sizes'] ?? array(), $body['colors'] ?? array() );
				}

				// Unlike a seller, the owner may publish as well as hide.
				$status = kandi_owner_clean_status( $body['status'] ?? '' );
				if ( '' !== $status ) {
					$product->set_status( $status );
				}

				$product->save();

				kandi_owner_set_category( $product_id, $body['category'] ?? '' );
				kandi_owner_attach_images( $product_id, $body['image_urls'] ?? array() );

				return rest_ensure_response( array(
					'product' => kandi_owner_format_product( wc_get_product( $product_id ) ),
				) );
			},
		),
		array(
			'methods'             => WP_REST_Server::DELETABLE,
			'permission_callback' => 'kandi_owner_permission',
			'callback'            => function ( WP_REST_Request $request ) {
				$product_id = (int) $request['id'];

				if ( ! wc_get_product( $product_id ) ) {
					return new WP_Error( 'kandi_not_found', 'Product not found.', array( 'status' => 404 ) );
				}

				// Trashed by default so past orders keep their line items; pass
				// ?force=1 to delete permanently.
				if ( $request->get_param( 'force' ) ) {
					wp_delete_post( $product_id, true );
				} else {
					wp_trash_post( $product_id );
				}

				return rest_ensure_response( array( 'ok' => true ) );
			},
		),
	) );
} );

/* -------------------------------------------------------------------------
 * 4. Sales overview — GET /owner/stats?range=7d|30d|90d|mtd|ytd
 *
 * The admin's front page. It answers, in this order, the questions that turn
 * into money today:
 *
 *   1. Who tried to pay and did not finish? (`recover`) Each one is a shopper
 *      who chose a product, typed an address and reached the payment step, so
 *      a phone call or a WhatsApp message wins back a sale already made in
 *      their head. Nothing else on the page converts as cheaply.
 *   2. What is paid and waiting to be sent? (`to_ship`) Late dispatch is how a
 *      first order fails to become a second one.
 *   3. Which proven sellers can no longer be bought? (`sold_out_best`) A best
 *      seller at zero stock is losing sales every hour it stays that way.
 *   4. Only then the figures: revenue, orders, average order, best sellers.
 *
 * Self-contained like the rest of this file: no Seller Centre helpers, so it
 * works on an install without that plugin.
 * ---------------------------------------------------------------------- */

/**
 * Real UTC timestamps for a named range, measured in the shop's own timezone,
 * plus the equally long window before it for the change figures.
 */
if ( ! function_exists( 'kandi_owner_range' ) ) :
function kandi_owner_range( $range ) {
	$zone  = wp_timezone();
	$now   = new DateTimeImmutable( 'now', $zone );
	$today = $now->setTime( 0, 0, 0 );

	switch ( is_string( $range ) ? strtolower( $range ) : '30d' ) {
		case '7d':
			$start = $today->modify( '-6 days' );
			break;
		case '90d':
			$start = $today->modify( '-89 days' );
			break;
		case 'mtd':
			$start = $today->modify( 'first day of this month' );
			break;
		case 'ytd':
			$start = $today->setDate( (int) $today->format( 'Y' ), 1, 1 );
			break;
		case '30d':
		default:
			$start = $today->modify( '-29 days' );
			break;
	}

	$start_ts = $start->getTimestamp();
	$end_ts   = $now->getTimestamp();
	$span     = max( DAY_IN_SECONDS, $end_ts - $start_ts );

	return array(
		'start'          => $start_ts,
		'end'            => $end_ts,
		'previous_start' => $start_ts - $span,
		'previous_end'   => $start_ts - 1,
		'start_date'     => $start,
		'zone'           => $zone,
	);
}
endif;

/** Order ids in a status set and time window, newest first, with a hard cap. */
if ( ! function_exists( 'kandi_owner_order_ids' ) ) :
function kandi_owner_order_ids( $statuses, $from, $to, $limit = 3000 ) {
	return wc_get_orders( array(
		'limit'        => $limit,
		'status'       => $statuses,
		'date_created' => $from . '...' . $to,
		'orderby'      => 'date',
		'order'        => 'DESC',
		'return'       => 'ids',
	) );
}
endif;

/** The one-line shape an order takes in the admin's action lists. */
if ( ! function_exists( 'kandi_owner_order_row' ) ) :
function kandi_owner_order_row( $order ) {
	$items = array();
	$units = 0;
	foreach ( $order->get_items() as $item ) {
		$items[] = $item->get_name();
		$units  += (int) $item->get_quantity();
	}

	$name = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );

	return array(
		'id'         => $order->get_id(),
		'number'     => (string) $order->get_order_number(),
		'status'     => $order->get_status(),
		'total'      => (float) $order->get_total(),
		'customer'   => '' !== $name ? $name : 'Guest',
		'phone'      => (string) $order->get_billing_phone(),
		'city'       => (string) ( $order->get_shipping_city() ? $order->get_shipping_city() : $order->get_billing_city() ),
		'items'      => $items,
		'units'      => $units,
		'created_at' => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : null,
		'edit_url'   => admin_url( 'post.php?post=' . $order->get_id() . '&action=edit' ),
	);
}
endif;

/** Net order value: what was charged, less anything already refunded. */
if ( ! function_exists( 'kandi_owner_net_total' ) ) :
function kandi_owner_net_total( $order ) {
	return (float) $order->get_total() - (float) $order->get_total_refunded();
}
endif;

add_action( 'rest_api_init', function () {
	register_rest_route( 'kandi/v1', '/owner/stats', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_owner_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			if ( ! function_exists( 'wc_get_orders' ) ) {
				return new WP_Error( 'kandi_no_woocommerce', 'WooCommerce is not active.', array( 'status' => 500 ) );
			}

			$range = kandi_owner_range( $request->get_param( 'range' ) );

			// What counts as a sale. `on-hold` is in because cash-on-delivery
			// and manual payments wait there; leaving it out would hide real
			// orders from the revenue figure.
			$paid = array( 'processing', 'completed', 'on-hold' );

			/* ---- Current window: totals, daily series, best sellers ---- */
			$revenue  = 0.0;
			$units    = 0;
			$by_day   = array();
			$products = array();

			$ids = kandi_owner_order_ids( $paid, $range['start'], $range['end'] );
			foreach ( $ids as $order_id ) {
				$order = wc_get_order( $order_id );
				if ( ! $order ) {
					continue;
				}

				$total    = kandi_owner_net_total( $order );
				$revenue += $total;

				$created = $order->get_date_created();
				if ( $created ) {
					$day = $created->setTimezone( $range['zone'] )->format( 'Y-m-d' );
					if ( ! isset( $by_day[ $day ] ) ) {
						$by_day[ $day ] = array( 'revenue' => 0.0, 'orders' => 0 );
					}
					$by_day[ $day ]['revenue'] += $total;
					$by_day[ $day ]['orders']  += 1;
				}

				foreach ( $order->get_items() as $item ) {
					$product_id = (int) $item->get_product_id();
					$qty        = (int) $item->get_quantity();
					$units     += $qty;
					if ( ! isset( $products[ $product_id ] ) ) {
						$products[ $product_id ] = array(
							'id'      => $product_id,
							'name'    => $item->get_name(),
							'units'   => 0,
							'revenue' => 0.0,
						);
					}
					$products[ $product_id ]['units']   += $qty;
					$products[ $product_id ]['revenue'] += (float) $item->get_total();
				}
			}

			$orders = count( $ids );

			// Every day in the window, including the empty ones — a chart that
			// skips a day with no sales draws a line straight across the gap
			// and hides exactly the day worth asking about.
			$series = array();
			$cursor = $range['start_date'];
			$last   = ( new DateTimeImmutable( 'now', $range['zone'] ) )->format( 'Y-m-d' );
			for ( $guard = 0; $guard < 400; $guard++ ) {
				$key      = $cursor->format( 'Y-m-d' );
				$series[] = array(
					'date'    => $key,
					'revenue' => round( isset( $by_day[ $key ] ) ? $by_day[ $key ]['revenue'] : 0, 2 ),
					'orders'  => isset( $by_day[ $key ] ) ? (int) $by_day[ $key ]['orders'] : 0,
				);
				if ( $key >= $last ) {
					break;
				}
				$cursor = $cursor->modify( '+1 day' );
			}

			usort( $products, function ( $a, $b ) {
				return $b['revenue'] <=> $a['revenue'];
			} );
			$top = array_slice( array_values( $products ), 0, 8 );

			/* ---- Previous window, for the change figures ---- */
			$previous_revenue = 0.0;
			$previous_ids     = kandi_owner_order_ids( $paid, $range['previous_start'], $range['previous_end'] );
			foreach ( $previous_ids as $order_id ) {
				$order = wc_get_order( $order_id );
				if ( $order ) {
					$previous_revenue += kandi_owner_net_total( $order );
				}
			}
			$previous_orders = count( $previous_ids );

			$change = function ( $current, $previous ) {
				if ( $previous <= 0 ) {
					return $current > 0 ? 100.0 : 0.0;
				}
				return round( ( ( $current - $previous ) / $previous ) * 100, 1 );
			};

			/* ---- Unfinished payments in the last 7 days: the recovery list ---- */
			// Always the last week, whatever range is picked: a shopper who gave
			// up three months ago is not a call worth making, and one from
			// yesterday very much is.
			$week_ago        = time() - 7 * DAY_IN_SECONDS;
			$unpaid_statuses = array( 'pending', 'failed' );
			if ( get_post_status_object( 'wc-checkout-draft' ) ) {
				$unpaid_statuses[] = 'checkout-draft';
			}

			$recover     = array();
			$recover_sum = 0.0;
			$seen        = array();
			foreach ( kandi_owner_order_ids( $unpaid_statuses, $week_ago, time(), 200 ) as $order_id ) {
				$order = wc_get_order( $order_id );
				if ( ! $order || $order->is_paid() ) {
					continue;
				}

				// One row per shopper. Someone who retried the payment three
				// times is one phone call, not three, and three rows would
				// triple-count the money on the table.
				$raw_phone = (string) $order->get_billing_phone();
				$phone     = preg_replace( '/\D+/', '', $raw_phone );
				$key       = '' !== $phone ? $phone : 'order-' . $order_id;
				if ( isset( $seen[ $key ] ) ) {
					continue;
				}
				$seen[ $key ] = true;

				// A shopper who went on to pay through a later order does not
				// need a call about the abandoned one.
				$created = $order->get_date_created();
				if ( '' !== $phone && $created ) {
					$paid_since = wc_get_orders( array(
						'limit'         => 1,
						'return'        => 'ids',
						'status'        => $paid,
						'billing_phone' => $raw_phone,
						'date_created'  => '>=' . $created->getTimestamp(),
					) );
					if ( ! empty( $paid_since ) ) {
						continue;
					}
				}

				$recover[]    = kandi_owner_order_row( $order );
				$recover_sum += (float) $order->get_total();
			}

			/* ---- Paid and waiting to be sent ---- */
			$to_ship_ids = wc_get_orders( array(
				'limit'   => 50,
				'status'  => array( 'processing', 'on-hold' ),
				'orderby' => 'date',
				'order'   => 'ASC', // Oldest first: they have waited longest.
				'return'  => 'ids',
			) );
			$to_ship = array();
			foreach ( $to_ship_ids as $order_id ) {
				$order = wc_get_order( $order_id );
				if ( $order ) {
					$to_ship[] = kandi_owner_order_row( $order );
				}
			}

			/* ---- Best sellers that can no longer be bought ---- */
			// Sorted here rather than in the query: ordering wc_get_products by a
			// meta value is not portable across WooCommerce versions, and the
			// out-of-stock list is short enough to sort in PHP.
			$sold_out_ids = wc_get_products( array(
				'status'       => 'publish',
				'stock_status' => 'outofstock',
				'limit'        => -1,
				'return'       => 'ids',
			) );
			$sold_counts = array();
			foreach ( $sold_out_ids as $product_id ) {
				$sold = (int) get_post_meta( $product_id, 'total_sales', true );
				if ( $sold > 0 ) {
					$sold_counts[ $product_id ] = $sold; // Never sold: not urgent.
				}
			}
			arsort( $sold_counts );

			$sold_out_best = array();
			foreach ( array_slice( $sold_counts, 0, 8, true ) as $product_id => $sold ) {
				$product = wc_get_product( $product_id );
				if ( ! $product ) {
					continue;
				}
				$image_id        = $product->get_image_id();
				$sold_out_best[] = array(
					'id'         => (int) $product_id,
					'name'       => $product->get_name(),
					'units_sold' => $sold,
					'price'      => (float) $product->get_price(),
					'image'      => $image_id ? (string) wp_get_attachment_image_url( $image_id, 'thumbnail' ) : '',
				);
			}

			return rest_ensure_response( array(
				'currency'          => get_woocommerce_currency(),
				'revenue'           => round( $revenue, 2 ),
				'revenue_change'    => $change( $revenue, $previous_revenue ),
				'orders'            => $orders,
				'orders_change'     => $change( $orders, $previous_orders ),
				'average_order'     => $orders > 0 ? round( $revenue / $orders, 2 ) : 0,
				'units_sold'        => $units,
				'revenue_series'    => $series,
				'top_products'      => $top,
				'recover'           => $recover,
				'recover_total'     => round( $recover_sum, 2 ),
				'to_ship'           => $to_ship,
				'sold_out_best'     => $sold_out_best,
				'products_live'     => (int) wp_count_posts( 'product' )->publish,
				'products_sold_out' => count( $sold_out_ids ),
			) );
		},
	) );
} );

/* -------------------------------------------------------------------------
 * 5. Automatic categories
 *
 * Imported and seller-listed products arrive in the wrong place more often
 * than the right one: men's watches under Women, sweatpants under Hoodies,
 * slippers under Formal Shoes, a fifth of them under nothing at all. A shopper
 * who opens Men > Shoes > Sneakers and finds a dish rack stops trusting the
 * menu.
 *
 * Product titles here are long and descriptive ("Men's Casual Sneakers ...",
 * "Unisex Hoodie ...", "Kids School Backpack ..."), so the title says both WHO
 * an item is for and WHAT it is. These rules read both and file the product
 * under the shop's EXISTING category tree, matched by name, so nothing is ever
 * created and a category renamed in wp-admin simply stops matching rather than
 * being recreated.
 *
 *   - New products are filed automatically the first time they are published,
 *     at the end of the request, after any importer has set its own terms.
 *   - Existing products are filed from the admin's Categories screen, which
 *     previews every change before anything is written.
 *   - A category the owner picks by hand in /admin is never overridden.
 *   - A title that matches no rule is left exactly as it is.
 * ---------------------------------------------------------------------- */

/**
 * The rules, in priority order: the first type whose pattern matches wins.
 *
 * Each type maps a department to path alternatives under it, tried in order;
 * when none exists in the shop's tree, the deepest existing ancestor of the
 * first one is used. `shoes` and `hoodie` choose their sub-category from the
 * title (see kandi_autocat_shoe_paths / kandi_autocat_hoodie_paths).
 */
if ( ! function_exists( 'kandi_autocat_types' ) ) :
function kandi_autocat_types() {
	$plain = array( 'Men' => array( array() ), 'Women' => array( array() ), 'Kids' => array( array() ) );

	return array(
		array( 'home-bin', '/\b(trash can|dustbin|waste bin|garbage)\b/', array( 'Home' => array( array( 'Storage & Organization' ) ) ) ),
		array( 'home-kitchen', '/\b(dish|kitchen|fruit basket|fruit storage|vegetable|sponge holder|drain rack|cutlery|spice|cookware|plate rack|frother|mixer|blender)\b/', array( 'Home' => array( array( 'Kitchen & Dining' ) ) ) ),
		array( 'home-storage', '/\b(drying rack|clothes ?line|laundry|garment rack|floor hanger|mop|organi[sz]er|storage box|shoe rack)\b/', array( 'Home' => array( array( 'Storage & Organization' ) ) ) ),
		array( 'home-rug', '/\b(carpets?|rugs?|doormats?)\b/', array( 'Home' => array( array( 'Rugs & Carpets' ), array( 'Rugs' ) ) ) ),
		array( 'home-light', '/\b(lamps?|chandeliers?|night light|led strip)\b/', array( 'Home' => array( array( 'Lamps & Lighting' ), array( 'Lighting' ) ) ) ),
		array( 'home-bed', '/\b(curtains?|bedsheets?|bed sheets?|duvets?|pillowcases?|bedding)\b/', array( 'Home' => array( array( 'Bedding & Curtains' ) ) ) ),
		array( 'home-misc', '/\b(cushion covers?|sofa cushions?|throw pillows?|vases?|planters?|wall art|wall clocks?|mirrors?|candles?)\b/', array( 'Home' => array( array() ) ) ),
		array( 'watch', '/\b(watch|watches|wristwatch)\b/', array( 'Men' => array( array( 'Watches' ) ), 'Women' => array( array( 'Watches' ) ), 'Kids' => array( array() ) ) ),
		array( 'grooming', '/\bbeard\b/', array( 'Men' => array( array() ), 'Women' => array( array( 'Beauty & Makeup' ) ), 'Kids' => array( array() ) ) ),
		array( 'hair', '/\b(wigs?|bonnets?|hair growth|hair oil|hair essential|hair extensions?)\b/', array( 'Women' => array( array( 'Wigs & Hair' ) ), 'Men' => array( array() ), 'Kids' => array( array() ) ) ),
		array( 'beauty', '/\b(derma ?roller|micro ?needl\w*|teeth whitening|makeup|lipstick|serum|skin ?care|face mask)\b/', array( 'Women' => array( array( 'Beauty & Makeup' ) ), 'Men' => array( array() ), 'Kids' => array( array() ) ) ),
		array( 'perfume', '/\b(perfumes?|fragrances?|cologne|eau de)\b/', array( 'Men' => array( array( 'Perfumes' ) ), 'Women' => array( array( 'Perfumes' ) ), 'Kids' => array( array() ) ) ),
		array( 'necklace', '/\b(necklaces?|pendants?)\b/', array( 'Men' => array( array( 'Jewelry', 'Necklaces' ) ), 'Women' => array( array( 'Jewelry', 'Necklaces' ) ), 'Kids' => array( array( 'Jewelry', 'Necklaces' ) ) ) ),
		array( 'bracelet', '/\b(bracelets?|bangles?)\b/', array( 'Men' => array( array( 'Jewelry', 'Bracelets' ) ), 'Women' => array( array( 'Jewelry', 'Bracelets' ) ), 'Kids' => array( array( 'Jewelry', 'Bracelets' ) ) ) ),
		array( 'earring', '/\b(earrings?|ear studs?)\b/', array( 'Women' => array( array( 'Jewelry', 'Earrings' ) ), 'Kids' => array( array( 'Jewelry', 'Earrings' ) ), 'Men' => array( array( 'Jewelry' ) ) ) ),
		array( 'anklet', '/\banklets?\b/', array( 'Women' => array( array( 'Jewelry', 'Anklets' ) ), 'Men' => array( array( 'Jewelry' ) ), 'Kids' => array( array( 'Jewelry' ) ) ) ),
		array( 'ring', '/\b(rings?)\b/', array( 'Men' => array( array( 'Jewelry', 'Rings' ) ), 'Women' => array( array( 'Jewelry', 'Rings' ) ), 'Kids' => array( array( 'Jewelry' ) ) ) ),
		array( 'bag', '/\b(bags?|backpacks?|bookbag|schoolbag|wallets?|purses?|totes?|handbags?|satchels?|duffel|luggage|suitcases?)\b/', array( 'Men' => array( array( 'Bags & Wallets' ) ), 'Women' => array( array( 'Handbags' ) ), 'Kids' => array( array() ) ) ),
		array( 'belt', '/\bbelts?\b/', array( 'Men' => array( array( 'Belts' ) ), 'Women' => array( array() ), 'Kids' => array( array() ) ) ),
		array( 'eyewear', '/\b(sunglasses|glasses|eyewear|spectacles)\b/', $plain ),
		// Shoes before clothing: "Wedding Formal Dress Shoes" is shoes, not a dress.
		array( 'shoes', '/\b(shoes?|sneakers?|trainers?|boots?|sandals?|slippers?|slides|flip ?flops?|clogs?|loafers?|oxfords?|derby|heels|pumps|flats|mules|crocs|birkenstock|footwear|runners|moccasins?)\b/', 'SHOES' ),
		array( 'hoodie', '/\b(hoodies?|hooded|sweatshirts?)\b/', 'HOODIE' ),
		array( 'bottoms', '/\b(sweatpants?|trousers|pants|jeans|joggers?|chinos)\b/', array( 'Men' => array( array( 'Trousers & Jeans' ) ), 'Women' => array( array() ), 'Kids' => array( array() ) ) ),
		array( 'underwear', '/\b(underwear|boxers?|briefs|underpants|bras?|panties|socks)\b/', $plain ),
		array( 'shorts', '/\bshorts\b/', $plain ),
		array( 'dress', '/\b(dress|dresses|gowns?|skirts?)\b/', array( 'Women' => array( array( 'Dresses' ) ), 'Men' => array( array() ), 'Kids' => array( array() ) ) ),
		array( 'top', '/\b(jerseys?|t-?shirts?|tees?|shirts?|polos?|blouses?)\b/', array( 'Men' => array( array( 'Shirts & T-shirts' ) ), 'Women' => array( array() ), 'Kids' => array( array() ) ) ),
		array( 'outerwear', '/\b(coats?|jackets?|parkas?|blazers?|sweaters?|cardigans?|pullover)\b/', $plain ),
	);
}
endif;

if ( ! function_exists( 'kandi_autocat_shoe_paths' ) ) :
function kandi_autocat_shoe_paths( $n ) {
	if ( preg_match( '/\b(slippers?|slides|flip ?flops?|clogs?|mules|crocs|hole shoes?)\b/', $n ) ) {
		$leaves = array( 'Slippers', 'Sandals' );
	} elseif ( preg_match( '/\bsandals?\b|birkenstock/', $n ) ) {
		$leaves = array( 'Sandals' );
	} elseif ( preg_match( '/\bboots?\b/', $n ) ) {
		$leaves = array( 'Boots' );
	} elseif ( preg_match( '/\b(heels|pumps|stilettos?)\b/', $n ) ) {
		$leaves = array( 'Heels' );
	} elseif ( preg_match( '/\bschool shoes?\b/', $n ) ) {
		$leaves = array( 'School Shoes' );
	} elseif ( preg_match( '/\b(loafers?|oxfords?|derby|formal|dress shoes?|wedding|brogues?|moccasins?)\b/', $n ) ) {
		$leaves = array( 'Formal Shoes' );
	} elseif ( preg_match( '/\b(running|jogging|marathon|runners)\b/', $n ) ) {
		$leaves = array( 'Running Shoes', 'Sneakers' );
	} elseif ( preg_match( '/\b(sneakers?|trainers?|skate|skateboard|board shoes?|basketball)\b/', $n ) ) {
		$leaves = array( 'Sneakers' );
	} elseif ( preg_match( '/\b(leather shoes?|business|casual shoes?)\b/', $n ) ) {
		$leaves = array( 'Formal Shoes' );
	} elseif ( preg_match( '/\b(flats|ballet)\b/', $n ) ) {
		$leaves = array( 'Flats', 'Sneakers' );
	} else {
		$leaves = array( 'Sneakers' );
	}

	$paths = array();
	foreach ( $leaves as $leaf ) {
		$paths[] = array( 'Shoes', $leaf );
	}
	return array( 'Men' => $paths, 'Women' => $paths, 'Kids' => $paths );
}
endif;

if ( ! function_exists( 'kandi_autocat_hoodie_paths' ) ) :
function kandi_autocat_hoodie_paths( $n ) {
	if ( preg_match( '/\bzip/', $n ) ) {
		$sub = 'Zip-Up Hoodies';
	} elseif ( preg_match( '/\bcrop/', $n ) ) {
		$sub = 'Cropped Hoodies';
	} elseif ( preg_match( '/\boversiz/', $n ) ) {
		$sub = 'Oversized Hoodies';
	} elseif ( preg_match( '/\b(graphic|print|printed|cartoon|letter)\b/', $n ) ) {
		$sub = 'Graphic Hoodies';
	} else {
		$sub = 'Pullover Hoodies';
	}
	$paths = array( array( 'Hoodies', $sub ), array( 'Hoodies', 'Pullover Hoodies' ) );
	return array( 'Men' => $paths, 'Women' => $paths, 'Kids' => $paths );
}
endif;

/**
 * Who the title says the item is for. Falls back to the departments the
 * product is already filed under, then to Men and Women, so a title that names
 * no-one keeps the department a seller or importer gave it.
 *
 * "Kids Girls Boys" is Kids only; "girl" on its own is Women, because that is
 * how imported fashion titles use it. "Youth" is ignored for the same reason.
 */
if ( ! function_exists( 'kandi_autocat_audience' ) ) :
function kandi_autocat_audience( $n, $current ) {
	$kids        = (bool) preg_match( "/\b(kids?|children|child|toddlers?|baby|babies|infants?|boys?|junior)\b/", $n );
	$unisex      = (bool) preg_match( "/\b(unisex|couples?|men'?s? (and|&|\/) women'?s?|women'?s? (and|&|\/) men'?s?|men women|women men|him (and|&) her)\b/", $n );
	$adult_women = (bool) preg_match( "/\b(women|woman|womens|women's|female|ladies|lady|mujer)\b/", $n );
	$adult_men   = (bool) preg_match( "/\b(men|man|mens|men's|male|gentleman|gents)\b/", $n );

	$out = array();
	if ( $unisex || $adult_men ) {
		$out[] = 'Men';
	}
	if ( $unisex || $adult_women || ( ! $kids && preg_match( '/\bgirls?\b/', $n ) ) ) {
		$out[] = 'Women';
	}
	if ( $kids ) {
		$out[] = 'Kids';
	}
	if ( ! empty( $out ) ) {
		return $out;
	}
	return ! empty( $current ) ? $current : array( 'Men', 'Women' );
}
endif;

/**
 * Every product category as "men > shoes > sneakers" => term id, decoded and
 * lower-cased, built once per request.
 */
if ( ! function_exists( 'kandi_autocat_tree' ) ) :
function kandi_autocat_tree( $refresh = false ) {
	static $tree = null;
	if ( null !== $tree && ! $refresh ) {
		return $tree;
	}

	$terms = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false ) );
	$tree  = array( 'paths' => array(), 'parents' => array(), 'roots' => array() );
	if ( is_wp_error( $terms ) ) {
		return $tree;
	}

	$by_id = array();
	foreach ( $terms as $term ) {
		$by_id[ $term->term_id ] = $term;
	}
	foreach ( $terms as $term ) {
		$names  = array();
		$cursor = $term;
		$guard  = 0;
		while ( $cursor && $guard++ < 10 ) {
			array_unshift( $names, kandi_autocat_norm( $cursor->name ) );
			$cursor = $cursor->parent && isset( $by_id[ $cursor->parent ] ) ? $by_id[ $cursor->parent ] : null;
		}
		$tree['paths'][ implode( ' > ', $names ) ] = (int) $term->term_id;
		$tree['parents'][ (int) $term->term_id ]   = (int) $term->parent;
		$tree['roots'][ (int) $term->term_id ]     = $names[0];
	}
	return $tree;
}
endif;

if ( ! function_exists( 'kandi_autocat_norm' ) ) :
function kandi_autocat_norm( $text ) {
	$text = html_entity_decode( wp_specialchars_decode( (string) $text, ENT_QUOTES ), ENT_QUOTES, 'UTF-8' );
	$text = str_replace( array( '’', '‘' ), "'", $text );
	return function_exists( 'mb_strtolower' ) ? mb_strtolower( trim( $text ), 'UTF-8' ) : strtolower( trim( $text ) );
}
endif;

/**
 * The category ids a product should have, leaf plus every ancestor, or null
 * when no rule matches the title (the product is then left alone).
 */
if ( ! function_exists( 'kandi_autocat_classify' ) ) :
function kandi_autocat_classify( $name, $current_ids = array() ) {
	$n    = kandi_autocat_norm( $name );
	$tree = kandi_autocat_tree();

	$map = null;
	foreach ( kandi_autocat_types() as $type ) {
		if ( preg_match( $type[1], $n ) ) {
			$map = 'SHOES' === $type[2] ? kandi_autocat_shoe_paths( $n ) : ( 'HOODIE' === $type[2] ? kandi_autocat_hoodie_paths( $n ) : $type[2] );
			break;
		}
	}
	if ( null === $map ) {
		return null;
	}

	if ( isset( $map['Home'] ) ) {
		$audiences = array( 'Home' );
	} else {
		// Departments the product is already under, for a title that names no-one.
		$current = array();
		foreach ( (array) $current_ids as $id ) {
			$root = isset( $tree['roots'][ (int) $id ] ) ? $tree['roots'][ (int) $id ] : '';
			foreach ( array( 'men' => 'Men', 'women' => 'Women', 'kids' => 'Kids' ) as $key => $label ) {
				if ( $root === $key && ! in_array( $label, $current, true ) ) {
					$current[] = $label;
				}
			}
		}
		$audiences = kandi_autocat_audience( $n, $current );
	}

	$ids = array();
	foreach ( $audiences as $audience ) {
		$root = 'Home' === $audience ? 'home decor' : strtolower( $audience );
		$alts = isset( $map[ $audience ] ) ? $map[ $audience ] : array( array() );
		$leaf = 0;

		foreach ( $alts as $alt ) {
			$key = implode( ' > ', array_merge( array( $root ), array_map( 'kandi_autocat_norm', $alt ) ) );
			if ( isset( $tree['paths'][ $key ] ) ) {
				$leaf = $tree['paths'][ $key ];
				break;
			}
		}
		if ( ! $leaf ) {
			$path = array_merge( array( $root ), array_map( 'kandi_autocat_norm', $alts[0] ) );
			for ( $i = count( $path ); $i > 0 && ! $leaf; $i-- ) {
				$key = implode( ' > ', array_slice( $path, 0, $i ) );
				if ( isset( $tree['paths'][ $key ] ) ) {
					$leaf = $tree['paths'][ $key ];
				}
			}
		}

		// Leaf plus ancestors, so the product shows under Men as well as
		// under Men > Shoes > Sneakers whichever way a listing is queried.
		$guard = 0;
		while ( $leaf && $guard++ < 10 ) {
			$ids[] = $leaf;
			$leaf  = isset( $tree['parents'][ $leaf ] ) ? $tree['parents'][ $leaf ] : 0;
		}
	}

	$ids = array_values( array_unique( array_map( 'intval', $ids ) ) );
	sort( $ids );
	return empty( $ids ) ? null : $ids;
}
endif;

/** A product's current category ids, sorted. */
if ( ! function_exists( 'kandi_autocat_current' ) ) :
function kandi_autocat_current( $product_id ) {
	$ids = wp_get_object_terms( $product_id, 'product_cat', array( 'fields' => 'ids' ) );
	$ids = is_wp_error( $ids ) ? array() : array_map( 'intval', $ids );
	sort( $ids );
	return $ids;
}
endif;

/** Files one product. Returns true when its categories changed. */
if ( ! function_exists( 'kandi_autocat_apply' ) ) :
function kandi_autocat_apply( $product_id ) {
	$current = kandi_autocat_current( $product_id );
	$target  = kandi_autocat_classify( get_the_title( $product_id ), $current );
	update_post_meta( $product_id, '_kandi_autocat_done', 'auto' );

	if ( null === $target || $target === $current ) {
		return false;
	}
	wp_set_object_terms( $product_id, $target, 'product_cat', false );
	if ( function_exists( 'wc_delete_product_transients' ) ) {
		wc_delete_product_transients( $product_id );
	}
	return true;
}
endif;

/* ---- New products: filed once, at the end of the request they are published in ----
 *
 * Not on save itself: WooCommerce and most importers write a product's terms
 * AFTER the post is inserted, so anything set during the save would be
 * overwritten a moment later. Queued, and handled on shutdown, when every
 * term the request was going to write has been written. */
if ( ! function_exists( 'kandi_autocat_queue' ) ) :
function kandi_autocat_queue( $product_id = null ) {
	static $queue = array();
	if ( null !== $product_id ) {
		$queue[ (int) $product_id ] = true;
	}
	return array_keys( $queue );
}
endif;

add_action( 'save_post_product', function ( $post_id, $post ) {
	if ( wp_is_post_revision( $post_id ) || 'publish' !== $post->post_status ) {
		return;
	}
	if ( ! get_option( 'kandi_autocat_enabled', 1 ) || get_post_meta( $post_id, '_kandi_autocat_done', true ) ) {
		return;
	}
	kandi_autocat_queue( $post_id );
}, 20, 2 );

add_action( 'shutdown', function () {
	foreach ( kandi_autocat_queue() as $product_id ) {
		// The owner may have picked a category later in the same request.
		if ( get_post_meta( $product_id, '_kandi_autocat_done', true ) ) {
			continue;
		}
		kandi_autocat_apply( $product_id );
	}
} );

/* ---- GET /owner/categorize (preview) and POST /owner/categorize (apply) ---- */
add_action( 'rest_api_init', function () {
	$names = function ( $ids ) {
		$out = array();
		foreach ( $ids as $id ) {
			$term = get_term( $id, 'product_cat' );
			if ( $term && ! is_wp_error( $term ) ) {
				// Leaves only: "Men > Shoes > Sneakers" already says Men.
				$out[ $id ] = $term;
			}
		}
		$leaves = array();
		foreach ( $out as $id => $term ) {
			$is_parent = false;
			foreach ( $out as $other ) {
				if ( (int) $other->parent === (int) $id ) {
					$is_parent = true;
					break;
				}
			}
			if ( ! $is_parent ) {
				$leaves[] = kandi_autocat_label( $id );
			}
		}
		return $leaves;
	};

	register_rest_route( 'kandi/v1', '/owner/categorize', array(
		array(
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => 'kandi_owner_permission',
			'callback'            => function () use ( $names ) {
				kandi_autocat_tree( true );
				$ids     = get_posts( array(
					'post_type'      => 'product',
					'post_status'    => array( 'publish', 'pending', 'draft', 'private' ),
					'posts_per_page' => 2000,
					'fields'         => 'ids',
					'no_found_rows'  => true,
				) );
				$changes = array();
				$skipped = 0;
				foreach ( $ids as $product_id ) {
					if ( 'owner' === get_post_meta( $product_id, '_kandi_autocat_done', true ) ) {
						$skipped++;
						continue;
					}
					$current = kandi_autocat_current( $product_id );
					$target  = kandi_autocat_classify( get_the_title( $product_id ), $current );
					if ( null === $target || $target === $current ) {
						continue;
					}
					$image     = get_post_thumbnail_id( $product_id );
					$changes[] = array(
						'id'    => (int) $product_id,
						'name'  => html_entity_decode( get_the_title( $product_id ), ENT_QUOTES, 'UTF-8' ),
						'image' => $image ? (string) wp_get_attachment_image_url( $image, 'thumbnail' ) : '',
						'from'  => $names( $current ),
						'to'    => $names( $target ),
					);
				}
				return rest_ensure_response( array(
					'checked'      => count( $ids ),
					'changes'      => $changes,
					'owner_locked' => $skipped,
					'auto_enabled' => (bool) get_option( 'kandi_autocat_enabled', 1 ),
				) );
			},
		),
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'permission_callback' => 'kandi_owner_permission',
			'callback'            => function ( WP_REST_Request $request ) {
				$body = (array) $request->get_json_params();

				if ( isset( $body['auto_enabled'] ) ) {
					update_option( 'kandi_autocat_enabled', $body['auto_enabled'] ? 1 : 0 );
				}

				$ids     = isset( $body['ids'] ) && is_array( $body['ids'] ) ? array_map( 'intval', $body['ids'] ) : array();
				$applied = 0;
				kandi_autocat_tree( true );
				foreach ( array_slice( $ids, 0, 2000 ) as $product_id ) {
					if ( 'product' !== get_post_type( $product_id ) ) {
						continue;
					}
					if ( 'owner' === get_post_meta( $product_id, '_kandi_autocat_done', true ) ) {
						continue;
					}
					if ( kandi_autocat_apply( $product_id ) ) {
						$applied++;
					}
				}
				return rest_ensure_response( array(
					'ok'           => true,
					'applied'      => $applied,
					'auto_enabled' => (bool) get_option( 'kandi_autocat_enabled', 1 ),
				) );
			},
		),
	) );
} );

/** "Men > Shoes > Sneakers" for a term id. */
if ( ! function_exists( 'kandi_autocat_label' ) ) :
function kandi_autocat_label( $term_id ) {
	$parts = array();
	$guard = 0;
	$term  = get_term( $term_id, 'product_cat' );
	while ( $term && ! is_wp_error( $term ) && $guard++ < 10 ) {
		array_unshift( $parts, html_entity_decode( $term->name, ENT_QUOTES, 'UTF-8' ) );
		$term = $term->parent ? get_term( $term->parent, 'product_cat' ) : null;
	}
	return implode( ' > ', $parts );
}
endif;
