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

if ( ! defined( 'KANDI_API_SECRET' ) ) {
	define( 'KANDI_API_SECRET', '739f20e1e2c785c3a68cef156cf22d42ade0dc3ec494f63aedf7e4b8c2cdd42e' );
}

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
	);

	if ( $with_description ) {
		$data['description'] = wpautop( $product->get_description() );
	}

	return $data;
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

	// GET /wp-json/kandi/v1/products/123
	register_rest_route( 'kandi/v1', '/products/(?P<id>\d+)', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => '__return_true',
		'callback'            => function ( WP_REST_Request $request ) {
			$product = wc_get_product( (int) $request['id'] );

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
			$terms = get_terms( array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => true,
			) );

			if ( is_wp_error( $terms ) ) {
				return new WP_Error( 'kandi_terms_failed', 'Could not load categories.', array( 'status' => 500 ) );
			}

			$categories = array();
			foreach ( $terms as $term ) {
				if ( 'uncategorized' === $term->slug ) {
					continue;
				}
				$categories[] = array(
					'id'    => $term->term_id,
					'name'  => $term->name,
					'slug'  => $term->slug,
					'count' => (int) $term->count,
				);
			}

			return rest_ensure_response( $categories );
		},
	) );

	// POST /wp-json/kandi/v1/orders  (requires X-Kandi-Secret header)
	register_rest_route( 'kandi/v1', '/orders', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => function ( WP_REST_Request $request ) {
			$secret = defined( 'KANDI_API_SECRET' ) ? KANDI_API_SECRET : get_option( 'kandi_api_secret' );
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

			$order->set_created_via( 'kandi-storefront' );
			$order->calculate_totals();
			$order->update_status( 'processing', 'Order placed via Kandi storefront.' );

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
