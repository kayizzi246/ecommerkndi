<?php
/**
 * Plugin Name: Kandi Storefront Settings
 * Description: Edit the Kandi storefront's logo, brand name and promotional wording from wp-admin — no code changes, no redeploy.
 * Version: 1.0.0
 * Author: Kandi UG
 *
 * HOW TO INSTALL (choose ONE):
 *  A) Plugin: upload this file to
 *     wp-content/plugins/kandi-storefront-settings/kandi-storefront-settings.php
 *     and activate "Kandi Storefront Settings" in wp-admin > Plugins.
 *  B) Code Snippets plugin: paste everything below this comment block into a
 *     new snippet and activate it.
 *
 * THEN edit everything under wp-admin > Kandi Storefront.
 *
 * The storefront reads these values from GET /wp-json/kandi/v1/settings and
 * caches them for a minute, so a change is live within about 60 seconds.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const KANDI_SETTINGS_OPTION = 'kandi_storefront_settings';

/**
 * Everything the storefront can be told, with the values it falls back to when
 * the field is left blank. These defaults are the current wording, so an empty
 * install looks exactly like the shipped site.
 */
function kandi_settings_defaults() {
	return array(
		'logo_url'            => '',
		'logo_id'             => 0,
		// The browser-tab icon. Blank falls back to the file shipped with the
		// storefront, so the shop always has one.
		'favicon_url'         => '',
		'favicon_id'          => 0,
		'brand_name'          => 'Kandi',
		'brand_suffix'        => 'For Less',
		'tagline'             => 'Fashion for less, delivered across Uganda',

		// The thin strip above the masthead.
		'promo_line_1'        => 'FREE delivery on orders over UGX 50,000',
		'promo_line_2'        => 'Pay on delivery',
		'promo_line_3'        => '14-day free returns',
		'promo_cta_label'     => 'Up to 80% off',
		'promo_cta_url'       => '/sale',

		// The rotating animated line. One message per line in the textarea.
		'ticker_messages'     => "FREE delivery on orders over UGX 50,000\nPay on delivery — cash, MTN MoMo or Airtel Money\n14-day free returns, no questions asked\n100% authentic brands, checked before dispatch",

		// Campaign promotions — the row of cards on the homepage. One per line,
		// four fields separated by a pipe:
		//
		//     Badge | Headline | Small line | /where-it-links
		//
		// e.g.  30% OFF | Christmas Sale | Ends 26 December | /sale
		//
		// Left blank, the storefront works out its own from the catalogue —
		// the real biggest discount, genuinely new stock — so the row is never
		// empty and never advertises a sale that is not happening.
		'promotions'          => '',

		// The one full-width banner on the homepage.
		'banner_eyebrow'      => 'Super Price Store',
		'banner_headline'     => 'Up to 80% off RRP',
		'banner_cta_label'    => 'Shop now',
		'banner_cta_url'      => '/sale',

		// ---- The homepage hero image ----
		//
		// Blank by default, and blank is a real state rather than a broken one:
		// with no image uploaded the storefront draws its own hero — headline,
		// badge, promises, button, all as live text. Upload one here and it
		// takes over the slot entirely.
		//
		// Two fields, because one banner cannot serve both shapes. A wide
		// desktop banner is roughly 2.4:1, and at 390px across that is about
		// 160px tall — any headline designed into it lands at a size nobody can
		// read. `banner_image_mobile_url` is shown instead below 768px, so the
		// phone gets artwork laid out for a phone. Leave it blank and the wide
		// one is used at every width.
		'banner_image_url'    => '',
		'banner_image_id'     => 0,
		'banner_image_mobile_url' => '',
		'banner_image_mobile_id'  => 0,
		// Where the banner links. Separate from `banner_cta_url` because that
		// one belongs to the older text banner; a shop may well want the hero
		// pointing at a campaign category while the text CTA still says /sale.
		'banner_image_href'   => '/sale',
		// The alt text. Not optional in practice: an uploaded banner is usually
		// the largest statement on the homepage, and with the words baked into
		// the pixels this is the only form of them a screen reader, a crawler
		// or a shopper on a failed image request will ever get.
		'banner_image_alt'    => '',

		// Contact details, shown on /contact and in the footer.
		'support_phone'       => '0200 804 020',
		'support_email'       => 'support@kandiug.com',
		'support_hours'       => 'Monday to Saturday, 9am – 6pm',
		'support_address'     => 'Kampala, Uganda',
		'whatsapp'            => '',

		// Mobile apps. Until `app_available` is switched on, the storefront
		// shows the store badges greyed out with a "Coming soon" label rather
		// than linking to a listing that does not exist yet.
		'app_available'       => '',
		'app_store_url'       => '',
		'play_store_url'      => '',

		// Social profiles. Blank ones are hidden rather than linking nowhere.
		'facebook_url'        => '',
		'instagram_url'       => '',
		'tiktok_url'          => '',
		'x_url'               => '',

		// Commercial terms quoted across the store. Numbers, so the storefront
		// can format them as currency in the shopper's own locale.
		'free_delivery_from'  => 50000,
		'returns_days'        => 14,

		// Delivery pricing. Per kilometre from the shop, editable below.
		'delivery_lat'        => 0.3476,
		'delivery_lng'        => 32.5825,
		'delivery_base'       => 3000,
		'delivery_per_km'     => 700,
		'delivery_free_km'    => 3,
		'delivery_max_fee'    => 30000,
		'delivery_max_km'     => 120,

		// Seller terms. Quoted on the "Sell with us" landing page, in the
		// earnings calculator and throughout onboarding, so they only ever
		// need changing here.
		'seller_fee'          => 50000,
		'seller_commission'   => 10,
		'seller_payout_days'  => 7,
		'seller_pay_number'   => '',
		'seller_pay_name'     => '',
	);
}

/**
 * Turns the promotions textarea into a list the storefront can render.
 *
 * One campaign per line, fields separated by a pipe:
 *
 *     30% OFF | Christmas Sale | Ends 26 December | /sale
 *
 * A pipe-separated line is not elegant, but it is one textarea instead of a
 * repeater field with add/remove buttons and its own JavaScript — and a shop
 * owner editing four promotions twice a year is better served by something
 * they can read at a glance than by a widget.
 *
 * Only the headline is required. A line without one is skipped rather than
 * published as an empty card, and six is the most the row will carry.
 */
function kandi_parse_promotions( $raw ) {
	$out = array();

	foreach ( preg_split( '/\r\n|\r|\n/', (string) $raw ) as $line ) {
		if ( '' === trim( $line ) ) {
			continue;
		}

		$parts    = array_map( 'trim', explode( '|', $line ) );
		$headline = $parts[1] ?? '';

		if ( '' === $headline ) {
			continue;
		}

		$out[] = array(
			'badge'    => sanitize_text_field( $parts[0] ?? '' ),
			'headline' => sanitize_text_field( $headline ),
			'note'     => sanitize_text_field( $parts[2] ?? '' ),
			'url'      => sanitize_text_field( $parts[3] ?? '/sale' ),
		);

		if ( count( $out ) >= 6 ) {
			break;
		}
	}

	return $out;
}

/** The saved settings merged over the defaults. */
function kandi_settings_all() {
	$saved = get_option( KANDI_SETTINGS_OPTION, array() );
	if ( ! is_array( $saved ) ) {
		$saved = array();
	}

	$settings = kandi_settings_defaults();
	foreach ( $settings as $key => $default ) {
		// An empty string means "use the default"; 0 and "0" are real values.
		if ( isset( $saved[ $key ] ) && '' !== $saved[ $key ] ) {
			$settings[ $key ] = $saved[ $key ];
		}
	}

	return $settings;
}

/* -------------------------------------------------------------------------
 * Storefront connection
 *
 * The three values that make the Next.js storefront work, kept in their own
 * options rather than in the settings array above — that array is served
 * publicly at /wp-json/kandi/v1/settings, and secrets must never be one field's
 * mistake away from being published.
 * ---------------------------------------------------------------------- */

const KANDI_SECRET_OPTION    = 'kandi_api_secret';
const KANDI_PASSCODE_OPTION  = 'kandi_owner_passcode';
const KANDI_STOREFRONT_URL   = 'kandi_storefront_url';

/** The storefront's public base URL, without a trailing slash. */
function kandi_storefront_url() {
	return untrailingslashit( (string) get_option( KANDI_STOREFRONT_URL, '' ) );
}

/**
 * Learns the storefront's URL by itself, so nobody has to type it in.
 *
 * The Next.js shop sends `X-Kandi-Storefront: https://…` on every product read
 * it makes. The first such request teaches WordPress where the shop lives, and
 * from then on cache purges have somewhere to go. Redeploy the shop to a new
 * domain and it re-registers on the next page view.
 *
 * Only http(s) URLs are accepted, and the value is stored with esc_url_raw, so
 * a forged header cannot turn this into a request to anywhere interesting — the
 * worst it can do is point purges at a site that ignores them.
 */
add_action( 'rest_api_init', function () {
	if ( empty( $_SERVER['HTTP_X_KANDI_STOREFRONT'] ) ) {
		return;
	}

	$sent = esc_url_raw( untrailingslashit( wp_unslash( $_SERVER['HTTP_X_KANDI_STOREFRONT'] ) ) );
	if ( '' === $sent || ! preg_match( '#^https?://#i', $sent ) ) {
		return;
	}

	// Written only when it actually changes: this runs on every REST request,
	// and an update_option on each one would be a write per page view.
	if ( $sent !== kandi_storefront_url() ) {
		update_option( KANDI_STOREFRONT_URL, $sent );
	}
} );

/**
 * Tells the storefront to drop its cached catalogue.
 *
 * The storefront caches product reads for a minute, which is what makes it
 * fast — and what used to leave a product you deleted in wp-admin sitting on
 * the shop until that minute expired. This fires the moment a product changes,
 * so the shop is correct on the next page load instead.
 *
 * Non-blocking: the response is never read, because saving a product must not
 * wait on an HTTP round trip to another host, and a storefront that is down
 * should not make wp-admin feel broken.
 */
function kandi_purge_storefront_cache() {
	static $already_sent = false;

	// WooCommerce fires several of these hooks for a single save; once per
	// request is enough.
	if ( $already_sent ) {
		return;
	}

	$base = kandi_storefront_url();
	if ( '' === $base ) {
		return;
	}

	$already_sent = true;

	$secret = function_exists( 'kandi_shared_secret' )
		? kandi_shared_secret()
		: (string) get_option( KANDI_SECRET_OPTION, '' );

	wp_remote_post( $base . '/api/revalidate', array(
		'timeout'  => 0.01,
		'blocking' => false,
		'headers'  => array( 'X-Kandi-Secret' => $secret ),
	) );
}

/** Only products matter here — a page or a post cannot change the catalogue. */
function kandi_purge_on_product_change( $post_id ) {
	if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
		return;
	}
	if ( 'product' !== get_post_type( $post_id ) && 'product_variation' !== get_post_type( $post_id ) ) {
		return;
	}
	kandi_purge_storefront_cache();
}

// `before_delete_post` rather than `deleted_post`: by the time the latter runs
// the row is gone, so the post-type check below could no longer tell whether it
// was a product.
foreach ( array( 'save_post', 'trashed_post', 'untrashed_post', 'before_delete_post' ) as $kandi_hook ) {
	add_action( $kandi_hook, 'kandi_purge_on_product_change', 10, 1 );
}

// WooCommerce writes products through its own data store as well as through the
// post API, and the CRUD hooks are the only ones a stock change fires.
foreach ( array( 'woocommerce_update_product', 'woocommerce_new_product', 'woocommerce_delete_product', 'woocommerce_trash_product' ) as $kandi_hook ) {
	add_action( $kandi_hook, 'kandi_purge_storefront_cache', 10, 0 );
}

/* -------------------------------------------------------------------------
 * REST — GET /wp-json/kandi/v1/settings
 *
 * Public and read-only: it is branding, not private data, and the storefront
 * renders it on every page.
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', function () {
	register_rest_route( 'kandi/v1', '/settings', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => '__return_true',
		'callback'            => function () {
			$settings = kandi_settings_all();

			// The textarea is one message per line; the storefront wants a list.
			$ticker = array_values( array_filter( array_map(
				'trim',
				preg_split( '/\r\n|\r|\n/', (string) $settings['ticker_messages'] )
			) ) );

			return rest_ensure_response( array(
				'brand'    => array(
					'name'        => $settings['brand_name'],
					'suffix'      => $settings['brand_suffix'],
					'tagline'     => $settings['tagline'],
					'logo_url'    => $settings['logo_url'],
					'favicon_url' => $settings['favicon_url'],
				),
				'promo'    => array(
					'lines'     => array_values( array_filter( array(
						$settings['promo_line_1'],
						$settings['promo_line_2'],
						$settings['promo_line_3'],
					) ) ),
					'cta_label' => $settings['promo_cta_label'],
					'cta_url'   => $settings['promo_cta_url'],
				),
				'ticker'   => $ticker,
				// Campaign cards, parsed from "Badge | Headline | Note | /link".
				// Anything without a headline is dropped rather than published
				// as a blank card.
				'promotions' => kandi_parse_promotions( $settings['promotions'] ),
				'banner'   => array(
					'eyebrow'   => $settings['banner_eyebrow'],
					'headline'  => $settings['banner_headline'],
					'cta_label' => $settings['banner_cta_label'],
					'cta_url'   => $settings['banner_cta_url'],
					// The uploaded hero. Empty strings rather than null so the
					// storefront's parser has one shape to check.
					'image_url'        => $settings['banner_image_url'],
					'image_mobile_url' => $settings['banner_image_mobile_url'],
					'image_href'       => $settings['banner_image_href'],
					'image_alt'        => $settings['banner_image_alt'],
				),
				'support'  => array(
					'phone'    => $settings['support_phone'],
					'email'    => $settings['support_email'],
					'hours'    => $settings['support_hours'],
					'address'  => $settings['support_address'],
					'whatsapp' => $settings['whatsapp'],
				),
				'app'      => array(
					// Only "available" when the toggle is on AND there is at
					// least one real listing URL to send people to.
					'available'   => ( '1' === (string) $settings['app_available'] )
						&& ( $settings['app_store_url'] || $settings['play_store_url'] ),
					'ios_url'     => $settings['app_store_url'],
					'android_url' => $settings['play_store_url'],
				),
				'social'   => array_filter( array(
					'facebook'  => $settings['facebook_url'],
					'instagram' => $settings['instagram_url'],
					'tiktok'    => $settings['tiktok_url'],
					'x'         => $settings['x_url'],
				) ),
				'delivery' => array(
					'origin'        => array(
						'lat' => (float) $settings['delivery_lat'],
						'lng' => (float) $settings['delivery_lng'],
					),
					'baseFee'       => (float) $settings['delivery_base'],
					'perKm'         => (float) $settings['delivery_per_km'],
					'freeRadiusKm'  => (float) $settings['delivery_free_km'],
					'maxFee'        => (float) $settings['delivery_max_fee'],
					'maxDistanceKm' => (float) $settings['delivery_max_km'],
				),
				'commerce' => array(
					'free_delivery_from' => (float) $settings['free_delivery_from'],
					'returns_days'       => (int) $settings['returns_days'],
				),
				'seller'   => array(
					'registration_fee' => (float) $settings['seller_fee'],
					'commission_rate'  => (float) $settings['seller_commission'],
					'payout_days'      => (int) $settings['seller_payout_days'],
					'pay_number'       => $settings['seller_pay_number'],
					'pay_name'         => $settings['seller_pay_name'],
				),
			) );
		},
	) );
} );

/* -------------------------------------------------------------------------
 * wp-admin screen
 * ---------------------------------------------------------------------- */

add_action( 'admin_menu', function () {
	add_menu_page(
		'Kandi Storefront',
		'Kandi Storefront',
		'manage_options',
		'kandi-storefront',
		'kandi_settings_render_page',
		'dashicons-store',
		56
	);
} );

/** Loads the media library picker used by the logo field. */
add_action( 'admin_enqueue_scripts', function ( $hook ) {
	if ( 'toplevel_page_kandi-storefront' === $hook ) {
		wp_enqueue_media();
	}
} );

/** Text fields are sanitised per type; URLs and emails get their own filters. */
function kandi_settings_sanitise( $key, $value ) {
	$url_fields   = array( 'logo_url', 'favicon_url', 'promo_cta_url', 'banner_cta_url', 'banner_image_url', 'banner_image_mobile_url', 'banner_image_href', 'facebook_url', 'instagram_url', 'tiktok_url', 'x_url', 'app_store_url', 'play_store_url' );
	$number_field = array( 'free_delivery_from', 'returns_days', 'logo_id', 'favicon_id', 'banner_image_id', 'banner_image_mobile_id', 'seller_fee', 'seller_commission', 'seller_payout_days', 'delivery_lat', 'delivery_lng', 'delivery_base', 'delivery_per_km', 'delivery_free_km', 'delivery_max_fee', 'delivery_max_km' );

	if ( 'ticker_messages' === $key || 'promotions' === $key ) {
		return sanitize_textarea_field( $value );
	}
	if ( 'app_available' === $key ) {
		// An unchecked checkbox is not posted at all, which the save loop
		// below turns into "leave as-is" — so the form posts a hidden 0 first.
		return '1' === (string) $value ? '1' : '0';
	}
	if ( 'support_email' === $key ) {
		return sanitize_email( $value );
	}
	if ( in_array( $key, $number_field, true ) ) {
		return (float) $value;
	}
	if ( in_array( $key, $url_fields, true ) ) {
		// Relative paths like /sale are legitimate here, and esc_url_raw would
		// keep them, but it strips a leading slash from nothing else — so only
		// absolute URLs go through it.
		$value = trim( (string) $value );
		return preg_match( '#^https?://#i', $value ) ? esc_url_raw( $value ) : sanitize_text_field( $value );
	}

	return sanitize_text_field( $value );
}

function kandi_settings_render_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'You do not have permission to edit the storefront.' );
	}

	$saved_notice = false;

	if ( isset( $_POST['kandi_settings_nonce'] ) && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['kandi_settings_nonce'] ) ), 'kandi_save_settings' ) ) {
		$incoming = array();
		foreach ( array_keys( kandi_settings_defaults() ) as $key ) {
			if ( isset( $_POST[ $key ] ) ) {
				$incoming[ $key ] = kandi_settings_sanitise( $key, wp_unslash( $_POST[ $key ] ) );
			}
		}
		update_option( KANDI_SETTINGS_OPTION, $incoming );

		// The connection values live in their own options, outside the array
		// that gets served publicly. A blank secret field means "leave it as it
		// is" rather than "erase it" — the field renders empty on every load,
		// so treating blank as a value would wipe the secret on any save.
		if ( isset( $_POST['kandi_storefront_url'] ) ) {
			update_option(
				KANDI_STOREFRONT_URL,
				untrailingslashit( esc_url_raw( trim( (string) wp_unslash( $_POST['kandi_storefront_url'] ) ) ) )
			);
		}
		foreach ( array( 'kandi_api_secret' => KANDI_SECRET_OPTION, 'kandi_owner_passcode' => KANDI_PASSCODE_OPTION ) as $field => $option ) {
			if ( ! isset( $_POST[ $field ] ) ) {
				continue;
			}
			$value = trim( (string) wp_unslash( $_POST[ $field ] ) );
			if ( '' !== $value ) {
				update_option( $option, sanitize_text_field( $value ) );
			}
		}

		$saved_notice = true;
	}

	$s = kandi_settings_all();
	?>
	<div class="wrap">
		<h1>Kandi Storefront</h1>
		<p>Everything here shows on the Next.js storefront within about a minute of saving. Leave a field blank to fall back to the built-in wording.</p>

		<?php if ( $saved_notice ) : ?>
			<div class="notice notice-success is-dismissible"><p>Saved. The storefront will pick this up within a minute.</p></div>
		<?php endif; ?>

		<form method="post">
			<?php wp_nonce_field( 'kandi_save_settings', 'kandi_settings_nonce' ); ?>

			<h2 class="title">Storefront connection</h2>
			<p class="description">
				The three values that make the Next.js shop work. Everything else on this page is
				wording; these are what let the two halves talk to each other.
			</p>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="kandi_storefront_url">Storefront URL</label></th>
					<td>
						<input type="text" id="kandi_storefront_url" name="kandi_storefront_url" value="<?php echo esc_attr( kandi_storefront_url() ); ?>" class="large-text" placeholder="https://shop.kandiug.com">
						<p class="description">
							Where the Next.js shop is published, with no trailing slash.
							<strong>Fill this in and deleted or edited products disappear from the shop
							immediately</strong> — WordPress pings the storefront to drop its cached
							catalogue on every product change. Leave it blank and the shop keeps showing
							the old catalogue for up to a minute after each edit.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="kandi_api_secret">Storefront API secret</label></th>
					<td>
						<input type="password" id="kandi_api_secret" name="kandi_api_secret" value="" class="regular-text" autocomplete="new-password" placeholder="<?php echo get_option( KANDI_SECRET_OPTION ) ? '•••••••• (saved — type to replace)' : 'Paste a long random string'; ?>">
						<p class="description">
							Must match <code>KANDI_API_SECRET</code> in the storefront's <code>.env.local</code>.
							Every order, seller and owner request carries it, so only your shop can reach
							these endpoints.
							<?php if ( defined( 'KANDI_API_SECRET' ) && KANDI_API_SECRET ) : ?>
								<br><strong>A <code>KANDI_API_SECRET</code> constant is defined in wp-config.php, and it wins over this field.</strong>
							<?php endif; ?>
							Leave blank to keep the value you already saved.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="kandi_owner_passcode">Owner passcode</label></th>
					<td>
						<input type="password" id="kandi_owner_passcode" name="kandi_owner_passcode" value="" class="regular-text" autocomplete="new-password" placeholder="<?php echo get_option( KANDI_PASSCODE_OPTION ) ? '•••••••• (saved — type to replace)' : 'Not set — owner access is off'; ?>">
						<p class="description">
							Unlocks <code><?php echo esc_html( kandi_storefront_url() ?: 'https://your-shop' ); ?>/admin</code>,
							where you can add, edit and delete <em>any</em> product without a seller account.
							Until this is set, that screen refuses every request. Make it long and random —
							it is the only thing standing between the internet and your catalogue.
							Leave blank to keep the value you already saved.
						</p>
					</td>
				</tr>
			</table>

			<h2 class="title">Logo and brand</h2>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="logo_url">Logo image</label></th>
					<td>
						<div id="kandi-logo-preview" style="margin-bottom:8px;">
							<?php if ( $s['logo_url'] ) : ?>
								<img src="<?php echo esc_url( $s['logo_url'] ); ?>" alt="" style="max-height:60px;background:#f6f6f6;padding:6px;border-radius:6px;">
							<?php else : ?>
								<em>No logo set — the storefront shows the built-in wordmark.</em>
							<?php endif; ?>
						</div>
						<input type="text" id="logo_url" name="logo_url" value="<?php echo esc_attr( $s['logo_url'] ); ?>" class="regular-text" placeholder="https://…">
						<input type="hidden" id="logo_id" name="logo_id" value="<?php echo esc_attr( $s['logo_id'] ); ?>">
						<button type="button" class="button" id="kandi-pick-logo">Choose from media library</button>
						<button type="button" class="button" id="kandi-clear-logo">Remove</button>
						<p class="description">A wide (landscape) PNG or SVG with a transparent background works best. It is displayed about 40px tall.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="favicon_url">Email brand mark</label></th>
					<td>
						<div id="kandi-favicon-preview" style="margin-bottom:8px;">
							<?php if ( $s['favicon_url'] ) : ?>
								<img src="<?php echo esc_url( $s['favicon_url'] ); ?>" alt="" style="width:32px;height:32px;object-fit:contain;background:#f6f6f6;padding:4px;border-radius:6px;">
							<?php else : ?>
								<em>No mark set — emails fall back to the shop name in text.</em>
							<?php endif; ?>
						</div>
						<input type="text" id="favicon_url" name="favicon_url" value="<?php echo esc_attr( $s['favicon_url'] ); ?>" class="regular-text" placeholder="https://…">
						<input type="hidden" id="favicon_id" name="favicon_id" value="<?php echo esc_attr( $s['favicon_id'] ); ?>">
						<button type="button" class="button" id="kandi-pick-favicon">Choose from media library</button>
						<button type="button" class="button" id="kandi-clear-favicon">Remove</button>
						<p class="description">
							The square mark that goes on emails &mdash; the receipt letterhead
							and the header of every notification the shop sends. A
							<strong>square</strong> PNG at 512&times;512 works everywhere.
							A wide logo will <strong>not</strong> work here; crop it square first.
							<br>
							<strong>This is no longer the browser tab icon.</strong> The tab icon
							and the icon Google shows beside the shop in search results are now a
							file that ships with the storefront (<code>public/icon.png</code>),
							because a favicon that depends on WordPress being reachable is a
							favicon that quietly changes &mdash; and a search favicon that changes
							is one Google stops showing. Changing it means replacing that file and
							deploying. Nothing you do on this row affects it.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="brand_name">Brand name</label></th>
					<td>
						<input type="text" id="brand_name" name="brand_name" value="<?php echo esc_attr( $s['brand_name'] ); ?>" class="regular-text">
						<input type="text" id="brand_suffix" name="brand_suffix" value="<?php echo esc_attr( $s['brand_suffix'] ); ?>" class="regular-text">
						<p class="description">Shown as two words side by side when no logo image is set — e.g. <strong>Kandi</strong> For Less.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="tagline">Tagline</label></th>
					<td><input type="text" id="tagline" name="tagline" value="<?php echo esc_attr( $s['tagline'] ); ?>" class="large-text"></td>
				</tr>
			</table>

			<h2 class="title">Promotional wording</h2>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">Top strip</th>
					<td>
						<input type="text" name="promo_line_1" value="<?php echo esc_attr( $s['promo_line_1'] ); ?>" class="large-text" placeholder="Main promise"><br><br>
						<input type="text" name="promo_line_2" value="<?php echo esc_attr( $s['promo_line_2'] ); ?>" class="regular-text" placeholder="Second point">
						<input type="text" name="promo_line_3" value="<?php echo esc_attr( $s['promo_line_3'] ); ?>" class="regular-text" placeholder="Third point">
						<p class="description">The thin strip above the search bar.</p>
					</td>
				</tr>
				<tr>
					<th scope="row">Top strip link</th>
					<td>
						<input type="text" name="promo_cta_label" value="<?php echo esc_attr( $s['promo_cta_label'] ); ?>" class="regular-text" placeholder="Up to 80% off">
						<input type="text" name="promo_cta_url" value="<?php echo esc_attr( $s['promo_cta_url'] ); ?>" class="regular-text" placeholder="/sale">
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="ticker_messages">Animated rotating line</label></th>
					<td>
						<textarea id="ticker_messages" name="ticker_messages" rows="5" class="large-text"><?php echo esc_textarea( $s['ticker_messages'] ); ?></textarea>
						<p class="description">
							One message per line. They rotate in the masthead, one every few seconds.
							Keep them to promises you actually keep — invented stock counts and fake
							countdowns break consumer-protection rules and lose repeat customers.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="promotions">Campaign promotions</label></th>
					<td>
						<textarea id="promotions" name="promotions" rows="6" class="large-text code" placeholder="30% OFF | Christmas Sale | Ends 26 December | /sale"><?php echo esc_textarea( $s['promotions'] ); ?></textarea>
						<p class="description">
							The row of campaign cards on the homepage. <strong>One per line</strong>,
							four fields separated by a pipe character:
							<br>
							<code>Badge | Headline | Small line | /where-it-links</code>
							<br><br>
							For example:
							<br>
							<code>30% OFF&nbsp;|&nbsp;Christmas Sale&nbsp;|&nbsp;Ends 26 December&nbsp;|&nbsp;/sale</code>
							<br>
							<code>NEW IN&nbsp;|&nbsp;Summer Drop&nbsp;|&nbsp;Fresh this week&nbsp;|&nbsp;/search?sort=newest</code>
							<br>
							<code>UP TO 50%&nbsp;|&nbsp;Shoes Week&nbsp;|&nbsp;While stocks last&nbsp;|&nbsp;/category/shoes</code>
							<br><br>
							Only the headline is required, and six is the most that will show.
							<strong>Leave this empty and the shop works out its own</strong> from the
							catalogue — the real biggest discount, genuinely new stock — so the row is
							never empty and never advertises a sale that is not happening.
							<br>
							Take a campaign down by deleting its line. Nothing expires by itself, so a
							Christmas card left here will still be up in March.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row">Homepage banner</th>
					<td>
						<input type="text" name="banner_eyebrow" value="<?php echo esc_attr( $s['banner_eyebrow'] ); ?>" class="regular-text" placeholder="Small line above"><br><br>
						<input type="text" name="banner_headline" value="<?php echo esc_attr( $s['banner_headline'] ); ?>" class="large-text" placeholder="Big headline"><br><br>
						<input type="text" name="banner_cta_label" value="<?php echo esc_attr( $s['banner_cta_label'] ); ?>" class="regular-text" placeholder="Shop now">
						<input type="text" name="banner_cta_url" value="<?php echo esc_attr( $s['banner_cta_url'] ); ?>" class="regular-text" placeholder="/sale">
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="banner_image_url">Hero image (desktop)</label></th>
					<td>
						<div id="kandi-hero-preview" style="margin-bottom:8px;">
							<?php if ( $s['banner_image_url'] ) : ?>
								<img src="<?php echo esc_url( $s['banner_image_url'] ); ?>" alt="" style="max-width:520px;width:100%;height:auto;background:#f6f6f6;padding:6px;border-radius:6px;">
							<?php else : ?>
								<em>No hero image — the storefront draws its own hero with live text.</em>
							<?php endif; ?>
						</div>
						<input type="text" id="banner_image_url" name="banner_image_url" value="<?php echo esc_attr( $s['banner_image_url'] ); ?>" class="large-text" placeholder="https://…">
						<input type="hidden" id="banner_image_id" name="banner_image_id" value="<?php echo esc_attr( $s['banner_image_id'] ); ?>">
						<button type="button" class="button" id="kandi-pick-hero">Choose from media library</button>
						<button type="button" class="button" id="kandi-clear-hero">Remove</button>
						<p class="description">
							Spans the <strong>full width</strong> of the page, so upload it wide.
							<strong>1920&times;640 (3:1) is the size to aim for.</strong>
							<br>
							Whatever you upload is shown <strong>whole</strong> — nothing is cropped
							and nothing is stretched, at any shape. What the shape decides is the
							<em>height</em>, because a full-width image has no height of its own: it
							is the page width times its proportions. Across a wide screen a 3:1
							banner comes out about 530px tall and a 2.4:1 one about 650px, which is
							most of a laptop screen given to one picture before a single product is
							visible. So the wider you export it, the shorter and tighter the hero.
							<br>
							Avoid anything near square. A 1:1 banner would be as tall as the page is
							wide; past roughly 720px the storefront does start trimming, purely to
							stop one image filling the whole screen.
							<br>
							Leave this empty to go back to the built-in hero, which is live text and
							resizes properly on every screen.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="banner_image_mobile_url">Hero image (phone)</label></th>
					<td>
						<div id="kandi-hero-mobile-preview" style="margin-bottom:8px;">
							<?php if ( $s['banner_image_mobile_url'] ) : ?>
								<img src="<?php echo esc_url( $s['banner_image_mobile_url'] ); ?>" alt="" style="max-width:260px;width:100%;height:auto;background:#f6f6f6;padding:6px;border-radius:6px;">
							<?php else : ?>
								<em>None — the desktop image is used at every screen size.</em>
							<?php endif; ?>
						</div>
						<input type="text" id="banner_image_mobile_url" name="banner_image_mobile_url" value="<?php echo esc_attr( $s['banner_image_mobile_url'] ); ?>" class="large-text" placeholder="https://…">
						<input type="hidden" id="banner_image_mobile_id" name="banner_image_mobile_id" value="<?php echo esc_attr( $s['banner_image_mobile_id'] ); ?>">
						<button type="button" class="button" id="kandi-pick-hero-mobile">Choose from media library</button>
						<button type="button" class="button" id="kandi-clear-hero-mobile">Remove</button>
						<p class="description">
							<strong>Strongly recommended, and here is why.</strong> A wide banner shown on a
							phone is about 160px tall — any wording designed into it comes out at
							roughly 13px, and small print inside it is not readable at all. Most
							shoppers here are on a phone.
							<br>
							Upload a taller crop with the words re-laid out for a narrow screen —
							about <strong>900&times;1100</strong> works well. Shown below 768px wide.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="banner_image_href">Hero image link</label></th>
					<td>
						<input type="text" id="banner_image_href" name="banner_image_href" value="<?php echo esc_attr( $s['banner_image_href'] ); ?>" class="regular-text" placeholder="/sale">
						<p class="description">Where tapping the banner goes — <code>/sale</code>, <code>/category/shoes</code>, and so on.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="banner_image_alt">Hero image description</label></th>
					<td>
						<input type="text" id="banner_image_alt" name="banner_image_alt" value="<?php echo esc_attr( $s['banner_image_alt'] ); ?>" class="large-text" placeholder="Buy more, spend less — unbeatable prices on everything you love">
						<p class="description">
							Type out whatever the banner <em>says</em>. The words in an uploaded image are
							pixels: Google cannot read them, a screen reader cannot read them, and a
							shopper on a bad connection whose image fails sees only this. It is usually
							the biggest statement on the homepage, so it is worth filling in.
						</p>
					</td>
				</tr>
			</table>

			<h2 class="title">Contact details</h2>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="support_phone">Phone</label></th>
					<td><input type="text" id="support_phone" name="support_phone" value="<?php echo esc_attr( $s['support_phone'] ); ?>" class="regular-text"></td>
				</tr>
				<tr>
					<th scope="row"><label for="support_email">Email</label></th>
					<td><input type="email" id="support_email" name="support_email" value="<?php echo esc_attr( $s['support_email'] ); ?>" class="regular-text"></td>
				</tr>
				<tr>
					<th scope="row"><label for="whatsapp">WhatsApp number</label></th>
					<td>
						<input type="text" id="whatsapp" name="whatsapp" value="<?php echo esc_attr( $s['whatsapp'] ); ?>" class="regular-text" placeholder="256700000000">
						<p class="description">International format, no + or spaces. Leave blank to hide the WhatsApp button.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="support_hours">Opening hours</label></th>
					<td><input type="text" id="support_hours" name="support_hours" value="<?php echo esc_attr( $s['support_hours'] ); ?>" class="large-text"></td>
				</tr>
				<tr>
					<th scope="row"><label for="support_address">Address</label></th>
					<td><input type="text" id="support_address" name="support_address" value="<?php echo esc_attr( $s['support_address'] ); ?>" class="large-text"></td>
				</tr>
			</table>

			<h2 class="title">Mobile apps</h2>
			<p class="description">
				The App Store and Google Play badges show in the footer either way. Until you
				tick the box below they are greyed out and labelled <strong>Coming soon</strong>,
				so nobody clicks through to a listing that is not live yet.
			</p>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">App is live</th>
					<td>
						<!-- Posted first so an unticked box still saves as "off". -->
						<input type="hidden" name="app_available" value="0">
						<label>
							<input type="checkbox" name="app_available" value="1" <?php checked( '1', (string) $s['app_available'] ); ?>>
							The app is published — turn the badges into working links
						</label>
						<p class="description">
							This only takes effect once at least one store URL below is filled in.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="app_store_url">Apple App Store URL</label></th>
					<td>
						<input type="text" id="app_store_url" name="app_store_url" value="<?php echo esc_attr( $s['app_store_url'] ); ?>" class="large-text" placeholder="https://apps.apple.com/ug/app/…">
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="play_store_url">Google Play URL</label></th>
					<td>
						<input type="text" id="play_store_url" name="play_store_url" value="<?php echo esc_attr( $s['play_store_url'] ); ?>" class="large-text" placeholder="https://play.google.com/store/apps/details?id=…">
					</td>
				</tr>
			</table>

			<h2 class="title">Social links</h2>
			<p class="description">Blank links are hidden on the storefront rather than pointing nowhere.</p>
			<table class="form-table" role="presentation">
				<tr><th scope="row">Facebook</th><td><input type="text" name="facebook_url" value="<?php echo esc_attr( $s['facebook_url'] ); ?>" class="large-text"></td></tr>
				<tr><th scope="row">Instagram</th><td><input type="text" name="instagram_url" value="<?php echo esc_attr( $s['instagram_url'] ); ?>" class="large-text"></td></tr>
				<tr><th scope="row">TikTok</th><td><input type="text" name="tiktok_url" value="<?php echo esc_attr( $s['tiktok_url'] ); ?>" class="large-text"></td></tr>
				<tr><th scope="row">X / Twitter</th><td><input type="text" name="x_url" value="<?php echo esc_attr( $s['x_url'] ); ?>" class="large-text"></td></tr>
			</table>

			<h2 class="title">Commercial terms</h2>
			<p class="description">These numbers are quoted all over the storefront — the delivery banner, the cart progress bar, the product page, the policy pages. Changing them here changes them everywhere.</p>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="free_delivery_from">Free delivery from (UGX)</label></th>
					<td><input type="number" id="free_delivery_from" name="free_delivery_from" value="<?php echo esc_attr( $s['free_delivery_from'] ); ?>" class="small-text" step="1000" min="0"></td>
				</tr>
				<tr>
					<th scope="row"><label for="returns_days">Returns window (days)</label></th>
					<td><input type="number" id="returns_days" name="returns_days" value="<?php echo esc_attr( $s['returns_days'] ); ?>" class="small-text" min="0"></td>
				</tr>
			</table>

			<h2 class="title">Delivery pricing</h2>
			<p class="description">
				Delivery is charged per kilometre from your shop, straight-line. The shopper
				shares their location (or types their area) at checkout and sees the exact
				cost <strong>before</strong> they pay, and the same figures price the order on
				the server — so the fee cannot be edited in the browser.
				<br>
				<strong>The defaults are plausible Kampala figures, not researched ones.</strong>
				Replace them with what your riders actually cost you.
			</p>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">Shop location</th>
					<td>
						<label>Latitude
							<input type="number" name="delivery_lat" value="<?php echo esc_attr( $s['delivery_lat'] ); ?>" class="small-text" step="0.0001">
						</label>
						<label style="margin-left:12px;">Longitude
							<input type="number" name="delivery_lng" value="<?php echo esc_attr( $s['delivery_lng'] ); ?>" class="small-text" step="0.0001">
						</label>
						<p class="description">
							Where your riders set off from. Find it by right-clicking your shop in
							Google Maps and choosing the coordinates it offers. The default is
							central Kampala.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="delivery_base">Base fee (UGX)</label></th>
					<td>
						<input type="number" id="delivery_base" name="delivery_base" value="<?php echo esc_attr( $s['delivery_base'] ); ?>" class="small-text" step="500" min="0">
						<p class="description">Charged on every delivery, before distance.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="delivery_per_km">Per kilometre (UGX)</label></th>
					<td>
						<input type="number" id="delivery_per_km" name="delivery_per_km" value="<?php echo esc_attr( $s['delivery_per_km'] ); ?>" class="small-text" step="100" min="0">
						<p class="description">
							Charged for each kilometre beyond the free radius below. Note this is
							straight-line distance, which runs shorter than the road route — set
							the rate a little above your true per-km cost to absorb that.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="delivery_free_km">Free radius (km)</label></th>
					<td>
						<input type="number" id="delivery_free_km" name="delivery_free_km" value="<?php echo esc_attr( $s['delivery_free_km'] ); ?>" class="small-text" step="1" min="0">
						<p class="description">Distance included in the base fee.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="delivery_max_fee">Maximum fee (UGX)</label></th>
					<td>
						<input type="number" id="delivery_max_fee" name="delivery_max_fee" value="<?php echo esc_attr( $s['delivery_max_fee'] ); ?>" class="small-text" step="1000" min="0">
						<p class="description">The fee never exceeds this, however far the address is.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="delivery_max_km">Delivery radius (km)</label></th>
					<td>
						<input type="number" id="delivery_max_km" name="delivery_max_km" value="<?php echo esc_attr( $s['delivery_max_km'] ); ?>" class="small-text" step="10" min="0">
						<p class="description">
							Beyond this the checkout tells the shopper you do not deliver there and
							will not take the order. Set to 0 to deliver anywhere.
						</p>
					</td>
				</tr>
			</table>
			<p class="description">
				Orders at or above the <em>Free delivery from</em> figure in Commercial terms
				above pay nothing, whatever the distance.
			</p>

			<h2 class="title">Seller terms</h2>
			<p class="description">Quoted on the &ldquo;Sell with us&rdquo; landing page, in its earnings calculator, and throughout seller onboarding.</p>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="seller_fee">Monthly seller fee (UGX)</label></th>
					<td>
						<input type="number" id="seller_fee" name="seller_fee" value="<?php echo esc_attr( $s['seller_fee'] ); ?>" class="small-text" step="1000" min="0">
						<p class="description">
							Charged <strong>every month</strong>, not once. A seller whose month runs
							out has their products hidden from the shop until they pay — nothing is
							deleted, and their listings come straight back. Record each payment with
							<em>Add a month</em> on the Kandi Sellers screen.
							<br>
							Set to 0 to make selling free: the payment step disappears from
							onboarding and no store is ever hidden for non-payment.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="seller_commission">Default commission (%)</label></th>
					<td>
						<input type="number" id="seller_commission" name="seller_commission" value="<?php echo esc_attr( $s['seller_commission'] ); ?>" class="small-text" step="0.5" min="0" max="100">
						<p class="description">The rate quoted publicly. Per-seller rates are set in <em>Kandi Sellers</em> and override this.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="seller_payout_days">Payout frequency (days)</label></th>
					<td><input type="number" id="seller_payout_days" name="seller_payout_days" value="<?php echo esc_attr( $s['seller_payout_days'] ); ?>" class="small-text" min="1"></td>
				</tr>
				<tr>
					<th scope="row"><label for="seller_pay_number">Fee payment number</label></th>
					<td>
						<input type="text" id="seller_pay_number" name="seller_pay_number" value="<?php echo esc_attr( $s['seller_pay_number'] ); ?>" class="regular-text" placeholder="0700 000 000">
						<input type="text" name="seller_pay_name" value="<?php echo esc_attr( $s['seller_pay_name'] ); ?>" class="regular-text" placeholder="Registered name on the account">
						<p class="description">The mobile money number sellers send the monthly fee to, and the name it is registered under so they can check before sending. Leave blank and onboarding tells them to call you instead.</p>
					</td>
				</tr>
			</table>

			<?php submit_button( 'Save storefront settings' ); ?>
		</form>
	</div>

	<script>
	jQuery(function ($) {
		var frame;

		$('#kandi-pick-logo').on('click', function (event) {
			event.preventDefault();

			if (frame) {
				frame.open();
				return;
			}

			frame = wp.media({
				title: 'Choose the storefront logo',
				button: { text: 'Use this logo' },
				library: { type: 'image' },
				multiple: false
			});

			frame.on('select', function () {
				var image = frame.state().get('selection').first().toJSON();
				$('#logo_url').val(image.url);
				$('#logo_id').val(image.id);
				$('#kandi-logo-preview').html(
					$('<img>', { src: image.url, alt: '' }).css({
						maxHeight: '60px', background: '#f6f6f6', padding: '6px', borderRadius: '6px'
					})
				);
			});

			frame.open();
		});

		$('#kandi-clear-logo').on('click', function (event) {
			event.preventDefault();
			$('#logo_url').val('');
			$('#logo_id').val(0);
			$('#kandi-logo-preview').html('<em>No logo set — the storefront shows the built-in wordmark.</em>');
		});

		// ---- The two hero-image pickers ----
		//
		// Built from one factory rather than copied twice more, because there
		// are now four of these on this screen and they differ only in their
		// element ids, their frame title and what the empty state says.
		//
		// Each gets its OWN `wp.media` frame, created lazily and kept. Sharing a
		// frame between fields carries the previous field's selection across, so
		// opening the phone picker after the desktop one would come up with the
		// desktop banner already ticked — which looks like the field is already
		// filled in and is the sort of thing somebody saves without noticing.
		function kandiImagePicker(options) {
			var frameInstance;

			$('#' + options.pickId).on('click', function (event) {
				event.preventDefault();

				if (frameInstance) {
					frameInstance.open();
					return;
				}

				frameInstance = wp.media({
					title: options.title,
					button: { text: options.buttonText },
					library: { type: 'image' },
					multiple: false
				});

				frameInstance.on('select', function () {
					var image = frameInstance.state().get('selection').first().toJSON();
					$('#' + options.urlId).val(image.url);
					$('#' + options.idId).val(image.id);
					$('#' + options.previewId).html(
						$('<img>', { src: image.url, alt: '' }).css({
							maxWidth: options.previewWidth,
							width: '100%',
							height: 'auto',
							background: '#f6f6f6',
							padding: '6px',
							borderRadius: '6px'
						})
					);
				});

				frameInstance.open();
			});

			$('#' + options.clearId).on('click', function (event) {
				event.preventDefault();
				$('#' + options.urlId).val('');
				$('#' + options.idId).val(0);
				$('#' + options.previewId).html('<em>' + options.emptyText + '</em>');
			});
		}

		kandiImagePicker({
			pickId: 'kandi-pick-hero',
			clearId: 'kandi-clear-hero',
			urlId: 'banner_image_url',
			idId: 'banner_image_id',
			previewId: 'kandi-hero-preview',
			previewWidth: '520px',
			title: 'Choose the homepage hero image',
			buttonText: 'Use this banner',
			emptyText: 'No hero image — the storefront draws its own hero with live text.'
		});

		kandiImagePicker({
			pickId: 'kandi-pick-hero-mobile',
			clearId: 'kandi-clear-hero-mobile',
			urlId: 'banner_image_mobile_url',
			idId: 'banner_image_mobile_id',
			previewId: 'kandi-hero-mobile-preview',
			previewWidth: '260px',
			title: 'Choose the phone hero image',
			buttonText: 'Use this banner',
			emptyText: 'None — the desktop image is used at every screen size.'
		});

		// The favicon picker. Its own frame instance, because sharing one with
		// the logo would carry the logo's current selection across.
		var faviconFrame;

		$('#kandi-pick-favicon').on('click', function (event) {
			event.preventDefault();

			if (faviconFrame) {
				faviconFrame.open();
				return;
			}

			faviconFrame = wp.media({
				title: 'Choose the browser tab icon',
				button: { text: 'Use this favicon' },
				library: { type: 'image' },
				multiple: false
			});

			faviconFrame.on('select', function () {
				var image = faviconFrame.state().get('selection').first().toJSON();
				$('#favicon_url').val(image.url);
				$('#favicon_id').val(image.id);
				$('#kandi-favicon-preview').html(
					$('<img>', { src: image.url, alt: '' }).css({
						width: '32px', height: '32px', objectFit: 'contain',
						background: '#f6f6f6', padding: '4px', borderRadius: '6px'
					})
				);
			});

			faviconFrame.open();
		});

		$('#kandi-clear-favicon').on('click', function (event) {
			event.preventDefault();
			$('#favicon_url').val('');
			$('#favicon_id').val(0);
			$('#kandi-favicon-preview').html('<em>No mark set — emails fall back to the shop name in text.</em>');
		});
	});
	</script>
	<?php
}
