# Adding the app to FlutterFlow

Eighteen custom widgets — one per page. **No parameters to declare on any of them.**
**One pubspec change:** add `webview_flutter` under Custom Code →
Dependencies.

```yaml
webview_flutter: ^4.7.0
```

Nothing else. It is used by one widget — the Pesapal sheet on the checkout
screen — and this file said "no pubspec changes needed" for a long time
before that sheet existed, so the line is worth reading twice if you are
following an older copy of these instructions.

Android needs nothing extra. On iOS the plugin requires a minimum deployment
target of 12.0, which FlutterFlow already sets.

| Name it exactly | Paste this file |
|---|---|
| `KandiHomeScreen` | `kandi_home_screen.dart` |
| `KandiProductScreen` | `kandi_product_screen.dart` |
| `KandiCartScreen` | `kandi_cart_screen.dart` |
| `KandiVerifyScreen` | `kandi_verify_screen.dart` |
| `KandiCheckoutScreen` | `kandi_checkout_screen.dart` |
| `KandiSearchScreen` | `kandi_search_screen.dart` |
| `KandiShopScreen` | `kandi_shop_screen.dart` |
| `KandiWishlistScreen` | `kandi_wishlist_screen.dart` |
| `KandiAccountScreen` | `kandi_account_screen.dart` |
| `KandiOrdersScreen` | `kandi_orders_screen.dart` |
| `KandiSellerScreen` | `kandi_seller_screen.dart` |
| `KandiSellerOrdersScreen` | `kandi_seller_orders_screen.dart` |
| `KandiSellerProductsScreen` | `kandi_seller_products_screen.dart` |
| `KandiSellerPayoutsScreen` | `kandi_seller_payouts_screen.dart` |
| `KandiCategoriesScreen` | `kandi_categories_screen.dart` |
| `KandiDealsScreen` | `kandi_deals_screen.dart` |
| `KandiStoresScreen` | `kandi_stores_screen.dart` |
| `KandiTrackOrderScreen` | `kandi_track_order_screen.dart` |

**Custom Code → Widgets → `+` → Widget**, then paste the whole file over
whatever is in the editor.

Names must match exactly. FlutterFlow turns the widget name into the file path —
`KandiHomeScreen` becomes `lib/custom_code/widgets/kandi_home_screen.dart` — and
the navigation imports are written against those paths.

---

## Paste order

Any. Each page carries its own palette, HTTP client and product model, all
file-private, so nothing depends on anything else being pasted first.

The only cross-file imports are **navigation** — Home opens Product, Cart,
Search, Shop, Saved and Account; Cart opens **Verify or Checkout**,
whichever the device needs; Verify opens Checkout; Account opens Orders and
the Seller Centre; Product opens Cart and, sideways, another Product. Dart
resolves those once all eighteen exist, so the project compiles when the set is
complete and not before. Paste them in any order you like and compile at the
end.

---

## On every paste

1. Select all in the editor, paste the whole file over it.
2. Delete these two lines if FlutterFlow added them:
   ```dart
   import '/backend/backend.dart';
   import '/backend/supabase/supabase.dart';
   ```
   This project has neither file, and leaving them breaks the build in every
   custom widget at once.
3. Compile.

There is no step for parameters. Leave the parameter list empty on all eighteen.

**Never add an import above `// DO NOT REMOVE OR MODIFY THE CODE ABOVE!`.**
FlutterFlow rewrites those first lines on save and silently drops anything you
put there. The file then stops compiling, and the error it gives is
`No widget "…" found` — which reads like the name is wrong and never is.

---

## Nothing is passed between pages

Not a constructor parameter. Not a route argument. Every page is opened with a
const constructor and no arguments at all.

What a page needs to know, it reads from the device. Before opening the product
page, whichever page you tapped from writes the id to `kandi-open-product`; the
product page reads that key in `initState`.

That is deliberately not the obvious design, and the reason is FlutterFlow. A
route argument only survives if navigation happens through this code — the
moment you wire a page with the builder's own **Navigate To** action, the
argument is gone and the destination opens blank. A handoff on disk works
however the shopper got there, including from a FlutterFlow action, a deep link
or a push notification.

**So you can wire navigation in FlutterFlow however you like.** Nothing breaks.

---

## The keys every page agrees on

These are the entire contract between pages. They appear verbatim in each file,
and nothing enforces the agreement — **if you change one, change it everywhere
at once.**

| Key | Holds |
|---|---|
| `kandi-cart-v1` | The basket: a JSON list of lines |
| `kandi-wishlist-v1` | Saved items: id, name, image, price |
| `kandi-checkout-v1` | Delivery details, refilled next visit |
| `kandi-auth-v1` | The shopper's bearer token |
| `kandi-verified-phone` | The number this device proved, as `+2567XXXXXXXX`. With `kandi-auth-v1`, this is the whole of the checkout gate |
| `kandi-auth-name` | The name shown in the greeting |
| `kandi-seller-auth-v1` | The **seller's** token — a different account |
| `kandi-seller-name` | The store name shown in the Seller Centre |
| `kandi-open-sort` | Which sort the shop page opens on |
| `kandi-open-product` | Which product the product page opens |
| `kandi-open-category` | Which aisle the shop page lists, as `slug\|Name` |
| `kandi-open-search` | The term the search page runs |

A basket line is keyed `productId::variantLabel`, so the same shoe in two sizes
stays two lines rather than merging into one with a size missing.

---

## How the pages connect

```
Home ─┬─ tap a card ──────────→ Product ──→ Cart ─┬─ Verify ─→ Checkout ─→ (pay)
      │                                            └─ Checkout ─────────→ (pay)
      ├─ search bar ──────────→ Search  ──→ Product
      ├─ a department pill ───→ Shop    ──→ Product
      ├─ bottom bar: Shop ────→ Shop
      ├─ bottom bar: Saved ───→ Saved   ──→ Product
      ├─ bottom bar: Basket ──→ Cart
      └─ bottom bar: Account ─→ Account ─┬→ Categories ─→ Shop / Product
                                         ├→ Today's deals ─→ Product
                                         ├→ Shop by store ─┬→ Product
                                         │                 └→ (store page, browser)
                                         ├→ Track an order
                                         ├→ Orders ─→ Track an order
                                         ├→ Seller Centre ─┬→ Seller Orders
                                         │                 ├→ Seller Products
                                         │                 └→ Commissions
                                         └→ Saved / Cart

Product ──→ "You might also like" ──→ another Product (in place)
```

### Why the four browse screens hang off Account

Categories, deals, the store directory and order tracking are all reached from
the Account page rather than from the bottom bar. That is not where they
belong in the abstract — three of them are things a shopper does *before* they
buy — but the bar is full at five tabs and every one of those five earns its
place. A panel of rows at the top of Account costs one extra tap and no
ambiguity; a sixth tab costs legibility on every screen in the app.

They are also all reachable from FlutterFlow's own navigation, like everything
else here, because nothing is passed between pages. If you would rather put
Categories on the bar, wire it there and delete nothing.

### The bottom bar

Five pages carry it — **Home, Shop, Saved, Basket, Account** — because those are
the top-level destinations. Product, Checkout, Search, Orders and the four
seller pages do not: they are detail screens reached from somewhere specific,
and a tab bar on them invites a shopper to leave mid-task.

**Tabs never stack.** Tapping one pops to the app's root and pushes the target,
so the stack is never deeper than Home plus one tab and Back always means Home.
Without that, Home → Shop → Account → Basket leaves four screens stacked and
four back taps to escape.

The tab you are already on has a **null** handler rather than an empty one, so
InkWell draws no ripple — the honest signal for "nothing will happen". On Home
it scrolls back to the top instead.

On the Basket the tab bar sits **below** the checkout summary rather than
replacing it. Dropping the tabs there would strand a shopper who opened the
basket to check a total and then wanted to carry on browsing.

---

## What each page does

**Home** — one request to `/api/app/home` builds it: the shop's terms, the
departments as pills, every merchandising rail already composed and ordered by
the server, and a picked-for-you grid. Same feed the website's homepage renders
from, so trending and discount depth are decided once and both clients agree.

**Product** — reads the id from the device, fetches `/api/app/product/{id}`,
shows the gallery, price, size and colour pickers, and adds to the basket. A
product with options cannot be added from a card anywhere in the app; it opens
here, where the picker is.

**Cart** — reads the saved basket, then asks the shop what each line costs *now*
and shows any price that moved or item that sold out. Quantity, remove-with-undo,
and a free-delivery meter.

**Verify** — the step between the basket and the checkout, and the only screen
in the app a shopper is meant to see exactly once. A number, six digits back,
and it is done: the token goes into `kandi-auth-v1` and the proved number into
`kandi-verified-phone`, and from then on the basket's Checkout button opens the
checkout directly.

> **The gate used to be inside the checkout, and that was the wrong place.**
> `_placeOrder` verified the phone as its first step, which meant the sheet
> appeared *after* the shopper had filled in a name, a town and an address and
> pressed the button that says how much they are about to pay. That is the
> worst moment in the flow to stop somebody. Asked at the basket, it costs a
> first-time shopper one screen at the point where they have decided to buy
> and not yet committed to a form, and it costs a returning shopper nothing.
>
> **The basket decides, by reading two keys and asking nothing.** Both
> `kandi-auth-v1` and `kandi-verified-phone` present means registered and
> reachable, and the gate is skipped. The token is opaque to the app, so a
> round trip could only report what those two already say — and it would put a
> spinner on the one button in the app that must never hesitate.
>
> **A dead session still reappears, and by the right route.** When the shop
> stops accepting a token, `/api/checkout` answers 401, the checkout clears
> both keys, and the next trip through the basket lands on the gate. Nothing
> polls for it.
>
> **The gate takes a phone, where the account page takes either.** An email
> address is not something a rider can ring from outside a gate. A shopper who
> signed in by email comes through here once; the code lands on the same
> WordPress customer, because `/customers/otp-session` matches an existing
> account on `billing_phone` and updates it.

**Checkout** — collects name, phone, town and address, saves them for next
time, chooses mobile money or a card, and takes the payment without leaving the
app. It keeps its own copy of the verification check: it can be reached from a
FlutterFlow action or a deep link that never passed through the basket, and it
is the screen that finds out when a token has gone stale.

> **Payment used to happen on the website, and no longer does.** The argument
> for the old way was real — the site is where Pesapal is wired and where the
> order is written — but what it cost was the order: being thrown into a
> browser at the moment of payment is where app checkouts are abandoned. The
> drift it was avoiding is avoided a different way instead. Nothing about the
> payment is reimplemented here: the same `/api/checkout` writes the order,
> the same `/api/payments/pesapal/start` opens the session, and the page the
> shopper types into is Pesapal's own, on Pesapal's domain. The screen
> contributes a WebView and a poll. See **Signing in, and paying** below.

**Search** — 400ms debounce, two-character minimum, and a generation counter so a
slow answer for `sho` cannot overwrite a fast one for `shoes`.

**Shop** — browse by department with server-side sorting. Opened with no
department it lists the departments instead of an empty grid.

**Saved** — the wishlist. Makes no network request at all: it stores enough of
each product to draw a tile, so it opens instantly and works with no signal.

**Account** — sign in, and the links out. Browsing, the basket and saved items
all work signed out; the only thing an account buys is order history, and the
page says that rather than blocking the app behind a form.

> **There is no password.** A phone number or an email address, six digits
> back, and that is the whole of it. The old form asked for an email and a
> password and mostly sent people to a browser to reset one — a sign-in flow
> that did not sign anybody in. A first sign-in is also the registration, so
> "Create account" and "Forgot password" are both gone rather than moved.

**Orders** — the one page that needs a shopper account. With no token it says so
and sends you to Account. A 401 clears the stored token, because a token the shop
has stopped accepting is not a session.

**Seller Centre** — reached from Account. Signed in it shows revenue, orders,
units sold, payout due and the listing counts for a 7/30/90-day range; signed out
it shows the seller sign-in with "become a seller" underneath, so one row is
correct for whoever taps it.

> **A seller session is not a shopper session.** They are different accounts on
> different endpoints, so the seller token lives under its own key. Sharing one
> would mean signing in as a seller silently signed you out as a shopper — and
> would send a seller token to the customer orders endpoint, which answers 401
> and then clears it, logging the trader out of a session they never noticed
> breaking. Most sellers here are also shoppers; both sessions coexist.

**Seller → Orders** — every order for this trader, filtered by all / to pack /
completed, with the line items and the payout on each. **Accepting an order is
the one write the app does**: it flips the row optimistically, and reverts with
a message if the shop did not hear. That matters because a row claiming
"accepted" when nothing was sent leaves a customer waiting on a confirmation
that never comes.

**Seller → Products** — the trader's stock, sorted with out-of-stock first
because it is the only row costing them money today, then by what sells. A
banner at the top counts the out-of-stock lines and doubles as a filter.

**Seller → Commissions** — what is payable, what is pending, and the arithmetic
order by order: gross, rate, commission, net. Commission is the most-argued
number in any marketplace, so the working is shown rather than just the total,
and none of it is computed on the phone — a second implementation disagreeing by
one shilling would be worse than no figure.

**Categories** — the browse screen, and the one the phone web build now serves
too: a rail of departments down the left that never moves, the selected
department's shelves as photographs on the right, and a dozen of its products
under them. One request to `/api/app/categories`, switched between locally — a
rail that costs a round trip per tap is not a rail. Two levels of shelf, so
Sandals is visible without opening Shoes first. Shelf pictures are borrowed
from the first product filed beneath them, because a WooCommerce category
almost never has an image of its own and a photograph of real stock beats a
designed icon anyway.

**Today's deals** — `/api/app/products` with `sale=1` or a `min_discount`
floor, ordered by discount and paged as the shopper scrolls. The depth chips
are a floor, not a sort: "reduced at all" and "at least half price" are
different promises. Shop answers "show me shoes"; this answers "show me what is
cheap today", which is a different shopper with the same money.

**Shop by store** — the trader directory off `/api/app/stores`, each row
carrying four of that store's actual products because a list of store names is
not a place to shop. The products open in the app; the store's own page opens
in a browser, since it is a masthead, a policy block and a filtered grid the
app already has.

**Track an order** — an order number and the phone or email it was placed with,
against `/api/track`, and the four steps back. It exists because checkout does
not require an account, so most orders here are not tied to one and My orders
can never show them. The four steps and their wording are copied from the
website's tracking panel: one shopper checking one order in two places must not
be told two different things. The signed-out state of My orders offers this as
its second action for exactly that reason.

### Signing in, and paying

Both changed together, because they are the same fact seen twice: the app
now proves a contact, and the thing it proves is what lets it take money.

**There is no password.** The account page asks for a phone number or an
email address, `POST /api/otp/start` sends six digits, and
`POST /api/app/auth/otp` trades those digits for the bearer token that goes
into `kandi-auth-v1`. WordPress finds the customer behind that contact or
creates one — `/customers/otp-session` in `wordpress/kandi-customer-auth.php`.
A first sign-in **is** the registration, so there is no "Create account" link
and nothing to forget.

**The checkout takes a phone only**, where the account page takes either. The
number on an order is what a rider rings from the gate; an email is not. A
shopper who signed in by email is asked once for a number at checkout, which
lands on the same account — WordPress matches `billing_phone` and updates it.

**Payment happens in the app.** Four steps, in `_placeOrder`:

1. Verify the phone if it is not already.
2. `POST /api/checkout` with the bearer token. WooCommerce writes the order
   `awaiting_payment` and returns its id and a one-shot `payment_token`.
   Nothing has been charged yet.
3. `POST /api/payments/pesapal/start` with that token, which returns a URL.
4. That URL opens in a WebView sheet. When it navigates to
   `/payment/callback`, the sheet asks `POST /api/app/payment/status` what
   actually happened.

Step 4 is the one to leave alone. The callback URL says the trip is over and
nothing about whether money moved; believing it is a free-order bug one proxy
away. Only the server's answer clears the basket.

Ids and quantities are all that is posted. Prices are the server's — a figure
sent from a phone is one the shop would have to either trust or ignore.

Closing the payment sheet early is safe at any point: if the money has left,
Pesapal's IPN settles the order server-side whatever the sheet does. An order
that exists but is not paid for keeps its number, and the basket is left
alone so trying again costs nothing.

---

### What stays on the website

Adding a product and store settings. The split is by whether the task is
**reading or writing**, not by what was easy: those two are forms — a media
picker, a variations table, a payout account — and a cramped version of either
on a phone is how a seller publishes at the wrong price or types the wrong MoMo
number.

**Cash on delivery**, too, and for a different reason. It is priced from a
point on a map — `codZoneFor` on the storefront decides whether an address is
in a zone the riders collect from — and the checkout screen collects a town
and a landmark. The app is missing an address picker, not a payment flow, so
the COD line on the payment panel opens the website's checkout with the
basket and details attached. Mobile money and cards stay in the app.

---

## The design language

Every page carries its own copy of the palette — nothing is shared, for the
reason at the top of this file — so these values have to be kept in step by
hand. If you change one, change all eighteen.

### The bottom bar marks its tab with a capsule

The active tab used to be signalled by colour alone — the icon and label went
from grey to flame and nothing else moved. That is one channel, it is the
channel a colour-deficient shopper does not have, and at 22px on a white bar it
is weak with normal vision too. A gradient-filled capsule behind the icon adds
shape and ground to the same fact.

**The bar's height is measured, not assumed.** It was a flat 58, which was the
height of its contents at the default text size and stayed 58 when a reader
raised theirs: at a 1.3 scale the label was clipped by 7px on all five tabbed
screens. It is now added up from a 30 capsule, a 2 gap and one scaled line of
label, plus 12. That failure is invisible to `flutter analyze` and only a
pumped widget test catches it — which is why the test below now runs every
screen at two text scales rather than one.

### Buttons come in two heights, on purpose

The **gradient pill** is the money action — checkout, confirm, place the order —
and there is at most one on a screen. Everything else is a page's own main
action, and those are solid `flame` pills. Both are lifted on a shadow washed
in the button's own dark end (`#A81100` at 20–35%) rather than in black: black
under a saturated colour greys the pixels it falls on and reads as dirt, where
the same hue reads as colour bleeding onto paper. The solid ones sit lower than
the gradient one, which is the distinction that was always meant and was
previously not drawn at all — they were flat on a white page with nothing under
them.

**Every neutral here is the storefront's own**, read out of the `:root` block
in `app/globals.css` rather than chosen. That is the point: the app used a
Tailwind slate ramp and the site uses a warm one, and two greys a shade apart
is exactly the difference a shopper cannot name and does notice. If a value
moves on the web, follow it here.

| Token | Value | What it is for |
| --- | --- | --- |
| `canvas` | `#FFFFFF` | The page ground, and it is **white** — it was `#F5F5F5`. The site stands its tiles on white and draws them with a ring; a tinted ground was the app's own invention. |
| `panel` | `#FFFFFF` | Cards, bars, sheets. |
| `edge` | `#DEDEDE` | The 1px ring on every white panel. Load-bearing now: with the canvas white, this is the only thing separating a card from the page. |
| `photo` | `#FBF7F4` | The ground behind a product photograph. Warm on purpose — this catalogue is shot on white, and white sits on warm paper and floats on cool grey. |
| `priceWas` | `#C62828` | A reduced price, and the corner flag. Kept apart from `flame`, which is a button ground picked for white-on contrast. |
| `ink` / `body` / `muted` / `faint` | `#0B0B0B` / `#414346` / `#5D6066` / `#8E9196` | The type ramp, warm rather than slate. |
| `line` / `hairline` | `#E0E0E0` / `#F2F2F2` | Dividers, and the ground under a shimmer. |
| `primary` | `#FF6A00` | Brand orange. The **top** of every gradient, and small graphics — the scarcity dot, a spinner, a focus ring. Never a large flat ground with white text on it: it is 2.9:1 and fails AA at every size. |
| `flame` | `#D62200` | The money colour. Every price, every filled button, the active tab, every text link. White on it is 5.1:1 and it is 5.1:1 on white, so the one value works as a ground **and** as text. |
| `flameSoft` | `#FFF1ED` | The tint behind a selected chip, and the product page's price band. |
| `save` / `saveSoft` | `#15803D` / `#ECFDF3` | A saving, a guarantee — money coming back. |
| `express` | `#FFE000` | The discount flag and the delivery badge. Black on it is 11:1, the most legible pairing in the palette at 9px. |
| `_brandGradient` | `#FF6A00 → #E03400 → #A81100` | **Corner to corner, three stops**, and both changed. A two-stop ramp between two colours half a hue apart is a flat wash with a lean, and on a 56px bar it read as one muddy orange; the diagonal gives it the bar's longest run and the middle stop stops the ends averaging. The dark end went from `#D62200` to `#A81100` for contrast, not taste — every app bar sets white type on this, and white on `#FF6A00` is 2.9:1. On `#A81100` it is 8.1:1, and the bright end is now a corner rather than half the bar. |
| `_BrandSurface` | gradient + white radial at 18% | The gradient with a light on it. A LinearGradient can only ramp along a line; a highlight that falls off in a circle is what makes a coloured surface read as lit rather than filled. White rather than a paler orange, because a paler orange puts the bar back in the 2.9:1 band. **It sizes to its child** — the gradients are `Positioned.fill` — which is what lets the same widget serve an app bar's `flexibleSpace` and the home masthead, where the height constraint is unbounded. |
| `_rPanel` / `_rPhoto` | `16` / `8` | Panel and photograph corners. `_rPanel` was 12. **It governs the chrome only** — sheets, shelf grounds, the terms strip, the panels on account, checkout and the seller pages — and deliberately not the product tile, which is square with a drawn ring because the website's `.tile-card` is. The app draws two radii on purpose now: a square catalogue on softened furniture. 12 sat between the two and read as neither. |
| `_rPill` | `999` | Every button and every filter chip. The pill is what separates a control from the panels it sits on. |

### The product tile

The same tile is drawn in **five** places — Home's rails, Home's grid, Shop,
Search and Today's deals — and a sixth copy sits at the foot of the product
page, in five files. Each file has its own source for it, so a change has to be
made five times or the shop starts showing the same product two different ways.
(This said "four places" and five files, which was already one short: the deals
screen has drawn the tile since it was added.)

Top to bottom:

**It is the website's mobile tile**, matched row by row against
`components/ProductCard.tsx` and the `.tile-card` / `.tile-frame` /
`.product-name` / `.price` rules in `app/globals.css`. Where the two now
differ, they differ on purpose and the code says why.

| Row | Rule |
| --- | --- |
| The card | **Square corners and a 1px `edge` ring.** Both changed: it was a 12px rounded card with no border, floating on grey. The site squares its corners so tiles can touch in a flush grid without a white notch at every shared corner, and draws the ring because its page is white. `p-1.5` — 6px, where this was 8. |
| Photograph | 1:1, never cropped (`BoxFit.contain`), on the warm `photo` ground, **10px corners** to match `.tile-frame`. The corners are on the **Stack**, not the picture — the deal strip is a sibling, and clipping only the picture leaves the strip with square ends. |
| Heart, top left | On a white disc with a `black/5` ring. **The site shows this on hover only**; a hover state on a touch screen is a control that does not exist, so it stays visible here. |
| Discount flag, top right | **White on `priceWas` red, fully rounded** — it was ink on yellow with an 8px corner. The same red the reduced price below is set in, so the flag and the figure agree. |
| Sold out, top right | The site's white pill with `body` type and a `line` ring, not the black chip this drew. It is top-**left** on the site; the heart holds that corner here. |
| Deal strip, across the foot | `SAVE <amount>`, plus `FREE DELIVERY` when the item clears the threshold. **The site puts both below the name**, as a green chip and a row — two rows of tile height for two facts. On a 165px tile that is the difference between the price landing on the first screen and under the fold, so they ride the photograph here. |
| Basket button, bottom right | A white disc with a ring, floating over the strip's end. Opens the product instead when it `hasOptions`. |
| Name | **13px on 17px leading at weight 500**, in a box fixed at two lines (34px — exactly 2 × the leading, and the pair moves together or a one-line name reopens the gap under it), **4px under the photograph** (`pt-1` on the site — this was 8, and the comment beside it claimed a `pt-2` the stylesheet does not have). All three type values are `.product-name` on a phone. They were 12/15 at 300 and moved when the site's did: `.product-name` is 500 now with the phone override removed, and the site's tile runs 13/17 on a phone and 14/18 from `sm` up. The app has no `sm` and takes the phone pair everywhere. The old note said the weight was the one to leave alone, on the argument that the name is the only thing on the tile that is not a claim. That argument measured the name's rank and not whether it could be READ: 300 at 12px is the lightest step of the face at the smallest size on the card, holding a supplier's keyword-stuffed title in a two-line clamp. The hierarchy still has room at 500 — the price is 800 and red on a reduction, three steps clear. **The text sits at the BOTTOM of its box.** The box is two lines tall whatever the name does, which is `min-h-[30px]` on the site; what the site never has to answer is where a one-line name sits inside it, because its phone grid is a masonry. Top-aligned — the default, and what this drew — a short name left 15px of white above the price, and most names in this catalogue are one line. |
| Price | **12px at weight 800**, down from 17 — `.price`, which steps to 14 at `sm`. **1px under the name**, which is the site's `pt-px`; it was 3. Prices still land on one baseline across a grid row, because everything above them is a fixed height — a square photograph, a 4px gap, a two-line box — rather than because the price is pinned to the foot of the cell. Red only when reduced. |
| Old price | **Not drawn on a phone.** `.was-price` is `hidden sm:inline`: the tile has room for one figure. Nothing is lost — the corner flag carries the percentage and the deal strip the shillings. |
| `Only N left` | Only when stock is tracked and ≤ 5. |
| `N sold  ★★★★½ 4.5` | **Below** the price, which is the site's order and the reverse of what this drew. The name says which product it is and the price says whether it is worth a second look; the crowd is corroboration, read once those two have passed. |

Two rules that are easy to break:

- **An app bar's gradient goes in `flexibleSpace`,** not `backgroundColor`,
  which only takes a flat colour — and whatever goes in there needs a sized
  child. A childless `DecoratedBox` has no size, and `AppBar` lays
  `flexibleSpace` out under loose constraints, so it paints nothing at all.
  Every bar now passes `const _BrandSurface(child: SizedBox.expand())`, which
  is that rule and the light bloom in one place.
- **A tile is 274px tall** on a 390-wide phone (`childAspectRatio: 0.646`,
  rails `height: 266`). Added up at 177px wide rather than guessed: 2 of
  border, 12 of padding, a 163 photograph, 4 to the name, a 34 name box, 1, a
  13 price, 16 for the reserved sold-and-stars row, and 16 more for the stock
  line when there is one. That is 245 at rest and 261 at its fullest. The 13px
  on top is not spare — it is what the rows grow by at a 1.3 text scale, which
  is as far as this has been measured. Add a row and this has to move with it,
  or the bottom one is clipped.
- **The leftover height collects above the name, not between the name and the
  price.** The two used to be separated by whatever a short name left behind
  inside its fixed box; bottom-aligning the name moved that slack up against
  the photograph, where it reads as the margin it already is. Anything left
  over after that sits below the last row, inside the drawn edge, which is why
  the cell is measured as tightly as it is.

---

## Verified

All eighteen files were type-checked against **Flutter 3.35 / Dart 3.9** in a
throwaway package with the FlutterFlow-only imports stubbed out:

```
flutter analyze  →  no errors
```

Re-run after the checkout gate and the design pass, with `webview_flutter` in
the throwaway package: still no errors.

The only warnings are `unused_import` on the four FlutterFlow header lines,
which exist in the real project and cannot be removed from these files.

Every screen is also **pumped in a widget test** at 390x844 with no network and
empty preferences, **at a 1.0 and a 1.3 text scale**, and the test fails on any
exception — including a `RenderFlex` overflow, which is the failure `analyze`
is blindest to. Running without a network is deliberate: it drives each screen
into its failure state, which is the path nobody exercises by hand.

Adding the second text scale immediately found two real overflows that the
single-scale run had never reported: the bottom bar clipped its label by 7px on
all five tabbed screens, and the basket's "Delivery at checkout · N-day
returns" line was unflexed in a Row. Both are fixed. **If you add a screen, add
it to both scales** — one of those had been shipping since the bar was written.

The gate has its own test, because "shown once and never again" is behaviour
rather than layout: an unverified device is sent to the verify page, a device
with a token but no proved number is too, and a device with both goes straight
to the checkout.

```
flutter test  →  18 screens at two text scales, plus the gate: all passed
```

One caveat on that test: `flutter_test` draws with a placeholder font where
every glyph is one em wide, so text is far wider there than on a device. An
overflow it reports on a row of text is worth measuring by hand before
believing.

The layout was checked in a browser too, which neither of those can do: the
files were built for the web against the live `kandiug.com` feed and
photographed at 390x844. That pass found an app-bar gradient painting nothing, a
price ellipsising to "UGX 36,0…" on every tile, a hundred pixels of empty white
under every card, and a department row running at about 2.3:1 on the gradient.
None of those were visible in the source, and none of them failed `analyze`.

Two things about the web harness that are **not** true on a phone: product
photographs need a CORS header the image endpoint does not send, and the status
bar has no height, so the app bars sit tighter there than they will on a
device.
