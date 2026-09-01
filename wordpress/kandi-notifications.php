<?php
/**
 * Plugin Name: Kandi Notifications
 * Description: Branded transactional email for the Kandi storefront — shopper order confirmations, and the shared mail template the Seller Centre uses for verification codes, order alerts and payout notices. Sends through wp_mail, so it obeys whatever SMTP plugin the site already uses.
 * Version: 1.0.0
 * Author: Kandi UG
 *
 * HOW TO INSTALL
 *  Upload this file to wp-content/plugins/kandi-notifications/kandi-notifications.php
 *  and activate "Kandi Notifications" in wp-admin > Plugins. No settings, no tables.
 *
 * WHY IT IS SEPARATE
 *  Shopper email is not a seller feature — a shop with no sellers still needs to
 *  tell someone their order arrived — and the Seller Centre plugin is already
 *  long. Both plugins work without this one installed: they fall back to plain
 *  wp_mail, which is uglier but still delivers.
 *
 * ON DUPLICATES
 *  WooCommerce sends its own shopper emails. Every shopper message here checks
 *  whether the matching WooCommerce email is switched on and stays quiet if it
 *  is, so nobody is told twice that their order is being processed. Turn a
 *  WooCommerce email off in WooCommerce > Settings > Emails and Kandi's version
 *  takes over automatically.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* -------------------------------------------------------------------------
 * 0. Loading twice must not be fatal
 *
 * This plugin was activated a second time from a second directory — the file
 * had been uploaded both as `kandi-notifications/kandi-notifications.php` and
 * loose in `wp-content/plugins/`, so wp-admin listed "Kandi Notifications"
 * twice and activating the idle copy while the other was live produced:
 *
 *     Fatal error: Cannot redeclare kandi_mail_brand()
 *     (previously declared in .../kandi-notifications.php:34)
 *
 * which wp-admin reports only as "Plugin could not be activated because it
 * triggered a fatal error." Every function here was declared bare, so the
 * first one PHP reached on the second pass killed the request.
 *
 * ---- Two guards, because one of them does not do what it looks like ----
 *
 * The `defined()` return below stops the `add_action` at the foot of the file
 * running twice. It does NOT stop the redeclare, and that is the part worth
 * writing down: PHP early-binds functions that are declared UNCONDITIONALLY at
 * the top level of a file, registering them while the file is compiled — which
 * happens before any of its statements execute. A `return` on line 40 is
 * reached long after `kandi_mail_brand()` has already been declared and has
 * already collided.
 *
 * What actually prevents it is the `if ( ! function_exists( … ) ) :` wrapper
 * around each function below. A conditionally-declared function is bound when
 * execution reaches it, not at compile time, so the second copy finds the name
 * taken and skips it. This is the same pairing `kandi-customer-auth.php` uses.
 *
 * The wrappers use the alternative `:` / `endif;` syntax rather than braces so
 * that six hundred lines of function bodies keep their indentation and the
 * change stays readable in a diff.
 *
 * Re-adding the same hook twice is harmless either way — WordPress keys a
 * callback by name and replaces rather than appends — so the worst a duplicate
 * copy can now do is nothing at all.
 * ---------------------------------------------------------------------- */

if ( defined( 'KANDI_NOTIFICATIONS_LOADED' ) ) {
	return;
}
define( 'KANDI_NOTIFICATIONS_LOADED', true );

/* -------------------------------------------------------------------------
 * 1. Branding, read from the storefront settings so email matches the shop
 * ---------------------------------------------------------------------- */

if ( ! function_exists( 'kandi_mail_brand' ) ) :
function kandi_mail_brand() {
	$settings = get_option( 'kandi_storefront_settings', array() );
	$settings = is_array( $settings ) ? $settings : array();

	$name   = isset( $settings['brand_name'] ) && '' !== $settings['brand_name'] ? $settings['brand_name'] : 'Kandi';
	$suffix = isset( $settings['brand_suffix'] ) && '' !== $settings['brand_suffix'] ? $settings['brand_suffix'] : 'For Less';

	return array(
		'name'    => trim( $name . ' ' . $suffix ),
		'logo'    => isset( $settings['logo_url'] ) ? (string) $settings['logo_url'] : '',
		/**
		 * The square brand mark, set in Store Settings.
		 *
		 * Emails get a *mark*, not just a wordmark, and the difference is worth
		 * stating. A shopper scanning an inbox on a phone reads the sender
		 * column and the first line of the message; by the time the letterhead
		 * is on screen they have already decided to open it. What the mark does
		 * is make the opened message unmistakably from this shop at a glance,
		 * the way every WooCommerce, Amazon and Jumia receipt does.
		 *
		 * It has its own field rather than reusing `logo_url` because the logo is
		 * a wordmark, and a wordmark cropped into a 44px circle is a coin flip.
		 * This field is asked for square. It used to double as the storefront
		 * favicon, which is where the squareness guarantee came from; the tab
		 * icon ships as a file now (`public/icon.png`), so the only thing
		 * keeping this square is the note under the field.
		 */
		'mark'    => isset( $settings['favicon_url'] ) ? (string) $settings['favicon_url'] : '',
		'phone'   => isset( $settings['support_phone'] ) ? (string) $settings['support_phone'] : '',
		'email'   => isset( $settings['support_email'] ) ? (string) $settings['support_email'] : get_option( 'admin_email' ),
		'address' => isset( $settings['support_address'] ) ? (string) $settings['support_address'] : '',
		// The Next.js shop, learned from the X-Kandi-Storefront header the
		// storefront sends on every read. Falls back to WordPress's own URL so
		// a link is never empty, even if it lands on the wrong half of the site.
		'url'     => function_exists( 'kandi_storefront_url' ) && kandi_storefront_url()
			? kandi_storefront_url()
			: home_url(),
	);
}
endif;

/* -------------------------------------------------------------------------
 * 2. The one email template
 * ---------------------------------------------------------------------- */

/**
 * The shop's font stack, as an email client will actually resolve it.
 *
 * No webfont, and that is not a compromise. Gmail, Outlook and every native
 * mobile client strip `@font-face`, so a `<link>` to Open Sans buys nothing but
 * a slower render and a fallback nobody chose. Naming the system faces means
 * the message is set in the reader's own interface font — which is what every
 * WooCommerce, Amazon and Jumia receipt does, and why they look native.
 */
if ( ! function_exists( 'kandi_mail_font' ) ) :
function kandi_mail_font() {
	return "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
}
endif;

/**
 * Wraps a message in the shop's letterhead.
 *
 * Deliberately plain HTML with inline styles and nested tables: email clients
 * are twenty years behind browsers, Gmail strips <style> blocks from the head,
 * and Outlook renders through Word. Anything cleverer than this is a mess
 * somewhere that matters.
 *
 * ---- What makes it read as professional ----
 *
 * The pieces below are the ones a shopper never consciously notices and would
 * immediately notice the absence of:
 *
 *   • A SQUARE BRAND MARK in the header, beside the shop name. This is the
 *     favicon — the same image as the browser tab — so the receipt, the tab and
 *     the search result all carry one mark.
 *   • A PREHEADER: hidden text that becomes the grey preview line next to the
 *     subject in every inbox list. Left unset, mailbox providers scrape it from
 *     the first thing in the body, which is why so much small-business email
 *     previews as its own letterhead alt text. This is the single highest-value
 *     detail in the whole template, because it is read before the message is
 *     opened and often instead of it.
 *   • A BULLETPROOF BUTTON: a table with a background colour, not a styled <a>.
 *     Outlook ignores padding and border-radius on an anchor and collapses the
 *     button to a bare underlined link.
 *   • `mso-line-height-rule:exactly`, or Word rounds every line height up and
 *     the careful spacing turns to slop in Outlook.
 *   • 600px, the width every email client has been tested against since the
 *     2000s and the one WooCommerce itself uses.
 *   • `color-scheme` / `supported-color-schemes`, so Apple Mail and Outlook
 *     dark mode stop inverting the palette into mud.
 *
 * @param string $heading  The one-line headline.
 * @param string $body     Pre-escaped HTML for the message body.
 * @param array  $cta      Optional array( 'label' => …, 'url' => … ).
 * @param string $preview  Optional inbox preview line. Falls back to the heading.
 */
if ( ! function_exists( 'kandi_mail_template' ) ) :
function kandi_mail_template( $heading, $body, $cta = null, $preview = '' ) {
	$brand = kandi_mail_brand();
	$font  = kandi_mail_font();

	/* ---- The mark ----
	   Square, 44px, rounded. `border-radius` is ignored by Outlook, which shows
	   a square — acceptable, because a square logo in a square frame is still a
	   logo. The image is given explicit width AND height attributes as well as
	   CSS: Outlook reads the attributes and ignores the style, and without them
	   a slow-loading image reserves no space and the header jumps. */
	$mark = '';
	if ( $brand['mark'] ) {
		$mark = sprintf(
			'<td width="44" style="padding:0 12px 0 0;vertical-align:middle">
				<img src="%s" alt="" width="44" height="44"
					style="display:block;width:44px;height:44px;border-radius:10px;border:0;outline:none;text-decoration:none">
			</td>',
			esc_url( $brand['mark'] )
		);
	}

	/* The wordmark. A logo image when the shop has uploaded one, otherwise the
	   name set in the brand orange — never an empty header. */
	$wordmark = $brand['logo']
		? sprintf(
			'<img src="%s" alt="%s" width="150" style="max-height:36px;max-width:150px;display:block;border:0">',
			esc_url( $brand['logo'] ),
			esc_attr( $brand['name'] )
		)
		: sprintf(
			'<span style="font:700 20px/1.2 %s;color:#171717;mso-line-height-rule:exactly">%s</span>',
			$font,
			esc_html( $brand['name'] )
		);

	/* ---- The button ----
	   A table with a background colour rather than a padded anchor, because
	   Outlook drops padding and radius on an <a> and leaves a bare blue link
	   where the call to action should be. The anchor still fills the cell, so
	   the whole coloured block is clickable everywhere else. */
	$button = '';
	if ( is_array( $cta ) && ! empty( $cta['url'] ) && ! empty( $cta['label'] ) ) {
		$button = sprintf(
			'<tr><td style="padding:4px 32px 30px">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0">
					<tr><td align="center" bgcolor="#ff6a00" style="background:#ff6a00;border-radius:8px">
						<a href="%s" style="display:inline-block;padding:14px 30px;font:700 15px/1 %s;
							color:#ffffff;text-decoration:none;border-radius:8px;mso-line-height-rule:exactly">%s</a>
					</td></tr>
				</table>
			</td></tr>',
			esc_url( $cta['url'] ),
			$font,
			esc_html( $cta['label'] )
		);
	}

	/* ---- The preheader ----
	   Hidden in the message, shown in the inbox list. The run of zero-width
	   spaces after it is deliberate and is the standard trick: without it Gmail
	   pads the preview out with whatever text comes next, which would be the
	   letterhead, and the reader sees "Kandi For Less Kandi For Less …". */
	$preheader = sprintf(
		'<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;
			mso-hide:all">%s%s</div>',
		esc_html( '' !== $preview ? $preview : $heading ),
		str_repeat( '&#8199;&#65279;&#847; ', 30 )
	);

	// The footer's support lines, each dropped when the shop has not set it.
	$support = array();
	if ( $brand['phone'] ) {
		$support[] = 'Call ' . esc_html( $brand['phone'] );
	}
	if ( $brand['email'] ) {
		$support[] = sprintf(
			'<a href="mailto:%s" style="color:#71717a;text-decoration:underline">%s</a>',
			esc_attr( $brand['email'] ),
			esc_html( $brand['email'] )
		);
	}

	return sprintf(
		'<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>%s</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f4f4f5;-webkit-text-size-adjust:100%%;-ms-text-size-adjust:100%%">
%s
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"
	style="background:#f4f4f5;padding:24px 12px">
	<tr><td align="center">
		<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
			style="width:100%%;max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">

			<!-- Letterhead -->
			<tr><td style="padding:22px 32px;border-bottom:1px solid #e5e7eb">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>%s<td style="vertical-align:middle">%s</td></tr></table>
			</td></tr>

			<!-- Message -->
			<tr><td style="padding:30px 32px 8px">
				<h1 style="margin:0 0 14px;font:700 22px/1.3 %s;color:#171717;mso-line-height-rule:exactly">%s</h1>
				<div style="font:400 15px/1.6 %s;color:#3f3f46;mso-line-height-rule:exactly">%s</div>
			</td></tr>
			%s

			<!-- Footer -->
			<tr><td style="padding:20px 32px 24px;border-top:1px solid #e5e7eb;background:#fafafa;
				font:400 13px/1.6 %s;color:#71717a;mso-line-height-rule:exactly">
				<div style="font-weight:700;color:#3f3f46">%s</div>
				%s
				%s
				<div style="margin-top:10px;color:#a1a1aa;font-size:12px">
					You are receiving this because of an order or account on
					<a href="%s" style="color:#a1a1aa;text-decoration:underline">%s</a>.
				</div>
			</td></tr>
		</table>
	</td></tr>
</table>
</body></html>',
		esc_html( $heading ),
		$preheader,
		$mark,
		$wordmark,
		$font,
		esc_html( $heading ),
		$font,
		$body,
		$button,
		$font,
		esc_html( $brand['name'] ),
		$support ? '<div>' . implode( ' &middot; ', $support ) . '</div>' : '',
		$brand['address'] ? '<div>' . esc_html( $brand['address'] ) . '</div>' : '',
		esc_url( $brand['url'] ),
		esc_html( wp_parse_url( $brand['url'], PHP_URL_HOST ) ?: $brand['name'] )
	);
}
endif;

/**
 * Sends one branded HTML email. Returns wp_mail's own result.
 *
 * The Seller Centre calls this when it is available and drops back to plain
 * wp_mail when it is not, so the two plugins stay independent.
 */
if ( ! function_exists( 'kandi_send_mail' ) ) :
function kandi_send_mail( $to, $subject, $heading, $body, $cta = null, $preview = '' ) {
	if ( ! $to || ! is_email( $to ) ) {
		return false;
	}

	$brand = kandi_mail_brand();

	$headers = array(
		'Content-Type: text/html; charset=UTF-8',
		sprintf( 'From: %s <%s>', $brand['name'], kandi_mail_from_address() ),
	);

	// Replies go to a mailbox a human reads, not to no-reply@. Gmail also reads
	// a valid Reply-To as a sign of a real sender rather than a blast.
	if ( $brand['email'] && is_email( $brand['email'] ) ) {
		$headers[] = sprintf( 'Reply-To: %s <%s>', $brand['name'], $brand['email'] );
	}

	// Marks the message as transactional. Some filters use it, and it stops
	// mailbox providers offering to unsubscribe from a verification code.
	$headers[] = 'Auto-Submitted: auto-generated';
	$headers[] = 'X-Auto-Response-Suppress: All';

	// A plain-text alternative alongside the HTML. A message that is HTML-only
	// scores worse in every spam filter there is — a real newsletter has both —
	// and it is what a text-mode client or a screen reader falls back to.
	add_action( 'phpmailer_init', 'kandi_mail_attach_plain_text' );
	$GLOBALS['kandi_mail_plain'] = kandi_mail_plain_text( $heading, $body, $cta );

	$sent = wp_mail( $to, $subject, kandi_mail_template( $heading, $body, $cta, $preview ), $headers );

	remove_action( 'phpmailer_init', 'kandi_mail_attach_plain_text' );
	unset( $GLOBALS['kandi_mail_plain'] );

	return $sent;
}
endif;

/**
 * Turns the HTML body into readable plain text for the multipart alternative.
 *
 * Not a general HTML-to-text converter — it only has to handle the markup this
 * plugin generates: paragraphs, line breaks, list items and a button.
 */
if ( ! function_exists( 'kandi_mail_plain_text' ) ) :
function kandi_mail_plain_text( $heading, $body, $cta = null ) {
	$text = str_ireplace(
		array( '</p>', '<br>', '<br/>', '<br />', '</tr>', '</li>' ),
		"\n",
		$body
	);
	$text = str_ireplace( '<li>', '- ', $text );
	$text = wp_strip_all_tags( $text );
	// Collapse the runs of blank lines the table markup leaves behind.
	$text = preg_replace( "/\n{3,}/", "\n\n", trim( html_entity_decode( $text, ENT_QUOTES, 'UTF-8' ) ) );

	$out = $heading . "\n" . str_repeat( '-', min( 60, strlen( $heading ) ) ) . "\n\n" . $text;

	if ( is_array( $cta ) && ! empty( $cta['url'] ) ) {
		$out .= "\n\n" . ( $cta['label'] ?? 'Open' ) . ': ' . $cta['url'];
	}

	$brand = kandi_mail_brand();
	$out  .= "\n\n--\n" . $brand['name'];
	if ( $brand['phone'] ) {
		$out .= "\n" . $brand['phone'];
	}
	if ( $brand['email'] ) {
		$out .= "\n" . $brand['email'];
	}

	return $out;
}
endif;

/** Hands PHPMailer the plain-text half of the message. */
if ( ! function_exists( 'kandi_mail_attach_plain_text' ) ) :
function kandi_mail_attach_plain_text( $phpmailer ) {
	if ( ! empty( $GLOBALS['kandi_mail_plain'] ) ) {
		$phpmailer->AltBody = $GLOBALS['kandi_mail_plain'];
	}
}
endif;

/**
 * The address mail is sent from.
 *
 * Must be on the site's own domain or the big providers treat it as forgery and
 * bin it — which is why this is the site domain rather than the shop's Gmail
 * support address. Replies still go where they should: `Reply-To` carries the
 * support address on messages a shopper might answer.
 */
if ( ! function_exists( 'kandi_mail_from_address' ) ) :
function kandi_mail_from_address() {
	$host = wp_parse_url( home_url(), PHP_URL_HOST );
	$host = preg_replace( '/^www\./i', '', (string) $host );
	return apply_filters( 'kandi_mail_from_address', 'no-reply@' . $host );
}
endif;

/* -------------------------------------------------------------------------
 * 3. Small formatting helpers shared by the order emails
 * ---------------------------------------------------------------------- */

/**
 * Renders order lines as a table. Used in both shopper and seller emails.
 *
 * Boxed with a header row and a shaded total, which is the shape a receipt is
 * expected to have — the same one WooCommerce, and every invoice before it, has
 * used. The previous version was two bare columns separated by hairlines; it
 * read as a list of things rather than as a statement of what was bought and
 * what it came to, and a shopper checking a charge scans for the boxed total.
 *
 * `white-space:nowrap` on the money column so "UGX 1,250,000" can never be
 * broken across two lines, which is the one thing in a receipt that must not
 * happen. The name column takes the wrapping instead.
 */
if ( ! function_exists( 'kandi_mail_items_table' ) ) :
function kandi_mail_items_table( $rows, $total_label = '', $total = null ) {
	$font = kandi_mail_font();

	$html = sprintf(
		'<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"
			style="width:100%%;border-collapse:collapse;margin:16px 0 6px;border:1px solid #e5e7eb;border-radius:8px;
			font:400 14px/1.5 %s">
		<tr>
			<th align="left" style="padding:10px 14px;background:#fafafa;border-bottom:1px solid #e5e7eb;
				font:600 12px/1.4 %s;color:#71717a;text-transform:uppercase;letter-spacing:0.04em">Item</th>
			<th align="right" style="padding:10px 14px;background:#fafafa;border-bottom:1px solid #e5e7eb;
				font:600 12px/1.4 %s;color:#71717a;text-transform:uppercase;letter-spacing:0.04em">Total</th>
		</tr>',
		$font,
		$font,
		$font
	);

	foreach ( $rows as $row ) {
		$html .= sprintf(
			'<tr>
				<td style="padding:12px 14px;border-bottom:1px solid #f1f1f4;color:#171717;mso-line-height-rule:exactly">%s<br>
					<span style="color:#71717a;font-size:13px">Qty %d</span></td>
				<td align="right" style="padding:12px 14px;border-bottom:1px solid #f1f1f4;color:#171717;
					white-space:nowrap;vertical-align:top">%s</td>
			</tr>',
			esc_html( $row['name'] ),
			(int) $row['quantity'],
			wp_kses_post( $row['total'] )
		);
	}

	if ( null !== $total ) {
		$html .= sprintf(
			'<tr>
				<td style="padding:13px 14px;background:#fafafa;font-weight:700;color:#171717">%s</td>
				<td align="right" style="padding:13px 14px;background:#fafafa;font-weight:700;color:#171717;
					white-space:nowrap;font-size:16px">%s</td>
			</tr>',
			esc_html( $total_label ),
			wp_kses_post( $total )
		);
	}

	return $html . '</table>';
}
endif;

/** True when WooCommerce is already sending the shopper this message itself. */
if ( ! function_exists( 'kandi_wc_email_enabled' ) ) :
function kandi_wc_email_enabled( $class ) {
	if ( ! function_exists( 'WC' ) || ! WC()->mailer() ) {
		return false;
	}
	$emails = WC()->mailer()->get_emails();
	return isset( $emails[ $class ] ) && $emails[ $class ]->is_enabled();
}
endif;

/** The shopper's address on an order, or '' when it is a guest with none. */
if ( ! function_exists( 'kandi_order_email' ) ) :
function kandi_order_email( $order ) {
	$email = $order->get_billing_email();
	return is_email( $email ) ? $email : '';
}
endif;

if ( ! function_exists( 'kandi_order_first_name' ) ) :
function kandi_order_first_name( $order ) {
	$name = trim( (string) $order->get_billing_first_name() );
	return '' !== $name ? $name : 'there';
}
endif;

/** Every line on an order, formatted for kandi_mail_items_table. */
if ( ! function_exists( 'kandi_order_rows' ) ) :
function kandi_order_rows( $order ) {
	$rows = array();
	foreach ( $order->get_items() as $item ) {
		$rows[] = array(
			'name'     => $item->get_name(),
			'quantity' => $item->get_quantity(),
			'total'    => wc_price( (float) $item->get_total(), array( 'currency' => $order->get_currency() ) ),
		);
	}
	return $rows;
}
endif;

/** Where the shopper follows their order on the storefront. */
if ( ! function_exists( 'kandi_order_tracking_url' ) ) :
function kandi_order_tracking_url( $order ) {
	$brand = kandi_mail_brand();
	return sprintf(
		'%s/track-order?order=%s&email=%s',
		$brand['url'],
		rawurlencode( $order->get_order_number() ),
		rawurlencode( (string) $order->get_billing_email() )
	);
}
endif;

/* -------------------------------------------------------------------------
 * 4. Shopper email
 * ---------------------------------------------------------------------- */

/**
 * "We have your order" — sent the moment an order is placed.
 *
 * WooCommerce has no equivalent for a cash-on-delivery order that goes straight
 * to processing: its shopper email for that status is the *processing* notice,
 * which reads as an update to something you were never told about. This is the
 * receipt.
 */
if ( ! function_exists( 'kandi_mail_order_placed' ) ) :
function kandi_mail_order_placed( $order_id ) {
	$order = wc_get_order( $order_id );
	if ( ! $order || $order->get_meta( '_kandi_mailed_placed' ) ) {
		return false;
	}

	$to = kandi_order_email( $order );
	if ( '' === $to ) {
		return false;
	}

	$cod  = 'cod' === $order->get_payment_method();
	$body = sprintf(
		'<p style="margin:0 0 14px">Hi %s, thank you — your order <strong>#%s</strong> is in.</p>%s<p style="margin:14px 0 0">%s</p>',
		esc_html( kandi_order_first_name( $order ) ),
		esc_html( $order->get_order_number() ),
		kandi_mail_items_table(
			kandi_order_rows( $order ),
			'Total',
			wc_price( (float) $order->get_total(), array( 'currency' => $order->get_currency() ) )
		),
		$cod
			? 'You pay <strong>when it reaches you</strong> — cash, MTN MoMo or Airtel Money. Please have the exact amount ready for the rider.'
			: 'We have your payment. Packing starts now.'
	);

	/**
	 * The preview line, which is read before the message is opened.
	 *
	 * It carries the total and the delivery window rather than repeating the
	 * subject, because the inbox already shows the subject an inch to the left.
	 * A preview that restates it wastes the one line a shopper reads while
	 * deciding whether this needs opening at all — and the two facts they
	 * actually want from an order confirmation are what it cost and when it
	 * comes.
	 */
	kandi_send_mail(
		$to,
		sprintf( 'Order #%s confirmed', $order->get_order_number() ),
		'Thank you for your order',
		$body,
		array( 'label' => 'Track this order', 'url' => kandi_order_tracking_url( $order ) ),
		sprintf(
			'%s · arriving in 1–3 days. We will text you before the rider sets off.',
			wp_strip_all_tags( $order->get_formatted_order_total() )
		)
	);

	// Stamped on the order rather than kept in a transient: an order is only
	// placed once, and the flag has to survive as long as the order does.
	$order->update_meta_data( '_kandi_mailed_placed', 1 );
	$order->save();

	return true;
}
endif;

/** "We are packing it" / "It is on the way" / "Delivered". */
if ( ! function_exists( 'kandi_mail_order_status' ) ) :
function kandi_mail_order_status( $order_id, $from_status, $to_status ) {
	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return;
	}

	$to = kandi_order_email( $order );
	if ( '' === $to ) {
		return;
	}

	$name  = esc_html( kandi_order_first_name( $order ) );
	$id    = esc_html( $order->get_order_number() );
	$track = array( 'label' => 'Track this order', 'url' => kandi_order_tracking_url( $order ) );

	// The receipt goes out here rather than on `woocommerce_new_order`, because
	// that hook fires inside wc_create_order() — before the storefront has added
	// a single line item or the delivery address, so the email would arrive
	// describing an empty order. By the first real status the order is complete.
	//
	// It is also why an order awaiting payment gets nothing: a Pesapal order
	// sits at `pending` until the money lands, and thanking somebody for an
	// order they abandoned at the payment screen is worse than silence.
	$just_placed = false;
	if ( in_array( $to_status, array( 'processing', 'on-hold', 'completed' ), true ) ) {
		$just_placed = kandi_mail_order_placed( $order_id );
	}

	if ( 'processing' === $to_status ) {
		// The receipt above already said this order is being prepared; a second
		// email a millisecond later saying the same thing is noise.
		if ( $just_placed ) {
			return;
		}
		if ( kandi_wc_email_enabled( 'WC_Email_Customer_Processing_Order' ) ) {
			return;
		}
		kandi_send_mail(
			$to,
			sprintf( 'Order #%s is being prepared', $order->get_order_number() ),
			'Your order is being packed',
			sprintf(
				'<p style="margin:0 0 14px">Hi %s, order <strong>#%s</strong> has been accepted and is being packed now. We will be in touch when the rider sets off.</p>',
				$name,
				$id
			),
			$track
		);
		return;
	}

	if ( 'completed' === $to_status ) {
		if ( kandi_wc_email_enabled( 'WC_Email_Customer_Completed_Order' ) ) {
			return;
		}

		/**
		 * Someone else may already have told the shopper.
		 *
		 * This message is written for an order that has ARRIVED. Kandi Order
		 * Dispatch redefines `completed` to mean "every seller has accepted and
		 * it is on its way", and sends its own dispatch notice at that moment —
		 * so with both plugins active and no guard here the shopper is told
		 * their parcel is on its way and has been delivered, in the same minute,
		 * by the same shop.
		 *
		 * A filter rather than a hard-coded check on that plugin's meta, so this
		 * file does not have to know it exists.
		 */
		if ( ! apply_filters( 'kandi_send_completed_email', true, $order ) ) {
			return;
		}
		$brand = kandi_mail_brand();
		kandi_send_mail(
			$to,
			sprintf( 'Order #%s delivered', $order->get_order_number() ),
			'Your order has been delivered',
			sprintf(
				'<p style="margin:0 0 14px">Hi %s, order <strong>#%s</strong> is complete. We hope it is exactly what you wanted.</p>
				 <p style="margin:0 0 14px">Something not right? You have %d days to return it, no questions asked — just reply to this email.</p>
				 <p style="margin:0">A review helps the next shopper decide, and it helps the seller more than you would think.</p>',
				$name,
				$id,
				kandi_returns_days()
			),
			array( 'label' => 'Shop again', 'url' => $brand['url'] )
		);
		return;
	}

	if ( 'cancelled' === $to_status ) {
		kandi_send_mail(
			$to,
			sprintf( 'Order #%s cancelled', $order->get_order_number() ),
			'Your order has been cancelled',
			sprintf(
				'<p style="margin:0 0 14px">Hi %s, order <strong>#%s</strong> has been cancelled and you have not been charged.</p>
				 <p style="margin:0">If this was not you, reply to this email and we will look into it straight away.</p>',
				$name,
				$id
			)
		);
	}
}
endif;
add_action( 'woocommerce_order_status_changed', 'kandi_mail_order_status', 20, 3 );

/** The shop's published returns window, for the delivery email. */
if ( ! function_exists( 'kandi_returns_days' ) ) :
function kandi_returns_days() {
	$settings = get_option( 'kandi_storefront_settings', array() );
	if ( is_array( $settings ) && ! empty( $settings['returns_days'] ) ) {
		return (int) $settings['returns_days'];
	}
	return 14;
}
endif;
