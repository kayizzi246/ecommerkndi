# Phone verification (one-time codes)

Shoppers prove a phone number — or an email address — with a 6-digit code
before their first order, before creating an account, and before opening a
store. This is what it costs, how to switch it on, and what it does not do.

## Why

Most orders on this shop are cash on delivery. The shop packs the goods, pays a
rider, and sends them across Kampala on the strength of a phone number typed
into a form by somebody who has paid nothing. `lib/phone.ts` already checked
that a number was *shaped* like a Ugandan mobile. This checks somebody is
holding it.

A verified contact lasts **90 days per browser**, so a returning shopper is
never asked twice. That is the number that decides the running cost.

## Choosing a gateway

Per-message prices, September 2026. An OTP is one message.

| Gateway | Per SMS | Notes |
| --- | --- | --- |
| **EgoSMS (Pahappa)** | pay-as-you-go, volume tiers | Ugandan, JSON API, no per-verification fee. **The default adapter.** |
| SMSUG / UgSMS | flat UGX 25 | Advertised flat rate, no setup fee. Use the `generic` adapter. |
| Africa's Talking | competitive | Well documented, but wants a deposit up front. Use the `generic` adapter. |
| Twilio Verify | ~$0.05 **per verification** *plus* the SMS | Roughly UGX 190 per signup before a message is sent, and its Uganda SMS rate is several times the local one because the message arrives through an international aggregator. Not recommended here. |

Email codes cost nothing, which is why the dialog offers "use my email
instead" as a first-class option rather than burying it. Every shopper who
takes that route is margin the shop keeps. The phone is still offered first,
because the number is what the rider calls.

## Environment

### SMS — EgoSMS (default)

```
KANDI_SMS_USERNAME=...        # EgoSMS account
KANDI_SMS_PASSWORD=...        # EgoSMS API key
KANDI_SMS_SENDER_ID=KandiUg   # must be registered with the gateway
```

### SMS — any other gateway

```
KANDI_SMS_PROVIDER=generic
KANDI_SMS_URL=https://gateway.example/send
KANDI_SMS_BODY_TEMPLATE={"to":"{to}","text":"{message}","from":"{sender}"}
KANDI_SMS_CONTENT_TYPE=application/json     # or application/x-www-form-urlencoded
KANDI_SMS_AUTH_HEADER=Bearer xxx            # optional
KANDI_SMS_SENDER_ID=KandiUg
```

`{to}`, `{message}` and `{sender}` are substituted and escaped for the content
type, so a message containing a quote cannot break the body it is pasted into.

### Email

```
KANDI_MAIL_API_KEY=re_...                   # Resend
KANDI_MAIL_FROM=verify@kandiug.com          # must be on a verified domain
```

An unverified sender domain is accepted by the API and then silently not
delivered — that is the failure that looks like the code never arriving.

### Sealing

Codes and the verified-contact cookie are sealed with `KANDI_SESSION_SECRET`
(falling back to `KANDI_API_SECRET`). **No secret means no verification**: the
routes answer 503 rather than letting anyone through. Rotating the secret
invalidates every verified cookie at once.

### Escape hatch

```
KANDI_REQUIRE_VERIFIED_CHECKOUT=0
```

Lets orders through without a proved contact. It is for one situation: the SMS
gateway is down and the shop would rather take unverified orders than none.
Defaults to enforcing.

## Development

With no gateway configured and `NODE_ENV !== "production"`, the code is printed
to the server console and the send reports success — so the whole flow can be
worked on before anybody has an SMS account. It is guarded on `NODE_ENV`, so a
production deployment with no gateway fails loudly rather than waving everyone
through.

## Where it is enforced

| Place | Behaviour |
| --- | --- |
| `/checkout` | `CheckoutVerifyGate` opens the dialog on arrival, by whichever route — cart, cart drawer, Buy now, sticky buy bar, a bookmark. Cancel returns to `/cart`. |
| `POST /api/checkout` | 403 `verification_required` for same-origin requests with no proved contact. |
| `POST /api/auth/register` | 403 without a proved contact. The phone is read from the sealed cookie, never from the body. |
| `POST /api/seller/register` | 403 without a proved **phone**, and refuses if the form's number differs from the proved one. |

## What this does not do

The checkout gate is a page-level control: it stops a person, not a script.
Server-side enforcement is scoped to requests carrying
`Sec-Fetch-Site: same-origin`, because the mobile app posts to the same
endpoint cross-origin with no cookie jar and would otherwise break. A script
posting straight to `/api/checkout` with no such header is not stopped here —
what bounds that is the rate limiter, the Turnstile check, and the fact that an
order still has to survive a rider ringing the number.

Sealed challenges cannot count their own attempts, so brute-force resistance
comes from the rate limiter: 10 verify attempts per 10 minutes per source and
per challenge, 4 sends per hour and 12 per day per destination. Those windows
are shared across instances wherever Upstash is configured, which matters more
here than on sign-in because every send is real money.

## Not built: signing in with a phone number

Seller and shopper **sign-in** still require an email address. Signing in with a
phone needs WordPress to look an account up by phone and issue a token for it —
`kandi/v1/sellers/login` and `kandi/v1/customers/login` both take an email only.
The storefront cannot add that on its own. When the plugin grows a
`login_by_phone` endpoint, the OTP half of it is already here: verify, then post
the proved number instead of the email.
