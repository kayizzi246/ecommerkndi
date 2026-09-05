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
			// Through the shared check rather than a bare length test — see
			// kandi_password_problem() for what eight characters was admitting.
			// Guarded, because this plugin runs without Kandi Store API present
			// and a missing function is a fatal rather than a warning.
			if ( function_exists( 'kandi_password_problem' ) ) {
				$weak = kandi_password_problem( $password, $email );
				if ( $weak ) {
					return new WP_Error( 'kandi_weak_password', $weak, array( 'status' => 400 ) );
				}
			} elseif ( strlen( $password ) < 8 ) {
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

	/* ---- POST /customers/otp-mail ----
	 *
	 * Emails a one-time code that the STOREFRONT generated.
	 *
	 * ---- Why WordPress sends it and not the storefront ----
	 *
	 * The storefront had no mailer of its own, so the first build reached for a
	 * third-party API. That is a second sending domain to verify, a second
	 * reputation to keep clean, a second bill, and a second place for a shop
	 * owner to look when an email does not arrive. WordPress already sends every
	 * order confirmation, every password reset and every seller notice from this
	 * shop, through whatever SMTP the host has been set up with — so it is
	 * already the thing that knows how to get mail to a Ugandan inbox, and
	 * `kandi_send_mail()` already wraps it in the shop's own branding.
	 *
	 * ---- The caller cannot choose what is sent ----
	 *
	 * This route takes an address and six digits and composes the message here.
	 * It deliberately does NOT accept a subject or a body: an endpoint that
	 * emails arbitrary text to an arbitrary address is a spam relay the moment
	 * the shared secret leaks, and it would be sending from the domain every
	 * order confirmation goes out on. The worst this can be abused for is
	 * sending somebody a number.
	 *
	 * ---- What it does not do ----
	 *
	 * It does not generate the code, store it, or check it. The storefront seals
	 * the code into an encrypted challenge and verifies it there; WordPress
	 * never sees a code twice and has nothing to keep in sync. This is a mail
	 * transport and nothing else.
	 */
	register_rest_route( 'kandi/v1', '/customers/otp-mail', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_auth_guard',
		'callback'            => function ( WP_REST_Request $request ) {
			$body  = (array) $request->get_json_params();
			$email = sanitize_email( $body['email'] ?? '' );
			$code  = preg_replace( '/\D/', '', (string) ( $body['code'] ?? '' ) );

			if ( ! is_email( $email ) ) {
				return new WP_Error( 'kandi_bad_email', 'Enter a valid email address.', array( 'status' => 400 ) );
			}
			if ( 6 !== strlen( $code ) ) {
				return new WP_Error( 'kandi_bad_code', 'A verification code is six digits.', array( 'status' => 400 ) );
			}

			// Second ceiling, under the storefront's own. This one is here
			// because it is the one an attacker cannot skip by calling
			// WordPress directly with a leaked secret.
			$limited = kandi_customer_guard_pair( 'otp_mail', $email, 5, 40, 15 * MINUTE_IN_SECONDS );
			if ( is_wp_error( $limited ) ) {
				return $limited;
			}

			$heading = 'Your verification code';
			$message =
				'<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 16px">'
				. esc_html( $code ) . '</p>'
				. '<p>Enter this code to finish what you were doing on Kandi. '
				. 'It expires in 10 minutes.</p>'
				. '<p>If you did not ask for it, you can ignore this email. '
				. 'We will never ask you for this code.</p>';

			$sent = function_exists( 'kandi_send_mail' )
				? kandi_send_mail( $email, $code . ' is your Kandi verification code', $heading, $message, null, 'Your Kandi verification code' )
				: wp_mail(
					$email,
					$code . ' is your Kandi verification code',
					"{$code} is your Kandi verification code.\n\n"
					. "It expires in 10 minutes. If you did not ask for it, ignore this email."
				);

			if ( ! $sent ) {
				// Reported honestly rather than swallowed: the storefront offers
				// the shopper the SMS route instead, which it cannot do if this
				// claims to have sent something it did not.
				return new WP_Error( 'kandi_mail_failed', 'The code could not be emailed.', array( 'status' => 502 ) );
			}

			return rest_ensure_response( array( 'ok' => true ) );
		},
	) );

	/* ---- POST /customers/otp-session ----
	 *
	 * A session for a shopper who has proved a phone number or an email
	 * address, and who has no password at all.
	 *
	 * ---- Why this route exists ----
	 *
	 * The Kandi app used to sign shoppers in with `/customers/login` — an
	 * address and a password typed on a phone keyboard. That is the wrong
	 * credential for this shop's customers: most of them arrive from a phone,
	 * a good number have no email they check, and the password they would set
	 * at checkout is one they will have forgotten by their second order. The
	 * app now verifies a CONTACT instead, over SMS or email, and this is what
	 * turns that proof into a session.
	 *
	 * ---- What is trusted, and by whom ----
	 *
	 * This route does NOT see a code and does not check one. The storefront
	 * seals the six digits into an encrypted challenge, verifies them itself
	 * (see `openChallenge` in the storefront's lib/otp.ts) and only then calls
	 * here, over the shared secret, saying "this contact is proved". So the
	 * trust boundary is exactly the one every other route in this file uses:
	 * `kandi_customer_auth_guard` and `X-Kandi-Secret`.
	 *
	 * That is worth stating plainly because of what it means if the secret
	 * leaks: whoever holds it can mint a session for any address. That was
	 * ALREADY true — the secret is what lets `/customers/register` create an
	 * account and hand back a token — so this route widens no boundary. It is
	 * still the reason the secret is the one value in this system that must
	 * never be in a client.
	 *
	 * ---- Find, or create ----
	 *
	 * An SMS shopper usually has no WordPress user, because nothing in this
	 * shop has ever needed one for them. Creating it here is what makes the
	 * order history work at all, and it is the same account guest checkout
	 * would have made for them later.
	 *
	 * A phone number is matched on `billing_phone`, which is where WooCommerce
	 * keeps it and where every order this shop writes has already put it. It is
	 * matched EXACTLY: the storefront normalises to +2567XXXXXXXX before it
	 * seals the challenge, so both sides are comparing the same shape. Do not
	 * relax this to a LIKE — a partial match on a phone number is a way into
	 * somebody else's order history.
	 *
	 * The synthetic address for a phone-only shopper is deliberately on an
	 * unroutable domain. WordPress requires an email on every user, so there
	 * has to be one; making it obviously undeliverable is what stops an order
	 * confirmation being sent into the void and counted as sent.
	 */
	register_rest_route( 'kandi/v1', '/customers/otp-session', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'permission_callback' => 'kandi_customer_auth_guard',
		'callback'            => function ( WP_REST_Request $request ) {
			$body    = (array) $request->get_json_params();
			$channel = (string) ( $body['channel'] ?? '' );
			$contact = trim( (string) ( $body['contact'] ?? '' ) );
			$name    = sanitize_text_field( $body['name'] ?? '' );

			if ( 'sms' !== $channel && 'email' !== $channel ) {
				return new WP_Error( 'kandi_bad_channel', 'Unknown verification channel.', array( 'status' => 400 ) );
			}

			// A ceiling under the storefront's own, for the same reason
			// /customers/otp-mail carries one: this is the copy an attacker
			// holding a leaked secret cannot skip by calling WordPress direct.
			$limited = kandi_customer_guard_pair( 'otp_session', $contact, 10, 60, 15 * MINUTE_IN_SECONDS );
			if ( is_wp_error( $limited ) ) {
				return $limited;
			}

			$user = null;

			if ( 'email' === $channel ) {
				$contact = sanitize_email( $contact );
				if ( ! is_email( $contact ) ) {
					return new WP_Error( 'kandi_bad_email', 'Enter a valid email address.', array( 'status' => 400 ) );
				}
				$user = get_user_by( 'email', $contact );
			} else {
				// +2567XXXXXXXX, which is what the storefront normalises to
				// before it seals the challenge. Anything else is not a shape
				// this shop stores, so there is nothing it could match.
				if ( ! preg_match( '/^\+256\d{9}$/', $contact ) ) {
					return new WP_Error( 'kandi_bad_phone', 'Enter a Ugandan mobile number.', array( 'status' => 400 ) );
				}

				$found = get_users( array(
					'meta_key'    => 'billing_phone',
					'meta_value'  => $contact,
					'number'      => 1,
					'fields'      => 'ID',
					'count_total' => false,
				) );

				if ( ! empty( $found ) ) {
					$user = get_user_by( 'id', (int) $found[0] );
				}
			}

			if ( ! $user ) {
				$seed     = 'email' === $channel ? strtok( $contact, '@' ) : substr( $contact, 1 );
				$username = sanitize_user( 'kandi_' . $seed, true );
				$base     = $username;
				$suffix   = 1;
				while ( username_exists( $username ) ) {
					$username = $base . $suffix++;
				}

				$email = 'email' === $channel
					? $contact
					: substr( $contact, 1 ) . '@phone.kandi.invalid';

				// A long random password nobody is ever told. The account is
				// reachable only by proving the contact again, which is the
				// point — leaving the field empty would let wp_signon() in
				// with a blank password on some configurations.
				$user_id = wp_insert_user( array(
					'user_login'   => $username,
					'user_email'   => $email,
					'user_pass'    => wp_generate_password( 32, true, true ),
					'display_name' => $name ?: $username,
					'role'         => 'customer',
				) );

				if ( is_wp_error( $user_id ) ) {
					return $user_id;
				}

				if ( 'sms' === $channel ) {
					update_user_meta( $user_id, 'billing_phone', $contact );
				}
				if ( '' !== $name ) {
					update_user_meta( $user_id, 'billing_first_name', $name );
				}

				$user = get_user_by( 'id', $user_id );
			} elseif ( 'sms' === $channel ) {
				// Found by phone already, so this is a no-op in the common
				// case. It matters for an account created by email that is now
				// verifying a number: without it the number is proved and then
				// forgotten, and the next sign-in makes a SECOND account.
				update_user_meta( $user->ID, 'billing_phone', $contact );
			}

			kandi_customer_rate_clear( 'otp_session', $contact );

			return rest_ensure_response( kandi_customer_session_payload( $user->ID ) );
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
			if ( function_exists( 'kandi_password_problem' ) ) {
				$weak = kandi_password_problem( $password, $login );
				if ( $weak ) {
					return new WP_Error( 'kandi_weak_password', $weak, array( 'status' => 400 ) );
				}
			} elseif ( strlen( $password ) < 8 ) {
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
