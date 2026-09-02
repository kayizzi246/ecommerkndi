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

/**
 * The build of this file. Bump it whenever the API contract changes.
 *
 * Reported by /seller/health and shown in the Seller Centre, so "the code on
 * the server is older than the code in the repository" becomes a sentence on
 * the screen rather than a fortnight of debugging a fix that was never running.
 */
define( 'KANDI_SELLER_API_VERSION', '2.5.1' );

/**
 * Load guard — this file must run exactly once.
 *
 * It can legitimately arrive by two roads: as a plugin in
 * wp-content/plugins/kandi-seller-api/, and pasted into the Code Snippets
 * plugin. Installed both ways, the second copy to load hits
 * `function kandi_seller_install()` a second time and PHP stops the request
 * dead with "Cannot redeclare" — a 500 on every seller endpoint, with the real
 * message buried in a log nobody is reading.
 *
 * Worse is the near-miss: two *different* versions loaded, where the older one
 * registers its routes last and silently wins. Every symptom then belongs to
 * code that is not the code being edited.
 *
 * So: first copy in wins and records how it arrived; any later copy returns
 * immediately and leaves a note that /seller/health reports. Nothing fatals,
 * and the duplicate is visible from the storefront.
 */
if ( defined( 'KANDI_SELLER_LOADED_FROM' ) ) {
	if ( ! isset( $GLOBALS['kandi_seller_duplicate_loads'] ) ) {
		$GLOBALS['kandi_seller_duplicate_loads'] = array();
	}
	$GLOBALS['kandi_seller_duplicate_loads'][] = __FILE__;
	return;
}

define( 'KANDI_SELLER_LOADED_FROM', __FILE__ );

define( 'KANDI_SELLER_DB_VERSION', '1.1.0' );
define( 'KANDI_SELLER_ROLE', 'kandi_seller' );
define( 'KANDI_SELLER_TOKEN_TTL', 14 * DAY_IN_SECONDS );
/** Ceiling for one product photo, in bytes. Phone cameras routinely exceed 5 MB. */
define( 'KANDI_SELLER_MAX_UPLOAD', 8 * 1024 * 1024 );

/**
 * Image types a seller may upload.
 *
 * WebP and AVIF are on the list because that is increasingly what a phone hands
 * over — every Android share sheet produces WebP, and modern iOS pipelines
 * produce AVIF. A seller whose photo was refused as "not an image" had no way
 * to know it needed converting and no tool on the phone to convert it with, so
 * the listing went up with no picture at all.
 *
 * Kept in step with `ALLOWED_TYPES` in app/api/seller/media/route.ts and
 * `ACCEPTED` in ImageUploader.tsx. All three must agree, or a file passes one
 * gate and is turned away by the next.
 */
if ( ! function_exists( 'kandi_seller_image_mimes' ) ) :
function kandi_seller_image_mimes() {
	return array( 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif' );
}
endif;

/**
 * Lets WordPress itself accept WebP and AVIF.
 *
 * The allow-list above governs what this plugin will take; this governs what
 * WordPress will take, and both have to say yes. `wp_handle_upload` and
 * `wp_check_filetype_and_ext` both test the file against
 * `get_allowed_mime_types()`, so without this an AVIF is refused by core after
 * passing every check here — the upload fails with WordPress's own generic
 * "Sorry, you are not allowed to upload this file type", which tells the seller
 * nothing.
 *
 * WordPress has shipped both by default since 6.5 (AVIF) and 5.8 (WebP); this
 * is what makes the uploader work on the installs that predate them. Adding a
 * key that is already present is a no-op.
 */
add_filter( 'upload_mimes', function ( $mimes ) {
	$mimes['webp'] = 'image/webp';
	$mimes['avif'] = 'image/avif';
	return $mimes;
} );

/** How long an emailed verification code stays valid. */
define( 'KANDI_SELLER_CODE_TTL', 30 * MINUTE_IN_SECONDS );

/* -------------------------------------------------------------------------
 * 0. Email and abuse control
 *
 * Both live at the top because everything below leans on them: no endpoint
 * that costs money, sends mail or checks a password should be reachable
 * without a limit in front of it.
 * ---------------------------------------------------------------------- */

/**
 * Sends a branded email through the Kandi Notifications plugin, falling back to
 * plain-text wp_mail when it is not installed.
 *
 * The fallback matters: a verification code that never arrives because a
 * companion plugin is missing would lock every new seller out of their own
 * account.
 */
if ( ! function_exists( 'kandi_seller_mail' ) ) :
function kandi_seller_mail( $to, $subject, $heading, $body_html, $cta = null ) {
	if ( function_exists( 'kandi_send_mail' ) ) {
		return kandi_send_mail( $to, $subject, $heading, $body_html, $cta );
	}

	$text = trim( wp_strip_all_tags( str_replace( array( '<br>', '</p>' ), "\n", $body_html ) ) );
	if ( is_array( $cta ) && ! empty( $cta['url'] ) ) {
		$text .= "\n\n" . $cta['url'];
	}

	return wp_mail( $to, $subject, $heading . "\n\n" . $text );
}
endif;

/**
 * The caller's IP, as well as it can be known behind a proxy.
 *
 * Cloudflare and most Ugandan hosts terminate TLS in front of PHP, so
 * REMOTE_ADDR is the proxy rather than the visitor. The forwarded headers are
 * trivially forged, which is fine for what this is used for — spreading a rate
 * limit across attackers, not authenticating anyone — but it is why nothing
 * security-critical is ever decided from this value.
 */
if ( ! function_exists( 'kandi_seller_client_ip' ) ) :
function kandi_seller_client_ip() {
	foreach ( array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' ) as $header ) {
		if ( empty( $_SERVER[ $header ] ) ) {
			continue;
		}
		$value = sanitize_text_field( wp_unslash( $_SERVER[ $header ] ) );
		// X-Forwarded-For is a chain; the client is the first entry.
		$value = trim( explode( ',', $value )[0] );
		if ( filter_var( $value, FILTER_VALIDATE_IP ) ) {
			return $value;
		}
	}
	return '0.0.0.0';
}
endif;

/**
 * A fixed-window rate limit, counted in transients.
 *
 * Returns a WP_Error once the caller has spent its allowance, so a handler can
 * simply `return` it. Deliberately coarse: this exists to make password
 * guessing and sign-up floods pointlessly slow, not to meter traffic. Every
 * bucket is namespaced by action *and* by whatever identity the endpoint knows
 * (an email, usually), because limiting by IP alone punishes everyone behind
 * one mobile carrier NAT — which in Uganda is most of the country.
 */
if ( ! function_exists( 'kandi_seller_rate_limit' ) ) :
function kandi_seller_rate_limit( $action, $identity, $limit, $window ) {
	$key   = 'kandi_rl_' . md5( $action . '|' . strtolower( (string) $identity ) );
	$count = (int) get_transient( $key );

	if ( $count >= $limit ) {
		return new WP_Error(
			'kandi_rate_limited',
			'Too many attempts. Please wait a few minutes and try again.',
			array( 'status' => 429 )
		);
	}

	// Re-setting the transient each hit would slide the window forward forever
	// and never let the caller out; the expiry is only set on the first hit.
	set_transient( $key, $count + 1, 0 === $count ? $window : max( 60, $window ) );

	return true;
}
endif;

/** Clears a bucket after a success, so one good login forgives the typos before it. */
if ( ! function_exists( 'kandi_seller_rate_clear' ) ) :
function kandi_seller_rate_clear( $action, $identity ) {
	delete_transient( 'kandi_rl_' . md5( $action . '|' . strtolower( (string) $identity ) ) );
}
endif;

/** A six-digit verification code. Random_int, not rand — this guards an account. */
if ( ! function_exists( 'kandi_seller_new_code' ) ) :
function kandi_seller_new_code() {
	return str_pad( (string) random_int( 0, 999999 ), 6, '0', STR_PAD_LEFT );
}
endif;

/**
 * Stores a fresh code against a seller and emails it.
 *
 * The code is hashed before storage. It is short-lived and only six digits, but
 * a database dump should still not hand over a working key to every unverified
 * account in it.
 */
if ( ! function_exists( 'kandi_seller_send_code' ) ) :
function kandi_seller_send_code( $user_id ) {
	$user = get_userdata( $user_id );
	if ( ! $user ) {
		return false;
	}

	$code = kandi_seller_new_code();
	update_user_meta( $user_id, '_kandi_verify_hash', wp_hash_password( $code ) );
	update_user_meta( $user_id, '_kandi_verify_expires', time() + KANDI_SELLER_CODE_TTL );
	update_user_meta( $user_id, '_kandi_verify_attempts', 0 );

	return kandi_seller_mail(
		$user->user_email,
		'Your Kandi verification code: ' . $code,
		'Verify your seller account',
		kandi_seller_p( sprintf(
			'Enter this code in the Seller Centre to finish setting up <strong>%s</strong>:',
			esc_html( get_user_meta( $user_id, '_kandi_store_name', true ) )
		), '0 0 18px' )
		. ( function_exists( 'kandi_mail_code' )
			? kandi_mail_code( $code )
			: sprintf(
				'<p style="margin:0 0 18px;font:700 32px/1 Helvetica,Arial,sans-serif;letter-spacing:8px;color:#171717">%s</p>',
				esc_html( $code )
			) )
		. kandi_seller_p( sprintf( 'The code works for %d minutes.', (int) ( KANDI_SELLER_CODE_TTL / 60 ) ), '0 0 10px' )
		. kandi_seller_p(
			'<span style="color:#8a8178;font-size:13px">If you did not apply to sell on Kandi, ignore this email — nothing happens without the code.</span>',
			'0'
		)
	);
}
endif;

/**
 * True once the seller has entered the code that was emailed to them.
 *
 * An account with no flag at all registered before verification existed, and is
 * treated as verified. The alternative — everyone unverified until proven
 * otherwise — would have locked every existing seller out of their own store on
 * the day this plugin was updated, including any test account whose address
 * nobody can actually read email at. Only registration writes the '0', so the
 * distinction is exact: absent means legacy, '0' means new and waiting.
 *
 * This no longer decides whether a seller may *sign in* — see
 * kandi_seller_session_response. It decides what an unconfirmed account may do
 * once inside, which is everything except take money out.
 */
if ( ! function_exists( 'kandi_seller_is_verified' ) ) :
function kandi_seller_is_verified( $user_id ) {
	$flag = get_user_meta( $user_id, '_kandi_email_verified', true );
	return '' === $flag || '1' === (string) $flag;
}
endif;

/**
 * The session payload every way into an account returns.
 *
 * One function because there are four doors — password, Google, the emailed
 * code, and registration itself — and they were drifting apart. Three of them
 * used to refuse an account whose address was unconfirmed, which turned out to
 * be the single reason no new seller could reach their own dashboard: the code
 * is delivered by wp_mail, wp_mail on a host without SMTP delivers nothing, and
 * an account that can never present a code it never received can never sign in
 * by any route. The store was reachable only by accounts old enough to predate
 * the flag, which is why one legacy test account appeared to be the only seller
 * the site had.
 *
 * Confirming the address is still asked for, and still means something — it
 * gates payouts, below, which is the point at which the shop has to be sure it
 * can reach the person it is sending money to. It no longer stands between a
 * seller and the dashboard they just created, because a marketplace that cannot
 * be signed into is not more secure, only empty.
 *
 * `email_verified` rides in the seller object, so the storefront can ask for
 * confirmation without guessing.
 */
if ( ! function_exists( 'kandi_seller_session_response' ) ) :
function kandi_seller_session_response( $user_id ) {
	return rest_ensure_response( array(
		'token'      => kandi_seller_issue_token( $user_id ),
		'expires_in' => KANDI_SELLER_TOKEN_TTL,
		'seller'     => kandi_format_seller( $user_id ),
	) );
}
endif;

/* -------------------------------------------------------------------------
 * 1. Install — roles and ledger tables
 * ---------------------------------------------------------------------- */

if ( ! function_exists( 'kandi_seller_commissions_table' ) ) :
function kandi_seller_commissions_table() {
	global $wpdb;
	return $wpdb->prefix . 'kandi_commissions';
}
endif;

if ( ! function_exists( 'kandi_seller_payouts_table' ) ) :
function kandi_seller_payouts_table() {
	global $wpdb;
	return $wpdb->prefix . 'kandi_payouts';
}
endif;

/**
 * Creates the seller role and the two ledger tables. Safe to call repeatedly —
 * dbDelta only applies differences.
 */
if ( ! function_exists( 'kandi_seller_install' ) ) :
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
			entry_ids LONGTEXT NULL,
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
endif;
register_activation_hook( __FILE__, 'kandi_seller_install' );

/** Covers the Code Snippets install path, where the activation hook never runs. */
if ( ! function_exists( 'kandi_seller_maybe_install' ) ) :
function kandi_seller_maybe_install() {
	if ( get_option( 'kandi_seller_db_version' ) !== KANDI_SELLER_DB_VERSION ) {
		kandi_seller_install();
	}
}
endif;
add_action( 'plugins_loaded', 'kandi_seller_maybe_install' );

/* -------------------------------------------------------------------------
 * 2. Seller profile helpers
 * ---------------------------------------------------------------------- */

if ( ! function_exists( 'kandi_default_commission_rate' ) ) :
function kandi_default_commission_rate() {
	return (float) get_option( 'kandi_default_commission_rate', 12 );
}
endif;

if ( ! function_exists( 'kandi_is_seller' ) ) :
function kandi_is_seller( $user_id ) {
	$user = get_userdata( $user_id );
	return $user && in_array( KANDI_SELLER_ROLE, (array) $user->roles, true );
}
endif;

/** Shapes a WP user into the seller object the Next.js client expects. */
if ( ! function_exists( 'kandi_format_seller' ) ) :
function kandi_format_seller( $user_id ) {
	$user = get_userdata( $user_id );
	if ( ! $user ) {
		return null;
	}

	return array(
		'id'              => (int) $user->ID,
		'store_name'      => (string) get_user_meta( $user->ID, '_kandi_store_name', true ),
		'store_slug'      => (string) get_user_meta( $user->ID, '_kandi_store_slug', true ),
		// The colour behind the store's name on its own page, and the only part
		// of the shop a seller paints. See kandi_store_colour().
		'store_color'     => kandi_store_colour( $user->ID ),
		'email'           => $user->user_email,
		'phone'           => (string) get_user_meta( $user->ID, '_kandi_phone', true ),
		'owner_name'      => (string) get_user_meta( $user->ID, '_kandi_owner_name', true ),
		'status'          => (string) ( get_user_meta( $user->ID, '_kandi_status', true ) ?: 'pending' ),
		// Through the helper, not a raw meta read with `?:`. That idiom treats a
		// stored 0 as absent, so a seller on a genuine 0% commission — a launch
		// partner, a staff store — was silently shown and charged the shop
		// default instead. The helper distinguishes "no override" from "zero".
		'commission_rate' => kandi_seller_commission_rate( $user->ID ),
		'payout_method'   => (string) get_user_meta( $user->ID, '_kandi_payout_method', true ),
		'payout_account'  => (string) get_user_meta( $user->ID, '_kandi_payout_account', true ),
		'registered_at'   => mysql2date( 'c', $user->user_registered ),
		'logo'            => (string) get_user_meta( $user->ID, '_kandi_logo', true ),
		/**
		 * The monthly seller fee.
		 *
		 * `fee_status` is DERIVED from the paid-until date rather than read from
		 * a stored flag, so it cannot go stale between a cron run and a page
		 * load. 'waived' when the shop has set the fee to zero, so a seller
		 * never sees a payment step that does not apply to them.
		 */
		'fee_status'      => kandi_seller_fee_state( $user->ID ),
		'fee_amount'      => (float) get_user_meta( $user->ID, '_kandi_fee_amount', true ),
		'fee_reference'   => kandi_seller_fee_reference( $user->ID ),
		/**
		 * When cover runs out, ISO-8601, or null if they have never paid.
		 *
		 * The Seller Centre needs the date and not just the status: "Your fee is
		 * due" is a demand, "Your cover runs out on 14 September" is information
		 * a seller can act on before they lose their shopfront.
		 */
		'fee_paid_until'  => kandi_seller_fee_paid_until( $user->ID )
			? gmdate( 'c', kandi_seller_fee_paid_until( $user->ID ) )
			: null,
		// Whether the emailed code has been entered. The Seller Centre uses this
		// to decide between the dashboard and the verification screen.
		'email_verified'  => kandi_seller_is_verified( $user->ID ),
		// Business verification. 'missing' until documents are sent, then
		// 'submitted' until the marketplace team looks at them.
		'kyc_status'         => (string) ( get_user_meta( $user->ID, '_kandi_kyc_status', true ) ?: 'missing' ),
		'business_registered' => (string) get_user_meta( $user->ID, '_kandi_business_registered', true ),
		'business_name'      => (string) get_user_meta( $user->ID, '_kandi_business_name', true ),
		'business_number'    => (string) get_user_meta( $user->ID, '_kandi_business_number', true ),
	);
}
endif;

/** The payment reference a seller quotes when sending the registration fee. */
if ( ! function_exists( 'kandi_seller_fee_reference' ) ) :
function kandi_seller_fee_reference( $user_id ) {
	return 'KND-' . str_pad( (string) (int) $user_id, 4, '0', STR_PAD_LEFT );
}
endif;

/** The monthly seller fee currently configured in Kandi Storefront settings. */
if ( ! function_exists( 'kandi_seller_registration_fee' ) ) :
function kandi_seller_registration_fee() {
	$settings = get_option( 'kandi_storefront_settings', array() );
	if ( is_array( $settings ) && isset( $settings['seller_fee'] ) && '' !== $settings['seller_fee'] ) {
		return (float) $settings['seller_fee'];
	}
	return 50000.0;
}
endif;

/* ==========================================================================
 * THE MONTHLY SELLER FEE
 * ==========================================================================
 *
 * The fee used to be a one-off gate: a single `_kandi_fee_status` meta holding
 * 'unpaid', 'paid' or 'waived', flipped to 'paid' once and never looked at
 * again. A subscription cannot be expressed in that flag, because the only
 * question it can answer is "did they ever pay", and the question now is "are
 * they paid up *today*".
 *
 * So the truth moved to a date — `_kandi_fee_paid_until`, a Unix timestamp for
 * the moment cover runs out — and the status is DERIVED from it rather than
 * stored. That ordering is the important part. A stored status has to be
 * corrected by something running on a schedule, and anything that depends on
 * wp-cron firing on a shared host will eventually be wrong in the direction
 * that costs a seller their shopfront. A derived status cannot drift: it is
 * recomputed from the clock every time it is read.
 *
 * `_kandi_fee_status` is still written, but only for the one value the date
 * cannot express — 'waived', which is what a shop charging nothing sets.
 */

/** How long one payment buys. */
if ( ! function_exists( 'kandi_seller_fee_period' ) ) :
function kandi_seller_fee_period() {
	return '+1 month';
}
endif;

/**
 * When this seller's cover expires, as a Unix timestamp. 0 if never paid.
 */
if ( ! function_exists( 'kandi_seller_fee_paid_until' ) ) :
function kandi_seller_fee_paid_until( $seller_id ) {
	return (int) get_user_meta( $seller_id, '_kandi_fee_paid_until', true );
}
endif;

/**
 * The seller's fee standing right now: 'waived', 'paid' or 'unpaid'.
 *
 * Derived from the clock, never from a stored flag — see the block above.
 *
 * There is no grace period, by explicit instruction: cover ends the moment the
 * paid-until timestamp passes. Note what that means operationally, because it
 * is a foot-gun rather than a subtlety — payments are confirmed BY HAND on the
 * Sellers screen in wp-admin, so a seller who has genuinely paid stays 'unpaid'
 * until somebody marks it. The lag being punished there is the marketplace's,
 * not the seller's. `kandi_seller_extend_fee` therefore always counts a month
 * from the later of now and the existing expiry, so marking a payment late
 * never costs the seller the days you took to record it.
 */
if ( ! function_exists( 'kandi_seller_fee_state' ) ) :
function kandi_seller_fee_state( $seller_id ) {
	if ( 'waived' === get_user_meta( $seller_id, '_kandi_fee_status', true ) ) {
		return 'waived';
	}

	// A shop that has set the fee to zero charges nobody, whatever is on file.
	if ( kandi_seller_registration_fee() <= 0 ) {
		return 'waived';
	}

	$until = kandi_seller_fee_paid_until( $seller_id );

	return ( $until > 0 && $until >= time() ) ? 'paid' : 'unpaid';
}
endif;

/**
 * Credits one month of cover.
 *
 * Counted from the LATER of now and the current expiry, which is what makes the
 * billing cycle stable: a seller who pays three days early keeps those three
 * days instead of forfeiting them, and one whose payment you record a week late
 * is not charged for the week you spent recording it. Both of those are the same
 * bug — resetting the clock to `now` on every payment — and it silently shortens
 * every cycle a seller ever buys.
 */
if ( ! function_exists( 'kandi_seller_extend_fee' ) ) :
function kandi_seller_extend_fee( $seller_id ) {
	$current = kandi_seller_fee_paid_until( $seller_id );
	$from    = max( time(), $current );
	$until   = strtotime( kandi_seller_fee_period(), $from );

	update_user_meta( $seller_id, '_kandi_fee_paid_until', $until );
	// Cleared rather than set: 'paid' is now derived, and leaving a stale
	// literal here would outrank the date it is supposed to describe.
	delete_user_meta( $seller_id, '_kandi_fee_status' );

	return $until;
}
endif;

/**
 * Every seller who is not currently paid up.
 *
 * Cached for a minute because the storefront asks this on every product query.
 * A minute is short enough that a seller who pays sees their shop return almost
 * at once, and long enough that a burst of catalogue requests does not re-read
 * every seller's meta from the database.
 */
if ( ! function_exists( 'kandi_seller_lapsed_ids' ) ) :
function kandi_seller_lapsed_ids() {
	$cached = get_transient( 'kandi_lapsed_sellers' );
	if ( is_array( $cached ) ) {
		return $cached;
	}

	$lapsed = array();

	foreach ( get_users( array( 'role' => 'kandi_seller', 'fields' => 'ID' ) ) as $seller_id ) {
		if ( 'unpaid' === kandi_seller_fee_state( $seller_id ) ) {
			$lapsed[] = (int) $seller_id;
		}
	}

	set_transient( 'kandi_lapsed_sellers', $lapsed, MINUTE_IN_SECONDS );

	return $lapsed;
}
endif;

/** Drops the cache above, so a payment takes effect without waiting it out. */
if ( ! function_exists( 'kandi_seller_flush_lapsed_cache' ) ) :
function kandi_seller_flush_lapsed_cache() {
	delete_transient( 'kandi_lapsed_sellers' );
}
endif;

/**
 * Hides the products of sellers who are not paid up.
 *
 * The chosen consequence of lapsing: listings stop being shown to shoppers,
 * while the account, the products, the images and the order history all stay
 * exactly as they were. Nothing is deleted and nothing is unrecoverable — the
 * moment the fee is credited the same products reappear, unedited. That is the
 * only version of enforcement worth having, because the alternative asks a
 * seller to rebuild a catalogue over a late payment.
 *
 * Applied at the query layer rather than by flipping each product to `draft`,
 * and the distinction matters more than it looks. Editing post status would
 * mean writing to every one of a seller's products on lapse and again on
 * payment, which is slow, destroys any genuine draft/published distinction the
 * seller had set up, and leaves the catalogue in a state that has to be
 * correctly reversed. Filtering leaves the data untouched and is exactly as
 * reversible as the condition that caused it.
 *
 * Products with no `_kandi_seller_id` are the shop's own stock and are never
 * touched by this.
 */
if ( ! function_exists( 'kandi_seller_hide_lapsed_products' ) ) :
function kandi_seller_hide_lapsed_products( $query ) {
	// Never in wp-admin: the shop must still be able to see and manage the
	// listings of a seller who has lapsed, which is precisely when somebody
	// needs to look at them.
	if ( is_admin() ) {
		return;
	}

	$lapsed = kandi_seller_lapsed_ids();
	if ( empty( $lapsed ) ) {
		return;
	}

	$meta_query = (array) $query->get( 'meta_query' );

	$meta_query[] = array(
		'relation' => 'OR',
		// The shop's own products carry no seller meta at all.
		array(
			'key'     => '_kandi_seller_id',
			'compare' => 'NOT EXISTS',
		),
		array(
			'key'     => '_kandi_seller_id',
			'value'   => $lapsed,
			'compare' => 'NOT IN',
		),
	);

	$query->set( 'meta_query', $meta_query );
}
endif;
add_action( 'woocommerce_product_query', 'kandi_seller_hide_lapsed_products' );

if ( ! function_exists( 'kandi_seller_commission_rate' ) ) :
function kandi_seller_commission_rate( $seller_id ) {
	$rate = get_user_meta( $seller_id, '_kandi_commission_rate', true );
	return '' === $rate ? kandi_default_commission_rate() : (float) $rate;
}
endif;

/**
 * The ways this marketplace can actually send a seller money.
 *
 * One list, filterable, served to the payout dialog AND enforced by the endpoint
 * that accepts a request. The Seller Centre used to carry the only copy, as a
 * constant in its settings screen, so the browser could offer a method the shop
 * had no way to pay through and nothing would notice until a human read the
 * payout row. The list still has to be mirrored in app/seller/settings — keep
 * the two in step, and this is the one that decides.
 */
/**
 * ---- A store's own short link ----
 *
 * Sellers market these by hand: a slug goes on a flyer, into a WhatsApp status,
 * onto the side of a boda. So it has to be short enough to say out loud, it has
 * to be theirs to choose, and — the part that matters most — it must not change
 * underneath them once it is printed.
 *
 * That last point is why renaming a store no longer rewrites the slug. It used
 * to: `store_slug` was re-derived from `store_name` on every settings save, so
 * a seller correcting a typo in their shop name silently broke every link they
 * had ever shared. The slug is now set at registration and only ever changes
 * when somebody deliberately edits it.
 *
 * Refuses, in order:
 *   • anything under three characters, which is not a name, it is a collision
 *     waiting to happen;
 *   • the storefront's own top-level routes — a store called "cart" or "search"
 *     would be unreachable at kandiug.com/cart because the shop's own page owns
 *     that address, and the seller would have no way to know why;
 *   • a slug another store already holds.
 *
 * The reserved list is duplicated in the storefront's own route guard. Both
 * have to agree, and this is the one that decides — the other only exists so a
 * bad address 404s cleanly instead of rendering an empty shop.
 */
if ( ! function_exists( 'kandi_reserved_store_slugs' ) ) :
function kandi_reserved_store_slugs() {
	return array(
		'about', 'account', 'admin', 'api', 'careers', 'cart', 'categories',
		'category', 'checkout', 'contact', 'help', 'order-received', 'payment',
		'privacy', 'products', 'reset-password', 'returns', 'sale', 'search',
		'sell', 'seller', 'seller-policies', 'sellers', 'shipping', 'terms',
		'track-order', 'wp-admin', 'wp-json', 'wp-content', 'assets', 'static',
		'_next', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'icon.png',
		'brand-icon', 'opengraph-image',
	);
}
endif;

/**
 * Validates a proposed store slug. Returns the clean slug, or a WP_Error saying
 * which rule it broke — the seller is choosing a public address and deserves to
 * be told why one was refused rather than have it silently changed.
 */
if ( ! function_exists( 'kandi_check_store_slug' ) ) :
function kandi_check_store_slug( $raw, $seller_id ) {
	$slug = sanitize_title( (string) $raw );

	if ( strlen( $slug ) < 3 ) {
		return new WP_Error(
			'kandi_slug_short',
			'Your store link needs at least three characters.',
			array( 'status' => 400 )
		);
	}

	if ( strlen( $slug ) > 40 ) {
		return new WP_Error(
			'kandi_slug_long',
			'That store link is too long. Use 40 characters or fewer.',
			array( 'status' => 400 )
		);
	}

	if ( in_array( $slug, kandi_reserved_store_slugs(), true ) ) {
		return new WP_Error(
			'kandi_slug_reserved',
			sprintf( '"%s" is part of the shop itself, so it cannot be a store link. Try something else.', $slug ),
			array( 'status' => 409 )
		);
	}

	// Taken by another store. `get_users` rather than a slug index because there
	// is no index to keep — a marketplace of this size has tens of sellers, not
	// tens of thousands, and a correct answer beats a fast wrong one.
	$holders = get_users( array(
		'meta_key'   => '_kandi_store_slug',
		'meta_value' => $slug,
		'fields'     => 'ID',
		'number'     => 2,
	) );

	foreach ( $holders as $holder ) {
		if ( (int) $holder !== (int) $seller_id ) {
			return new WP_Error(
				'kandi_slug_taken',
				'Another store already uses that link. Try adding your town or a word to it.',
				array( 'status' => 409 )
			);
		}
	}

	return $slug;
}
endif;

/**
 * The colour behind a store's name on its own page.
 *
 * Stored as a hex, defaulted to the near-black every store started with. It is
 * the one piece of the shop a seller can paint, and it is deliberately the only
 * one: a marketplace where every store page is a different design is a
 * marketplace that stops looking like one shop, and the products themselves —
 * the part that actually sells — stay on white either way.
 *
 * Six-digit hex only. Three-digit shorthand and named colours are both valid
 * CSS and both awkward to reason about when the storefront has to work out
 * whether to set white or black type over the top.
 */
if ( ! function_exists( 'kandi_store_colour' ) ) :
function kandi_store_colour( $seller_id ) {
	$stored = (string) get_user_meta( (int) $seller_id, '_kandi_store_color', true );
	return preg_match( '/^#[0-9a-f]{6}$/i', $stored ) ? strtolower( $stored ) : '#1c1a18';
}
endif;

if ( ! function_exists( 'kandi_seller_payout_methods' ) ) :
function kandi_seller_payout_methods() {
	return (array) apply_filters(
		'kandi_seller_payout_methods',
		array( 'MTN Mobile Money', 'Airtel Money', 'Bank transfer' )
	);
}
endif;

/**
 * The smallest payout the shop will send, never above what the seller has.
 *
 * A floor exists because each transfer costs the marketplace a fee, and forty
 * 500-shilling withdrawals cost more to send than they are worth. It is capped
 * at the balance for the opposite reason: a seller whose whole earnings are
 * below the floor must still be able to take them out, or the rule quietly
 * becomes "we keep small balances", which is not a rule anyone agreed to.
 */
if ( ! function_exists( 'kandi_seller_payout_floor' ) ) :
function kandi_seller_payout_floor( $payable ) {
	$minimum = (float) apply_filters(
		'kandi_seller_minimum_payout',
		(float) get_option( 'kandi_seller_minimum_payout', 10000 )
	);

	return min( max( 0, $minimum ), max( 0, (float) $payable ) );
}
endif;

/* -------------------------------------------------------------------------
 * 3. Authentication — shared secret + bearer token
 * ---------------------------------------------------------------------- */

if ( ! function_exists( 'kandi_seller_secret' ) ) :
function kandi_seller_secret() {
	// kandi-store-api.php owns the resolution order (wp-config constant, then
	// the settings screen, then the legacy fallback). Only installs without
	// that plugin fall through to the two sources below.
	if ( function_exists( 'kandi_shared_secret' ) ) {
		return kandi_shared_secret();
	}
	if ( defined( 'KANDI_API_SECRET' ) && KANDI_API_SECRET ) {
		return (string) KANDI_API_SECRET;
	}
	return (string) get_option( 'kandi_api_secret', '' );
}
endif;

/** True when the caller presented the storefront's shared secret. */
if ( ! function_exists( 'kandi_seller_check_secret' ) ) :
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
endif;

if ( ! function_exists( 'kandi_seller_token_key' ) ) :
function kandi_seller_token_key( $token ) {
	return 'kandi_seller_tok_' . hash( 'sha256', $token );
}
endif;

if ( ! function_exists( 'kandi_seller_issue_token' ) ) :
function kandi_seller_issue_token( $user_id ) {
	$token = bin2hex( random_bytes( 32 ) );
	set_transient(
		kandi_seller_token_key( $token ),
		// Same generation stamp the shopper tokens carry, read from the same
		// user meta — one password protects both sides of this account, so one
		// password change has to end the sessions on both. The helpers live in
		// kandi-store-api.php; without that plugin a seller session behaves
		// exactly as it did before.
		function_exists( 'kandi_token_generation' )
			? array( 'uid' => (int) $user_id, 'gen' => kandi_token_generation( $user_id ) )
			: (int) $user_id,
		KANDI_SELLER_TOKEN_TTL
	);
	return $token;
}
endif;

if ( ! function_exists( 'kandi_seller_bearer_token' ) ) :
function kandi_seller_bearer_token( WP_REST_Request $request ) {
	$header = (string) $request->get_header( 'authorization' );
	if ( 0 === stripos( $header, 'bearer ' ) ) {
		return trim( substr( $header, 7 ) );
	}
	return '';
}
endif;

/** Resolves the seller behind the bearer token, or 0. */
if ( ! function_exists( 'kandi_seller_current_id' ) ) :
function kandi_seller_current_id( WP_REST_Request $request ) {
	$token = kandi_seller_bearer_token( $request );
	if ( '' === $token ) {
		return 0;
	}

	$key    = kandi_seller_token_key( $token );
	$stored = get_transient( $key );

	$user_id = function_exists( 'kandi_user_from_token_record' )
		? kandi_user_from_token_record( $stored, $key )
		: (int) $stored;

	return kandi_is_seller( $user_id ) ? $user_id : 0;
}
endif;

/** Permission callback for public seller endpoints (register, login). */
if ( ! function_exists( 'kandi_seller_public_permission' ) ) :
function kandi_seller_public_permission( WP_REST_Request $request ) {
	return kandi_seller_check_secret( $request );
}
endif;

/** Permission callback for everything that acts on a signed-in seller. */
if ( ! function_exists( 'kandi_seller_permission' ) ) :
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
endif;

/* -------------------------------------------------------------------------
 * 4. Date-range parsing shared by stats and commissions
 * ---------------------------------------------------------------------- */

/**
 * Turns "7d" / "30d" / "90d" / "mtd" / "ytd" into a start/end pair plus the
 * equally long preceding window used for the change figures.
 */
if ( ! function_exists( 'kandi_parse_range' ) ) :
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
endif;

if ( ! function_exists( 'kandi_percent_change' ) ) :
function kandi_percent_change( $current, $previous ) {
	if ( $previous <= 0 ) {
		return $current > 0 ? 100.0 : 0.0;
	}
	return round( ( ( $current - $previous ) / $previous ) * 100, 1 );
}
endif;

/* -------------------------------------------------------------------------
 * 5. Commission ledger — written from WooCommerce order status changes
 * ---------------------------------------------------------------------- */

/**
 * Writes one ledger row per order line item that belongs to a seller.
 * Keyed on order_item_id, so re-running on a later status change is a no-op.
 */
if ( ! function_exists( 'kandi_record_order_commissions' ) ) :
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
endif;

/** Moves an order's ledger rows between pending / payable / cancelled. */
if ( ! function_exists( 'kandi_sync_commission_status' ) ) :
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
endif;

add_action(
	'woocommerce_order_status_changed',
	function ( $order_id, $from_status, $to_status ) {
		if ( in_array( $to_status, array( 'processing', 'on-hold', 'completed' ), true ) ) {
			kandi_record_order_commissions( $order_id );
			kandi_notify_sellers_of_order( $order_id );
		}
		kandi_sync_commission_status( $order_id, $to_status );
	},
	10,
	3
);

/* -------------------------------------------------------------------------
 * 5b. Seller notifications
 * ---------------------------------------------------------------------- */

/** The lines on an order that belong to one seller, with that seller's totals. */
if ( ! function_exists( 'kandi_seller_order_lines' ) ) :
function kandi_seller_order_lines( $order, $seller_id ) {
	$lines = array();
	$total = 0.0;

	foreach ( $order->get_items() as $item ) {
		if ( (int) get_post_meta( $item->get_product_id(), '_kandi_seller_id', true ) !== (int) $seller_id ) {
			continue;
		}
		$line_total = (float) $item->get_total();
		$total     += $line_total;
		$lines[]    = array(
			'name'     => $item->get_name(),
			'quantity' => $item->get_quantity(),
			'total'    => wc_price( $line_total, array( 'currency' => $order->get_currency() ) ),
		);
	}

	return array( 'lines' => $lines, 'total' => $total );
}
endif;

/**
 * ---- The email blocks, borrowed when they are available ----
 *
 * Kandi Notifications owns the shop's letterhead and the pieces a message is
 * built from — a paragraph, a row of facts, a tinted panel, a headline figure.
 * This plugin has to work without it: the two are separate downloads, and a
 * verification code that never arrives because a companion plugin is missing
 * would lock every new seller out of their own account.
 *
 * So each of these calls the real block when it is loaded and falls back to
 * plain markup when it is not — the same arrangement `kandi_seller_lines_html`
 * has always used. The fallbacks are ugly and they deliver, which is the
 * correct order of priorities for mail.
 */
if ( ! function_exists( 'kandi_seller_p' ) ) :
function kandi_seller_p( $html, $margin = '0 0 14px' ) {
	if ( function_exists( 'kandi_mail_p' ) ) {
		return kandi_mail_p( $html, $margin );
	}
	return sprintf( '<p style="margin:%s">%s</p>', esc_attr( $margin ), wp_kses_post( $html ) );
}
endif;

if ( ! function_exists( 'kandi_seller_facts' ) ) :
function kandi_seller_facts( $rows ) {
	if ( function_exists( 'kandi_mail_facts' ) ) {
		return kandi_mail_facts( $rows );
	}

	$html = '';
	foreach ( (array) $rows as $label => $value ) {
		if ( '' === trim( wp_strip_all_tags( (string) $value ) ) ) {
			continue;
		}
		$html .= sprintf( '<li>%s: %s</li>', esc_html( $label ), wp_kses_post( $value ) );
	}

	return '' === $html ? '' : '<ul>' . $html . '</ul>';
}
endif;

if ( ! function_exists( 'kandi_seller_panel' ) ) :
function kandi_seller_panel( $html, $tone = 'neutral' ) {
	if ( function_exists( 'kandi_mail_panel' ) ) {
		return kandi_mail_panel( $html, $tone );
	}
	return sprintf( '<p style="margin:0 0 14px">%s</p>', wp_kses_post( $html ) );
}
endif;

if ( ! function_exists( 'kandi_seller_figure' ) ) :
function kandi_seller_figure( $label, $value, $note = '' ) {
	if ( function_exists( 'kandi_mail_figure' ) ) {
		return kandi_mail_figure( $label, $value, $note );
	}
	return sprintf(
		'<p style="margin:0 0 14px">%s: <strong>%s</strong>%s</p>',
		esc_html( $label ),
		wp_kses_post( $value ),
		'' !== $note ? '<br>' . wp_kses_post( $note ) : ''
	);
}
endif;

/** Renders order lines as an HTML table, with or without the Notifications plugin. */
if ( ! function_exists( 'kandi_seller_lines_html' ) ) :
function kandi_seller_lines_html( $lines, $total_label = '', $total = null ) {
	if ( function_exists( 'kandi_mail_items_table' ) ) {
		return kandi_mail_items_table( $lines, $total_label, $total );
	}

	$html = '<ul>';
	foreach ( $lines as $line ) {
		$html .= sprintf( '<li>%s × %d — %s</li>', esc_html( $line['name'] ), (int) $line['quantity'], wp_kses_post( $line['total'] ) );
	}
	$html .= '</ul>';

	return null === $total ? $html : $html . sprintf( '<p><strong>%s %s</strong></p>', esc_html( $total_label ), wp_kses_post( $total ) );
}
endif;

/** The Seller Centre's orders screen, for the link in the alert. */
if ( ! function_exists( 'kandi_seller_centre_url' ) ) :
function kandi_seller_centre_url( $path = '/seller/orders' ) {
	$base = function_exists( 'kandi_storefront_url' ) && kandi_storefront_url()
		? kandi_storefront_url()
		: home_url();
	return $base . $path;
}
endif;

/**
 * Everything a seller needs to physically get the parcel to the buyer.
 *
 * One function, because the same four facts — who, where, which phone, which
 * pin — have to read identically in the Seller Centre, in the "new order" email
 * and in the acceptance email. They did not: the orders table showed a name and
 * a city, the new-order email added the street, and the acceptance email had
 * neither a street nor a phone number. A seller reading the last of those had
 * been told to have the parcel ready for a buyer they could not call.
 *
 * Shipping first, billing as the fallback. The storefront writes both from the
 * one checkout form, so they agree for every order placed through it — but an
 * order raised by hand in wp-admin, or imported, routinely carries only billing,
 * and an empty address block is the one failure mode this must not have.
 *
 * The map link is the pin the shopper dropped at checkout
 * (`_kandi_delivery_lat/lng`, written by Kandi Store API). Half of Kampala has
 * no numbered street, so for a lot of these orders the pin IS the address and
 * the typed line is only a description of it.
 */
if ( ! function_exists( 'kandi_seller_delivery' ) ) :
function kandi_seller_delivery( $order ) {
	$pick = function ( $shipping, $billing ) {
		$shipping = trim( (string) $shipping );
		return '' !== $shipping ? $shipping : trim( (string) $billing );
	};

	$lat = $order->get_meta( '_kandi_delivery_lat' );
	$lng = $order->get_meta( '_kandi_delivery_lng' );

	return array(
		'name'      => $pick(
			trim( $order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name() ),
			trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() )
		),
		// Phone and email live on billing in WooCommerce's schema, and that is
		// where the storefront writes them, so there is nothing to fall back from.
		'phone'     => (string) $order->get_billing_phone(),
		'email'     => (string) $order->get_billing_email(),
		'address_1' => $pick( $order->get_shipping_address_1(), $order->get_billing_address_1() ),
		'address_2' => $pick( $order->get_shipping_address_2(), $order->get_billing_address_2() ),
		'city'      => $pick( $order->get_shipping_city(), $order->get_billing_city() ),
		'note'      => (string) $order->get_customer_note(),
		'map_url'   => ( $lat && $lng )
			? sprintf( 'https://maps.google.com/?q=%F,%F', (float) $lat, (float) $lng )
			: '',
	);
}
endif;

/** The same delivery details, as a block for an email. */
if ( ! function_exists( 'kandi_seller_delivery_html' ) ) :
function kandi_seller_delivery_html( $order ) {
	$to    = kandi_seller_delivery( $order );
	$lines = array();

	if ( $to['name'] ) {
		$lines[] = '<strong>' . esc_html( $to['name'] ) . '</strong>';
	}
	if ( $to['phone'] ) {
		// A tel: link, because this is read on the phone the seller is about to
		// call from — and the digits in plain sight beside it, because it is
		// also read on a laptop where a tel: link does nothing at all.
		$lines[] = sprintf(
			'<a href="tel:%s" style="color:#c05a1c;text-decoration:none">%s</a>',
			esc_attr( preg_replace( '/[^0-9+]/', '', $to['phone'] ) ),
			esc_html( $to['phone'] )
		);
	}
	foreach ( array( $to['address_1'], $to['address_2'], $to['city'] ) as $part ) {
		if ( '' !== trim( (string) $part ) ) {
			$lines[] = esc_html( $part );
		}
	}
	if ( $to['map_url'] ) {
		$lines[] = sprintf(
			'<a href="%s" style="color:#c05a1c">Open the delivery pin in Maps</a>',
			esc_url( $to['map_url'] )
		);
	}

	$html = sprintf(
		'<p style="margin:0 0 4px"><strong>Deliver to</strong></p>
		 <p style="margin:0 0 14px;color:#3f3f46;line-height:1.7">%s</p>',
		$lines ? implode( '<br>', $lines ) : 'No address was recorded on this order.'
	);

	if ( '' !== trim( $to['note'] ) ) {
		$html .= sprintf(
			'<p style="margin:0 0 4px"><strong>The buyer asked</strong></p>
			 <p style="margin:0 0 14px;color:#3f3f46">%s</p>',
			esc_html( $to['note'] )
		);
	}

	return $html;
}
endif;

/**
 * Emails every seller with something in a new order.
 *
 * One email per seller per order, holding only their own lines — a seller must
 * never see what another store sold to the same shopper, or the buyer's full
 * basket. The delivery address is included because they are the one packing it.
 *
 * Stamped on the order so a later status change does not send it twice: an
 * order that moves on-hold → processing → completed passes through this hook
 * three times.
 */
if ( ! function_exists( 'kandi_notify_sellers_of_order' ) ) :
function kandi_notify_sellers_of_order( $order_id ) {
	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return;
	}

	$already = (array) $order->get_meta( '_kandi_seller_alerted' );

	foreach ( $order->get_items() as $item ) {
		$seller_id = (int) get_post_meta( $item->get_product_id(), '_kandi_seller_id', true );

		if ( ! $seller_id || in_array( $seller_id, $already, true ) || ! kandi_is_seller( $seller_id ) ) {
			continue;
		}

		$user = get_userdata( $seller_id );
		if ( ! $user ) {
			continue;
		}

		$part = kandi_seller_order_lines( $order, $seller_id );
		if ( empty( $part['lines'] ) ) {
			continue;
		}

		$rate       = kandi_seller_commission_rate( $seller_id );
		$commission = round( $part['total'] * ( $rate / 100 ), 2 );

		kandi_seller_mail(
			$user->user_email,
			sprintf( 'New order #%s — %d item(s) to pack', $order->get_order_number(), count( $part['lines'] ) ),
			'You have a new order',
			kandi_seller_p( sprintf(
					'Order <strong>#%s</strong> came in for <strong>%s</strong>. Here is your part of it:',
					esc_html( $order->get_order_number() ),
					esc_html( get_user_meta( $seller_id, '_kandi_store_name', true ) )
				) )
				. kandi_seller_lines_html(
					$part['lines'],
					'Your total',
					wc_price( $part['total'], array( 'currency' => $order->get_currency() ) )
				)
				/* What the seller actually takes home, as the figure rather than
				   as the third line of a paragraph. It is the number they are
				   looking for and it was set in body text between two others. */
				. kandi_seller_figure(
					'You receive',
					wc_price( $part['total'] - $commission, array( 'currency' => $order->get_currency() ) ),
					sprintf(
						'After %s%% commission (%s).',
						esc_html( (string) $rate ),
						wp_kses_post( wc_price( $commission, array( 'currency' => $order->get_currency() ) ) )
					)
				)
				. kandi_seller_delivery_html( $order )
				. kandi_seller_panel(
					'Accept it in the Seller Centre so we can tell the buyer it is being packed.',
					'brand'
				),
			/**
			 * The button, filtered.
			 *
			 * Defaults to "Open the order", which is all this plugin can offer
			 * on its own. Kandi Order Dispatch replaces it with a signed
			 * one-click accept link, so the seller can accept from the email
			 * without signing in. A filter rather than the link itself because
			 * this file is already at the size where it cannot be saved through
			 * Code Snippets — see that plugin's header.
			 */
			apply_filters(
				'kandi_seller_order_cta',
				array( 'label' => 'Open the order', 'url' => kandi_seller_centre_url() ),
				$order,
				$seller_id
			)
		);

		/**
		 * Everything else that wants to tell this seller about this order.
		 *
		 * Fired inside the same once-per-seller-per-order guard as the email
		 * above, so anything hooked here inherits it — an order moving
		 * on-hold → processing → completed passes through this function three
		 * times and must not send three SMS. `$part` is handed over so a
		 * listener does not have to re-walk the order to find out what belongs
		 * to whom.
		 */
		do_action( 'kandi_seller_order_notified', $order, $seller_id, $part );

		$already[] = $seller_id;
	}

	$order->update_meta_data( '_kandi_seller_alerted', array_values( array_unique( $already ) ) );
	$order->save();
}
endif;

/* -------------------------------------------------------------------------
 * 6. Product formatting for the Seller Centre
 * ---------------------------------------------------------------------- */

if ( ! function_exists( 'kandi_format_seller_product' ) ) :
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

	// Main image first, then the gallery, at full size: the Seller Centre editor
	// sends this list straight back when photos are added or reordered, and a
	// "medium" URL round-tripped that way would permanently shrink the listing.
	$images = array();
	if ( $image_id ) {
		$images[] = wp_get_attachment_url( $image_id );
	}
	foreach ( $product->get_gallery_image_ids() as $gallery_id ) {
		$gallery_url = wp_get_attachment_url( $gallery_id );
		if ( $gallery_url ) {
			$images[] = $gallery_url;
		}
	}

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
		'images'         => array_values( array_filter( $images ) ),
		'categories'     => $categories,
		'units_sold'     => (int) get_post_meta( $product->get_id(), 'total_sales', true ),
		'created_at'     => $product->get_date_created() ? $product->get_date_created()->date( 'c' ) : null,
	);
}
endif;

/** Applies size/colour lists as custom (non-taxonomy) product attributes. */
if ( ! function_exists( 'kandi_apply_product_attributes' ) ) :
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
endif;

/**
 * Stores a photograph of the product in each of its colours.
 *
 * ---- Why this is product meta and not term meta ----
 *
 * The storefront reads swatch images off attribute TERMS — see the
 * `thumbnail_id` lookup in `kandi_format_product` — which is where a swatch
 * plugin puts them, and which is right for a shop-wide colour taxonomy where
 * "Red" is one term with one picture.
 *
 * That is exactly wrong for this. A seller's colours are CUSTOM attributes,
 * unique to the listing, and the picture is of THIS product in that colour. Two
 * sellers listing a black shoe need two different photographs behind the same
 * word, and term meta gives them one. So the map is stored per product.
 *
 * Keyed by colour NAME, matching the option names `kandi_apply_product_attributes`
 * writes. An index would re-point every picture the moment a colour was removed
 * from the middle of the list.
 *
 * Passing an empty array clears the map, which is what lets a seller take the
 * last photograph off a listing.
 */
if ( ! function_exists( 'kandi_save_color_images' ) ) :
function kandi_save_color_images( $product_id, $map ) {
	$clean = array();

	foreach ( (array) $map as $name => $url ) {
		$name = sanitize_text_field( (string) $name );
		$url  = esc_url_raw( (string) $url );
		if ( '' === $name || '' === $url ) {
			continue;
		}
		// Only ever this site's own media library. A seller cannot make the
		// storefront hotlink an arbitrary remote URL through this field.
		if ( ! attachment_url_to_postid( $url ) ) {
			continue;
		}
		$clean[ $name ] = $url;
	}

	if ( empty( $clean ) ) {
		delete_post_meta( $product_id, '_kandi_color_images' );
		return;
	}

	update_post_meta( $product_id, '_kandi_color_images', $clean );
}
endif;

/**
 * Attaches image URLs to a product. The first becomes the main image, the rest
 * the gallery.
 *
 * A URL that already points at this site's media library — everything the
 * seller uploaded through /seller/media — is resolved to its existing
 * attachment rather than downloaded again, otherwise every save would leave
 * another identical copy behind in wp-content/uploads. Anything genuinely
 * remote is still sideloaded, so pasted URLs keep working.
 *
 * With $replace true and an empty list the product's photos are cleared, which
 * is what lets a seller delete the last picture from the editor.
 */
if ( ! function_exists( 'kandi_attach_product_images' ) ) :
function kandi_attach_product_images( $product_id, $urls, $replace = false ) {
	$urls = array_values( array_filter( array_map( 'esc_url_raw', (array) $urls ) ) );
	if ( empty( $urls ) && ! $replace ) {
		return;
	}

	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	$attachment_ids = array();
	foreach ( array_slice( $urls, 0, 8 ) as $url ) {
		$existing = attachment_url_to_postid( $url );
		if ( $existing ) {
			$attachment_ids[] = (int) $existing;
			continue;
		}

		$attachment_id = media_sideload_image( $url, $product_id, null, 'id' );
		if ( ! is_wp_error( $attachment_id ) ) {
			$attachment_ids[] = (int) $attachment_id;
		}
	}

	if ( empty( $attachment_ids ) ) {
		if ( $replace ) {
			delete_post_thumbnail( $product_id );
			delete_post_meta( $product_id, '_product_image_gallery' );
		}
		return;
	}

	set_post_thumbnail( $product_id, array_shift( $attachment_ids ) );
	if ( ! empty( $attachment_ids ) ) {
		update_post_meta( $product_id, '_product_image_gallery', implode( ',', $attachment_ids ) );
	} elseif ( $replace ) {
		delete_post_meta( $product_id, '_product_image_gallery' );
	}
}
endif;

/**
 * Stores a verification document against a seller and returns its URL and id.
 *
 * Separate from the product-photo upload for two reasons: it accepts PDFs as
 * well as images, since a trading licence is usually a scan, and it renames the
 * file to random hex before it lands. `national-id.jpg` in a public uploads
 * folder is one guess away from being read by anyone; a 32-character random
 * name is not guessable, which is the most a stock WordPress install can offer
 * without a server-level deny rule on the directory.
 */
if ( ! function_exists( 'kandi_seller_store_document' ) ) :
function kandi_seller_store_document( $file, $seller_id, $kind ) {
	if ( ! isset( $file['tmp_name'] ) || '' === $file['tmp_name'] ) {
		return new WP_Error( 'kandi_no_file', 'No document was received.', array( 'status' => 400 ) );
	}

	if ( isset( $file['size'] ) && (int) $file['size'] > KANDI_SELLER_MAX_UPLOAD ) {
		return new WP_Error( 'kandi_file_too_big', 'That file is larger than 8 MB.', array( 'status' => 413 ) );
	}

	$check = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'] ?? '' );
	$type  = $check['type'] ? $check['type'] : '';
	$allowed = array_merge( kandi_seller_image_mimes(), array( 'application/pdf' ) );

	if ( ! in_array( $type, $allowed, true ) ) {
		return new WP_Error(
			'kandi_bad_file_type',
			'Documents must be a photo (JPEG, PNG, WebP, AVIF) or a PDF.',
			array( 'status' => 415 )
		);
	}

	$extension   = strtolower( pathinfo( $file['name'] ?? '', PATHINFO_EXTENSION ) );
	$extension   = preg_replace( '/[^a-z0-9]/', '', $extension ) ?: 'jpg';
	$file['name'] = sprintf( 'kandi-%s-%s.%s', $kind, bin2hex( random_bytes( 16 ) ), $extension );

	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	$moved = wp_handle_upload( $file, array( 'test_form' => false ) );
	if ( ! is_array( $moved ) || isset( $moved['error'] ) ) {
		return new WP_Error(
			'kandi_upload_failed',
			is_array( $moved ) ? $moved['error'] : 'The document could not be saved.',
			array( 'status' => 500 )
		);
	}

	$attachment_id = wp_insert_attachment(
		array(
			'post_mime_type' => $moved['type'],
			'post_title'     => sprintf( 'Seller %d %s document', (int) $seller_id, $kind ),
			'post_status'    => 'private',
		),
		$moved['file']
	);

	if ( is_wp_error( $attachment_id ) || ! $attachment_id ) {
		return new WP_Error( 'kandi_upload_failed', 'The document could not be saved.', array( 'status' => 500 ) );
	}

	wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $moved['file'] ) );
	update_post_meta( $attachment_id, '_kandi_seller_id', (int) $seller_id );
	// Marks it as identity paperwork rather than shop media, so a future clean-up
	// job can find these without guessing from filenames.
	update_post_meta( $attachment_id, '_kandi_document', $kind );

	return array( 'id' => (int) $attachment_id, 'url' => wp_get_attachment_url( $attachment_id ) );
}
endif;

/* -------------------------------------------------------------------------
 * 7. REST API — kandi/v1/seller/*
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', function () {

	/* ---- GET /seller/health ----
	 *
	 * What is actually running on this server.
	 *
	 * Exists because the hardest bug on this project was not in any of the
	 * logic below — it was not knowing whether the logic below was the code
	 * answering the request. This states the build, the file it loaded from,
	 * and whether a second copy tried to load, so that question is settled in
	 * one request instead of by inference.
	 *
	 * Secret-gated, not public: the file path is server detail and nobody
	 * outside the storefront needs it.
	 */
	register_rest_route( 'kandi/v1', '/seller/health', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_seller_public_permission',
		'callback'            => function () {
			$duplicates = isset( $GLOBALS['kandi_seller_duplicate_loads'] )
				? (array) $GLOBALS['kandi_seller_duplicate_loads']
				: array();

			return rest_ensure_response( array(
				'version'     => KANDI_SELLER_API_VERSION,
				'loaded_from' => KANDI_SELLER_LOADED_FROM,
				// More than zero means this file is installed twice — as a
				// plugin and as a snippet, most likely. The storefront turns
				// this into a warning on the Seller Centre.
				'duplicates'  => array_values( $duplicates ),
				// Proof of which auth contract is live: false here means a
				// build old enough to still refuse sign-in to an account whose
				// email is unconfirmed.
				'signin_requires_verified_email' => false,
				'seller_count' => count( get_users( array( 'role' => KANDI_SELLER_ROLE, 'fields' => 'ID' ) ) ),
			) );
		},
	) );

	/* ---- POST /seller/register ---- */
	register_rest_route( 'kandi/v1', '/seller/register', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_public_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$body  = (array) $request->get_json_params();
			$email = sanitize_email( $body['email'] ?? '' );

			// Sign-up is the cheapest thing on the site to automate and the most
			// expensive to clean up: every attempt creates a user, a store name
			// and an email. Ten a quarter-hour from one address is generous for
			// a human and useless for a script.
			$limited = kandi_seller_rate_limit( 'register', kandi_seller_client_ip(), 10, 15 * MINUTE_IN_SECONDS );
			if ( is_wp_error( $limited ) ) {
				return $limited;
			}

			if ( ! is_email( $email ) ) {
				return new WP_Error( 'kandi_bad_email', 'Enter a valid email address.', array( 'status' => 400 ) );
			}
			if ( email_exists( $email ) ) {
				return new WP_Error( 'kandi_email_taken', 'An account already uses that email address. Try signing in instead.', array( 'status' => 409 ) );
			}

			// A Google sign-up arrives with the account id Google issued, which
			// the storefront obtained by verifying the ID token against Google's
			// own keys before calling this. Reaching here at all means the
			// storefront's shared secret checked out, so the id is trustworthy.
			$google_id = sanitize_text_field( $body['google_id'] ?? '' );

			$password = (string) ( $body['password'] ?? '' );
			if ( '' !== $google_id ) {
				// No password is set on a Google account. WordPress requires
				// one, so it gets a random string nobody ever learns — the
				// account is reachable only through Google until the seller
				// asks for a password reset.
				$password = wp_generate_password( 32, true, true );
			} elseif ( function_exists( 'kandi_password_problem' ) ) {
				$weak = kandi_password_problem( $password, $email );
				if ( $weak ) {
					return new WP_Error( 'kandi_weak_password', $weak, array( 'status' => 400 ) );
				}
			} elseif ( strlen( $password ) < 8 ) {
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

			/**
			 * ---- No commission rate is written here, and that is the fix ----
			 *
			 * This line used to copy the shop's default onto the seller:
			 *
			 *     update_user_meta( $user_id, '_kandi_commission_rate', kandi_default_commission_rate() );
			 *
			 * which quietly turned a default into a permanent per-seller
			 * override at the moment of sign-up. Every seller was therefore
			 * pinned to whatever the rate happened to be on the day they
			 * joined, and changing "Default commission rate" in wp-admin
			 * afterwards changed nothing for anybody — the setting appeared to
			 * do nothing at all, because for every existing seller it did.
			 *
			 * Leaving the meta absent means `kandi_seller_commission_rate()`
			 * falls through to the shop default, so a new seller follows the
			 * shop and an override exists only where somebody deliberately set
			 * one on the Sellers screen. Existing sellers already carry the
			 * stamped value; the Settings screen has a control to clear those.
			 */

			/**
			 * The monthly fee. Recorded at the amount in force on the day they
			 * applied, so a later price change never moves someone's goalposts
			 * mid-cycle.
			 *
			 * No paid-until date is written: a new seller has bought no cover
			 * yet, and `kandi_seller_fee_state` reads an absent date as 'unpaid'
			 * without needing to be told. A zero fee is still stored as 'waived'
			 * explicitly, because that is the one state a date cannot express.
			 */
			$fee = kandi_seller_registration_fee();
			update_user_meta( $user_id, '_kandi_fee_amount', $fee );
			if ( $fee <= 0 ) {
				update_user_meta( $user_id, '_kandi_fee_status', 'waived' );
			}

			/**
			 * A Google sign-up is confirmed on arrival: the ID token the
			 * storefront verified against Google's keys is proof of the address,
			 * and there is nothing an emailed code would establish that Google
			 * has not already established better.
			 *
			 * A password sign-up is sent a code and marked unconfirmed — but is
			 * still signed in below. The code confirms the address at the
			 * seller's convenience; it no longer decides whether the account
			 * they just created is reachable at all.
			 */
			if ( '' !== $google_id ) {
				update_user_meta( $user_id, '_kandi_google_id', $google_id );
				update_user_meta( $user_id, '_kandi_email_verified', '1' );
			} else {
				update_user_meta( $user_id, '_kandi_email_verified', '0' );
				kandi_seller_send_code( $user_id );
			}

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

			/**
			 * Signed in immediately, whichever way they signed up.
			 *
			 * Registration used to return the seller and no token, leaving the
			 * new account stranded behind a code screen until an email arrived —
			 * and when the host could not send mail, that was the end of the
			 * road for every store that ever tried to open here.
			 *
			 * The account is still `pending` review and still has its documents
			 * and joining fee to settle; the storefront's setup gate handles all
			 * of that. None of it requires locking the seller out of the account
			 * they have just made.
			 */
			return kandi_seller_session_response( $user_id );
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

			// Two buckets, because either one alone can be walked around: an
			// attacker with a botnet spreads across IPs to hammer one account,
			// and an attacker with one IP sprays one password across thousands
			// of accounts. Guessing has to be slow from both directions.
			foreach ( array(
				array( 'login_ip', kandi_seller_client_ip(), 30 ),
				array( 'login_email', $email, 8 ),
			) as $bucket ) {
				$limited = kandi_seller_rate_limit( $bucket[0], $bucket[1], $bucket[2], 15 * MINUTE_IN_SECONDS );
				if ( is_wp_error( $limited ) ) {
					return $limited;
				}
			}

			$user = get_user_by( 'email', $email );
			if ( ! $user || ! wp_check_password( $password, $user->user_pass, $user->ID ) ) {
				// One message for both cases on purpose: saying "no such account"
				// turns this endpoint into a way to find out who sells here.
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

			// Right password, unconfirmed address: sign them in and send a fresh
			// code anyway, so confirming is one click away from the banner the
			// dashboard shows. This used to refuse the sign-in outright, which
			// meant an undelivered email locked a seller out of their own store
			// permanently — see kandi_seller_session_response.
			if ( ! kandi_seller_is_verified( $user->ID ) ) {
				kandi_seller_send_code( $user->ID );
			}

			kandi_seller_rate_clear( 'login_email', $email );

			return kandi_seller_session_response( $user->ID );
		},
	) );

	/* ---- POST /seller/verify ----
	 *
	 * Exchanges the emailed six-digit code for a session, so a seller who has
	 * just signed up lands in their dashboard instead of being asked to type
	 * the password they set ninety seconds ago.
	 *
	 * Identified by email rather than by a session, because there is no session
	 * yet — which is exactly why it is rate limited on both the address and the
	 * caller, and why the code itself is only good for five attempts.
	 */
	register_rest_route( 'kandi/v1', '/seller/verify', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_public_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$body  = (array) $request->get_json_params();
			$email = sanitize_email( $body['email'] ?? '' );
			$code  = preg_replace( '/\D/', '', (string) ( $body['code'] ?? '' ) );

			$limited = kandi_seller_rate_limit( 'verify_ip', kandi_seller_client_ip(), 30, 15 * MINUTE_IN_SECONDS );
			if ( is_wp_error( $limited ) ) {
				return $limited;
			}

			$user = get_user_by( 'email', $email );
			if ( ! $user || ! kandi_is_seller( $user->ID ) ) {
				return new WP_Error( 'kandi_bad_code', 'That code is not valid. Please check and try again.', array( 'status' => 400 ) );
			}

			if ( kandi_seller_is_verified( $user->ID ) ) {
				// Already done — hand back a session rather than an error, so a
				// double-submitted form does not look like a failure.
				return kandi_seller_session_response( $user->ID );
			}

			$hash    = (string) get_user_meta( $user->ID, '_kandi_verify_hash', true );
			$expires = (int) get_user_meta( $user->ID, '_kandi_verify_expires', true );
			$tries   = (int) get_user_meta( $user->ID, '_kandi_verify_attempts', true );

			if ( '' === $hash || $expires < time() ) {
				return new WP_Error(
					'kandi_code_expired',
					'That code has expired. Ask for a new one.',
					array( 'status' => 410 )
				);
			}

			// Five guesses per code. A six-digit code is a million combinations,
			// but without a ceiling a script gets to try all of them.
			if ( $tries >= 5 ) {
				delete_user_meta( $user->ID, '_kandi_verify_hash' );
				return new WP_Error(
					'kandi_code_expired',
					'Too many wrong codes. Ask for a new one.',
					array( 'status' => 410 )
				);
			}

			if ( '' === $code || ! wp_check_password( $code, $hash ) ) {
				update_user_meta( $user->ID, '_kandi_verify_attempts', $tries + 1 );
				return new WP_Error( 'kandi_bad_code', 'That code is not valid. Please check and try again.', array( 'status' => 400 ) );
			}

			update_user_meta( $user->ID, '_kandi_email_verified', '1' );
			delete_user_meta( $user->ID, '_kandi_verify_hash' );
			delete_user_meta( $user->ID, '_kandi_verify_expires' );
			delete_user_meta( $user->ID, '_kandi_verify_attempts' );

			return kandi_seller_session_response( $user->ID );
		},
	) );

	/* ---- POST /seller/verify/resend ---- */
	register_rest_route( 'kandi/v1', '/seller/verify/resend', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_public_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$body  = (array) $request->get_json_params();
			$email = sanitize_email( $body['email'] ?? '' );

			// Three a quarter-hour: enough for a code that went to spam, not
			// enough to use this shop as a way to post email at someone.
			$limited = kandi_seller_rate_limit( 'resend', $email ?: kandi_seller_client_ip(), 3, 15 * MINUTE_IN_SECONDS );
			if ( is_wp_error( $limited ) ) {
				return $limited;
			}

			$user = get_user_by( 'email', $email );
			if ( $user && kandi_is_seller( $user->ID ) && ! kandi_seller_is_verified( $user->ID ) ) {
				kandi_seller_send_code( $user->ID );
			}

			// Always the same answer, whether or not that address is a seller:
			// a different reply here would be a way to test which addresses
			// have accounts.
			return rest_ensure_response( array(
				'ok'      => true,
				'message' => 'If that address has an unverified seller account, a new code is on its way.',
			) );
		},
	) );

	/* ---- POST /seller/google ----
	 *
	 * Google sign-in for existing sellers. It never creates an account: stores
	 * are reviewed before they can trade, so "sign in with Google" on an email
	 * nobody has registered has to fail rather than quietly open a store.
	 *
	 * Google has already proved the address by the time this runs — the
	 * storefront verifies the ID token with Google's own keys before calling —
	 * so a seller arriving this way is treated as verified.
	 */
	register_rest_route( 'kandi/v1', '/seller/google', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_public_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$body      = (array) $request->get_json_params();
			$email     = sanitize_email( $body['email'] ?? '' );
			$google_id = sanitize_text_field( $body['google_id'] ?? '' );

			$limited = kandi_seller_rate_limit( 'google', kandi_seller_client_ip(), 30, 15 * MINUTE_IN_SECONDS );
			if ( is_wp_error( $limited ) ) {
				return $limited;
			}

			if ( ! is_email( $email ) || '' === $google_id ) {
				return new WP_Error( 'kandi_bad_request', 'Google did not return a usable account.', array( 'status' => 400 ) );
			}

			$user = get_user_by( 'email', $email );
			if ( ! $user || ! kandi_is_seller( $user->ID ) ) {
				return new WP_Error(
					'kandi_not_seller',
					'No seller account uses that Google address. Open a seller account first.',
					array( 'status' => 404 )
				);
			}

			$status = get_user_meta( $user->ID, '_kandi_status', true );
			if ( 'rejected' === $status ) {
				return new WP_Error( 'kandi_rejected', 'This seller application was not approved. Contact Kandi support.', array( 'status' => 403 ) );
			}
			if ( 'suspended' === $status ) {
				return new WP_Error( 'kandi_suspended', 'This seller account is suspended. Contact Kandi support.', array( 'status' => 403 ) );
			}

			update_user_meta( $user->ID, '_kandi_google_id', $google_id );

			/**
			 * Google has just proved this address — that is what the ID token
			 * the storefront verified *is*. So an account arriving here is
			 * confirmed by any honest reading, and recording that is more
			 * truthful than leaving a '0' on a seller Google has vouched for
			 * and then nagging them to prove it a second time by email.
			 */
			if ( ! kandi_seller_is_verified( $user->ID ) ) {
				update_user_meta( $user->ID, '_kandi_email_verified', '1' );
			}

			return kandi_seller_session_response( $user->ID );
		},
	) );

	/* ---- POST /seller/password/forgot ----
	 *
	 * ---- Why this did not exist, and why that was serious ----
	 *
	 * The Seller Centre had sign-in, sign-up, an emailed verification code and
	 * Google — and no way whatsoever to recover a forgotten password. A seller
	 * who set one at registration and forgot it was locked out permanently:
	 * their listings stayed up, their orders kept arriving, their payouts kept
	 * clearing, and they could not reach any of it. The only route back in was
	 * somebody editing wp_users by hand.
	 *
	 * That is an availability failure rather than a breach, but it is the kind
	 * that ends a seller's relationship with a marketplace, and it pushed people
	 * towards the worst possible workaround: opening a SECOND seller account for
	 * the same shop, which splits their catalogue and their commission ledger in
	 * ways nothing here can merge back.
	 *
	 * ---- The same construction the shopper flow uses ----
	 *
	 * WordPress's own reset key: single use, time limited, and void the moment
	 * the password changes. Nothing bespoke, because a hand-rolled reset token
	 * is the single easiest thing in an auth system to get wrong.
	 */
	register_rest_route( 'kandi/v1', '/seller/password/forgot', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_public_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$body  = (array) $request->get_json_params();
			$email = sanitize_email( $body['email'] ?? '' );

			/* The same answer every time. A different reply for an address with
			   no seller account would turn this into a way to find out which
			   shops trade here and who runs them. */
			$answer = rest_ensure_response( array(
				'ok'      => true,
				'message' => 'If that address has a seller account, a reset link is on its way.',
			) );

			if ( ! is_email( $email ) ) {
				return $answer;
			}

			// Two buckets, for the reason given on the sign-in route: a
			// per-address limit alone never sees an attacker walking a list.
			foreach ( array(
				array( 'seller_forgot_ip', kandi_seller_client_ip(), 15 ),
				array( 'seller_forgot', $email, 3 ),
			) as $bucket ) {
				$limited = kandi_seller_rate_limit( $bucket[0], $bucket[1], $bucket[2], 15 * MINUTE_IN_SECONDS );
				if ( is_wp_error( $limited ) ) {
					return $limited;
				}
			}

			$user = get_user_by( 'email', $email );

			// Sellers only. A shopper asking here is answered exactly as an
			// unknown address is — they have their own reset flow, and telling
			// them apart would leak which accounts sell.
			if ( ! $user || ! kandi_is_seller( $user->ID ) ) {
				return $answer;
			}

			$key = get_password_reset_key( $user );
			if ( is_wp_error( $key ) ) {
				return $answer;
			}

			$link = add_query_arg(
				array(
					'key'   => rawurlencode( $key ),
					'login' => rawurlencode( $user->user_login ),
				),
				kandi_seller_centre_url( '/seller/reset-password' )
			);

			kandi_seller_mail(
				$user->user_email,
				'Reset your Kandi Seller Centre password',
				'Reset your password',
				kandi_seller_p( sprintf(
						'Somebody asked to reset the password for <strong>%s</strong> on the Kandi Seller Centre.',
						esc_html( get_user_meta( $user->ID, '_kandi_store_name', true ) ?: $user->user_email )
					) )
					. kandi_seller_p( 'The button below works once and stops working after a day.' )
					. kandi_seller_panel(
						'If this was not you, nothing has changed and you can ignore this email. '
						. 'Your password is only altered when somebody opens that link and sets a new one.',
						'warn'
					),
				array( 'label' => 'Choose a new password', 'url' => $link )
			);

			return $answer;
		},
	) );

	/* ---- POST /seller/password/reset ---- */
	register_rest_route( 'kandi/v1', '/seller/password/reset', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_public_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$body     = (array) $request->get_json_params();
			$key      = (string) ( $body['key'] ?? '' );
			$login    = (string) ( $body['login'] ?? '' );
			$password = (string) ( $body['password'] ?? '' );

			if ( '' === $key || '' === $login ) {
				return new WP_Error( 'kandi_bad_reset', 'That reset link is not valid. Please request a new one.', array( 'status' => 400 ) );
			}

			// Guarded: the strength check lives in Kandi Store API, and calling a
			// function that is not there is a fatal rather than a warning — on
			// the one endpoint a locked-out seller is depending on.
			if ( function_exists( 'kandi_password_problem' ) ) {
				$weak = kandi_password_problem( $password, $login );
				if ( $weak ) {
					return new WP_Error( 'kandi_weak_password', $weak, array( 'status' => 400 ) );
				}
			} elseif ( strlen( $password ) < 8 ) {
				return new WP_Error( 'kandi_weak_password', 'Use at least 8 characters for your password.', array( 'status' => 400 ) );
			}

			$limited = kandi_seller_rate_limit( 'seller_reset', $login, 10, 15 * MINUTE_IN_SECONDS );
			if ( is_wp_error( $limited ) ) {
				return $limited;
			}

			$user = check_password_reset_key( $key, $login );
			if ( is_wp_error( $user ) || ! kandi_is_seller( $user->ID ) ) {
				return new WP_Error(
					'kandi_bad_reset',
					'That reset link has expired or has already been used. Please request a new one.',
					array( 'status' => 400 )
				);
			}

			/* `reset_password` clears the key so the link cannot be replayed —
			   including one sitting in an inbox somebody else can read later —
			   and fires `after_password_reset`, which is what revokes every
			   session this account already had open. See kandi_revoke_tokens()
			   in kandi-store-api.php: without that, resetting a password on a
			   stolen device would leave the thief signed in. */
			reset_password( $user, $password );

			/**
			 * The address is proven by definition here.
			 *
			 * Whoever opened this link read the seller's email, which is the
			 * same fact the six-digit code establishes — so a seller who never
			 * got round to entering that code is confirmed by having reset their
			 * password, and does not have to go and find it afterwards to be
			 * paid out.
			 */
			update_user_meta( $user->ID, '_kandi_email_verified', '1' );

			return kandi_seller_session_response( $user->ID );
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

	/* ---- GET /seller/session ----
	 *
	 * Who the bearer token belongs to. The storefront's only source of identity.
	 *
	 * This exists because /seller/me was hijacked on a live install. A second,
	 * unauthenticated registration of `kandi/v1/seller/me` — from a snippet
	 * outside this file — was returning one hardcoded seller to every caller.
	 * WordPress does not replace a duplicate route: it merges the registrations
	 * and dispatches the first handler whose methods match, so the rogue copy
	 * answered and this one never ran. Signing in worked perfectly and issued
	 * the right token; the dashboard then asked who it was and was told
	 * somebody else, which is a very hard bug to see from either end alone.
	 *
	 * A distinct route name is the defence. `/seller/me` is left in place below
	 * for older storefront builds, but nothing this repository ships reads
	 * identity from it any more — so a stray registration of that path can no
	 * longer put one seller inside another's account.
	 *
	 * `checked` is proof this handler ran: it is the authenticated one, so a
	 * reply without it did not come from here.
	 */
	register_rest_route( 'kandi/v1', '/seller/session', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_seller_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			return rest_ensure_response( array(
				'seller'  => kandi_format_seller( kandi_seller_current_id( $request ) ),
				'checked' => true,
			) );
		},
	) );

	/* ---- GET /seller/me ----
	 *
	 * Kept for compatibility with storefront builds that predate
	 * /seller/session. New code must not use it — see the note above.
	 */
	register_rest_route( 'kandi/v1', '/seller/me', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_seller_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			return rest_ensure_response( array(
				'seller'  => kandi_format_seller( kandi_seller_current_id( $request ) ),
				'checked' => true,
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

			/**
			 * ---- Renaming the store no longer rewrites its link ----
			 *
			 * This used to re-derive `_kandi_store_slug` from the store name on
			 * every save, which meant a seller correcting a typo in their shop
			 * name silently broke every link they had ever shared — the flyer,
			 * the WhatsApp status, the QR code on the counter. A name is a
			 * label and an address is an address; only one of them is safe to
			 * change on somebody's behalf.
			 *
			 * The slug now changes when, and only when, it is edited.
			 */
			if ( isset( $body['store_slug'] ) ) {
				$slug = kandi_check_store_slug( $body['store_slug'], $seller_id );
				if ( is_wp_error( $slug ) ) {
					return $slug;
				}
				update_user_meta( $seller_id, '_kandi_store_slug', $slug );
			}

			/* A store with no slug at all predates this being a field — give it
			   one derived from the name rather than leaving it unreachable. */
			if ( '' === (string) get_user_meta( $seller_id, '_kandi_store_slug', true ) ) {
				$fallback = kandi_check_store_slug(
					(string) get_user_meta( $seller_id, '_kandi_store_name', true ),
					$seller_id
				);
				if ( ! is_wp_error( $fallback ) ) {
					update_user_meta( $seller_id, '_kandi_store_slug', $fallback );
				}
			}

			if ( isset( $body['store_color'] ) ) {
				$colour = strtolower( trim( (string) $body['store_color'] ) );
				if ( ! preg_match( '/^#[0-9a-f]{6}$/', $colour ) ) {
					return new WP_Error(
						'kandi_bad_colour',
						'Choose a colour from the swatches, or enter one as a six-digit hex like #1c1a18.',
						array( 'status' => 400 )
					);
				}
				update_user_meta( $seller_id, '_kandi_store_color', $colour );
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

				// Colour photographs, keyed by the colour names just written above.
				if ( isset( $body['color_images'] ) ) {
					kandi_save_color_images( $product_id, $body['color_images'] );
				}

				/*
				 * And put the seller's name on the post itself.
				 *
				 * Nothing in the marketplace reads `post_author` any more — the
				 * two places that did are what made store pages look empty —
				 * but WooCommerce and wp-admin do. Left at 0 the listing shows
				 * up in the products table with no owner at all, which is the
				 * one screen a shop owner uses to work out where a product came
				 * from. The meta stays the record of ownership; this keeps
				 * WordPress's own idea of it from being a lie.
				 */
				wp_update_post( array( 'ID' => $product_id, 'post_author' => $seller_id ) );

				// Sellers file into existing departments only — they never create
				// new ones. This used to fall through to wp_insert_term, so a
				// seller typing "Sportswear" or "Mens Shoes" minted a category
				// of its own beside the real one, and the shopper's department
				// tree filled with near-duplicates holding one product each.
				// The storefront now offers sellers the real list, and this is
				// the guard behind it.
				$category = sanitize_text_field( $body['category'] ?? '' );
				if ( '' !== $category ) {
					$term = term_exists( $category, 'product_cat' );
					if ( ! $term ) {
						$term = term_exists( sanitize_title( $category ), 'product_cat' );
					}
					if ( $term && ! is_wp_error( $term ) ) {
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
				// Only when the key is present, so an editor that never touched the
				// colours does not wipe their photographs.
				if ( isset( $body['color_images'] ) ) {
					kandi_save_color_images( $product_id, $body['color_images'] );
				}
				// A seller may unpublish their own listing, but never self-publish one.
				if ( isset( $body['status'] ) && 'draft' === $body['status'] ) {
					$product->set_status( 'draft' );
				}

				$product->save();

				// Photos are replaced wholesale, and only when the key is present:
				// an editor that never touched the gallery sends nothing, so a
				// price change cannot silently wipe a listing's pictures.
				if ( array_key_exists( 'image_urls', $body ) ) {
					kandi_attach_product_images( $product_id, $body['image_urls'] ?? array(), true );
				}

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

	/* ---- POST /seller/media ----
	 *
	 * Takes one photograph off a seller's phone or laptop and puts it in the
	 * media library, returning the URL the product endpoints then attach.
	 *
	 * Uploading is separated from saving the listing on purpose: a seller on a
	 * Ugandan mobile connection can lose a 4 MB photo halfway through, and
	 * retrying one picture is a different thing from retyping the whole form.
	 * The attachment is stamped with the seller's id so wp-admin can see who
	 * put what in the library.
	 */
	register_rest_route( 'kandi/v1', '/seller/media', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$seller_id = kandi_seller_current_id( $request );

			if ( 'approved' !== get_user_meta( $seller_id, '_kandi_status', true ) ) {
				return new WP_Error(
					'kandi_not_approved',
					'Your store is still awaiting approval, so photos cannot be uploaded yet.',
					array( 'status' => 403 )
				);
			}

			$files = $request->get_file_params();
			$file  = isset( $files['file'] ) ? $files['file'] : null;

			if ( ! $file || ! isset( $file['tmp_name'] ) || '' === $file['tmp_name'] ) {
				return new WP_Error( 'kandi_no_file', 'No photo was received.', array( 'status' => 400 ) );
			}

			if ( isset( $file['size'] ) && (int) $file['size'] > KANDI_SELLER_MAX_UPLOAD ) {
				return new WP_Error(
					'kandi_file_too_big',
					sprintf( 'That photo is larger than %d MB. Please use a smaller one.', KANDI_SELLER_MAX_UPLOAD / 1048576 ),
					array( 'status' => 413 )
				);
			}

			// Trust the bytes, not the filename: wp_check_filetype_and_ext reads
			// the file itself, so a script renamed to .jpg is turned away here
			// rather than landing in a publicly served uploads folder.
			$check = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'] ?? '' );
			$type  = $check['type'] ? $check['type'] : '';
			if ( ! in_array( $type, kandi_seller_image_mimes(), true ) ) {
				return new WP_Error(
					'kandi_bad_file_type',
					'Photos must be JPEG, PNG, WebP, AVIF or GIF.',
					array( 'status' => 415 )
				);
			}

			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/image.php';

			$moved = wp_handle_upload(
				$file,
				array(
					// The upload arrives over REST, not from a wp-admin form, so
					// there is no form token for WordPress to look for.
					'test_form' => false,
					'mimes'     => array(
						'jpg|jpeg|jpe' => 'image/jpeg',
						'png'          => 'image/png',
						'gif'          => 'image/gif',
						'webp'         => 'image/webp',
						'avif'         => 'image/avif',
					),
				)
			);

			if ( ! is_array( $moved ) || isset( $moved['error'] ) ) {
				return new WP_Error(
					'kandi_upload_failed',
					is_array( $moved ) ? $moved['error'] : 'The photo could not be saved.',
					array( 'status' => 500 )
				);
			}

			$attachment_id = wp_insert_attachment(
				array(
					'post_mime_type' => $moved['type'],
					'post_title'     => sanitize_text_field( pathinfo( $moved['file'], PATHINFO_FILENAME ) ),
					'post_content'   => '',
					'post_status'    => 'inherit',
				),
				$moved['file']
			);

			if ( is_wp_error( $attachment_id ) || ! $attachment_id ) {
				return new WP_Error( 'kandi_upload_failed', 'The photo could not be saved.', array( 'status' => 500 ) );
			}

			wp_update_attachment_metadata(
				$attachment_id,
				wp_generate_attachment_metadata( $attachment_id, $moved['file'] )
			);
			update_post_meta( $attachment_id, '_kandi_seller_id', $seller_id );

			return rest_ensure_response( array(
				'id'  => (int) $attachment_id,
				'url' => wp_get_attachment_url( $attachment_id ),
			) );
		},
	) );

	/* ---- POST /seller/kyc ----
	 *
	 * Business verification: a photo of the seller's national ID, whether the
	 * business is formally registered, and the registration details if it is.
	 *
	 * Deliberately reachable before approval — unlike every other write endpoint
	 * here — because this is the step that *earns* approval. A seller who cannot
	 * send their documents until they are approved can never be approved.
	 *
	 * ON THE ID PHOTO. WordPress serves everything in wp-content/uploads
	 * directly from the web server, so an attachment is readable by anyone who
	 * knows its URL no matter what post status it carries. The filename is
	 * therefore randomised to 32 hex characters, which makes the URL
	 * unguessable, and the attachment is kept out of the media library listing.
	 * That is obscurity, not access control: to make these genuinely private the
	 * site needs a deny rule on the uploads directory, which is a server
	 * configuration job and is documented in the README.
	 */
	register_rest_route( 'kandi/v1', '/seller/kyc', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$seller_id = kandi_seller_current_id( $request );

			// Sent as multipart, so the fields arrive as body params rather than
			// JSON. Falls back to the JSON body for a caller that sends no file.
			$body       = $request->get_body_params();
			$json       = (array) $request->get_json_params();
			$registered = sanitize_text_field( $body['business_registered'] ?? $json['business_registered'] ?? '' );

			if ( ! in_array( $registered, array( 'yes', 'no' ), true ) ) {
				return new WP_Error(
					'kandi_kyc_incomplete',
					'Tell us whether the business is formally registered.',
					array( 'status' => 400 )
				);
			}

			$business_name   = sanitize_text_field( $body['business_name'] ?? $json['business_name'] ?? '' );
			$business_number = sanitize_text_field( $body['business_number'] ?? $json['business_number'] ?? '' );

			if ( 'yes' === $registered && '' === $business_number ) {
				return new WP_Error(
					'kandi_kyc_incomplete',
					'Enter the certificate or TIN number the business is registered under.',
					array( 'status' => 400 )
				);
			}

			$files    = $request->get_file_params();
			$existing = (string) get_user_meta( $seller_id, '_kandi_id_document', true );
			$file     = isset( $files['id_document'] ) ? $files['id_document'] : null;

			if ( ! $file && '' === $existing ) {
				return new WP_Error(
					'kandi_kyc_no_id',
					'Upload a photo of your national ID.',
					array( 'status' => 400 )
				);
			}

			if ( $file ) {
				$stored = kandi_seller_store_document( $file, $seller_id, 'id' );
				if ( is_wp_error( $stored ) ) {
					return $stored;
				}
				update_user_meta( $seller_id, '_kandi_id_document', $stored['url'] );
				update_user_meta( $seller_id, '_kandi_id_document_id', $stored['id'] );
			}

			if ( isset( $files['business_document'] ) ) {
				$stored = kandi_seller_store_document( $files['business_document'], $seller_id, 'business' );
				if ( is_wp_error( $stored ) ) {
					return $stored;
				}
				update_user_meta( $seller_id, '_kandi_business_document', $stored['url'] );
			}

			update_user_meta( $seller_id, '_kandi_business_registered', $registered );
			update_user_meta( $seller_id, '_kandi_business_name', $business_name );
			update_user_meta( $seller_id, '_kandi_business_number', $business_number );
			update_user_meta( $seller_id, '_kandi_kyc_status', 'submitted' );
			update_user_meta( $seller_id, '_kandi_kyc_submitted_at', current_time( 'mysql' ) );

			wp_mail(
				get_option( 'admin_email' ),
				sprintf( 'Kandi seller documents to check: %s', get_user_meta( $seller_id, '_kandi_store_name', true ) ),
				sprintf(
					"%s has sent their verification documents.\n\nReview them: %s",
					get_user_meta( $seller_id, '_kandi_store_name', true ),
					admin_url( 'admin.php?page=kandi-sellers' )
				)
			);

			return rest_ensure_response( array(
				'ok'     => true,
				'seller' => kandi_format_seller( $seller_id ),
			) );
		},
	) );

	/* ---- GET /seller/stats ---- */
	/* ---- POST /seller/fee-paid ----
	 *
	 * Called by the storefront once Pesapal confirms a month's seller
	 * fee. Gated on the shared secret rather than the seller's own token: the
	 * IPN that fires when a seller closes the tab mid-payment comes from
	 * Pesapal's servers and carries no session, and that is precisely the case
	 * this has to cover.
	 *
	 * Idempotent — the callback and the IPN both arrive for the same payment.
	 */
	register_rest_route( 'kandi/v1', '/seller/fee-paid', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_public_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$body      = (array) $request->get_json_params();
			$seller_id = (int) ( $body['seller_id'] ?? 0 );
			$reference = sanitize_text_field( $body['transaction_id'] ?? '' );
			$method    = sanitize_text_field( $body['payment_method'] ?? 'Pesapal' );

			if ( ! $seller_id || ! kandi_is_seller( $seller_id ) ) {
				return new WP_Error( 'kandi_not_found', 'Seller not found.', array( 'status' => 404 ) );
			}

			/**
			 * Every confirmed payment credits another month.
			 *
			 * The `$already` guard that used to sit here has gone, and its
			 * removal is the point of the change rather than a side effect. It
			 * asked "has this seller ever paid?" and did nothing if so — correct
			 * for a one-off fee, and exactly wrong for a subscription, where the
			 * second payment is the one that keeps the shop open. A seller
			 * paying their second month would have had the money taken and no
			 * cover added.
			 *
			 * Idempotency now comes from the arithmetic instead: cover is
			 * counted from the later of now and the current expiry, so paying
			 * early stacks rather than resets. A genuine duplicate of the same
			 * transaction would add a month twice, which is why the reference is
			 * still recorded — a repeat is visible and refundable, where a
			 * silently swallowed renewal is neither.
			 */
			$until = kandi_seller_extend_fee( $seller_id );
			kandi_seller_flush_lapsed_cache();

			update_user_meta( $seller_id, '_kandi_fee_reference', $reference );
			update_user_meta( $seller_id, '_kandi_fee_method', $method );

			// Paying the fee is what a seller can do for themselves; whether
			// the store then goes live is still the shop's call, so approval
			// is left to the Sellers screen in wp-admin.
			if ( 'pending' === ( get_user_meta( $seller_id, '_kandi_status', true ) ?: 'pending' )
				&& get_option( 'kandi_seller_auto_approve_sellers' ) ) {
				update_user_meta( $seller_id, '_kandi_status', 'approved' );
			}

			return rest_ensure_response( array(
				'ok'         => true,
				// When the month just bought runs out, so the Seller Centre can
				// say so on the confirmation rather than only "paid".
				'paid_until' => gmdate( 'c', $until ),
				'seller'     => kandi_format_seller( $seller_id ),
			) );
		},
	) );

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

				/**
				 * The buyer's contact details, which a seller packing a parcel
				 * cannot work without.
				 *
				 * This screen used to carry a first name and a city and nothing
				 * else, so every seller had to email or phone the marketplace to
				 * ask where an order they had already accepted was going. There
				 * is no privacy argument for withholding it: the seller is the
				 * one delivering, WooCommerce shows it to any shop manager, and
				 * the same details are already in the email this endpoint's
				 * sibling sends them. What IS withheld is anything belonging to
				 * another store — the line items above are filtered to this
				 * seller, so a shared order never leaks a competitor's sale.
				 */
				$to = kandi_seller_delivery( $order );

				$orders[] = array(
					'id'           => $order->get_id(),
					'number'       => $order->get_order_number(),
					'status'       => $order->get_status(),
					// Whether *this* seller has accepted their part, which is
					// what the Accept button in the Seller Centre keys off.
					'accepted'     => in_array( $seller_id, (array) $order->get_meta( '_kandi_accepted_by' ), true ),
					'customer'     => $to['name'],
					'city'         => $to['city'],
					'phone'        => $to['phone'],
					'email'        => $to['email'],
					'address_1'    => $to['address_1'],
					'address_2'    => $to['address_2'],
					'map_url'      => $to['map_url'],
					'note'         => $to['note'],
					'payment'      => $order->get_payment_method_title(),
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

	/* ---- POST /seller/orders/{id}/accept ----
	 *
	 * A seller confirming they have the stock and are packing it.
	 *
	 * Acceptance is recorded per seller, not per order, because one order can
	 * hold three stores' goods and the first to accept cannot speak for the
	 * others. The buyer is told as soon as the *first* seller accepts — from
	 * their side the order is being prepared, and they do not know or care that
	 * it is split — and the order only moves to processing once every seller in
	 * it has accepted.
	 */
	register_rest_route( 'kandi/v1', '/seller/orders/(?P<id>\d+)/accept', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_seller_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			$seller_id = kandi_seller_current_id( $request );
			$order     = wc_get_order( (int) $request['id'] );

			if ( ! $order ) {
				return new WP_Error( 'kandi_not_found', 'Order not found.', array( 'status' => 404 ) );
			}

			$part = kandi_seller_order_lines( $order, $seller_id );
			if ( empty( $part['lines'] ) ) {
				return new WP_Error( 'kandi_not_yours', 'Nothing in that order belongs to your store.', array( 'status' => 403 ) );
			}

			$accepted = (array) $order->get_meta( '_kandi_accepted_by' );
			$first    = empty( $accepted );

			if ( ! in_array( $seller_id, $accepted, true ) ) {
				$accepted[] = $seller_id;
				$order->update_meta_data( '_kandi_accepted_by', array_values( array_unique( $accepted ) ) );
				$order->add_order_note( sprintf(
					'%s accepted their part of this order.',
					get_user_meta( $seller_id, '_kandi_store_name', true )
				) );
				$order->save();

				// The seller's own copy — the confirmation that the shop heard
				// them, and the packing list they work from.
				$user = get_userdata( $seller_id );
				if ( $user ) {
					kandi_seller_mail(
						$user->user_email,
						sprintf( 'You accepted order #%s', $order->get_order_number() ),
						'Order accepted',
						kandi_seller_p( sprintf(
							'You have accepted order <strong>#%s</strong>. The buyer has been told it is being packed.',
							esc_html( $order->get_order_number() )
						) )
						. kandi_seller_lines_html( $part['lines'] )
						. kandi_seller_panel( 'Have it ready for collection today.', 'warn' )
						// The full address and a callable number, not just a
						// city. This email is the packing slip for a seller who
						// accepted from their phone and will not open the Seller
						// Centre again before the rider arrives.
						. kandi_seller_delivery_html( $order ),
						array( 'label' => 'View your orders', 'url' => kandi_seller_centre_url() )
					);
				}
			}

			// Tell the buyer once, on the first acceptance.
			$buyer = $order->get_billing_email();
			if ( $first && is_email( $buyer ) ) {
				kandi_seller_mail(
					$buyer,
					sprintf( 'Order #%s is being packed', $order->get_order_number() ),
					'Good news — your order is confirmed',
					sprintf(
						'<p style="margin:0 0 14px">Hi %s, the seller has confirmed order <strong>#%s</strong> and is packing it now.</p>
						 <p style="margin:0">We will be in touch the moment it is on its way to %s.</p>',
						esc_html( $order->get_billing_first_name() ?: 'there' ),
						esc_html( $order->get_order_number() ),
						esc_html( $order->get_shipping_city() ?: 'you' )
					)
				);
			}

			// Every seller in, so the order itself can move on.
			$sellers_in_order = array();
			foreach ( $order->get_items() as $item ) {
				$owner = (int) get_post_meta( $item->get_product_id(), '_kandi_seller_id', true );
				if ( $owner ) {
					$sellers_in_order[ $owner ] = true;
				}
			}

			/**
			 * ---- Two bugs lived in the four lines this replaced ----
			 *
			 * They read:
			 *
			 *   if ( empty( $outstanding )
			 *        && in_array( $order->get_status(), array( 'pending', 'on-hold' ), true ) ) {
			 *       $order->update_status( 'processing', … );
			 *   }
			 *
			 * The first is the status list. An order paid through Pesapal is
			 * ALREADY `processing` by the time the seller sees it — payment sets
			 * that, not acceptance — so the guard was false for every prepaid
			 * order and accepting one changed nothing whatsoever. The Seller
			 * Centre showed "Accepted" beside "Processing" indefinitely, which is
			 * exactly what it looked like, and the accept button appeared to be
			 * decorative. Only cash-on-delivery orders, which do start at
			 * pending, ever moved.
			 *
			 * The second is the target. Acceptance now completes the order.
			 *
			 * Delegated to Kandi Order Dispatch rather than reimplemented, so the
			 * emailed one-click link and this button cannot drift apart — that
			 * plugin also stamps `_kandi_dispatched_at` and tells the shopper the
			 * order is on its way, and neither should depend on which route the
			 * seller happened to use.
			 *
			 * `kandi_dispatch_accept` is idempotent and re-derives the accepted
			 * list from the order, so calling it after the block above has
			 * already recorded this seller is safe: it finds nothing new to add
			 * and goes straight to the completion check.
			 *
			 * The fallback keeps this endpoint working on an install without the
			 * dispatch plugin — with the status list corrected, but still only
			 * to `processing`, because completing an order without the shopper
			 * being told it has shipped is worse than leaving it where it is.
			 */
			$outstanding = array_diff( array_keys( $sellers_in_order ), $accepted );

			if ( function_exists( 'kandi_dispatch_accept' ) ) {
				kandi_dispatch_accept( $order, $seller_id );
			} elseif ( empty( $outstanding )
				&& in_array( $order->get_status(), array( 'pending', 'on-hold' ), true ) ) {
				$order->update_status( 'processing', 'All sellers accepted their part of the order.' );
			}

			return rest_ensure_response( array(
				'ok'       => true,
				'accepted' => true,
				'status'   => $order->get_status(),
			) );
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

	/* ---- GET /seller/payouts ----
	 *
	 * Everything the payout dialog needs in one call: what is cleared, where
	 * the money would go, the floor, and — the part that was missing entirely —
	 * the requests already made.
	 *
	 * Without that list a seller who asked for a payout on Monday had no way to
	 * tell on Tuesday whether it had been seen, so they asked again, hit the
	 * "you already have a request being processed" error, and wrote to support.
	 * A request in progress has to be visible as a request in progress.
	 *
	 * Registered as its own call rather than folded into the POST below as a
	 * two-endpoint array — the shape used elsewhere in this file. Both are
	 * correct: `register_rest_route` merges a second registration of the same
	 * route into the first unless `$override` is passed, so GET and POST end up
	 * on one route either way. Two calls because the two are 200 lines apart in
	 * behaviour, and nesting them would put the read path inside the diff of
	 * every future change to the write path.
	 */
	register_rest_route( 'kandi/v1', '/seller/payouts', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => 'kandi_seller_permission',
		'callback'            => function ( WP_REST_Request $request ) {
			global $wpdb;

			$seller_id = kandi_seller_current_id( $request );
			$table     = kandi_seller_commissions_table();

			$buckets = $wpdb->get_row( $wpdb->prepare(
				"SELECT COALESCE(SUM(CASE WHEN status = 'payable' THEN net ELSE 0 END),0) AS payable,
				        COALESCE(SUM(CASE WHEN status = 'pending' THEN net ELSE 0 END),0) AS pending
				   FROM {$table}
				  WHERE seller_id = %d",
				$seller_id
			) );

			$rows = $wpdb->get_results( $wpdb->prepare(
				"SELECT id, amount, method, account, status, note, requested_at, paid_at
				   FROM " . kandi_seller_payouts_table() . "
				  WHERE seller_id = %d
				  ORDER BY requested_at DESC
				  LIMIT 50",
				$seller_id
			) );

			$payouts = array();
			$open    = false;

			foreach ( $rows as $row ) {
				if ( 'requested' === $row->status ) {
					$open = true;
				}
				$payouts[] = array(
					'id'           => (int) $row->id,
					'amount'       => (float) $row->amount,
					'method'       => (string) $row->method,
					'account'      => (string) $row->account,
					'status'       => (string) $row->status,
					'note'         => (string) $row->note,
					'requested_at' => $row->requested_at ? mysql2date( 'c', $row->requested_at ) : null,
					'paid_at'      => $row->paid_at ? mysql2date( 'c', $row->paid_at ) : null,
				);
			}

			$payable = (float) $buckets->payable;

			return rest_ensure_response( array(
				'currency' => get_woocommerce_currency(),
				'payable'  => round( $payable, 2 ),
				'pending'  => round( (float) $buckets->pending, 2 ),
				// The floor never exceeds what the seller actually has: a shop
				// with a 10,000 minimum must not trap somebody's 4,000 forever.
				'minimum'  => round( kandi_seller_payout_floor( $payable ), 2 ),
				'method'   => (string) get_user_meta( $seller_id, '_kandi_payout_method', true ),
				'account'  => (string) get_user_meta( $seller_id, '_kandi_payout_account', true ),
				'methods'  => kandi_seller_payout_methods(),
				'open'     => $open,
				'payouts'  => $payouts,
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

			/**
			 * The one place a confirmed address is genuinely required.
			 *
			 * Signing in, listing and packing orders no longer wait on the
			 * emailed code — but money leaving the marketplace does. This is the
			 * moment the shop has to be certain it can reach the person it is
			 * paying, and the point at which asking them to prove the address
			 * costs them nothing they have not already earned.
			 */
			if ( ! kandi_seller_is_verified( $seller_id ) ) {
				kandi_seller_send_code( $seller_id );
				return new WP_Error(
					'kandi_unverified',
					'Confirm your email address before requesting a payout. We have sent you a six-digit code.',
					array( 'status' => 403 )
				);
			}

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

			/**
			 * Where the money goes.
			 *
			 * From the request when the seller chose in the dialog, from the
			 * account on file otherwise — then written back, so the choice made
			 * at the moment of being paid becomes the default next time instead
			 * of being forgotten between two screens.
			 *
			 * Refusing an empty account is not pedantry. A payout row with no
			 * number on it reaches finance as "pay this person somehow", and the
			 * only way to resolve it is to ring the seller, which is exactly the
			 * conversation this field exists to prevent.
			 */
			$method  = sanitize_text_field( (string) $request->get_param( 'method' ) );
			$account = sanitize_text_field( (string) $request->get_param( 'account' ) );

			if ( '' === $method ) {
				$method = (string) get_user_meta( $seller_id, '_kandi_payout_method', true );
			}
			if ( '' === $account ) {
				$account = (string) get_user_meta( $seller_id, '_kandi_payout_account', true );
			}

			if ( '' !== $method && ! in_array( $method, kandi_seller_payout_methods(), true ) ) {
				return new WP_Error(
					'kandi_bad_method',
					'Choose one of the payout methods we support.',
					array( 'status' => 400 )
				);
			}

			if ( '' === $method || '' === $account ) {
				return new WP_Error(
					'kandi_no_payout_account',
					'Tell us the number to send the money to before requesting a payout — Settings, then Payout details.',
					array( 'status' => 400 )
				);
			}

			update_user_meta( $seller_id, '_kandi_payout_method', $method );
			update_user_meta( $seller_id, '_kandi_payout_account', $account );

			/**
			 * How much.
			 *
			 * A missing or zero amount means "all of it", which is what the old
			 * button did and what most requests will be. Anything else is
			 * checked against the ceiling HERE rather than trusted from the
			 * dialog — the browser's copy of the balance is a photograph of a
			 * number that moves every time an order completes.
			 */
			$requested = (float) $request->get_param( 'amount' );
			if ( $requested <= 0 ) {
				$requested = $payable;
			}

			if ( $requested > $payable + 0.01 ) {
				return new WP_Error(
					'kandi_payout_too_large',
					sprintf( 'You can withdraw up to %s right now.', wp_strip_all_tags( wc_price( $payable ) ) ),
					array( 'status' => 400 )
				);
			}

			$floor = kandi_seller_payout_floor( $payable );
			if ( $requested < $floor - 0.01 ) {
				return new WP_Error(
					'kandi_payout_too_small',
					sprintf( 'The smallest payout we can send is %s.', wp_strip_all_tags( wc_price( $floor ) ) ),
					array( 'status' => 400 )
				);
			}

			/**
			 * ---- Payouts settle whole orders ----
			 *
			 * The ledger is one row per order line, each either payable or paid;
			 * there is no way to mark three fifths of a row settled. So a partial
			 * request is filled from the oldest cleared orders up to the amount
			 * asked for, and the payout records the exact rows it covers.
			 *
			 * Recording them is the point. Before this, settling a payout in
			 * wp-admin closed EVERY cleared row for that seller regardless of
			 * what the payout said — harmless while the only possible request
			 * was "all of it", and silently wrong the moment a seller could ask
			 * for less: a 50,000 withdrawal against a 300,000 balance would have
			 * wiped the other 250,000 off the books. See kandi_admin_payouts_page().
			 */
			$rows     = $wpdb->get_results( $wpdb->prepare(
				"SELECT id, net FROM {$table} WHERE seller_id = %d AND status = 'payable' ORDER BY created_at ASC, id ASC",
				$seller_id
			) );
			$covered  = array();
			$settling = 0.0;

			foreach ( $rows as $row ) {
				if ( $settling + (float) $row->net > $requested + 0.01 ) {
					continue;
				}
				$covered[] = (int) $row->id;
				$settling += (float) $row->net;
			}

			if ( empty( $covered ) ) {
				return new WP_Error(
					'kandi_payout_too_small',
					sprintf(
						'Payouts are sent one whole order at a time, and your smallest cleared order comes to more than %s. Ask for a little more.',
						wp_strip_all_tags( wc_price( $requested ) )
					),
					array( 'status' => 400 )
				);
			}

			$wpdb->insert(
				kandi_seller_payouts_table(),
				array(
					'seller_id'    => $seller_id,
					'amount'       => $settling,
					'method'       => $method,
					'account'      => $account,
					'status'       => 'requested',
					'entry_ids'    => wp_json_encode( $covered ),
					'requested_at' => current_time( 'mysql' ),
				),
				array( '%d', '%f', '%s', '%s', '%s', '%s', '%s' )
			);
			$payout_id = (int) $wpdb->insert_id;

			$store  = (string) get_user_meta( $seller_id, '_kandi_store_name', true );
			$user   = get_userdata( $seller_id );
			$amount = wc_price( $settling );
			$left   = wc_price( max( 0, $payable - $settling ) );

			/**
			 * The shop's own copy.
			 *
			 * Branded through the same mailer as everything else rather than a
			 * bare `wp_mail` string, because this is the message that makes
			 * somebody move money: it should arrive carrying the amount, the
			 * destination and the screen where it is actioned, not a sentence
			 * that has to be decoded first.
			 */
			kandi_seller_mail(
				get_option( 'admin_email' ),
				sprintf( 'Payout requested: %s — %s', $store, wp_strip_all_tags( $amount ) ),
				'A seller has asked to be paid',
				kandi_seller_figure(
					sprintf( '%s is owed', $store ),
					$amount,
					sprintf( 'Covering %d cleared order(s).', count( $covered ) )
				)
				. kandi_seller_facts( array(
					'Send to'            => $account,
					'Method'             => $method,
					'Seller email'       => $user ? $user->user_email : '',
					'Seller phone'       => (string) get_user_meta( $seller_id, '_kandi_phone', true ),
					'Balance left after' => $left,
				) )
				. kandi_seller_panel(
					'The seller has been told it is being processed and to expect the money within 24 hours.',
					'warn'
				),
				array(
					'label' => 'Review and pay',
					'url'   => admin_url( 'admin.php?page=kandi-seller-payouts' ),
				)
			);

			// The seller's receipt. Money leaving the platform should always be
			// something they were told about in writing, at the address on the
			// account — that record is what settles a dispute later.
			if ( $user ) {
				kandi_seller_mail(
					$user->user_email,
					sprintf( 'Payout requested: %s', wp_strip_all_tags( $amount ) ),
					'We are processing your payout',
					kandi_seller_figure(
						'On its way to you',
						$amount,
						sprintf( 'From %s.', esc_html( $store ) )
					)
					. kandi_seller_facts( array(
						'Sending to'      => $account,
						'Method'          => $method,
						'Balance left'    => $left,
					) )
					. kandi_seller_panel(
						'Every request is settled <strong>within 24 hours</strong>, and mobile money usually lands the same day. We will write again the moment it goes out.',
						'good'
					)
					. kandi_seller_p(
						'<span style="color:#8a8178;font-size:13px">Did not request this? Reply to this email straight away and change your password.</span>',
						'0'
					),
					array( 'label' => 'View your earnings', 'url' => kandi_seller_centre_url( '/seller/commissions' ) )
				);
			}

			return rest_ensure_response( array(
				'ok'      => true,
				'message' => sprintf(
					'Payout of %s requested. We are processing it, and the money reaches %s within 24 hours.',
					wp_strip_all_tags( $amount ),
					$account
				),
				'payout'  => array(
					'id'           => $payout_id,
					'amount'       => round( $settling, 2 ),
					'method'       => $method,
					'account'      => $account,
					'status'       => 'requested',
					'note'         => '',
					'requested_at' => mysql2date( 'c', current_time( 'mysql' ) ),
					'paid_at'      => null,
				),
				// What was asked for against what whole cleared orders could
				// actually fill, so the screen can say so plainly rather than
				// quietly sending a different number.
				'requested_amount' => round( $requested, 2 ),
				'payable_left'     => round( max( 0, $payable - $settling ), 2 ),
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
			'id'          => $seller_id,
			'store_name'  => (string) get_user_meta( $seller_id, '_kandi_store_name', true ),
			'store_slug'  => (string) get_user_meta( $seller_id, '_kandi_store_slug', true ),
			'logo'        => (string) get_user_meta( $seller_id, '_kandi_logo', true ),
			// The colour the seller picked for their own header. The product
			// page draws the "Sold by" chip in it, so a shopper meets the store
			// looking the way it will look when they arrive on it.
			'store_color' => kandi_store_colour( $seller_id ),
		);
	}
	return $data;
}, 10, 2 );

/**
 * One-time repair: give every existing marketplace listing its seller as author.
 *
 * Listings created before the write above went in are sitting on `post_author`
 * 0, so wp-admin shows them with no owner. Nothing on the storefront depends on
 * this — the store pages and counts read `_kandi_seller_id` now — which is why
 * it is a tidy-up rather than a migration the site has to be taken down for.
 *
 * Runs once and marks itself done in an option. Scoped to posts that carry the
 * seller meta, so on a shop whose own stock outnumbers its sellers' this touches
 * only the handful of rows it has to.
 */
add_action( 'admin_init', function () {
	if ( 'done' === get_option( 'kandi_seller_author_sync' ) ) {
		return;
	}

	$listings = get_posts( array(
		'post_type'      => 'product',
		'post_status'    => 'any',
		'meta_key'       => '_kandi_seller_id', // phpcs:ignore WordPress.DB.SlowDBQuery
		'fields'         => 'ids',
		'posts_per_page' => -1,
	) );

	foreach ( $listings as $listing_id ) {
		$owner = (int) get_post_meta( $listing_id, '_kandi_seller_id', true );
		if ( $owner && (int) get_post_field( 'post_author', $listing_id ) !== $owner ) {
			wp_update_post( array( 'ID' => $listing_id, 'post_author' => $owner ) );
		}
	}

	update_option( 'kandi_seller_author_sync', 'done', false );
} );

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
if ( ! function_exists( 'kandi_admin_guard' ) ) :
function kandi_admin_guard( $nonce_action ) {
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		wp_die( 'You do not have permission to manage Kandi sellers.' );
	}
	check_admin_referer( $nonce_action );
}
endif;

/* ---- Sellers ---- */

if ( ! function_exists( 'kandi_admin_sellers_page' ) ) :
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

			// Approving a store is the act of accepting its paperwork — there is
			// no separate "documents are fine" decision to make, and leaving KYC
			// at 'submitted' on a live store would keep nagging the seller for
			// documents they have already sent.
			if ( 'approve' === $action || 'reinstate' === $action ) {
				update_user_meta( $seller_id, '_kandi_kyc_status', 'approved' );
			} elseif ( 'reject' === $action ) {
				update_user_meta( $seller_id, '_kandi_kyc_status', 'rejected' );
			}

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

		/**
		 * Delete a seller outright.
		 *
		 * Suspending is the right tool almost always: it stops the store trading
		 * while keeping the account, its history and its paperwork. This is for
		 * the cases where the account should never have existed — a test store,
		 * a duplicate, a spam sign-up — and leaving it in place is itself the
		 * problem.
		 *
		 * What it does, in order:
		 *   1. refuses anything that is not actually a Kandi seller, so a
		 *      tampered form cannot delete an administrator;
		 *   2. bins their listings, so no product is left on the storefront
		 *      pointing at a store that no longer exists;
		 *   3. deletes their identity documents, because a national ID has no
		 *      business outliving the account it was collected for;
		 *   4. deletes the user.
		 *
		 * Commission rows are deliberately left alone. They are the record of
		 * money that moved, and an accounting trail that deletes itself when
		 * somebody tidies up a user list is not an accounting trail. A deleted
		 * seller's rows simply show a blank store name.
		 *
		 * Their sessions die on their own: `kandi_seller_current_id()` checks
		 * the role on every request, and a deleted user has none.
		 */
		if ( 'delete' === $action ) {
			if ( ! kandi_is_seller( $seller_id ) ) {
				echo '<div class="notice notice-error is-dismissible"><p>That account is not a Kandi seller, so it was not deleted.</p></div>';
			} elseif ( get_current_user_id() === $seller_id ) {
				echo '<div class="notice notice-error is-dismissible"><p>You cannot delete the account you are signed in with.</p></div>';
			} else {
				$store_name = get_user_meta( $seller_id, '_kandi_store_name', true );

				// Listings first: a published product whose seller is gone shows
				// up on the shop with no store behind it.
				$owned = wc_get_products( array(
					'limit'      => -1,
					'status'     => array( 'publish', 'pending', 'draft' ),
					'return'     => 'ids',
					'meta_key'   => '_kandi_seller_id',
					'meta_value' => $seller_id,
				) );
				foreach ( $owned as $owned_id ) {
					wp_trash_post( $owned_id );
				}

				// Identity paperwork. Force-deleted rather than trashed — the
				// point is that it stops existing.
				$documents = get_posts( array(
					'post_type'      => 'attachment',
					'post_status'    => 'any',
					'posts_per_page' => -1,
					'fields'         => 'ids',
					'meta_key'       => '_kandi_document',
					'meta_query'     => array(
						array( 'key' => '_kandi_seller_id', 'value' => $seller_id ),
					),
				) );
				foreach ( $documents as $document_id ) {
					wp_delete_attachment( $document_id, true );
				}

				require_once ABSPATH . 'wp-admin/includes/user.php';
				wp_delete_user( $seller_id );

				printf(
					'<div class="notice notice-success is-dismissible"><p>Deleted <strong>%s</strong> — %d listing(s) moved to trash. Commission history was kept.</p></div>',
					esc_html( $store_name ?: 'that seller' ),
					count( $owned )
				);
			}
		}

		if ( 'set_rate' === $action ) {
			$submitted = isset( $_POST['commission_rate'] ) ? trim( (string) wp_unslash( $_POST['commission_rate'] ) ) : '';

			if ( '' === $submitted ) {
				// Back onto the shop default, and it stays there when the
				// default moves — which is the whole point of the distinction.
				delete_user_meta( $seller_id, '_kandi_commission_rate' );
				kandi_seller_flush_lapsed_cache();
				echo '<div class="notice notice-success is-dismissible"><p>That store now follows the shop default.</p></div>';
			} else {
				update_user_meta( $seller_id, '_kandi_commission_rate', max( 0, min( 100, (float) $submitted ) ) );
				echo '<div class="notice notice-success is-dismissible"><p>Commission rate updated for that store.</p></div>';
			}
		}

		/**
		 * The monthly fee, marked by hand once the mobile money payment lands —
		 * there is no gateway wired into onboarding, so the money arrives out of
		 * band and a human confirms it.
		 *
		 * "Mark paid" now CREDITS A MONTH rather than setting a flag, and it can
		 * be used again every month for as long as the seller keeps paying.
		 * Because `kandi_seller_extend_fee` counts from the later of now and the
		 * existing expiry, pressing it twice in one cycle buys two months rather
		 * than throwing the first away — which also means it is the button to
		 * press when catching up on a payment recorded late.
		 *
		 * "Mark unpaid" ends cover immediately by clearing the date. It is a
		 * correction tool for a payment entered in error, not a punishment: no
		 * product is deleted, and crediting a month puts everything back.
		 */
		if ( 'fee_paid' === $action || 'fee_unpaid' === $action ) {
			if ( 'fee_paid' === $action ) {
				kandi_seller_extend_fee( $seller_id );
			} else {
				delete_user_meta( $seller_id, '_kandi_fee_paid_until' );
				delete_user_meta( $seller_id, '_kandi_fee_status' );
			}

			// The storefront caches who has lapsed for a minute; a decision made
			// here should show up on the shop now, not when that expires.
			kandi_seller_flush_lapsed_cache();

			if ( 'fee_paid' === $action ) {
				$user = get_userdata( $seller_id );
				if ( $user ) {
					wp_mail(
						$user->user_email,
						'Kandi: we have received your registration fee',
						sprintf(
							"Thanks — your registration fee has been received.\n\n%s is now with our team for approval, and we will email you the moment it is live.\n\nSign in: %s",
							get_user_meta( $seller_id, '_kandi_store_name', true ),
							home_url( '/seller/login' )
						)
					);
				}
			}

			echo '<div class="notice notice-success is-dismissible"><p>Registration fee updated.</p></div>';
		}
	}

	$sellers = get_users( array( 'role' => KANDI_SELLER_ROLE, 'orderby' => 'registered', 'order' => 'DESC' ) );
	$table   = kandi_seller_commissions_table();

	echo '<div class="wrap"><h1>Kandi Sellers</h1>';
	echo '<p>Approve applications, set commission rates and monitor each store.</p>';
	echo '<table class="wp-list-table widefat striped"><thead><tr>
			<th>Store</th><th>Contact</th><th>Status</th><th>Verification</th><th>Reg. fee</th><th>Commission</th>
			<th>Products</th><th>Gross sales</th><th>Owed to Kandi</th><th>Actions</th>
		  </tr></thead><tbody>';

	if ( empty( $sellers ) ) {
		echo '<tr><td colspan="10">No sellers have registered yet.</td></tr>';
	}

	foreach ( $sellers as $seller ) {
		$status = get_user_meta( $seller->ID, '_kandi_status', true ) ?: 'pending';
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

		// Verification: the documents, and what the seller said about the
		// business. The ID link opens the file itself — treat these as
		// confidential and do not paste them anywhere.
		$kyc        = get_user_meta( $seller->ID, '_kandi_kyc_status', true ) ?: 'missing';
		$id_doc     = (string) get_user_meta( $seller->ID, '_kandi_id_document', true );
		$biz_doc    = (string) get_user_meta( $seller->ID, '_kandi_business_document', true );
		$registered = (string) get_user_meta( $seller->ID, '_kandi_business_registered', true );

		echo '<td>';
		printf(
			'<span class="kandi-status kandi-status-%s">%s</span>',
			'submitted' === $kyc ? 'pending' : ( 'approved' === $kyc ? 'approved' : 'rejected' ),
			esc_html( 'missing' === $kyc ? 'no documents' : $kyc )
		);
		if ( $id_doc ) {
			printf(
				'<br><a href="%s" target="_blank" rel="noopener noreferrer">National ID</a>',
				esc_url( $id_doc )
			);
		}
		if ( $biz_doc ) {
			printf(
				'<br><a href="%s" target="_blank" rel="noopener noreferrer">Business document</a>',
				esc_url( $biz_doc )
			);
		}
		if ( $registered ) {
			printf(
				'<br><span class="description">Registered: %s%s</span>',
				esc_html( $registered ),
				'yes' === $registered && get_user_meta( $seller->ID, '_kandi_business_number', true )
					? ' · ' . esc_html( get_user_meta( $seller->ID, '_kandi_business_number', true ) )
					: ''
			);
		}
		echo '</td>';

		/**
		 * The monthly fee column, with the reference the seller quotes.
		 *
		 * Status is read through `kandi_seller_fee_state` rather than straight
		 * off the meta, so this screen shows the same derived answer the
		 * storefront enforces on. Reading the raw meta here would let wp-admin
		 * report a seller "paid" whose cover expired last week.
		 *
		 * The expiry date is printed next to it because it is the number this
		 * screen exists to act on: "paid" alone does not tell you whether a
		 * seller is about to drop off the shop tomorrow.
		 */
		$fee_status = kandi_seller_fee_state( $seller->ID );
		$fee_amount = (float) get_user_meta( $seller->ID, '_kandi_fee_amount', true );
		$paid_until = kandi_seller_fee_paid_until( $seller->ID );
		echo '<td>';
		if ( 'waived' === $fee_status ) {
			echo '<span class="description">Waived</span>';
		} else {
			printf(
				'<span class="kandi-status kandi-status-%s">%s</span><br><code>%s</code><br><span class="description">%s / month</span>',
				'paid' === $fee_status ? 'approved' : 'pending',
				'paid' === $fee_status ? 'paid' : 'unpaid',
				esc_html( kandi_seller_fee_reference( $seller->ID ) ),
				wp_kses_post( wc_price( $fee_amount ) )
			);

			if ( $paid_until > 0 ) {
				printf(
					'<br><span class="description">%s %s</span>',
					'paid' === $fee_status ? 'Until' : 'Lapsed',
					esc_html( date_i18n( get_option( 'date_format' ), $paid_until ) )
				);
			}

			// Spelled out, because the consequence is invisible from this screen
			// and is the whole reason the column matters now.
			if ( 'unpaid' === $fee_status ) {
				echo '<br><span class="description" style="color:#b32d2e">Products hidden from the shop</span>';
			}

			echo '<form method="post" style="margin-top:4px">';
			wp_nonce_field( 'kandi_seller_action' );
			printf( '<input type="hidden" name="seller_id" value="%d">', (int) $seller->ID );
			// "Add a month" is always available, including to a seller already
			// paid up — that is how a renewal is recorded, and the month stacks
			// onto the end of the current one rather than replacing it.
			printf( '<input type="hidden" name="kandi_seller_action" value="fee_paid">' );
			printf( '<button class="button button-small">%s</button>', 'Add a month' );
			echo '</form>';

			if ( 'paid' === $fee_status ) {
				echo '<form method="post" style="margin-top:4px">';
				wp_nonce_field( 'kandi_seller_action' );
				printf( '<input type="hidden" name="seller_id" value="%d">', (int) $seller->ID );
				echo '<input type="hidden" name="kandi_seller_action" value="fee_unpaid">';
				echo '<button class="button button-small button-link-delete">End cover</button>';
				echo '</form>';
			}
		}
		echo '</td>';

		// Inline commission-rate editor.
		//
		// Empty means "follow the shop default", which is a different state from
		// "happens to equal the default today" and now looks different: the box
		// is blank with the default as its placeholder, and clearing it removes
		// the override rather than writing the same number back as one.
		$override = get_user_meta( $seller->ID, '_kandi_commission_rate', true );

		echo '<td><form method="post" style="display:flex;gap:4px;align-items:center">';
		wp_nonce_field( 'kandi_seller_action' );
		printf( '<input type="hidden" name="seller_id" value="%d">', (int) $seller->ID );
		echo '<input type="hidden" name="kandi_seller_action" value="set_rate">';
		printf(
			'<input type="number" step="0.5" min="0" max="100" name="commission_rate" value="%s" placeholder="%s" style="width:70px">',
			esc_attr( '' === $override ? '' : $override ),
			esc_attr( kandi_default_commission_rate() )
		);
		echo '<button class="button button-small">%</button></form>';
		printf(
			'<span class="description">%s</span></td>',
			'' === $override
				? sprintf( 'Shop default (%s%%)', esc_html( kandi_default_commission_rate() ) )
				: 'Set for this store'
		);

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

		// Delete sits apart from the rest and asks first. It is the only action
		// on this screen that cannot be undone, and it is one stray click away
		// from Suspend, which does the same job reversibly.
		echo '<form method="post" style="display:inline-block;margin:0 4px 4px 0">';
		wp_nonce_field( 'kandi_seller_action' );
		printf( '<input type="hidden" name="seller_id" value="%d">', (int) $seller->ID );
		echo '<input type="hidden" name="kandi_seller_action" value="delete">';
		printf(
			'<button class="button button-small" style="color:#a51f1f" onclick="return confirm(%s)">Delete</button>',
			esc_attr( wp_json_encode(
				sprintf(
					"Permanently delete %s?\n\nTheir listings go to trash and their ID documents are destroyed. Commission history is kept.\n\nThis cannot be undone. To stop the store trading without deleting it, use Suspend instead.",
					get_user_meta( $seller->ID, '_kandi_store_name', true ) ?: $seller->user_email
				)
			) )
		);
		echo '</form>';

		echo '</td></tr>';
	}

	echo '</tbody></table>';
	kandi_admin_status_styles();
	echo '</div>';
}
endif;

if ( ! function_exists( 'kandi_seller_actions_for_status' ) ) :
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
endif;

/* ---- Product approvals ---- */

if ( ! function_exists( 'kandi_admin_products_page' ) ) :
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
endif;

/* ---- Commissions ---- */

if ( ! function_exists( 'kandi_admin_commissions_page' ) ) :
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
endif;

/* ---- Payouts ---- */

if ( ! function_exists( 'kandi_admin_payouts_page' ) ) :
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
			/**
			 * Settling closes exactly the ledger rows this payout was raised
			 * against — no more.
			 *
			 * This used to close every cleared row for the seller, which was
			 * indistinguishable from correct while "request a payout" meant "all
			 * of it" and could only ever be wrong afterwards: a seller who asked
			 * for 50,000 of a 300,000 balance would have had the other 250,000
			 * marked paid and vanish from their statement.
			 *
			 * `entry_ids` is written at request time. Older rows predate the
			 * column and have none, and for those the whole-balance sweep is
			 * still the right reading — they could only have been full requests.
			 */
			$entry_ids = array_filter( array_map( 'intval', (array) json_decode( (string) $payout->entry_ids, true ) ) );

			if ( $entry_ids ) {
				$placeholders = implode( ',', array_fill( 0, count( $entry_ids ), '%d' ) );
				$wpdb->query( $wpdb->prepare(
					"UPDATE {$commissions_table} SET status = 'paid', paid_at = %s
					  WHERE seller_id = %d AND status = 'payable' AND id IN ({$placeholders})",
					array_merge( array( current_time( 'mysql' ), (int) $payout->seller_id ), $entry_ids )
				) );
			} else {
				$wpdb->query( $wpdb->prepare(
					"UPDATE {$commissions_table} SET status = 'paid', paid_at = %s WHERE seller_id = %d AND status = 'payable'",
					current_time( 'mysql' ),
					(int) $payout->seller_id
				) );
			}
			$wpdb->update(
				$payouts_table,
				array( 'status' => 'paid', 'paid_at' => current_time( 'mysql' ) ),
				array( 'id' => $payout_id ),
				array( '%s', '%s' ),
				array( '%d' )
			);

			// The seller was promised an email when the money went out.
			$seller = get_userdata( (int) $payout->seller_id );
			if ( $seller ) {
				kandi_seller_mail(
					$seller->user_email,
					sprintf( 'Payout sent: %s', wp_strip_all_tags( wc_price( (float) $payout->amount ) ) ),
					'Your payout is on its way',
					kandi_seller_figure(
						'Sent',
						wc_price( (float) $payout->amount ),
						sprintf( 'To %s.', esc_html( $payout->account ?: 'the account on file' ) )
					)
					. kandi_seller_panel(
						'Mobile money usually lands within minutes; a bank transfer can take a working day.',
						'good'
					)
					. kandi_seller_p( 'Your earnings statement in the Seller Centre now shows this period as settled.', '0' ),
					array( 'label' => 'View your earnings', 'url' => kandi_seller_centre_url( '/seller/commissions' ) )
				);
			}

			/**
			 * So the phone in the seller's pocket knows too.
			 *
			 * Kandi Notifications listens on this and asks the storefront to
			 * push "Payout sent". An action rather than a direct call because
			 * this plugin must not require that one to be installed — and
			 * because the next thing that wants to know (an SMS, a webhook) can
			 * hook the same event rather than being wedged in here.
			 */
			do_action( 'kandi_seller_payout_paid', (int) $payout->seller_id, $payout );

			echo '<div class="notice notice-success is-dismissible"><p>Payout marked as paid. The seller has been emailed.</p></div>';
		} elseif ( $payout && 'cancel' === $action ) {
			$wpdb->update( $payouts_table, array( 'status' => 'cancelled' ), array( 'id' => $payout_id ), array( '%s' ), array( '%d' ) );
			echo '<div class="notice notice-warning is-dismissible"><p>Payout request cancelled.</p></div>';
		}
	}

	$payouts = $wpdb->get_results( "SELECT * FROM {$payouts_table} ORDER BY requested_at DESC LIMIT 200" );

	echo '<div class="wrap"><h1>Seller payouts</h1>';
	echo '<p>Marking a payout as paid closes all cleared commission entries for that seller.</p>';
	echo '<table class="wp-list-table widefat fixed striped"><thead><tr>
			<th>Seller</th><th>Amount</th><th>Orders</th><th>Method</th><th>Account</th><th>Requested</th><th>Status</th><th>Actions</th>
		  </tr></thead><tbody>';

	if ( empty( $payouts ) ) {
		echo '<tr><td colspan="8">No payout requests yet.</td></tr>';
	}

	foreach ( $payouts as $payout ) {
		echo '<tr>';
		printf( '<td><strong>%s</strong></td>', esc_html( get_user_meta( (int) $payout->seller_id, '_kandi_store_name', true ) ) );
		echo '<td>' . wp_kses_post( wc_price( (float) $payout->amount ) ) . '</td>';
		$covers = array_filter( array_map( 'intval', (array) json_decode( (string) $payout->entry_ids, true ) ) );
		printf( '<td>%s</td>', $covers ? count( $covers ) : '—' );
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
endif;

/* ---- Settings ---- */

if ( ! function_exists( 'kandi_admin_settings_page' ) ) :
function kandi_admin_settings_page() {
	if ( isset( $_POST['kandi_settings_submit'] ) ) {
		kandi_admin_guard( 'kandi_seller_settings' );

		update_option( 'kandi_default_commission_rate', max( 0, min( 100, (float) $_POST['default_rate'] ) ) );

		/**
		 * The escape hatch for every seller stamped by the old sign-up.
		 *
		 * Changing the default cannot move a seller who carries an override, and
		 * until the fix above every seller carried one — so a shop that set 6%
		 * here watched all of its sellers stay on 12% with nothing on screen
		 * explaining why. This clears the overrides, which is a deliberate,
		 * ticked, one-off act rather than something a save quietly does: a shop
		 * that has negotiated a rate with one store must not lose it by editing
		 * an unrelated field.
		 */
		if ( ! empty( $_POST['apply_rate_to_all'] ) ) {
			$cleared = 0;
			foreach ( get_users( array( 'role' => KANDI_SELLER_ROLE, 'fields' => 'ID' ) ) as $existing_id ) {
				if ( '' !== get_user_meta( $existing_id, '_kandi_commission_rate', true ) ) {
					delete_user_meta( $existing_id, '_kandi_commission_rate' );
					$cleared++;
				}
			}
			printf(
				'<div class="notice notice-success is-dismissible"><p>%d seller(s) now follow the shop default.</p></div>',
				(int) $cleared
			);
		}
		update_option( 'kandi_seller_auto_approve_products', isset( $_POST['auto_approve'] ) ? 1 : 0 );
		update_option( 'kandi_seller_minimum_payout', max( 0, (float) ( $_POST['minimum_payout'] ?? 0 ) ) );

		if ( ! defined( 'KANDI_API_SECRET' ) && isset( $_POST['api_secret'] ) ) {
			update_option( 'kandi_api_secret', sanitize_text_field( wp_unslash( $_POST['api_secret'] ) ) );
		}

		echo '<div class="notice notice-success is-dismissible"><p>Settings saved.</p></div>';
	}

	$rate         = kandi_default_commission_rate();
	$auto_approve = (int) get_option( 'kandi_seller_auto_approve_products', 0 );
	$minimum      = (float) get_option( 'kandi_seller_minimum_payout', 10000 );

	echo '<div class="wrap"><h1>Kandi Seller settings</h1><form method="post">';
	wp_nonce_field( 'kandi_seller_settings' );
	echo '<table class="form-table"><tbody>';

	printf(
		'<tr><th scope="row"><label for="default_rate">Default commission rate</label></th>
		 <td><input type="number" step="0.5" min="0" max="100" id="default_rate" name="default_rate" value="%s" class="small-text"> %%
		 <p class="description">Every seller uses this unless a rate has been set for their store individually
		 on the Sellers screen. Past orders keep the rate they were charged at.</p>
		 <p style="margin-top:8px"><label><input type="checkbox" name="apply_rate_to_all" value="1">
		 <strong>Also move every existing seller onto this rate</strong></label></p>
		 <p class="description">Clears any per-store rates, including the ones older sign-ups were given
		 automatically. Tick this if you changed the rate above and nothing seemed to happen.</p></td></tr>',
		esc_attr( $rate )
	);

	printf(
		'<tr><th scope="row">New listings</th>
		 <td><label><input type="checkbox" name="auto_approve" value="1" %s> Publish seller products immediately (skip approval)</label></td></tr>',
		checked( 1, $auto_approve, false )
	);

	printf(
		'<tr><th scope="row"><label for="minimum_payout">Smallest payout</label></th>
		 <td><input type="number" step="500" min="0" id="minimum_payout" name="minimum_payout" value="%s" class="small-text">
		 <p class="description">A seller cannot request less than this. It never blocks a seller whose whole
		 balance is below it — they can always withdraw the lot. Set to 0 to allow any amount.</p></td></tr>',
		esc_attr( $minimum )
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
endif;

if ( ! function_exists( 'kandi_admin_status_styles' ) ) :
function kandi_admin_status_styles() {
	echo '<style>
		.kandi-status{display:inline-block;padding:2px 8px;border-radius:3px;font-size:12px;font-weight:600;text-transform:capitalize}
		.kandi-status-approved,.kandi-status-paid{background:#e7f7ea;color:#0a7a2f}
		.kandi-status-pending,.kandi-status-requested{background:#fff6dd;color:#8a6100}
		.kandi-status-suspended,.kandi-status-rejected,.kandi-status-cancelled{background:#fdeaea;color:#a51f1f}
	</style>';
}
endif;

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

/* -------------------------------------------------------------------------
 * Public store directory
 *
 * Powers the storefront's "Shop by store" page. Approved sellers only, and
 * only the fields a shopper should see — no email, phone, commission rate or
 * payout details.
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', function () {
	register_rest_route( 'kandi/v1', '/stores', array(
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => '__return_true',
		'callback'            => function () {
			$sellers = get_users( array(
				'role'       => KANDI_SELLER_ROLE,
				'meta_key'   => '_kandi_status',
				'meta_value' => 'approved',
				'orderby'    => 'registered',
				'order'      => 'ASC',
			) );

			$stores = array();
			foreach ( $sellers as $seller ) {
				/*
				 * Counted by `_kandi_seller_id`, not by post author.
				 *
				 * Same bug as the storefront's `?seller=` filter: a listing
				 * saved through Seller Centre has no author, because Seller
				 * Centre authenticates with a bearer token and nothing is
				 * logged in when WooCommerce writes the post. Counting authors
				 * gave every marketplace store "0 products" on its own page
				 * while its owner was looking at the listing in their
				 * dashboard — the two were reading different records of the
				 * same fact. This is the record the rest of the plugin uses.
				 */
				$product_ids = get_posts( array(
					'post_type'      => 'product',
					'post_status'    => 'publish',
					'meta_key'       => '_kandi_seller_id', // phpcs:ignore WordPress.DB.SlowDBQuery
					'meta_value'     => $seller->ID, // phpcs:ignore WordPress.DB.SlowDBQuery
					'fields'         => 'ids',
					'posts_per_page' => -1,
				) );

				$store_name = (string) get_user_meta( $seller->ID, '_kandi_store_name', true );
				if ( '' === $store_name ) {
					continue;
				}

				$stores[] = array(
					'id'            => (int) $seller->ID,
					'store_name'    => $store_name,
					'store_slug'    => (string) get_user_meta( $seller->ID, '_kandi_store_slug', true ),
					'store_color'   => kandi_store_colour( $seller->ID ),
					'logo'          => (string) get_user_meta( $seller->ID, '_kandi_logo', true ),
					'product_count' => count( $product_ids ),
					'since'         => mysql2date( 'c', $seller->user_registered ),
				);
			}

			return rest_ensure_response( array( 'stores' => $stores ) );
		},
	) );
} );
