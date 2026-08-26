# The Kandi app, rebuilt

Fifteen files. **Start with `SETUP.md`** — it walks through adding them to
FlutterFlow one at a time, with the parameters each one needs.


---

## Paste order

FlutterFlow resolves cross-file references through
`/custom_code/widgets/index.dart`, which it regenerates as widgets are added.
Every screen below names `KandiColors`, `KandiType` and the rest directly, so
**the design system has to exist first** or the pastes fail one after another
with undefined-name errors.

Add each under **Custom Code → Widgets → Add**, in this order:

| # | File | What it gives the project |
|---|------|---------------------------|
| 1 | `kandi_design.dart` | Palette, type scale, spacing, cache, HTTP, product model, tile, rail, skeletons |
| 2 | `kandi_cart_store.dart` | The basket, shared by five screens |
| 3 | `kandi_auth_screen.dart` | Sign in / join / reset, and `KandiAuth` |
| 4 | `kandi_orders_screen.dart` | Order list, order detail, and `KandiSession` |
| 5 | `kandi_account_screen.dart` | Account hub, wishlist screen, and `KandiWishlist` |
| 6 | `kandi_addresses_screen.dart` | Address book, and `KandiAddresses` |
| 7 | `kandi_home_screen.dart` | Home |
| 8 | `kandi_product_screen.dart` | Product |
| 9 | `kandi_browse_screen.dart` | Search **and** category |
| 10 | `kandi_cart_screen.dart` | Cart |
| 11 | `kandi_checkout_screen.dart` | Checkout |
| 12 | `kandi_payment_screen.dart` | Payment wait, and order confirmation |
| 13 | `kandi_support_screen.dart` | Help, contact, and write-a-review |
| 14 | `kandi_seller_screen.dart` | Seller Centre |
| 15 | `kandi_shell.dart` | The four-tab shell that holds it together |

Files 2–6 come before the screens because they declare stores the screens read.
Within 7–14 the order does not matter.

### Check it landed

`kandi_design.dart` exports `KandiDesignPreview` — drop it on a blank page and
it renders the palette and the type scale. If the swatches are the right orange
and the prices are in tabular figures, the paste worked. `kandi_cart_store.dart`
exports `KandiCartProbe`, which shows the live basket and the storage key it is
reading.

Neither is meant to ship on a shopper-facing screen.

---

## Wiring the shell

`KandiShell` takes the four tabs as widgets rather than building them, because
it owns the chrome and nothing about what is inside. Navigation is handed in as
callbacks for the same reason: FlutterFlow owns the route table, and a custom
widget calling `Navigator.pushNamed` is guessing at names the designer can
rename in the builder at any time.

```dart
KandiShell(
  home: KandiHomeScreen(
    onOpenProduct: (id) => /* push the product page */,
    onOpenCategory: (slug) => /* push browse with that category */,
    onOpenSearch: () => /* select the Search tab */,
    onAddToCart: (product) => KandiCart.add(
      productId: product.id,
      name: product.name,
      price: product.price.toDouble(),
      image: product.image,
      slug: product.slug,
    ),
  ),
  browse: KandiBrowseScreen(autofocus: true, onOpenProduct: ...),
  cart: KandiCartScreen(onCheckout: ...),
  account: KandiAccountScreen(onOpenOrders: ...),
)
```

A product with `hasOptions` should open the product page rather than being added
straight to the basket — the tile's icon already says which it is, and adding a
variable product without a variation is how an order arrives with no size on it.

---

## Two things that are missing on purpose

Both are blocked on the same thing: **a pasted custom widget cannot add a
pubspec dependency**, and a missing package fails the entire web build, in every
widget at once.

**Google sign-in.** `google_sign_in` is not in the pubspec. The server half
already exists — `/api/app/auth/google` and `/api/app/seller/google` both take a
credential and return a session. To restore it: add `google_sign_in: ^6.2.2`
under Settings → App Settings → Pubspec Dependencies, then a **web** OAuth client
id passed as `--dart-define=GOOGLE_SERVER_CLIENT_ID=…`. Without a
`serverClientId` the plugin returns a null `idToken` on Android, so sign-in
appears to work and the server gets nothing to verify.

**Current location** on the address form. `geolocator` is not in the pubspec.
Add `geolocator: ^11.0.0` plus the location permission strings for both
platforms.

Do not add either import without the pubspec entry first.

---

## What the app now has that it did not

- **A tab shell.** Twelve screens with nothing holding them together meant a
  shopper going home → search → cart → home had four copies of the home screen
  stacked underneath them.
- **Order detail.** The list existed and led nowhere, so "where is my order" had
  no answer beyond a status word.
- **A payment screen.** Card and mobile-money orders are real and unpaid between
  leaving for Pesapal and coming back, and the app had nowhere to put that.
- **Write a review.** `/api/products/[id]/reviews` accepted a POST all along and
  nothing ever called it.
- **Help and contact**, answered from the shop's own settings so the delivery
  threshold and returns window cannot go stale.
- **An address book.** WooCommerce holds one shipping address per customer, so
  this is local — locally the app can hold several.

## And what it stopped doing

- **Refetching everything, always.** There was no caching anywhere: every screen
  fetched in `initState` and discarded the result on pop. `KandiCache` is
  read-through with stale-while-revalidate, and screens seed from
  `KandiCache.peek` synchronously so a second visit paints on the first frame.
- **Decoding images at full size.** `KandiImage` sets `memCacheWidth` from the
  box it is drawn into; a 1200px photograph in a 170px tile was being held at
  roughly fifty times the pixels needed.
- **Building lists eagerly.** Several rails were `ListView(children: [...])`,
  which builds every child before the first frame.
- **Twelve copies of the palette.** They had already drifted — `_kPrimarySoft`
  was `#FFF1E6` on one screen and `#FFF3E8` on another, and app ink was
  `#171717` against the website's `#111827`.

---

## Verifying changes

Every file here was checked with `dart analyze` against a real Flutter SDK, not
read over. The harness lives in the scratchpad and does three things: strips the
FlutterFlow-only imports (they resolve only inside a FlutterFlow project),
replaces them with relative imports of every sibling — which is what
`index.dart` actually does — and runs the analyser.

That middle step matters. The first run reported fourteen undefined-name errors
that were not real, because the harness was only importing the design system
while the code legitimately referenced `KandiCart` across files.
