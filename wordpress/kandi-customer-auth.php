<?php
/**
 * Plugin Name: Kandi Customer Auth
 * Description: Email-and-password sign in for shoppers — register, log in, forgot password and reset. Sits alongside Google sign-in rather than replacing it.
 * Version: 1.0.0
 * Author: Kandi UG
 *
 * REQUIRES Kandi Store API, which owns the shopper session: this file uses its
 * `kandi_customer_issue_token()`, `kandi_format_customer()` and
 * `kandi_customer_check_secret()`. Kept as a separate file so adding a second
 * way to sign in never means editing the plugin that already carries the
 * catalogue and the orders.
 *
 * WHY THIS EXISTS
 *  Google sign-in only serves shoppers who have a Google account and are
 *  willing to use it here. Many are not: a lot of people in this market sign
 *  up with a Yahoo or a work address, and a shop with exactly one door turns
 *  the rest away at the point where they were ready to buy.
 *
 * ON PASSWORDS
 *  None are stored, compared or hashed by this file. WordPress does all of it —
 *  `wp_insert_user` hashes, `wp_check_password` verifies, and the reset flow
 *  uses `get_password_reset_key()` / `check_password_reset_key()`, the same
 *  single-use machinery behind wp-login.php. That code has had far more
 *  scrutiny than anything hand-rolled here would ever get.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* Loads once, whether installed as a plugin or pasted into Code Snippets. */
if ( defined( 'KANDI_CUSTOMER_AUTH_LOADED' ) ) {
	return;
}
define( 'KANDI_CUSTOMER_AUTH_LOADED', true );

/**
 * Counts attempts against an action and refuses once there are too many.
 *
 * Without this, `/customers/login` is a standing offer to guess passwords at
 * whatever rate the network allows, and `/password/forgot` is a way to send
 * mail from this domain to anybody. Keyed per action *and* per identity, so
 * one attacker hammering an address cannot lock out an unrelated shopper.
 */
if ( ! function_exists( 'kandi_customer_rate_limit' ) ) {
	function kandi_customer_rate_limit( $action, $identity, $limit, $window ) {
		$key   = 'kandi_crl_' . md5( $action . '|' . strtolower( (string) $identity ) );
		$count = (int) get_transient( $key );

		if ( $count >= $limit ) {
			return new WP_Error(
				'kandi_rate_limited',
				'Too many attempts. Please wait a few minutes and try again.',
				array( 'status' => 429 )
			);
		}

		// The expiry is set on the first hit only. Re-setting it on every
		// attempt would slide the window forward for as long as the attempts
		// kept coming, and a genuine shopper would never get back in.
		set_transient( $key, $count + 1, 0 === $count ? $window : max( 60, $window ) );

		return true;
	}
}

/** Empties one bucket after a success, so a shopper's own typos do not add up. */
if ( ! function_exists( 'kandi_customer_rate_clear' ) ) {
	function kandi_customer_rate_clear( $action, $identity ) {
		delete_transient( 'kandi_crl_' . md5( $action . '|' . strtolower( (string) $identity ) ) );
	}
}

/**
 * The caller's IP, as well as it can be known behind a proxy.
 *
 * Reuses the Seller Centre's resolver when that plugin is loaded so both halves
 * of the site agree about who is calling, and falls back to a local copy of the
 * same logic when it is not — these limits must not quietly stop existing
 * because a companion plugin was deactivated.
 *
 * Forwarded headers are trivially forged. That is fine for what this is used
 * for — spreading a limit across attackers rather than authenticating anyone —
 * and it is why nothing security-critical is ever decided from this value.
 */
if ( ! function_exists( 'kandi_customer_client_ip' ) ) :
function kandi_customer_client_ip() {
	if ( function_exists( 'kandi_seller_client_ip' ) ) {
		return kandi_seller_client_ip();
	}

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
 * ---- Two buckets, because either one alone can be walked around ----
 *
 * Every limit on these endpoints counted the EMAIL and nothing else, which
 * stops one account being hammered and stops nothing else:
 *
 *   • Password spraying — one common password tried against ten thousand
 *     addresses — never trips a per-email counter, because each address is only
 *     touched once. It is also the attack that actually works against a
 *     consumer shop, where some fraction of accounts will be using a password
 *     from a leak.
 *   • Registration flooding — a different address every time — was likewise
 *     unlimited, and every attempt creates a WordPress user and sends an email.
 *   • The reset endpoint could be walked through an address list to find out
 *     which ones have accounts here, one request each.
 *
 * So each endpoint now counts the caller as well. The IP allowance is
 * deliberately much larger than the per-email one: a Ugandan mobile carrier
 * puts a great many real shoppers behind one NAT address, and a limit tight
 * enough to stop a determined attacker would lock out a suburb.
 */
if ( ! function_exists( 'kandi_customer_guard_pair' ) ) :
function kandi_customer_guard_pair( $action, $email, $email_limit, $ip_limit, $window ) {
	$limited = kandi_customer_rate_limit( $action . '_ip', kandi_customer_client_ip(), $ip_limit, $window );
	if ( is_wp_error( $limited ) ) {
		return $limited;
	}

	return kandi_customer_rate_limit( $action, $email, $email_limit, $window );
}
endif;

/** The session handed back to a shopper who has just proved who they are. */
if ( ! function_exists( 'kandi_customer_session_payload' ) ) :
function kandi_customer_session_payload( $user_id ) {
	return array(
		'token'      => kandi_customer_issue_token( $user_id ),
		'expires_in' => defined( 'KANDI_CUSTOMER_TOKEN_TTL' ) ? KANDI_CUSTOMER_TOKEN_TTL : 30 * DAY_IN_SECONDS,
		'customer'   => kandi_format_customer( $user_id ),
	);
}
endif;

/**
 * Guards every route here against Kandi Store API being absent.
 *
 * These endpoints are useless without it, and a missing function in PHP is a
 * fatal error rather than a warning — which on this shop means a blank 502 and
 * a shopper who cannot sign in and cannot be told why.
 */
if ( ! function_exists( 'kandi_customer_auth_ready' ) ) :
function kandi_customer_auth_ready() {
	return function_exists( 'kandi_customer_issue_token' )
		&& function_exists( 'kandi_format_customer' )
		&& function_exists( 'kandi_customer_check_secret' );
}
endif;

if ( ! function_exists( 'kandi_customer_auth_guard' ) ) :
function kandi_customer_auth_guard( WP_REST_Request $request ) {
	if ( ! kandi_customer_auth_ready() ) {
		return new WP_Error(
			'kandi_auth_unavailable',
			'Sign-in is not available: the Kandi Store API plugin is not active.',
			array( 'status' => 503 )
		);
	}

	return kandi_customer_check_secret( $request );
}
endif;

add_action( 'rest_api_init', function () {

	/* ---- POST /customers/register ---- */
	register_rest_route( 'kandi/v1', '/customers/register', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_auth_guard',
		'callback'            => function ( WP_REST_Request $request ) {
			$body     = (array) $request->get_json_params();
			$email    = sanitize_email( $body['email'] ?? '' );
			$password = (string) ( $body['password'] ?? '' );
			$name     = sanitize_text_field( $body['name'] ?? '' );

			if ( ! is_email( $email ) ) {
				return new WP_Error( 'kandi_bad_email', 'Enter a valid email address.', array( 'status' => 400 ) );
			}
			if ( strlen( $password ) < 8 ) {
				return new WP_Error( 'kandi_weak_password', 'Use at least 8 characters for your password.', array( 'status' => 400 ) );
			}

			$limited = kandi_customer_guard_pair( 'register', $email, 5, 20, 15 * MINUTE_IN_SECONDS );
			if ( is_wp_error( $limited ) ) {
				return $limited;
			}

			if ( get_user_by( 'email', $email ) ) {
				// The account may well exist without a password the shopper
				// ever chose — Google sign-in and guest checkout both create
				// one. So this points at the reset flow rather than at sign-in
				// alone: that path proves the address is theirs and then lets
				// them set a password, which is the only route that works for
				// every way the account might have come about.
				return new WP_Error(
					'kandi_email_taken',
					'There is already an account with that email. Sign in below, or use "Forgot password" to set one.',
					array( 'status' => 409 )
				);
			}

			$username = sanitize_user( 'kandi_' . strtok( $email, '@' ), true );
			$base     = $username;
			$suffix   = 1;
			while ( username_exists( $username ) ) {
				$username = $base . $suffix++;
			}

			$user_id = wp_insert_user( array(
				'user_login'   => $username,
				'user_email'   => $email,
				'user_pass'    => $password,
				'display_name' => $name ?: $username,
				'role'         => 'customer',
			) );

			if ( is_wp_error( $user_id ) ) {
				return $user_id;
			}

			if ( '' !== $name ) {
				update_user_meta( $user_id, 'billing_first_name', $name );
			}

			return rest_ensure_response( kandi_customer_session_payload( $user_id ) );
		},
	) );

	/* ---- POST /customers/login ---- */
	register_rest_route( 'kandi/v1', '/customers/login', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_auth_guard',
		'callback'            => function ( WP_REST_Request $request ) {
			$body     = (array) $request->get_json_params();
			$email    = sanitize_email( $body['email'] ?? '' );
			$password = (string) ( $body['password'] ?? '' );

			if ( ! is_email( $email ) || '' === $password ) {
				return new WP_Error( 'kandi_bad_login', 'Enter your email and your password.', array( 'status' => 400 ) );
			}

			$limited = kandi_customer_guard_pair( 'login', $email, 10, 60, 10 * MINUTE_IN_SECONDS );
			if ( is_wp_error( $limited ) ) {
				return $limited;
			}

			$user = get_user_by( 'email', $email );

			// Deliberately one message for "no such account" and for "wrong
			// password". Telling them apart turns this endpoint into a way to
			// discover which addresses shop here, which is worth money to a
			// spammer and costs a shopper their privacy.
			if ( ! $user || ! wp_check_password( $password, $user->user_pass, $user->ID ) ) {
				return new WP_Error(
					'kandi_bad_credentials',
					'That email and password do not match. Check them, or reset your password.',
					array( 'status' => 401 )
				);
			}

			// Clears the email bucket only. The caller's own bucket stays as it
			// is: one correct password among fifty wrong ones is what a
			// successful spray looks like, and forgiving the IP there would
			// hand the attacker a fresh allowance for guessing the next account.
			kandi_customer_rate_clear( 'login', $email );

			return rest_ensure_response( kandi_customer_session_payload( $user->ID ) );
		},
	) );

	/* ---- POST /customers/password/forgot ---- */
	register_rest_route( 'kandi/v1', '/customers/password/forgot', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_auth_guard',
		'callback'            => function ( WP_REST_Request $request ) {
			$body  = (array) $request->get_json_params();
			$email = sanitize_email( $body['email'] ?? '' );

			// The same answer every time, whether or not the address is
			// registered. A different reply for an unknown email would make
			// this a free tool for finding out who has an account here.
			$answer = rest_ensure_response( array(
				'ok'      => true,
				'message' => 'If that address has an account, a reset link is on its way.',
			) );

			if ( ! is_email( $email ) ) {
				return $answer;
			}

			$limited = kandi_customer_guard_pair( 'forgot', $email, 3, 15, 15 * MINUTE_IN_SECONDS );
			if ( is_wp_error( $limited ) ) {
				return $limited;
			}

			$user = get_user_by( 'email', $email );
			if ( ! $user ) {
				return $answer;
			}

			// WordPress's own key: single use, time limited, and void the
			// moment the password changes.
			$key = get_password_reset_key( $user );
			if ( is_wp_error( $key ) ) {
				return $answer;
			}

			$storefront = function_exists( 'kandi_storefront_url' ) && kandi_storefront_url()
				? rtrim( kandi_storefront_url(), '/' )
				: rtrim( home_url(), '/' );

			$link = add_query_arg(
				array(
					'key'   => rawurlencode( $key ),
					'login' => rawurlencode( $user->user_login ),
				),
				$storefront . '/reset-password'
			);

			$heading = 'Reset your password';
			$message =
				'<p>Somebody asked to reset the password on the Kandi account for '
				. esc_html( $user->user_email ) . '.</p>'
				. '<p>The button below works once and stops working after a day. '
				. 'If this was not you, nothing has changed and you can ignore this email.</p>';

			if ( function_exists( 'kandi_send_mail' ) ) {
				kandi_send_mail(
					$user->user_email,
					'Reset your Kandi password',
					$heading,
					$message,
					array( 'label' => 'Choose a new password', 'url' => $link )
				);
			} else {
				// No branded template available — plain text still has to
				// arrive, because a shopper locked out of their account will
				// not wait for us to fix our mail styling.
				wp_mail(
					$user->user_email,
					'Reset your Kandi password',
					"Reset your Kandi password with this link:\n\n{$link}\n\n"
					. "It works once and expires after a day. If this was not you, ignore this email."
				);
			}

			return $answer;
		},
	) );

	/* ---- POST /customers/password/reset ---- */
	register_rest_route( 'kandi/v1', '/customers/password/reset', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_auth_guard',
		'callback'            => function ( WP_REST_Request $request ) {
			$body     = (array) $request->get_json_params();
			$key      = (string) ( $body['key'] ?? '' );
			$login    = (string) ( $body['login'] ?? '' );
			$password = (string) ( $body['password'] ?? '' );

			if ( '' === $key || '' === $login ) {
				return new WP_Error( 'kandi_bad_reset', 'That reset link is not valid. Please request a new one.', array( 'status' => 400 ) );
			}
			if ( strlen( $password ) < 8 ) {
				return new WP_Error( 'kandi_weak_password', 'Use at least 8 characters for your password.', array( 'status' => 400 ) );
			}

			$limited = kandi_customer_rate_limit( 'reset', $login, 10, 15 * MINUTE_IN_SECONDS );
			if ( is_wp_error( $limited ) ) {
				return $limited;
			}

			$user = check_password_reset_key( $key, $login );
			if ( is_wp_error( $user ) ) {
				return new WP_Error(
					'kandi_bad_reset',
					'That reset link has expired or has already been used. Please request a new one.',
					array( 'status' => 400 )
				);
			}

			// `reset_password` clears the key, so a link cannot be replayed —
			// including one sitting in an inbox somebody else can read later.
			reset_password( $user, $password );

			// Straight into a session. Making somebody who has just proved they
			// own the address type the password again is friction with nothing
			// behind it.
			return rest_ensure_response( kandi_customer_session_payload( $user->ID ) );
		},
	) );
} );
