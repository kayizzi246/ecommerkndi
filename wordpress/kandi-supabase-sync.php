<?php
/**
 * Plugin Name: Kandi Supabase Sync
 * Description: Keeps the Kandi mobile app's Supabase database in step with WooCommerce: products and categories go to the app, order status comes back from it.
 * Version: 1.0.0
 * Author: Kandi UG
 *
 * WHAT IT DOES
 *  - Every product saved, published, hidden, restocked, re-filed or deleted is
 *    sent to Supabase at the end of the request, so the app shows it within
 *    seconds.
 *  - Every category change re-sends the category list.
 *  - Every status change on an order placed from the app (completed,
 *    cancelled, refunded…) is sent back, which is what awards reward points.
 *  - Products > App sync: settings and a "Sync everything now" button for the
 *    first sync, or after a bulk import.
 *
 * INSTALL
 *  Upload to wp-content/plugins/kandi-supabase-sync/kandi-supabase-sync.php,
 *  activate "Kandi Supabase Sync", then fill in Products > App sync:
 *    Sync URL:    https://<project>.supabase.co/functions/v1/woo-sync
 *    Sync secret: the KANDI_SYNC_SECRET you set in Supabase
 *  (or define KANDI_SUPABASE_SYNC_URL / KANDI_SUPABASE_SYNC_SECRET in wp-config.php).
 *
 * Requires WooCommerce and the Kandi Store API plugin (for the product format).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( defined( 'KANDI_SUPABASE_SYNC_LOADED' ) ) {
	return;
}
define( 'KANDI_SUPABASE_SYNC_LOADED', true );

/* -------------------------------------------------------------------------
 * Settings
 * ---------------------------------------------------------------------- */

if ( ! function_exists( 'kandi_sb_url' ) ) :
function kandi_sb_url() {
	if ( defined( 'KANDI_SUPABASE_SYNC_URL' ) && KANDI_SUPABASE_SYNC_URL ) {
		return (string) KANDI_SUPABASE_SYNC_URL;
	}
	return (string) get_option( 'kandi_sb_url', '' );
}
endif;

if ( ! function_exists( 'kandi_sb_secret' ) ) :
function kandi_sb_secret() {
	if ( defined( 'KANDI_SUPABASE_SYNC_SECRET' ) && KANDI_SUPABASE_SYNC_SECRET ) {
		return (string) KANDI_SUPABASE_SYNC_SECRET;
	}
	return (string) get_option( 'kandi_sb_secret', '' );
}
endif;

/** Sends one message to the woo-sync function. Returns true on success. */
if ( ! function_exists( 'kandi_sb_send' ) ) :
function kandi_sb_send( $payload ) {
	$url    = kandi_sb_url();
	$secret = kandi_sb_secret();
	if ( '' === $url || '' === $secret ) {
		return false;
	}

	$response = wp_remote_post( $url, array(
		'timeout' => 20,
		'headers' => array(
			'Content-Type'   => 'application/json',
			'X-Kandi-Secret' => $secret,
		),
		'body'    => wp_json_encode( $payload ),
	) );

	$code = is_wp_error( $response ) ? 0 : (int) wp_remote_retrieve_response_code( $response );
	$ok   = $code >= 200 && $code < 300;

	update_option( 'kandi_sb_last', array(
		'time'  => time(),
		'type'  => isset( $payload['type'] ) ? $payload['type'] : '',
		'ok'    => $ok,
		'error' => $ok ? '' : ( is_wp_error( $response ) ? $response->get_error_message() : wp_remote_retrieve_body( $response ) ),
	), false );

	return $ok;
}
endif;

/* -------------------------------------------------------------------------
 * Shaping
 * ---------------------------------------------------------------------- */

/** The product as the app reads it, or null when it should not be in the app. */
if ( ! function_exists( 'kandi_sb_product' ) ) :
function kandi_sb_product( $product_id ) {
	$product = wc_get_product( $product_id );
	if ( ! $product || $product->is_type( 'variation' ) ) {
		return null;
	}
	if ( 'publish' !== $product->get_status() || 'hidden' === $product->get_catalog_visibility() ) {
		return null;
	}

	if ( function_exists( 'kandi_format_product' ) ) {
		$row = kandi_format_product( $product, true );
	} else {
		$image = $product->get_image_id();
		$row   = array(
			'id'             => $product->get_id(),
			'name'           => $product->get_name(),
			'slug'           => $product->get_slug(),
			'price'          => (float) $product->get_price(),
			'regular_price'  => (float) $product->get_regular_price(),
			'sale_price'     => '' !== $product->get_sale_price() ? (float) $product->get_sale_price() : null,
			'on_sale'        => $product->is_on_sale(),
			'stock_status'   => $product->get_stock_status(),
			'stock_quantity' => $product->get_stock_quantity(),
			'image'          => $image ? wp_get_attachment_image_url( $image, 'large' ) : '',
			'categories'     => array(),
			'date_created'   => $product->get_date_created() ? $product->get_date_created()->date( 'c' ) : null,
			'total_sales'    => (int) $product->get_total_sales(),
		);
		$terms = get_the_terms( $product->get_id(), 'product_cat' );
		if ( $terms && ! is_wp_error( $terms ) ) {
			foreach ( $terms as $term ) {
				$row['categories'][] = array( 'id' => $term->term_id, 'name' => $term->name, 'slug' => $term->slug );
			}
		}
	}
	return $row;
}
endif;

if ( ! function_exists( 'kandi_sb_categories' ) ) :
function kandi_sb_categories() {
	$terms = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false ) );
	if ( is_wp_error( $terms ) ) {
		return array();
	}
	$rows = array();
	foreach ( $terms as $term ) {
		$thumb  = (int) get_term_meta( $term->term_id, 'thumbnail_id', true );
		$rows[] = array(
			'id'     => (int) $term->term_id,
			'name'   => html_entity_decode( $term->name, ENT_QUOTES, 'UTF-8' ),
			'slug'   => $term->slug,
			'parent' => (int) $term->parent,
			'count'  => (int) $term->count,
			'image'  => $thumb ? (string) wp_get_attachment_image_url( $thumb, 'medium' ) : null,
		);
	}
	return $rows;
}
endif;

/* -------------------------------------------------------------------------
 * The queue: collected during the request, sent once at the end of it
 * ---------------------------------------------------------------------- */

if ( ! function_exists( 'kandi_sb_queue' ) ) :
function kandi_sb_queue() {
	static $queue = null;
	if ( null === $queue ) {
		$queue = (object) array( 'products' => array(), 'deleted' => array(), 'categories' => false, 'orders' => array() );
	}
	return $queue;
}
endif;

if ( ! function_exists( 'kandi_sb_touch_product' ) ) :
function kandi_sb_touch_product( $post_id ) {
	$post_id = (int) $post_id;
	$type    = get_post_type( $post_id );
	if ( 'product_variation' === $type ) {
		$post_id = (int) wp_get_post_parent_id( $post_id );
		$type    = 'product';
	}
	if ( $post_id && 'product' === $type && ! wp_is_post_revision( $post_id ) ) {
		kandi_sb_queue()->products[ $post_id ] = true;
	}
}
endif;

add_action( 'save_post_product', 'kandi_sb_touch_product', 100, 1 );
add_action( 'woocommerce_update_product', 'kandi_sb_touch_product', 100, 1 );
add_action( 'woocommerce_new_product', 'kandi_sb_touch_product', 100, 1 );
add_action( 'woocommerce_product_set_stock', function ( $product ) {
	kandi_sb_touch_product( $product->get_id() );
} );
add_action( 'woocommerce_variation_set_stock', function ( $product ) {
	kandi_sb_touch_product( $product->get_id() );
} );
add_action( 'set_object_terms', function ( $object_id, $terms, $tt_ids, $taxonomy ) {
	if ( 'product_cat' === $taxonomy ) {
		kandi_sb_touch_product( $object_id );
	}
}, 10, 4 );
add_action( 'transition_post_status', function ( $new_status, $old_status, $post ) {
	if ( $post && 'product' === $post->post_type && $new_status !== $old_status ) {
		kandi_sb_touch_product( $post->ID );
	}
}, 10, 3 );
add_action( 'before_delete_post', function ( $post_id ) {
	if ( 'product' === get_post_type( $post_id ) ) {
		kandi_sb_queue()->deleted[ (int) $post_id ] = true;
	}
} );

foreach ( array( 'created_product_cat', 'edited_product_cat', 'delete_product_cat' ) as $kandi_sb_hook ) {
	add_action( $kandi_sb_hook, function () {
		kandi_sb_queue()->categories = true;
	} );
}

add_action( 'woocommerce_order_status_changed', function ( $order_id, $from, $to, $order ) {
	if ( $order && $order->get_meta( '_kandi_app_order_id' ) ) {
		kandi_sb_queue()->orders[ (int) $order_id ] = array(
			'status' => (string) $to,
			'total'  => (float) $order->get_total(),
		);
	}
}, 10, 4 );

// Priority 200: after the automatic categories (10) and the storefront purge
// (99) in kandi-owner-api.php, so the app receives the final categories.
add_action( 'shutdown', function () {
	$queue = kandi_sb_queue();
	if ( empty( $queue->products ) && empty( $queue->deleted ) && ! $queue->categories && empty( $queue->orders ) ) {
		return;
	}
	if ( '' === kandi_sb_url() || '' === kandi_sb_secret() ) {
		return;
	}

	// Let the visitor's page finish loading before talking to Supabase.
	if ( function_exists( 'fastcgi_finish_request' ) ) {
		fastcgi_finish_request();
	}

	$upsert = array();
	$delete = array_keys( $queue->deleted );
	foreach ( array_keys( $queue->products ) as $product_id ) {
		if ( isset( $queue->deleted[ $product_id ] ) ) {
			continue;
		}
		$row = kandi_sb_product( $product_id );
		if ( $row ) {
			$upsert[] = $row;
		} else {
			$delete[] = $product_id; // hidden, drafted or trashed: off the app
		}
	}

	foreach ( array_chunk( $upsert, 25 ) as $chunk ) {
		kandi_sb_send( array( 'type' => 'products', 'products' => $chunk ) );
	}
	if ( ! empty( $delete ) ) {
		kandi_sb_send( array( 'type' => 'delete_products', 'ids' => array_values( array_unique( $delete ) ) ) );
	}
	if ( $queue->categories ) {
		kandi_sb_send( array( 'type' => 'categories', 'categories' => kandi_sb_categories(), 'replace' => true ) );
	}
	foreach ( $queue->orders as $order_id => $change ) {
		kandi_sb_send( array(
			'type'         => 'order_status',
			'woo_order_id' => $order_id,
			'status'       => $change['status'],
			'total'        => $change['total'],
		) );
	}
}, 200 );

/* -------------------------------------------------------------------------
 * Products > App sync
 * ---------------------------------------------------------------------- */

/** Sends every visible product and the category list. Returns a summary. */
if ( ! function_exists( 'kandi_sb_sync_all' ) ) :
function kandi_sb_sync_all() {
	if ( function_exists( 'set_time_limit' ) ) {
		@set_time_limit( 600 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
	}

	$categories_ok = kandi_sb_send( array( 'type' => 'categories', 'categories' => kandi_sb_categories(), 'replace' => true ) );

	$ids  = get_posts( array(
		'post_type'      => 'product',
		'post_status'    => 'publish',
		'posts_per_page' => -1,
		'fields'         => 'ids',
		'no_found_rows'  => true,
	) );
	$sent = 0;
	$fail = 0;
	foreach ( array_chunk( $ids, 25 ) as $chunk ) {
		$rows = array_values( array_filter( array_map( 'kandi_sb_product', $chunk ) ) );
		if ( empty( $rows ) ) {
			continue;
		}
		if ( kandi_sb_send( array( 'type' => 'products', 'products' => $rows ) ) ) {
			$sent += count( $rows );
		} else {
			$fail += count( $rows );
		}
	}

	return array( 'categories' => $categories_ok, 'sent' => $sent, 'failed' => $fail );
}
endif;

add_action( 'admin_menu', function () {
	add_submenu_page(
		'edit.php?post_type=product',
		'App sync',
		'App sync',
		'manage_woocommerce',
		'kandi-app-sync',
		'kandi_sb_admin_page'
	);
} );

if ( ! function_exists( 'kandi_sb_admin_page' ) ) :
function kandi_sb_admin_page() {
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		return;
	}

	$notice = '';
	if ( isset( $_POST['kandi_sb_action'] ) ) {
		check_admin_referer( 'kandi_sb' );
		$action = sanitize_key( wp_unslash( $_POST['kandi_sb_action'] ) );

		if ( 'save' === $action ) {
			update_option( 'kandi_sb_url', esc_url_raw( wp_unslash( $_POST['kandi_sb_url'] ?? '' ) ) );
			$secret = sanitize_text_field( wp_unslash( $_POST['kandi_sb_secret'] ?? '' ) );
			if ( '' !== $secret ) {
				update_option( 'kandi_sb_secret', $secret, false );
			}
			$notice = 'Settings saved.';
		} elseif ( 'sync' === $action ) {
			$result = kandi_sb_sync_all();
			$notice = sprintf(
				'%d products sent to the app%s. Categories %s.',
				$result['sent'],
				$result['failed'] ? sprintf( ', %d failed (see the last error below)', $result['failed'] ) : '',
				$result['categories'] ? 'sent' : 'NOT sent'
			);
		}
	}

	$last       = get_option( 'kandi_sb_last', array() );
	$configured = '' !== kandi_sb_url() && '' !== kandi_sb_secret();
	?>
	<div class="wrap">
		<h1>App sync</h1>
		<p style="max-width:720px;font-size:14px">
			Sends your products and categories to the Kandi app's Supabase database and brings
			app order status back. After the first sync it runs by itself: every product you save
			reaches the app within seconds.
		</p>

		<?php if ( $notice ) : ?>
			<div class="notice notice-success"><p><?php echo esc_html( $notice ); ?></p></div>
		<?php endif; ?>

		<form method="post" style="margin:20px 0">
			<?php wp_nonce_field( 'kandi_sb' ); ?>
			<input type="hidden" name="kandi_sb_action" value="sync" />
			<button type="submit" class="button button-primary button-hero" <?php disabled( ! $configured ); ?>>
				Sync everything to the app now
			</button>
			<?php if ( ! $configured ) : ?>
				<p class="description">Fill in the two settings below first.</p>
			<?php endif; ?>
		</form>

		<h2>Settings</h2>
		<form method="post">
			<?php wp_nonce_field( 'kandi_sb' ); ?>
			<input type="hidden" name="kandi_sb_action" value="save" />
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="kandi_sb_url">Sync URL</label></th>
					<td>
						<input name="kandi_sb_url" id="kandi_sb_url" type="url" class="regular-text"
							value="<?php echo esc_attr( kandi_sb_url() ); ?>"
							placeholder="https://xxxx.supabase.co/functions/v1/woo-sync" />
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="kandi_sb_secret">Sync secret</label></th>
					<td>
						<input name="kandi_sb_secret" id="kandi_sb_secret" type="password" class="regular-text"
							placeholder="<?php echo kandi_sb_secret() ? 'Saved. Type a new one to change it.' : 'The KANDI_SYNC_SECRET from Supabase'; ?>" />
					</td>
				</tr>
			</table>
			<?php submit_button( 'Save settings' ); ?>
		</form>

		<?php if ( ! empty( $last['time'] ) ) : ?>
			<h2>Last message</h2>
			<p>
				<?php echo esc_html( human_time_diff( (int) $last['time'] ) . ' ago, ' . $last['type'] . ': ' . ( $last['ok'] ? 'OK' : 'FAILED' ) ); ?>
				<?php if ( ! $last['ok'] && ! empty( $last['error'] ) ) : ?>
					<br /><code><?php echo esc_html( substr( (string) $last['error'], 0, 300 ) ); ?></code>
				<?php endif; ?>
			</p>
		<?php endif; ?>
	</div>
	<?php
}
endif;
