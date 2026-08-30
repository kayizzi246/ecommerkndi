# Adding the app to FlutterFlow

Thirteen custom widgets — one per page. **No parameters to declare on any of them.**
No pubspec changes needed.

| Name it exactly | Paste this file |
|---|---|
| `KandiHomeScreen` | `kandi_home_screen.dart` |
| `KandiProductScreen` | `kandi_product_screen.dart` |
| `KandiCartScreen` | `kandi_cart_screen.dart` |
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
Search, Shop, Saved and Account; Cart opens Checkout; Account opens Orders and
the Seller Centre; Product opens Cart and, sideways, another Product. Dart
resolves those once all thirteen exist, so the project compiles when the set is
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

There is no step for parameters. Leave the parameter list empty on all thirteen.

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
Home ─┬─ tap a card ──────────→ Product ──→ Cart ──→ Checkout ──→ (website payment)
      ├─ search bar ──────────→ Search  ──→ Product
      ├─ a department pill ───→ Shop    ──→ Product
      ├─ bottom bar: Shop ────→ Shop
      ├─ bottom bar: Saved ───→ Saved   ──→ Product
      ├─ bottom bar: Basket ──→ Cart
      └─ bottom bar: Account ─→ Account ─┬→ Orders
                                         ├→ Seller Centre ─┬→ Seller Orders
                                         │                 ├→ Seller Products
                                         │                 └→ Commissions
                                         └→ Saved / Cart

Product ──→ "You might also like" ──→ another Product (in place)
```

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

**Checkout** — collects name, phone, town and address, saves them for next time,
then hands the shopper to the website's checkout with the basket on the URL.

> **Payment happens on the website, on purpose.** The site is where Pesapal is
> wired, where the IPN lands, where delivery is quoted from the address and where
> the order is written to WooCommerce. Rebuilding that in the app would be a
> second implementation of the one thing that must never be subtly wrong. The
> page says so before the shopper taps, so being handed to a browser is not a
> surprise.

**Search** — 400ms debounce, two-character minimum, and a generation counter so a
slow answer for `sho` cannot overwrite a fast one for `shoes`.

**Shop** — browse by department with server-side sorting. Opened with no
department it lists the departments instead of an empty grid.

**Saved** — the wishlist. Makes no network request at all: it stores enough of
each product to draw a tile, so it opens instantly and works with no signal.

**Account** — sign in, and the links out. Browsing, the basket and saved items
all work signed out; the only thing an account buys is order history, and the
page says that rather than blocking the app behind a form. Registration and
password resets link to the website.

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

### What stays on the website

Adding a product and store settings. The split is by whether the task is
**reading or writing**, not by what was easy: those two are forms — a media
picker, a variations table, a payout account — and a cramped version of either
on a phone is how a seller publishes at the wrong price or types the wrong MoMo
number.

---

## The design language

Every page carries its own copy of the palette — nothing is shared, for the
reason at the top of this file — so these values have to be kept in step by
hand. If you change one, change all thirteen.

| Token | Value | What it is for |
| --- | --- | --- |
| `canvas` | `#F5F5F5` | The page ground. Neutral, not the blue-cast grey it was: the chrome is warm now and a cool ground fights it. |
| `panel` | `#FFFFFF` | Cards, bars, sheets. |
| `primary` | `#FF6A00` | Brand orange. The **top** of every gradient, and small graphics — the scarcity dot, a spinner, a focus ring. Never a large flat ground with white text on it: it is 2.9:1 and fails AA at every size. |
| `flame` | `#D62200` | The money colour. Every price, every filled button, the active tab, every text link. White on it is 5.1:1 and it is 5.1:1 on white, so the one value works as a ground **and** as text. |
| `flameSoft` | `#FFF1ED` | The tint behind a selected chip, and the product page's price band. |
| `save` / `saveSoft` | `#15803D` / `#ECFDF3` | A saving, a guarantee — money coming back. |
| `express` | `#FFE000` | The discount flag and the delivery badge. Black on it is 11:1, the most legible pairing in the palette at 9px. |
| `_brandGradient` | `#FF6A00 → #D62200` | Left to right. Carries every app bar, the home band, and the primary buttons. |
| `_rPanel` / `_rPhoto` | `12` / `8` | Card and photograph corners. |
| `_rPill` | `999` | Every button and every filter chip. The pill is what separates a control from the panels it sits on. |

Two rules that are easy to break:

- **An app bar's gradient goes in `flexibleSpace`,** not `backgroundColor`,
  which only takes a flat colour — and it needs a `SizedBox.expand` child. A
  childless `DecoratedBox` has no size, and `AppBar` lays `flexibleSpace` out
  under loose constraints, so it paints nothing at all.
- **A tile is 300px tall** on a 390-wide phone (`childAspectRatio: 0.57`, rails
  `height: 302`). That is the fullest card added up row by row, not a guess.
  Add a row to the card and this has to move with it, or the bottom one is
  clipped.

---

## Verified

All thirteen files were type-checked against **Flutter 3.35 / Dart 3.9** in a
throwaway package with the FlutterFlow-only imports stubbed out:

```
flutter analyze  →  No issues found!
```

The layout was checked too, which `analyze` cannot do: the same thirteen files
were built for the web against the live `kandiug.com` feed and photographed at
390x844. That pass is what found the app-bar gradient painting nothing, the
price ellipsising to "UGX 36,0…" on every tile, a hundred pixels of empty white
under every card, and a department row running at about 2.3:1 on the gradient.
None of those were visible in the source.

Two things about the web harness that are **not** true on a phone: product
photographs need a CORS header the image endpoint does not send, and the status
bar has no height, so the app bars sit tighter there than they will on a
device.
