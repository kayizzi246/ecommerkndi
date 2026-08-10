<?php
/**
 * Plugin Name: Kandi Owner API
 * Description: Owner-only REST endpoints (kandi/v1/owner) that let the shop owner add, edit and delete ANY product from the Kandi storefront without a seller account.
 * Version: 1.0.0
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
 * 1. Authentication
 *
 * Two credentials, both required. The shared secret proves the request came
 * from the storefront's server (it never reaches the browser); the owner
 * passcode proves the person driving it is the owner. Neither is a session, so
 * there is nothing to expire or refresh — the storefront keeps the passcode in
 * an httpOnly cookie and replays it on each call.
 * ---------------------------------------------------------------------- */

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

function kandi_owner_passcode() {
	if ( defined( 'KANDI_OWNER_PASSCODE' ) ) {
		return (string) KANDI_OWNER_PASSCODE;
	}
	return (string) get_option( 'kandi_owner_passcode', '' );
}

/**
 * Permission callback for every owner endpoint.
 *
 * Comparisons use hash_equals so a wrong passcode takes the same time to reject
 * however many leading characters it got right.
 */
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

/* -------------------------------------------------------------------------
 * 2. Formatting + write helpers
 *
 * Deliberately self-contained: this file must work whether or not the Seller
 * Centre plugin is installed alongside it.
 * ---------------------------------------------------------------------- */

/** Turns a WC_Product into the shape the storefront's admin screen consumes. */
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

/** Applies size/colour lists as custom (non-taxonomy) product attributes. */
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

/**
 * Sideloads remote image URLs into the media library. The first becomes the
 * main image, the rest the gallery. Existing images are replaced, so sending
 * the list a product already has is a no-op from the shopper's point of view.
 */
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

/** Assigns a product to a category by name, creating the term if it is new. */
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
	}
}

/** The statuses the owner is allowed to set. */
function kandi_owner_clean_status( $status ) {
	$status = (string) $status;
	return in_array( $status, array( 'publish', 'draft', 'pending' ), true ) ? $status : '';
}

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
