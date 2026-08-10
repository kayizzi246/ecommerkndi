<?php
/**
 * Plugin Name: Kandi Store API
 * Description: Custom REST endpoints (kandi/v1) that expose WooCommerce products and accept orders from the Kandi Next.js storefront.
 * Version: 1.0.0
 * Author: Kandi UG
 *
 * HOW TO INSTALL (choose ONE):
 *  A) Code Snippets plugin: copy everything BELOW this comment block into a new
 *     snippet (Code Snippets strips the <?php tag automatically) and activate it.
 *  B) Plugin: upload this whole file to wp-content/plugins/kandi-store-api/kandi-store-api.php
 *     and activate "Kandi Store API" in wp-admin > Plugins.
 *
 * THEN set the shared secret used to authorize order creation. Add to wp-config.php:
 *     define( 'KANDI_API_SECRET', 'change-me-to-a-long-random-string' );
 * The same value goes in the Next.js .env.local as KANDI_API_SECRET.
 *
 * Requires WooCommerce to be active.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The shared secret the storefront proves itself with, resolved once for every
 * Kandi plugin.
 *
 * Three sources, in order of authority:
 *   1. a `KANDI_API_SECRET` constant in wp-config.php — the most secure place,
 *      because it is not in the database and not editable from wp-admin;
 *   2. the value saved under *Kandi Storefront → Storefront connection*, for
 *      installs where editing wp-config.php is not practical;
 *   3. the built-in fallback below, so an install that predates the settings
 *      screen keeps working untouched.
 *
 * This used to be a bare `define()`, which meant the constant always existed
 * and the option could never win — the settings field would have looked like it
 * saved and then done nothing.
 */
if ( ! function_exists( 'kandi_shared_secret' ) ) {
	function kandi_shared_secret() {
		if ( defined( 'KANDI_API_SECRET' ) && KANDI_API_SECRET ) {
			return (string) KANDI_API_SECRET;
		}

		$saved = (string) get_option( 'kandi_api_secret', '' );
		if ( '' !== $saved ) {
			return $saved;
		}

		return '739f20e1e2c785c3a68cef156cf22d42ade0dc3ec494f63aedf7e4b8c2cdd42e';
	}
}

/* -------------------------------------------------------------------------
 * Never let a page cache hold these responses
 *
 * THIS IS THE FIX FOR "I DELETED A PRODUCT AND IT IS STILL ON THE SHOP".
 *
 * The symptom looked like a storefront caching bug, but it was here: a page
 * cache on this server (LiteSpeed, WP Rocket, W3 Total Cache, or the host's own
 * layer) was storing `/wp-json/kandi/v1/products?per_page=18` and replaying it
 * for hours. The giveaway was that the same endpoint answered correctly on a
 * query string nobody had requested before — `?per_page=48` returned the live
 * catalogue while `?per_page=18` returned products deleted days earlier.
 *
 * WooCommerce's own Store API is exempt from those plugins by default; this
 * custom namespace was not, so it inherited whatever the site-wide page cache
 * was doing. These headers opt every kandi/v1 response out explicitly.
 * ---------------------------------------------------------------------- */

add_filter( 'rest_post_dispatch', function ( $response, $server, $request ) {
	$route = ltrim( is_object( $request ) ? (string) $request->get_route() : '', '/' );

	if ( 0 !== strpos( $route, 'kandi/v1' ) ) {
		return $response;
	}

	if ( is_object( $response ) && method_exists( $response, 'header' ) ) {
		$response->header( 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0' );
		$response->header( 'Pragma', 'no-cache' );
		$response->header( 'Expires', '0' );
		// Cloudflare and friends key on this when the URL is otherwise identical.
		$response->header( 'Vary', 'X-Kandi-Secret, X-Kandi-Storefront' );
	}

	// The constant most WordPress page-cache plugins check before storing a
	// response. Defined late like this it cannot affect anything else.
	if ( ! defined( 'DONOTCACHEPAGE' ) ) {
		define( 'DONOTCACHEPAGE', true );
	}

	return $response;
}, 10, 3 );

/**
 * Turn a WC_Product into the plain array the storefront consumes.
 */
function kandi_format_product( $product, $with_description = false ) {
	$image_id  = $product->get_image_id();
	$image_url = $image_id ? wp_get_attachment_image_url( $image_id, 'large' ) : wc_placeholder_img_src( 'large' );

	$gallery = array();
	foreach ( $product->get_gallery_image_ids() as $gallery_id ) {
		$url = wp_get_attachment_image_url( $gallery_id, 'large' );
		if ( $url ) {
			$gallery[] = $url;
		}
	}

	$categories = array();
	$terms      = get_the_terms( $product->get_id(), 'product_cat' );
	if ( $terms && ! is_wp_error( $terms ) ) {
		foreach ( $terms as $term ) {
			$categories[] = array(
				'id'   => $term->term_id,
				'name' => $term->name,
				'slug' => $term->slug,
			);
		}
	}

	// Attributes (e.g. Size, Color) so the storefront can show option pickers.
	$attributes = array();
	foreach ( $product->get_attributes() as $attribute ) {
		if ( is_object( $attribute ) && $attribute->is_taxonomy() ) {
			$terms = wc_get_product_terms( $product->get_id(), $attribute->get_name() );
			$options = array();
			foreach($terms as $term) {
				// Assumes a swatch plugin saves color hex as 'color' term meta.
				// Common plugins: 'WooCommerce Attribute Swatches', 'Variation Swatches for WooCommerce'.
				$color_val = get_term_meta( $term->term_id, 'color', true );
				$image_id  = get_term_meta( $term->term_id, 'thumbnail_id', true ); // Common key for swatch images
				$image_url = $image_id ? wp_get_attachment_image_url( $image_id, 'large' ) : null;
				$options[] = array(
					'name'  => $term->name,
					'value' => $color_val ?: null, // e.g. #RRGGBB
					'image' => $image_url,
				);
			}
		} elseif ( is_object( $attribute ) ) {
			$options = array_map(function($opt) {
				return array('name' => $opt, 'value' => null);
			}, $attribute->get_options());
		} else {
			continue;
		}
		if ( ! empty( $options ) ) {
			$attributes[] = array(
				'name'    => wc_attribute_label( $attribute->get_name() ), // e.g. "Color"
				'options' => $options, // e.g. [{ name: "Blue", value: "#0000FF" }]
			);
		}
	}

	// For variable products, add variation data (attributes, stock status, price).
	$variations_data = array();
	if ( $product->is_type( 'variable' ) ) {
		$available_variations = $product->get_available_variations();
		foreach ( $available_variations as $variation_obj ) {
			$variation_product = wc_get_product( $variation_obj['variation_id'] );
			if ( ! $variation_product ) {
				continue;
			}
			$variation_attributes = array();
			foreach ( $variation_product->get_variation_attributes() as $attr_key => $attr_value ) {
				$attr_name = wc_attribute_label( str_replace( 'attribute_', '', $attr_key ) );
				$variation_attributes[ $attr_name ] = $attr_value;
			}
			$variations_data[] = array(
				'attributes'   => $variation_attributes,
				'is_in_stock'  => $variation_product->is_in_stock(),
			);
		}
	}

	$data = array(
		'id'                => $product->get_id(),
		'name'              => $product->get_name(),
		'slug'              => $product->get_slug(),
		'price'             => (float) wc_get_price_to_display( $product ),
		'regular_price'     => (float) $product->get_regular_price(),
		'sale_price'        => $product->get_sale_price() !== '' ? (float) $product->get_sale_price() : null,
		'on_sale'           => $product->is_on_sale(),
		'featured'          => $product->is_featured(),
		'stock_status'      => $product->get_stock_status(), // instock | outofstock | onbackorder
		'stock_quantity'    => $product->get_stock_quantity(),
		'image'             => $image_url,
		'gallery'           => $gallery,
		'date_created'      => $product->get_date_created() ? $product->get_date_created()->date( 'c' ) : null,
		'short_description' => wp_strip_all_tags( $product->get_short_description() ),
		'categories'        => $categories,
		'attributes'        => $attributes,
		'variations'        => $variations_data,
		// Real review and sales figures, so the storefront tiles can show stars
		// and an "N sold" line without inventing either.
		'average_rating'    => (float) $product->get_average_rating(),
		'rating_count'      => (int) $product->get_rating_count(),
		'total_sales'       => (int) $product->get_total_sales(),
	);

	if ( $with_description ) {
		$data['description'] = wpautop( $product->get_description() );
	}

	/**
	 * Lets companion plugins extend the storefront payload. The Kandi Seller
	 * Centre uses this to attach the owning store to each product.
	 */
	return apply_filters( 'kandi_product_payload', $data, $product );
}

add_action( 'rest_api_init', function () {

	// GET /wp-json/kandi/v1/products
	register_rest_route( 'kandi/v1', '/products', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => '__return_true',
		'callback'            => function ( WP_REST_Request $request ) {
			if ( ! function_exists( 'wc_get_products' ) ) {
				return new WP_Error( 'kandi_no_woocommerce', 'WooCommerce is not active.', array( 'status' => 500 ) );
			}

			$args = array(
				'status'   => 'publish',
				'limit'    => min( 48, max( 1, (int) ( $request['per_page'] ?: 24 ) ) ),
				'page'     => max( 1, (int) ( $request['page'] ?: 1 ) ),
				'orderby'  => 'date',
				'order'    => 'DESC',
				'paginate' => true,
			);

			if ( ! empty( $request['category'] ) ) {
				$args['category'] = array( sanitize_title( $request['category'] ) );
			}
			if ( ! empty( $request['search'] ) ) {
				$args['s'] = sanitize_text_field( $request['search'] );
			}
			if ( ! empty( $request['featured'] ) ) {
				$args['featured'] = true;
			}
			// `?seller=store-slug` limits the list to one marketplace store,
			// which is what the storefront's store pages are built on.
			if ( ! empty( $request['seller'] ) ) {
				$owners = get_users( array(
					'meta_key'   => '_kandi_store_slug',
					'meta_value' => sanitize_title( $request['seller'] ),
					'fields'     => 'ID',
					'number'     => 1,
				) );
				if ( empty( $owners ) ) {
					return rest_ensure_response( array( 'products' => array(), 'total' => 0, 'total_pages' => 0 ) );
				}
				$args['author'] = (int) $owners[0];
			}
			if ( ! empty( $request['on_sale'] ) ) {
				$args['include'] = wc_get_product_ids_on_sale();
				if ( empty( $args['include'] ) ) {
					return rest_ensure_response( array( 'products' => array(), 'total' => 0, 'total_pages' => 0 ) );
				}
			}

			$results  = wc_get_products( $args );
			$products = array_map( 'kandi_format_product', $results->products );

			return rest_ensure_response( array(
				'products'    => $products,
				'total'       => (int) $results->total,
				'total_pages' => (int) $results->max_num_pages,
			) );
		},
	) );

	// GET /wp-json/kandi/v1/products/123  — or  /products/blue-running-shoes
	//
	// Accepts either form so the storefront can use readable URLs
	// (/products/blue-running-shoes) while every link, order and bookmark that
	// already carries a numeric id keeps resolving.
	register_rest_route( 'kandi/v1', '/products/(?P<id>[A-Za-z0-9_\-%]+)', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => '__return_true',
		'callback'            => function ( WP_REST_Request $request ) {
			$key = (string) $request['id'];

			if ( ctype_digit( $key ) ) {
				$product = wc_get_product( (int) $key );
			} else {
				// `get_page_by_path` is the slug lookup WordPress uses for
				// permalinks, so a product answers on exactly the slug shown in
				// wp-admin. rawurldecode first: a slug can be percent-encoded
				// in the URL the storefront requests.
				$post = get_page_by_path( sanitize_title( rawurldecode( $key ) ), OBJECT, 'product' );
				$product = $post ? wc_get_product( $post->ID ) : null;
			}

			if ( ! $product || 'publish' !== $product->get_status() ) {
				return new WP_Error( 'kandi_not_found', 'Product not found.', array( 'status' => 404 ) );
			}

			return rest_ensure_response( kandi_format_product( $product, true ) );
		},
	) );

	// GET /wp-json/kandi/v1/categories
	register_rest_route( 'kandi/v1', '/categories', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => '__return_true',
		'callback'            => function () {
			// hide_empty is off so a parent department still appears when its
			// products all sit in child categories.
			$terms = get_terms( array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => false,
			) );

			if ( is_wp_error( $terms ) ) {
				return new WP_Error( 'kandi_terms_failed', 'Could not load categories.', array( 'status' => 500 ) );
			}

			$categories = array();
			foreach ( $terms as $term ) {
				if ( 'uncategorized' === $term->slug ) {
					continue;
				}
				// `parent` lets the storefront assemble the mega-menu tree;
				// `image` is the promo tile WooCommerce stores against a category.
				$thumbnail_id = get_term_meta( $term->term_id, 'thumbnail_id', true );

				$categories[] = array(
					'id'     => $term->term_id,
					'name'   => $term->name,
					'slug'   => $term->slug,
					'count'  => (int) $term->count,
					'parent' => (int) $term->parent,
					'image'  => $thumbnail_id ? wp_get_attachment_image_url( $thumbnail_id, 'medium_large' ) : null,
				);
			}

			return rest_ensure_response( $categories );
		},
	) );

	// POST /wp-json/kandi/v1/orders  (requires X-Kandi-Secret header)
	register_rest_route( 'kandi/v1', '/orders', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => function ( WP_REST_Request $request ) {
			$secret = kandi_shared_secret();
			if ( empty( $secret ) ) {
				return new WP_Error( 'kandi_no_secret', 'KANDI_API_SECRET is not configured on the server.', array( 'status' => 500 ) );
			}
			$sent = $request->get_header( 'x-kandi-secret' );
			if ( empty( $sent ) || ! hash_equals( $secret, $sent ) ) {
				return new WP_Error( 'kandi_forbidden', 'Invalid API secret.', array( 'status' => 403 ) );
			}
			return true;
		},
		'callback'            => function ( WP_REST_Request $request ) {
			if ( ! function_exists( 'wc_create_order' ) ) {
				return new WP_Error( 'kandi_no_woocommerce', 'WooCommerce is not active.', array( 'status' => 500 ) );
			}

			$body       = $request->get_json_params();
			$customer   = isset( $body['customer'] ) && is_array( $body['customer'] ) ? $body['customer'] : array();
			$line_items = isset( $body['line_items'] ) && is_array( $body['line_items'] ) ? $body['line_items'] : array();

			if ( empty( $line_items ) ) {
				return new WP_Error( 'kandi_empty_cart', 'The order has no items.', array( 'status' => 400 ) );
			}
			foreach ( array( 'first_name', 'phone', 'address_1', 'city' ) as $required ) {
				if ( empty( $customer[ $required ] ) ) {
					return new WP_Error( 'kandi_missing_field', "Missing customer field: {$required}.", array( 'status' => 400 ) );
				}
			}

			// Auto-create (or reuse) a customer account when an email is provided.
			$customer_id = 0;
			$email       = sanitize_email( $customer['email'] ?? '' );
			if ( $email && is_email( $email ) ) {
				$existing = get_user_by( 'email', $email );
				if ( $existing ) {
					$customer_id = $existing->ID;
				} else {
					// Empty password => WooCommerce generates one and emails the
					// customer a "set your password" link (New Account email).
					$new_id = wc_create_new_customer( $email, '', '', array(
						'first_name' => sanitize_text_field( $customer['first_name'] ),
						'last_name'  => sanitize_text_field( $customer['last_name'] ?? '' ),
					) );
					if ( ! is_wp_error( $new_id ) ) {
						$customer_id = $new_id;
					}
				}

				// Keep the customer's billing profile up to date for next time.
				if ( $customer_id ) {
					update_user_meta( $customer_id, 'billing_first_name', sanitize_text_field( $customer['first_name'] ) );
					update_user_meta( $customer_id, 'billing_last_name', sanitize_text_field( $customer['last_name'] ?? '' ) );
					update_user_meta( $customer_id, 'billing_phone', sanitize_text_field( $customer['phone'] ) );
					update_user_meta( $customer_id, 'billing_address_1', sanitize_text_field( $customer['address_1'] ) );
					update_user_meta( $customer_id, 'billing_city', sanitize_text_field( $customer['city'] ) );
					update_user_meta( $customer_id, 'billing_country', sanitize_text_field( $customer['country'] ?? 'UG' ) );
				}
			}

			$order = wc_create_order( array( 'customer_id' => $customer_id ) );
			if ( is_wp_error( $order ) ) {
				return $order;
			}

			// Prices come from the store, never from the client payload.
			foreach ( $line_items as $item ) {
				$product_id = isset( $item['product_id'] ) ? (int) $item['product_id'] : 0;
				$quantity   = isset( $item['quantity'] ) ? max( 1, (int) $item['quantity'] ) : 1;
				$product    = wc_get_product( $product_id );

				if ( ! $product || 'publish' !== $product->get_status() ) {
					$order->delete( true );
					return new WP_Error( 'kandi_bad_product', "Product {$product_id} is not available.", array( 'status' => 400 ) );
				}
				if ( ! $product->is_in_stock() ) {
					$order->delete( true );
					return new WP_Error( 'kandi_out_of_stock', "'{$product->get_name()}' is out of stock.", array( 'status' => 400 ) );
				}

				$item_id = $order->add_product( $product, $quantity );

				// Chosen options (e.g. Size: 38) are stored as order item meta so
				// they show up on the order in wp-admin.
				if ( $item_id && ! empty( $item['options'] ) && is_array( $item['options'] ) ) {
					foreach ( $item['options'] as $option_name => $option_value ) {
						if ( is_scalar( $option_value ) && '' !== $option_value ) {
							wc_add_order_item_meta(
								$item_id,
								sanitize_text_field( $option_name ),
								sanitize_text_field( (string) $option_value )
							);
						}
					}
				}
			}

			$address = array(
				'first_name' => sanitize_text_field( $customer['first_name'] ),
				'last_name'  => sanitize_text_field( $customer['last_name'] ?? '' ),
				'email'      => sanitize_email( $customer['email'] ?? '' ),
				'phone'      => sanitize_text_field( $customer['phone'] ),
				'address_1'  => sanitize_text_field( $customer['address_1'] ),
				'address_2'  => sanitize_text_field( $customer['address_2'] ?? '' ),
				'city'       => sanitize_text_field( $customer['city'] ),
				'country'    => sanitize_text_field( $customer['country'] ?? 'UG' ),
			);
			$order->set_address( $address, 'billing' );
			$order->set_address( $address, 'shipping' );

			$payment_method = sanitize_text_field( $body['payment_method'] ?? 'cod' );
			$order->set_payment_method( $payment_method );
			$order->set_payment_method_title( 'cod' === $payment_method ? 'Cash on delivery' : $payment_method );

			if ( ! empty( $customer['notes'] ) ) {
				$order->set_customer_note( sanitize_textarea_field( $customer['notes'] ) );
			}

			// Delivery, as a real WooCommerce shipping line rather than a note.
			// That way it appears on the invoice, in the emails, in the reports
			// and in the order total, instead of being a figure only the
			// storefront knew about.
			//
			// The amount is priced on the storefront's server from the
			// customer's coordinates; it never comes from the browser.
			$shipping = isset( $body['shipping'] ) && is_array( $body['shipping'] ) ? $body['shipping'] : null;

			if ( $shipping && class_exists( 'WC_Order_Item_Shipping' ) ) {
				$rate = new WC_Order_Item_Shipping();
				$rate->set_method_title( sanitize_text_field( $shipping['label'] ?? 'Delivery' ) );
				$rate->set_method_id( 'kandi_delivery' );
				$rate->set_total( (float) max( 0, (float) ( $shipping['total'] ?? 0 ) ) );
				$order->add_item( $rate );
			}

			// The customer's exact drop point, so the rider has something better
			// to work from than a typed address.
			if ( ! empty( $body['delivery_point']['lat'] ) && ! empty( $body['delivery_point']['lng'] ) ) {
				$lat = (float) $body['delivery_point']['lat'];
				$lng = (float) $body['delivery_point']['lng'];
				$order->add_meta_data( '_kandi_delivery_lat', $lat, true );
				$order->add_meta_data( '_kandi_delivery_lng', $lng, true );
				$order->add_order_note(
					sprintf( 'Delivery pin: https://maps.google.com/?q=%F,%F', $lat, $lng )
				);
			}

			$order->set_created_via( 'kandi-storefront' );
			$order->calculate_totals();

			// Cash on delivery is confirmed the moment it is placed. A card or
			// mobile-money order is created `pending` and only becomes
			// `processing` once Pesapal confirms the money arrived — so an
			// abandoned payment leaves a visible unpaid order in wp-admin
			// rather than a phantom sale or nothing at all.
			$awaiting_payment = ! empty( $body['awaiting_payment'] );

			if ( $awaiting_payment ) {
				$order->update_status( 'pending', 'Awaiting payment via Pesapal.' );
			} else {
				$order->update_status( 'processing', 'Order placed via Kandi storefront.' );
			}

			return rest_ensure_response( array(
				'id'        => $order->get_id(),
				'order_key' => $order->get_order_key(),
				'status'    => $order->get_status(),
				'total'     => (float) $order->get_total(),
				'currency'  => $order->get_currency(),
			) );
		},
	) );
} );

/* -------------------------------------------------------------------------
 * Payment confirmation
 *
 * Called by the storefront once Pesapal has confirmed a payment, either from
 * the shopper's callback or — more importantly — from the server-to-server IPN
 * that fires even when the shopper closes the tab mid-payment.
 *
 * Deliberately idempotent: the callback and the IPN routinely both arrive for
 * the same order, and an order that is already paid must not be paid twice, nor
 * have its stock decremented twice.
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', function () {
	register_rest_route( 'kandi/v1', '/orders/(?P<id>\d+)/payment', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_check_secret',
		'callback'            => function ( WP_REST_Request $request ) {
			if ( ! function_exists( 'wc_get_order' ) ) {
				return new WP_Error( 'kandi_no_woocommerce', 'WooCommerce is not active.', array( 'status' => 500 ) );
			}

			$order = wc_get_order( (int) $request['id'] );
			if ( ! $order ) {
				return new WP_Error( 'kandi_not_found', 'Order not found.', array( 'status' => 404 ) );
			}

			$body      = (array) $request->get_json_params();
			$reference = sanitize_text_field( $body['transaction_id'] ?? '' );
			$method    = sanitize_text_field( $body['payment_method'] ?? 'Pesapal' );
			$account   = sanitize_text_field( $body['payment_account'] ?? '' );

			// Already settled — report success without touching it again.
			if ( $order->is_paid() ) {
				return rest_ensure_response( array(
					'id'      => $order->get_id(),
					'status'  => $order->get_status(),
					'already' => true,
				) );
			}

			$order->set_payment_method( 'pesapal' );
			$order->set_payment_method_title( $method );
			if ( '' !== $account ) {
				$order->add_meta_data( '_kandi_payment_account', $account, true );
			}

			// `payment_complete` is WooCommerce's own paid transition: it stamps
			// the transaction id, reduces stock, records the paid date and fires
			// the emails. Setting the status by hand would skip all of that.
			$order->payment_complete( $reference );
			$order->add_order_note(
				sprintf( 'Paid via Pesapal (%s). Confirmation: %s', $method, $reference ?: 'n/a' )
			);
			$order->save();

			return rest_ensure_response( array(
				'id'      => $order->get_id(),
				'status'  => $order->get_status(),
				'already' => false,
			) );
		},
	) );

	/* Marks an order failed or cancelled when Pesapal reports the same. */
	register_rest_route( 'kandi/v1', '/orders/(?P<id>\d+)/payment-failed', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_check_secret',
		'callback'            => function ( WP_REST_Request $request ) {
			$order = function_exists( 'wc_get_order' ) ? wc_get_order( (int) $request['id'] ) : null;
			if ( ! $order ) {
				return new WP_Error( 'kandi_not_found', 'Order not found.', array( 'status' => 404 ) );
			}

			// Never overwrite a paid order on a late failure notification.
			if ( $order->is_paid() ) {
				return rest_ensure_response( array( 'id' => $order->get_id(), 'status' => $order->get_status() ) );
			}

			$body   = (array) $request->get_json_params();
			$reason = sanitize_text_field( $body['reason'] ?? 'Payment was not completed.' );

			$order->update_status( 'failed', 'Pesapal: ' . $reason );

			return rest_ensure_response( array( 'id' => $order->get_id(), 'status' => $order->get_status() ) );
		},
	) );
} );

/* -------------------------------------------------------------------------
 * Shopper accounts — Google sign-in
 *
 * The Next.js storefront verifies the Google ID token with Google before it
 * calls anything here, so these endpoints receive an email address that has
 * already been proven. They are still gated on the shared secret so only the
 * storefront can reach them.
 * ---------------------------------------------------------------------- */

if ( ! defined( 'KANDI_CUSTOMER_TOKEN_TTL' ) ) {
	define( 'KANDI_CUSTOMER_TOKEN_TTL', 30 * DAY_IN_SECONDS );
}

function kandi_customer_token_key( $token ) {
	return 'kandi_cust_tok_' . hash( 'sha256', $token );
}

function kandi_customer_issue_token( $user_id ) {
	$token = bin2hex( random_bytes( 32 ) );
	set_transient( kandi_customer_token_key( $token ), (int) $user_id, KANDI_CUSTOMER_TOKEN_TTL );
	return $token;
}

function kandi_customer_bearer( WP_REST_Request $request ) {
	$header = (string) $request->get_header( 'authorization' );
	return 0 === stripos( $header, 'bearer ' ) ? trim( substr( $header, 7 ) ) : '';
}

/** Checks the storefront's shared secret. */
function kandi_customer_check_secret( WP_REST_Request $request ) {
	$secret = kandi_shared_secret();
	if ( empty( $secret ) ) {
		return new WP_Error( 'kandi_no_secret', 'KANDI_API_SECRET is not configured.', array( 'status' => 500 ) );
	}
	$sent = (string) $request->get_header( 'x-kandi-secret' );
	if ( '' === $sent || ! hash_equals( $secret, $sent ) ) {
		return new WP_Error( 'kandi_forbidden', 'Invalid API secret.', array( 'status' => 403 ) );
	}
	return true;
}

function kandi_customer_permission( WP_REST_Request $request ) {
	$secret = kandi_customer_check_secret( $request );
	if ( is_wp_error( $secret ) ) {
		return $secret;
	}
	$token   = kandi_customer_bearer( $request );
	$user_id = '' === $token ? 0 : (int) get_transient( kandi_customer_token_key( $token ) );
	return $user_id > 0 ? true : new WP_Error( 'kandi_unauthorised', 'Not signed in.', array( 'status' => 401 ) );
}

function kandi_customer_current_id( WP_REST_Request $request ) {
	$token = kandi_customer_bearer( $request );
	return '' === $token ? 0 : (int) get_transient( kandi_customer_token_key( $token ) );
}

/** Shapes a WP user into the shopper object the storefront expects. */
function kandi_format_customer( $user_id ) {
	$user = get_userdata( $user_id );
	if ( ! $user ) {
		return null;
	}

	return array(
		'id'          => (int) $user->ID,
		'name'        => $user->display_name ?: $user->user_email,
		'email'       => $user->user_email,
		'avatar'      => (string) get_user_meta( $user->ID, '_kandi_avatar', true ),
		'onboarded'   => (bool) get_user_meta( $user->ID, '_kandi_onboarded', true ),
		'preferences' => array(
			'departments' => (array) ( get_user_meta( $user->ID, '_kandi_pref_departments', true ) ?: array() ),
			'size'        => (string) get_user_meta( $user->ID, '_kandi_pref_size', true ),
			'city'        => (string) get_user_meta( $user->ID, '_kandi_pref_city', true ),
		),
	);
}

add_action( 'rest_api_init', function () {

	// POST /wp-json/kandi/v1/customers/google — find or create the shopper.
	register_rest_route( 'kandi/v1', '/customers/google', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_check_secret',
		'callback'            => function ( WP_REST_Request $request ) {
			$body  = (array) $request->get_json_params();
			$email = sanitize_email( $body['email'] ?? '' );

			if ( ! is_email( $email ) ) {
				return new WP_Error( 'kandi_bad_email', 'A verified email address is required.', array( 'status' => 400 ) );
			}

			$name    = sanitize_text_field( $body['name'] ?? '' );
			$picture = esc_url_raw( $body['picture'] ?? '' );
			$user    = get_user_by( 'email', $email );

			if ( ! $user ) {
				$username = sanitize_user( 'kandi_' . strtok( $email, '@' ), true );
				$base     = $username;
				$suffix   = 1;
				while ( username_exists( $username ) ) {
					$username = $base . $suffix++;
				}

				$user_id = wp_insert_user( array(
					'user_login'   => $username,
					'user_email'   => $email,
					'user_pass'    => wp_generate_password( 24, true, true ),
					'display_name' => $name ?: $username,
					'role'         => 'customer',
				) );

				if ( is_wp_error( $user_id ) ) {
					return $user_id;
				}
			} else {
				$user_id = $user->ID;
				if ( $name && $user->display_name === $user->user_login ) {
					wp_update_user( array( 'ID' => $user_id, 'display_name' => $name ) );
				}
			}

			update_user_meta( $user_id, '_kandi_google_id', sanitize_text_field( $body['google_id'] ?? '' ) );
			if ( $picture ) {
				update_user_meta( $user_id, '_kandi_avatar', $picture );
			}

			return rest_ensure_response( array(
				'token'      => kandi_customer_issue_token( $user_id ),
				'expires_in' => KANDI_CUSTOMER_TOKEN_TTL,
				'customer'   => kandi_format_customer( $user_id ),
			) );
		},
	) );

	// GET /wp-json/kandi/v1/customers/me
	register_rest_route( 'kandi/v1', '/customers/me', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_customer_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			return rest_ensure_response( array(
				'customer' => kandi_format_customer( kandi_customer_current_id( $request ) ),
			) );
		},
	) );

	// PUT /wp-json/kandi/v1/customers/preferences — saves the onboarding answers.
	register_rest_route( 'kandi/v1', '/customers/preferences', array(
		'methods'             => WP_REST_Server::EDITABLE,
		'permission_callback' => 'kandi_customer_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$user_id = kandi_customer_current_id( $request );
			$body    = (array) $request->get_json_params();

			if ( isset( $body['departments'] ) && is_array( $body['departments'] ) ) {
				update_user_meta(
					$user_id,
					'_kandi_pref_departments',
					array_map( 'sanitize_title', $body['departments'] )
				);
			}
			if ( isset( $body['size'] ) ) {
				update_user_meta( $user_id, '_kandi_pref_size', sanitize_text_field( $body['size'] ) );
			}
			if ( isset( $body['city'] ) ) {
				update_user_meta( $user_id, '_kandi_pref_city', sanitize_text_field( $body['city'] ) );
			}
			update_user_meta( $user_id, '_kandi_onboarded', 1 );

			return rest_ensure_response( array( 'customer' => kandi_format_customer( $user_id ) ) );
		},
	) );

	// POST /wp-json/kandi/v1/customers/logout
	register_rest_route( 'kandi/v1', '/customers/logout', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_check_secret',
		'callback'            => function ( WP_REST_Request $request ) {
			$token = kandi_customer_bearer( $request );
			if ( '' !== $token ) {
				delete_transient( kandi_customer_token_key( $token ) );
			}
			return rest_ensure_response( array( 'ok' => true ) );
		},
	) );

	// GET /wp-json/kandi/v1/customers/orders — the shopper's own order history.
	register_rest_route( 'kandi/v1', '/customers/orders', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_customer_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			if ( ! function_exists( 'wc_get_orders' ) ) {
				return new WP_Error( 'kandi_no_woocommerce', 'WooCommerce is not active.', array( 'status' => 500 ) );
			}

			$user_id = kandi_customer_current_id( $request );
			$orders  = wc_get_orders( array(
				'customer_id' => $user_id,
				'limit'       => 50,
				'orderby'     => 'date',
				'order'       => 'DESC',
			) );

			$payload = array();
			foreach ( $orders as $order ) {
				$items = array();
				foreach ( $order->get_items() as $item ) {
					$product  = $item->get_product();
					$image_id = $product ? $product->get_image_id() : 0;
					$items[]  = array(
						'product_id' => $product ? $product->get_id() : 0,
						'name'       => $item->get_name(),
						'quantity'   => (int) $item->get_quantity(),
						'total'      => (float) $item->get_total(),
						'image'      => $image_id ? wp_get_attachment_image_url( $image_id, 'thumbnail' ) : '',
						// Drives the "Write a review" prompt on past orders.
						'reviewed'   => $product ? (bool) kandi_find_customer_review( $product->get_id(), $user_id ) : false,
					);
				}

				$payload[] = array(
					'id'       => $order->get_id(),
					'number'   => $order->get_order_number(),
					'status'   => $order->get_status(),
					'date'     => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : null,
					'total'    => (float) $order->get_total(),
					'currency' => $order->get_currency(),
					'items'    => $items,
				);
			}

			return rest_ensure_response( array( 'orders' => $payload ) );
		},
	) );
} );

/* -------------------------------------------------------------------------
 * Contact form
 *
 * Emails the shop's support address and keeps a copy as a private comment on
 * nothing in particular — WordPress has no inbox, so the email is the record.
 * Gated on the shared secret (the storefront posts server-side) and rate
 * limited per sender, because a public mail endpoint is a spam relay if it is
 * neither.
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', function () {
	register_rest_route( 'kandi/v1', '/contact', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_check_secret',
		'callback'            => function ( WP_REST_Request $request ) {
			$body    = (array) $request->get_json_params();
			$name    = sanitize_text_field( $body['name'] ?? '' );
			$email   = sanitize_email( $body['email'] ?? '' );
			$order   = sanitize_text_field( $body['order'] ?? '' );
			$subject = sanitize_text_field( $body['subject'] ?? 'General question' );
			$message = trim( wp_strip_all_tags( (string) ( $body['message'] ?? '' ) ) );

			if ( '' === $name ) {
				return new WP_Error( 'kandi_no_name', 'Please tell us your name.', array( 'status' => 400 ) );
			}
			if ( ! is_email( $email ) ) {
				return new WP_Error( 'kandi_bad_email', 'Please give us an email address we can reply to.', array( 'status' => 400 ) );
			}
			if ( mb_strlen( $message ) < 10 ) {
				return new WP_Error( 'kandi_short_message', 'Please tell us a little more about the problem.', array( 'status' => 400 ) );
			}

			// One message per email address per minute. Enough to stop a script,
			// loose enough that a real person retrying is never blocked.
			$throttle_key = 'kandi_contact_' . md5( strtolower( $email ) );
			if ( get_transient( $throttle_key ) ) {
				return new WP_Error( 'kandi_too_fast', 'We already have your message — give us a moment to read it.', array( 'status' => 429 ) );
			}
			set_transient( $throttle_key, 1, MINUTE_IN_SECONDS );

			$to = get_option( 'kandi_support_email' );
			if ( ! $to || ! is_email( $to ) ) {
				$settings = get_option( 'kandi_storefront_settings', array() );
				$to       = is_array( $settings ) && ! empty( $settings['support_email'] )
					? $settings['support_email']
					: get_option( 'admin_email' );
			}

			$lines = array(
				'From: ' . $name . ' <' . $email . '>',
				'Subject: ' . $subject,
				'Order: ' . ( '' !== $order ? $order : '—' ),
				'',
				$message,
			);

			$sent = wp_mail(
				$to,
				sprintf( '[Kandi] %s — %s', $subject, $name ),
				implode( "\n", $lines ),
				array(
					'Content-Type: text/plain; charset=UTF-8',
					'Reply-To: ' . $name . ' <' . $email . '>',
				)
			);

			if ( ! $sent ) {
				return new WP_Error(
					'kandi_mail_failed',
					'We could not send that just now. Please call us instead.',
					array( 'status' => 502 )
				);
			}

			return rest_ensure_response( array( 'ok' => true ) );
		},
	) );
} );

/* -------------------------------------------------------------------------
 * Product reviews
 *
 * Reviews are stored where WooCommerce already keeps them — as comments of
 * type `review` against the product post — so they appear in wp-admin under
 * Products > Reviews, feed the product's average rating, and are readable by
 * any other theme or plugin. Nothing lives only inside the Next.js app.
 *
 * Writing requires a signed-in shopper (the bearer token Google sign-in
 * issues); reading is public.
 * ---------------------------------------------------------------------- */

/** The review this shopper has already left on a product, if any. */
function kandi_find_customer_review( $product_id, $user_id ) {
	if ( ! $product_id || ! $user_id ) {
		return null;
	}

	$found = get_comments( array(
		'post_id' => (int) $product_id,
		'user_id' => (int) $user_id,
		'type'    => 'review',
		'status'  => 'all',
		'number'  => 1,
	) );

	return $found ? $found[0] : null;
}

/** Shapes a review comment into the object the storefront renders. */
function kandi_format_review( $comment ) {
	return array(
		'id'       => (int) $comment->comment_ID,
		'author'   => $comment->comment_author,
		'avatar'   => (string) get_user_meta( (int) $comment->user_id, '_kandi_avatar', true ),
		'rating'   => (int) get_comment_meta( $comment->comment_ID, 'rating', true ),
		'date'     => mysql2date( 'c', $comment->comment_date_gmt ),
		'text'     => $comment->comment_content,
		'verified' => (bool) get_comment_meta( $comment->comment_ID, 'verified', true ),
		'approved' => '1' === (string) $comment->comment_approved,
	);
}

add_action( 'rest_api_init', function () {

	// GET /wp-json/kandi/v1/products/123/reviews
	register_rest_route( 'kandi/v1', '/products/(?P<id>\d+)/reviews', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => '__return_true',
		'callback'            => function ( WP_REST_Request $request ) {
			$product_id = (int) $request['id'];
			$product    = wc_get_product( $product_id );

			if ( ! $product ) {
				return new WP_Error( 'kandi_not_found', 'Product not found.', array( 'status' => 404 ) );
			}

			$comments = get_comments( array(
				'post_id' => $product_id,
				'type'    => 'review',
				'status'  => 'approve',
				'number'  => 50,
				'orderby' => 'comment_date_gmt',
				'order'   => 'DESC',
			) );

			// Star-by-star totals for the summary bars, counted from the same
			// approved reviews rather than a hard-coded distribution.
			$breakdown = array( 5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0 );
			foreach ( $comments as $comment ) {
				$rating = (int) get_comment_meta( $comment->comment_ID, 'rating', true );
				if ( isset( $breakdown[ $rating ] ) ) {
					$breakdown[ $rating ]++;
				}
			}

			return rest_ensure_response( array(
				'reviews'        => array_map( 'kandi_format_review', $comments ),
				'average_rating' => (float) $product->get_average_rating(),
				'rating_count'   => (int) $product->get_rating_count(),
				'breakdown'      => $breakdown,
			) );
		},
	) );

	// POST /wp-json/kandi/v1/products/123/reviews — signed-in shoppers only.
	register_rest_route( 'kandi/v1', '/products/(?P<id>\d+)/reviews', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$product_id = (int) $request['id'];
			$product    = wc_get_product( $product_id );

			if ( ! $product || 'publish' !== $product->get_status() ) {
				return new WP_Error( 'kandi_not_found', 'Product not found.', array( 'status' => 404 ) );
			}

			$user_id = kandi_customer_current_id( $request );
			$user    = get_userdata( $user_id );
			if ( ! $user ) {
				return new WP_Error( 'kandi_unauthorised', 'Not signed in.', array( 'status' => 401 ) );
			}

			$body   = (array) $request->get_json_params();
			$rating = (int) ( $body['rating'] ?? 0 );
			$text   = trim( wp_strip_all_tags( (string) ( $body['text'] ?? '' ) ) );

			if ( $rating < 1 || $rating > 5 ) {
				return new WP_Error( 'kandi_bad_rating', 'Choose a rating from 1 to 5 stars.', array( 'status' => 400 ) );
			}
			if ( mb_strlen( $text ) < 5 ) {
				return new WP_Error( 'kandi_bad_review', 'Please write a few words about the product.', array( 'status' => 400 ) );
			}

			// One review per shopper per product: a second submission edits the
			// first rather than stacking duplicates.
			$existing = kandi_find_customer_review( $product_id, $user_id );

			if ( $existing ) {
				wp_update_comment( array(
					'comment_ID'      => $existing->comment_ID,
					'comment_content' => $text,
				) );
				$comment_id = (int) $existing->comment_ID;
			} else {
				$comment_id = wp_insert_comment( array(
					'comment_post_ID'      => $product_id,
					'comment_author'       => $user->display_name ?: $user->user_email,
					'comment_author_email' => $user->user_email,
					'comment_content'      => $text,
					'comment_type'         => 'review',
					'user_id'              => $user_id,
					'comment_approved'     => 1,
				) );

				if ( ! $comment_id ) {
					return new WP_Error( 'kandi_review_failed', 'Could not save the review.', array( 'status' => 500 ) );
				}
			}

			update_comment_meta( $comment_id, 'rating', $rating );

			// "Verified purchase" is only claimed when the shopper really has an
			// order containing this product.
			$verified = function_exists( 'wc_customer_bought_product' )
				? wc_customer_bought_product( $user->user_email, $user_id, $product_id )
				: false;
			update_comment_meta( $comment_id, 'verified', $verified ? 1 : 0 );

			// Recalculates the product's average rating and review count.
			if ( class_exists( 'WC_Comments' ) ) {
				WC_Comments::clear_transients( $product_id );
			}

			$fresh = wc_get_product( $product_id );

			return rest_ensure_response( array(
				'review'         => kandi_format_review( get_comment( $comment_id ) ),
				'average_rating' => (float) $fresh->get_average_rating(),
				'rating_count'   => (int) $fresh->get_rating_count(),
			) );
		},
	) );

	// GET /wp-json/kandi/v1/customers/reviews — everything this shopper wrote.
	register_rest_route( 'kandi/v1', '/customers/reviews', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_customer_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$comments = get_comments( array(
				'user_id' => kandi_customer_current_id( $request ),
				'type'    => 'review',
				'status'  => 'all',
				'number'  => 50,
				'orderby' => 'comment_date_gmt',
				'order'   => 'DESC',
			) );

			$reviews = array();
			foreach ( $comments as $comment ) {
				$product   = wc_get_product( (int) $comment->comment_post_ID );
				$image_id  = $product ? $product->get_image_id() : 0;
				$reviews[] = array_merge( kandi_format_review( $comment ), array(
					'product_id'    => (int) $comment->comment_post_ID,
					'product_name'  => $product ? $product->get_name() : '',
					'product_image' => $image_id ? wp_get_attachment_image_url( $image_id, 'thumbnail' ) : '',
				) );
			}

			return rest_ensure_response( array( 'reviews' => $reviews ) );
		},
	) );
} );
