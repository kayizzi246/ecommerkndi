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
<body style="margin:0;padding:0;background:#f2eee9;-webkit-text-size-adjust:100%%;-ms-text-size-adjust:100%%">
%s
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"
	style="background:#f2eee9;padding:28px 12px">
	<tr><td align="center">
		<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
			style="width:100%%;max-width:600px;background:#ffffff;border:1px solid #e8e1d9;border-radius:14px;overflow:hidden">

			<!-- The brand bar.
			     Four pixels of orange across the top of the card, and the only place
			     the brand colour appears other than the button. It is the cheapest
			     signal of a designed message there is: an email that opens on a bare
			     white rectangle reads as something a script produced, one that opens
			     on a coloured edge reads as stationery. The zero font-size and
			     line-height are not decoration — Outlook gives an empty cell a line
			     box and turns a 4px rule into a 20px band without them. -->
			<tr><td height="4" bgcolor="#ff6a00"
				style="height:4px;background:#ff6a00;font-size:0;line-height:0;mso-line-height-rule:exactly">&nbsp;</td></tr>

			<!-- Letterhead -->
			<tr><td style="padding:22px 32px;border-bottom:1px solid #f0eae3">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>%s<td style="vertical-align:middle">%s</td></tr></table>
			</td></tr>

			<!-- Message -->
			<tr><td style="padding:30px 32px 8px">
				<h1 style="margin:0 0 14px;font:700 22px/1.3 %s;color:#171717;mso-line-height-rule:exactly">%s</h1>
				<div style="font:400 15px/1.6 %s;color:#3f3f46;mso-line-height-rule:exactly">%s</div>
			</td></tr>
			%s

			<!-- Footer -->
			<tr><td style="padding:20px 32px 24px;border-top:1px solid #f0eae3;background:#faf7f4;
				font:400 13px/1.6 %s;color:#8a8178;mso-line-height-rule:exactly">
				<div style="font-weight:700;color:#3f3f46">%s</div>
				%s
				%s
				<div style="margin-top:10px;color:#a89e93;font-size:12px">
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
			style="width:100%%;border-collapse:collapse;margin:16px 0 6px;border:1px solid #ece6df;border-radius:10px;
			font:400 14px/1.5 %s">
		<tr>
			<th align="left" style="padding:10px 14px;background:#faf7f4;border-bottom:1px solid #ece6df;
				font:600 12px/1.4 %s;color:#8a8178;text-transform:uppercase;letter-spacing:0.04em">Item</th>
			<th align="right" style="padding:10px 14px;background:#faf7f4;border-bottom:1px solid #ece6df;
				font:600 12px/1.4 %s;color:#8a8178;text-transform:uppercase;letter-spacing:0.04em">Total</th>
		</tr>',
		$font,
		$font,
		$font
	);

	foreach ( $rows as $row ) {
		$html .= sprintf(
			'<tr>
				<td style="padding:12px 14px;border-bottom:1px solid #f4efe9;color:#171717;mso-line-height-rule:exactly">%s<br>
					<span style="color:#8a8178;font-size:13px">Qty %d</span></td>
				<td align="right" style="padding:12px 14px;border-bottom:1px solid #f4efe9;color:#171717;
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
				<td style="padding:13px 14px;background:#faf7f4;font-weight:700;color:#171717">%s</td>
				<td align="right" style="padding:13px 14px;background:#faf7f4;font-weight:700;color:#171717;
					white-space:nowrap;font-size:16px">%s</td>
			</tr>',
			esc_html( $total_label ),
			wp_kses_post( $total )
		);
	}

	return $html . '</table>';
}
endif;

/* -------------------------------------------------------------------------
 * 3b. The blocks a message is assembled from
 *
 * Every email in this shop used to be a `sprintf` of hand-written `<p
 * style="margin:0 0 14px">` tags, one copy per message, spread across two
 * plugins. That is why they had drifted: the payout notice used a bare table
 * with its own padding, the order alert used a list, the verification code used
 * a one-off `font:700 34px`, and no two of them agreed on a margin.
 *
 * These are the pieces instead. They are deliberately few and deliberately
 * dull — a paragraph, a row of facts, a tinted box, a headline figure, a code —
 * because an email is not a web page and every extra shape is another thing to
 * test in Outlook. What they buy is that a change to how a "fact" looks happens
 * once and reaches every message.
 *
 * All of them return HTML fragments for the `$body` argument of
 * `kandi_mail_template`, and all of them escape their inputs unless the name
 * says otherwise (`_html` suffix = caller has already escaped).
 * ---------------------------------------------------------------------- */

/**
 * A paragraph, with the spacing the template expects.
 *
 * The last paragraph before a button or a table wants no bottom margin, hence
 * the second argument, which is the only reason this is not a one-liner.
 */
if ( ! function_exists( 'kandi_mail_p' ) ) :
function kandi_mail_p( $html, $margin = '0 0 14px' ) {
	return sprintf(
		'<p style="margin:%s;mso-line-height-rule:exactly">%s</p>',
		esc_attr( $margin ),
		wp_kses_post( $html )
	);
}
endif;

/**
 * A label-and-value list — the shape of every "here are the details" block.
 *
 * A table rather than a definition list, because Outlook does not lay out
 * `<dl>`, and left-aligned labels in a fixed column are what makes a column of
 * numbers scannable. Values may carry HTML (`wc_price` returns a `<span>`), so
 * they are passed through the post allow-list rather than escaped flat.
 *
 * @param array $rows Label => value. A row with an empty value is dropped, so a
 *                    caller can pass optional fields without guarding each one.
 */
if ( ! function_exists( 'kandi_mail_facts' ) ) :
function kandi_mail_facts( $rows ) {
	$font = kandi_mail_font();
	$html = '';

	foreach ( (array) $rows as $label => $value ) {
		if ( '' === trim( wp_strip_all_tags( (string) $value ) ) ) {
			continue;
		}
		$html .= sprintf(
			'<tr>
				<td style="padding:7px 16px 7px 0;color:#8a8178;white-space:nowrap;vertical-align:top">%s</td>
				<td style="padding:7px 0;color:#171717;font-weight:600;vertical-align:top">%s</td>
			</tr>',
			esc_html( $label ),
			wp_kses_post( $value )
		);
	}

	if ( '' === $html ) {
		return '';
	}

	return sprintf(
		'<table role="presentation" cellpadding="0" cellspacing="0" border="0"
			style="border-collapse:collapse;margin:0 0 16px;font:400 14px/1.5 %s;mso-line-height-rule:exactly">%s</table>',
		$font,
		$html
	);
}
endif;

/**
 * A tinted box for the one thing in the message that is not prose.
 *
 * Four tones, and they are the shop's own: `brand` for what to do next, `good`
 * for money arriving and orders confirmed, `warn` for something waiting on
 * somebody, `neutral` for an aside. Each is a background and a matching left
 * border rather than a full coloured panel — a solid block of colour behind
 * body text is the fastest way to make an email look like a promotion, which is
 * where a receipt should never look like it is going.
 */
if ( ! function_exists( 'kandi_mail_panel' ) ) :
function kandi_mail_panel( $html, $tone = 'neutral' ) {
	$tones = array(
		'brand'   => array( '#fff4ec', '#ff6a00', '#7c3a10' ),
		'good'    => array( '#eaf7ee', '#1a9e4b', '#0a7a2f' ),
		'warn'    => array( '#fff8e6', '#e0a800', '#8a6100' ),
		'neutral' => array( '#faf7f4', '#d9d1c8', '#3f3f46' ),
	);
	$tone = isset( $tones[ $tone ] ) ? $tone : 'neutral';
	list( $background, $edge, $ink ) = $tones[ $tone ];

	return sprintf(
		'<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"
			style="width:100%%;border-collapse:collapse;margin:0 0 16px">
			<tr><td bgcolor="%1$s" style="background:%1$s;border-left:3px solid %2$s;border-radius:0 8px 8px 0;
				padding:13px 16px;font:400 14px/1.6 %3$s;color:%4$s;mso-line-height-rule:exactly">%5$s</td></tr>
		</table>',
		esc_attr( $background ),
		esc_attr( $edge ),
		kandi_mail_font(),
		esc_attr( $ink ),
		wp_kses_post( $html )
	);
}
endif;

/**
 * The one number the message is about, at the size it deserves.
 *
 * For a payout, a refund, an order total — anything where the reader's first
 * question is "how much". It exists because those figures were previously set
 * in the middle of a sentence at body size, and a shopper scanning a receipt on
 * a phone reads the big number and the heading and nothing else.
 *
 * `$note` is the line under it: what it is for, when it lands, what is left.
 */
if ( ! function_exists( 'kandi_mail_figure' ) ) :
function kandi_mail_figure( $label, $value, $note = '' ) {
	$font = kandi_mail_font();

	return sprintf(
		'<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"
			style="width:100%%;border-collapse:collapse;margin:0 0 18px">
			<tr><td bgcolor="#faf7f4" style="background:#faf7f4;border:1px solid #ece6df;border-radius:10px;
				padding:16px 18px;mso-line-height-rule:exactly">
				<div style="font:600 12px/1.4 %1$s;color:#8a8178;text-transform:uppercase;letter-spacing:0.05em">%2$s</div>
				<div style="font:700 28px/1.2 %1$s;color:#171717;padding-top:4px;mso-line-height-rule:exactly">%3$s</div>
				%4$s
			</td></tr>
		</table>',
		$font,
		esc_html( $label ),
		wp_kses_post( $value ),
		'' !== $note
			? sprintf(
				'<div style="font:400 13px/1.5 %s;color:#8a8178;padding-top:6px">%s</div>',
				$font,
				wp_kses_post( $note )
			)
			: ''
	);
}
endif;

/**
 * A one-time code, set to be read off a screen and typed into another.
 *
 * Wide letter-spacing and a monospace-ish weight because the failure mode of a
 * six-digit code is misreading it, not mistyping it — a 0 next to an O, a 1
 * next to an l. Boxed so it cannot be confused with the sentence around it.
 */
if ( ! function_exists( 'kandi_mail_code' ) ) :
function kandi_mail_code( $code ) {
	return sprintf(
		'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px">
			<tr><td bgcolor="#faf7f4" style="background:#faf7f4;border:1px solid #ece6df;border-radius:10px;
				padding:14px 22px;font:700 32px/1 %s;letter-spacing:8px;color:#171717;
				mso-line-height-rule:exactly">%s</td></tr>
		</table>',
		kandi_mail_font(),
		esc_html( $code )
	);
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

	$cod = 'cod' === $order->get_payment_method();

	$body = kandi_mail_p( sprintf(
			'Hi %s, thank you — your order <strong>#%s</strong> is in.',
			esc_html( kandi_order_first_name( $order ) ),
			esc_html( $order->get_order_number() )
		) )
		. kandi_mail_items_table(
			kandi_order_rows( $order ),
			'Total',
			wc_price( (float) $order->get_total(), array( 'currency' => $order->get_currency() ) )
		)
		/* The payment line as a panel rather than a trailing sentence.
		   On a cash-on-delivery order it is an instruction — have the money
		   ready — and it was previously the last line of a paragraph under a
		   table, which is the part of an email nobody reads. */
		. kandi_mail_panel(
			$cod
				? 'You pay <strong>when it reaches you</strong> — cash, MTN MoMo or Airtel Money. Please have the exact amount ready for the rider.'
				: 'We have your payment. Packing starts now.',
			$cod ? 'warn' : 'good'
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

/* -------------------------------------------------------------------------
 * 5. Push notifications — the half that was missing
 *
 * The storefront ships a complete push stack: `lib/push.ts` addresses OneSignal,
 * `/api/notifications/send` authenticates with the shared secret and owns the
 * wording of every message, and the Flutter app registers its subscriptions. All
 * of it worked. None of it ever ran, because nothing on this side ever called
 * it — the route had no callers anywhere in the repository, so every push the
 * shop was built to send has been dead since it was written.
 *
 * This is that call.
 *
 * ---- Why WordPress calls the storefront rather than OneSignal ----
 *
 * PHP could POST to OneSignal directly and skip a hop. It must not, and the
 * route's own header says why: the WORDING lives in `orderMessage` and
 * `sellerMessage` on the storefront, one place where the shop's voice is
 * decided. Sending from here would mean the copy existing twice, in two
 * languages, and "on the way" being phrased two ways depending on which one
 * fired. So WordPress owns WHEN and WHO — it is the thing that has the orders —
 * and the storefront owns WHAT IT SAYS.
 *
 * ---- Why nothing here checks whether push is configured ----
 *
 * Because the far end already does, and answers 200 with `skipped: true` when
 * OneSignal is not set up. A shop with no push keys still takes orders; a status
 * change that threw because notifications were not configured would turn a
 * nice-to-have into an outage. The one thing that IS checked is the storefront
 * URL, since without it there is nowhere to send anything.
 * ---------------------------------------------------------------------- */

/**
 * Where the Next.js storefront lives, or '' when WordPress has not been told.
 *
 * Deliberately NOT falling back to `home_url()` the way the email letterhead
 * does. A wrong link in an email footer is a cosmetic problem; POSTing a
 * notification to WordPress's own domain would be a request to an endpoint that
 * does not exist, repeated on every order, forever.
 */
if ( ! function_exists( 'kandi_push_storefront' ) ) :
function kandi_push_storefront() {
	if ( ! function_exists( 'kandi_storefront_url' ) ) {
		return '';
	}
	return untrailingslashit( (string) kandi_storefront_url() );
}
endif;

/** The shared secret, resolved the same way every other Kandi plugin resolves it. */
if ( ! function_exists( 'kandi_push_secret' ) ) :
function kandi_push_secret() {
	if ( function_exists( 'kandi_shared_secret' ) ) {
		return (string) kandi_shared_secret();
	}
	if ( defined( 'KANDI_API_SECRET' ) && KANDI_API_SECRET ) {
		return (string) KANDI_API_SECRET;
	}
	return (string) get_option( 'kandi_api_secret', '' );
}
endif;

/**
 * Posts one notification request to the storefront.
 *
 * ---- Non-blocking, and what that costs ----
 *
 * `blocking => false` means PHP hands the request to the socket and carries on
 * without waiting for the reply. Every one of these fires during a WooCommerce
 * status change, which on this shop happens inside checkout — so a storefront
 * that is slow, or asleep on a cold start, would otherwise add its whole
 * response time to the shopper's wait for a message the shopper is not even
 * waiting for.
 *
 * The price is that failures are invisible: a wrong secret or a moved URL fails
 * silently and push goes quiet again, which is exactly how this system spent so
 * long broken. `kandi_push_test()` below is the answer to that — a blocking
 * call, run on demand from the Notifications screen, that reports what actually
 * came back.
 */
if ( ! function_exists( 'kandi_push_send' ) ) :
function kandi_push_send( $payload, $blocking = false ) {
	$storefront = kandi_push_storefront();
	$secret     = kandi_push_secret();

	if ( '' === $storefront || '' === $secret ) {
		return false;
	}

	$response = wp_remote_post(
		$storefront . '/api/notifications/send',
		array(
			'timeout'  => $blocking ? 12 : 1,
			'blocking' => (bool) $blocking,
			'headers'  => array(
				'Content-Type'   => 'application/json',
				'X-Kandi-Secret' => $secret,
			),
			'body'     => wp_json_encode( $payload ),
		)
	);

	return $blocking ? $response : true;
}
endif;

/**
 * Tells the shopper their order moved.
 *
 * Priority 30, so it runs after the commission ledger (10) and the email (20).
 * If any of those fatal, the ordering means the shopper still has the email —
 * the more important of the two channels — before push is attempted.
 *
 * ---- Dispatched is not delivered ----
 *
 * Kandi Order Dispatch redefines `completed` to mean "every seller accepted and
 * it is on its way", stamping `_kandi_dispatched_at` as it does. Sending the
 * shopper "Delivered" at that moment would be a lie told to their lock screen.
 * The storefront already has the right words for this under the status
 * `out-for-delivery` — a status WooCommerce does not have and nothing was ever
 * passing — so the stamp is what selects it.
 */
if ( ! function_exists( 'kandi_push_order_status' ) ) :
function kandi_push_order_status( $order_id, $from_status, $to_status ) {
	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return;
	}

	$status = $to_status;
	if ( 'completed' === $to_status && $order->get_meta( '_kandi_dispatched_at' ) ) {
		$status = 'out-for-delivery';
	}

	kandi_push_send( array(
		'kind'         => 'order',
		// 0 for a guest checkout, which the storefront answers with
		// "no customer" rather than an error. Most orders here are guests.
		'customer_id'  => (int) $order->get_customer_id(),
		'status'       => $status,
		'order_number' => (string) $order->get_order_number(),
	) );
}
endif;
add_action( 'woocommerce_order_status_changed', 'kandi_push_order_status', 30, 3 );

/**
 * Tells a seller they have something to pack.
 *
 * Hooked to `kandi_seller_order_notified`, which the Seller Centre fires once
 * per seller per order from inside its own de-duplication guard — so an order
 * moving on-hold to processing to completed cannot buzz the same seller three
 * times. That hook was added for exactly this and had no listeners.
 */
if ( ! function_exists( 'kandi_push_seller_order' ) ) :
function kandi_push_seller_order( $order, $seller_id, $part = array() ) {
	kandi_push_send( array(
		'kind'         => 'seller',
		'seller_id'    => (int) $seller_id,
		'event'        => 'new-order',
		'order_number' => (string) $order->get_order_number(),
	) );
}
endif;
add_action( 'kandi_seller_order_notified', 'kandi_push_seller_order', 10, 3 );

/** Tells a seller their money has gone out. */
if ( ! function_exists( 'kandi_push_payout_paid' ) ) :
function kandi_push_payout_paid( $seller_id, $payout = null ) {
	kandi_push_send( array(
		'kind'      => 'seller',
		'seller_id' => (int) $seller_id,
		'event'     => 'payout-sent',
	) );
}
endif;
add_action( 'kandi_seller_payout_paid', 'kandi_push_payout_paid', 10, 2 );

/**
 * A blocking round trip, for the Notifications screen in wp-admin.
 *
 * Returns a human-readable sentence rather than a status code, because the
 * person pressing the button is trying to answer one question — "is this thing
 * connected?" — and every failure mode has a different fix: no storefront URL
 * set, wrong secret, storefront unreachable, or connected but OneSignal keys
 * missing on the Next.js side.
 */
if ( ! function_exists( 'kandi_push_test' ) ) :
function kandi_push_test( $seller_id = 0 ) {
	$storefront = kandi_push_storefront();
	if ( '' === $storefront ) {
		return array( false, 'No storefront URL is set. Kandi Storefront > Settings, then load the shop once so it can announce itself.' );
	}
	if ( '' === kandi_push_secret() ) {
		return array( false, 'No shared secret is configured. Set KANDI_API_SECRET in wp-config.php.' );
	}

	$response = kandi_push_send(
		array(
			'kind'         => 'seller',
			'seller_id'    => (int) ( $seller_id ?: get_current_user_id() ),
			'event'        => 'new-order',
			'order_number' => 'TEST',
		),
		true
	);

	if ( is_wp_error( $response ) ) {
		return array( false, sprintf( 'Could not reach %s — %s', $storefront, $response->get_error_message() ) );
	}

	$code = (int) wp_remote_retrieve_response_code( $response );
	$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

	if ( 401 === $code ) {
		return array( false, 'The storefront rejected the shared secret. KANDI_API_SECRET here and in .env.local must match.' );
	}
	if ( 200 !== $code ) {
		return array( false, sprintf( 'The storefront answered %d. Is /api/notifications/send deployed?', $code ) );
	}
	if ( is_array( $body ) && ! empty( $body['skipped'] ) ) {
		return array( false, 'Connected, but the storefront has no OneSignal keys — set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in .env.local.' );
	}

	$sent = is_array( $body ) && isset( $body['sent'] ) ? (int) $body['sent'] : 0;

	return array(
		true,
		$sent > 0
			? sprintf( 'Connected. The test reached %d device(s).', $sent )
			: 'Connected, and OneSignal accepted it — but no device is subscribed for this account yet. Sign in to the app on a phone and try again.'
	);
}
endif;

/* ---- The screen that makes all of the above visible ---- */

add_action( 'admin_menu', function () {
	add_submenu_page(
		'woocommerce',
		'Kandi Notifications',
		'Kandi Notifications',
		'manage_woocommerce',
		'kandi-notifications',
		'kandi_notifications_admin_page'
	);
} );

if ( ! function_exists( 'kandi_notifications_admin_page' ) ) :
function kandi_notifications_admin_page() {
	$result = null;

	if ( isset( $_POST['kandi_push_test'] ) ) {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( 'You do not have permission to do that.' );
		}
		check_admin_referer( 'kandi_push_test' );
		$result = kandi_push_test();
	}

	$storefront = kandi_push_storefront();

	echo '<div class="wrap"><h1>Kandi Notifications</h1>';
	echo '<p>Email goes out through this site. Push notifications are handed to the storefront, which talks to OneSignal.</p>';

	if ( is_array( $result ) ) {
		printf(
			'<div class="notice notice-%s"><p>%s</p></div>',
			$result[0] ? 'success' : 'error',
			esc_html( $result[1] )
		);
	}

	echo '<table class="form-table"><tbody>';
	printf(
		'<tr><th scope="row">Storefront</th><td>%s</td></tr>',
		$storefront
			? '<code>' . esc_html( $storefront ) . '</code>'
			: '<span style="color:#b32d2e">Not known yet — open the shop once so it can announce itself.</span>'
	);
	printf(
		'<tr><th scope="row">Shared secret</th><td>%s</td></tr>',
		kandi_push_secret()
			? 'Configured'
			: '<span style="color:#b32d2e">Missing — set KANDI_API_SECRET in wp-config.php.</span>'
	);
	echo '<tr><th scope="row">What gets pushed</th><td>
			Order confirmed, out for delivery, delivered, cancelled and refunded to the shopper ·
			new order and payout sent to the seller.
			<p class="description">Emails are sent regardless. Push is extra, and only reaches people who installed the app.</p>
		  </td></tr>';
	echo '</tbody></table>';

	echo '<form method="post">';
	wp_nonce_field( 'kandi_push_test' );
	echo '<p><button class="button button-primary" name="kandi_push_test" value="1">Send a test notification</button>';
	echo '<span class="description" style="margin-left:10px">Goes to the app on whichever phone is signed in as you.</span></p>';
	echo '</form></div>';
}
endif;

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
