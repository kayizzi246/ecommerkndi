# Adding these to FlutterFlow, step by step

Fifteen files. Budget an hour or so — most of it is pasting, and the only part
that needs care is declaring each widget's parameters.

**Nothing here needs a pubspec change.** The new files use `google_fonts`,
`cached_network_image`, `http` and `shared_preferences` — all four are already
in the project, because the old screens used them plus `url_launcher`.

---

## The old widgets can stay while you do this

Your project still has the previous custom widgets in it — `KandiCheckout`,
`KandiOrdersPage`, `KandiSellerCentre`, `ProductDetailPage`, `SearchPage`,
`ShoppingCartPage`, `WishlistPage` and the rest. Deleting the `.dart` files
from the repo did not remove them from FlutterFlow, and it did not need to.

**Nothing here collides with them**, which was checked rather than assumed:

- No class name appears in both. `KandiCheckout` and `KandiCheckoutScreen` are
  different names; so are `KandiOrdersPage` and `KandiOrdersScreen`.
- Every public top-level name in the new files is `kandi`-prefixed —
  `kandiPrice`, `kandiCompact`, `kandiAppBar`, `kandiToast`, `kandiApiBase`.
  Everything else is `_`-private and therefore file-scoped.
- Every top-level name in the OLD widgets is private. That is why they could
  each carry their own `_ugx` and `_price` without clashing before, and it is
  why they cannot clash with these.

This matters because `index.dart` re-exports everything: one duplicated public
name would break the whole build.

**So migrate page by page.** Add all fifteen, then re-point one page at a time
and check it. Delete an old widget only once its replacement is live on the
page that used it. A big-bang switch gives you fifteen new widgets and seven
broken pages at the same moment, with no way to tell which change caused what.

---

## Widget names are load-bearing

Each file imports the ones it needs **directly**:

```dart
import '/custom_code/widgets/kandi_design.dart';
```

That path is not decorative. FlutterFlow writes a custom widget to
`lib/custom_code/widgets/<widget_name_in_snake_case>.dart` — so a widget named
`KandiDesign` lands at `kandi_design.dart` and the import resolves. Name it
`KandiDesignPreview` and it lands at `kandi_design_preview.dart`, the import
finds nothing, and every screen fails.

**Use the exact names in the sections below.** All fifteen are chosen so their
snake_case matches the file name in this folder.

### Why not rely on index.dart

FlutterFlow generates `/custom_code/widgets/index.dart` and re-exports each
widget with a `show <WidgetName>` clause — so it carries the WIDGET across
files and nothing else. That was enough for the old screens, which only ever
referenced each other's widget classes. It is not enough here: every screen
needs `KandiColors`, `KandiType`, `KandiCache` and `KandiCart`, none of which
is a widget.

Importing the sibling file directly takes the whole of it, and works whether or
not index.dart re-exports anything.

---

## Before you start

**Order is still what it was**, and now for a second reason: a direct import of
a file that does not exist yet is an error, not a warning.

**Order is not optional.** Every screen names `KandiColors`, `KandiType` and
the rest directly. FlutterFlow resolves that through
`/custom_code/widgets/index.dart`, which it regenerates as widgets are added —
so a screen pasted before the file that declares those names fails to compile
with a wall of "undefined name" errors.

Files 1–6 declare things the others read. Files 7–15 can go in any order among
themselves.

---

## The paste itself

Every file starts with a header FlutterFlow also generates. Do this:

1. **Custom Code → Widgets → `+ Add`**
2. Name it **exactly** the class name from the table below — FlutterFlow uses
   this for the file name and the widget palette entry.
3. In the code editor, **select all and paste the whole file over it.**
4. Look at the top of what you pasted. It must **not** contain these two lines:

   ```dart
   import '/backend/backend.dart';
   import '/backend/supabase/supabase.dart';
   ```

   If FlutterFlow has added them, delete them. This project has neither file,
   and their presence fails the web build in *every* custom widget at once —
   which looks like fifteen broken files rather than one bad paste.

5. Declare the parameters (right-hand panel) from the table.
6. Hit the compile/refresh button and wait for the tick before moving on.

> Do them one at a time and compile after each. Fifteen pastes then one compile
> means an error you cannot place.

---

## 1. `kandi_design.dart`

**Widget name:** `KandiDesign`  ← exactly this
**Parameters:** none beyond the automatic `width` / `height`.

This is the whole design system — palette, type, spacing, the cache, the HTTP
layer, the product model, the tile, the rail, the skeletons. Everything else
depends on it.

**Check it landed:** drop `KandiDesign` on a blank test page and run.
You should see the orange swatches, the type scale, and a price in tabular
figures. If that renders, the foundation is in.

---

## 2. `kandi_cart_store.dart`

**Widget name:** `KandiCartStore`  ← exactly this
**Parameters:** none.

The basket, shared by five screens. Also gives you `KandiCartBadge`.

**Check it landed:** drop `KandiCartStore` on the test page. It shows the live
basket and the storage key. It should read `kandi-cart-v2` — the same key the
old app wrote, so an existing basket survives the switch.

---

## 3. `kandi_auth_screen.dart`

**Widget name:** `KandiAuthScreen`

| Parameter | Type | Notes |
|---|---|---|
| `mode` | *(leave undeclared)* | Defaults to sign-in. Only needed if you want a page that opens straight on "join". |
| `onSignedIn` | Action | Fires after a successful sign-in. Point it at "navigate back" or the home tab. |

Also declares `KandiAuth`, which the account and support screens read.

---

## 4. `kandi_orders_screen.dart`

**Widget name:** `KandiOrdersScreen`

| Parameter | Type | Notes |
|---|---|---|
| `onOpenOrder` | Action | Takes the order. See the note below on this one. |
| `onSignIn` | Action | Navigate to the auth page. |
| `onStartShopping` | Action | Back to the home tab. |

Also gives you `KandiOrderScreen` (the detail page) and `KandiSession`.

**On `onOpenOrder`:** it hands back a `KandiOrder` object, which FlutterFlow's
action parameters cannot carry. The simplest wiring is to declare it as a plain
Action with **no** parameters and navigate to a page holding
`KandiOrderScreen`, passing the order through an App State variable you set
just before. If that is fiddly, leave it undeclared for now — the list works
without it and the row simply does not open.

---

## 5. `kandi_account_screen.dart`

**Widget name:** `KandiAccountScreen`

| Parameter | Type | Notes |
|---|---|---|
| `onSignIn` | Action | To the auth page. |
| `onOpenOrders` | Action | To the orders page. |
| `onOpenWishlist` | Action | To a page holding `KandiWishlistScreen`. |
| `onOpenAddresses` | Action | To a page holding `KandiAddressesScreen`. |
| `onOpenHelp` | Action | To a page holding `KandiSupportScreen`. |
| `onOpenSellerCentre` | Action | To a page holding `KandiSellerScreen`. |
| `onSignedOut` | Action | Usually "go to home tab". |

Also gives you `KandiWishlistScreen`, `KandiWishlist` and
`KandiWishlistButton`.

---

## 6. `kandi_addresses_screen.dart`

**Widget name:** `KandiAddressesScreen`

| Parameter | Type | Notes |
|---|---|---|
| `pickMode` | Boolean | `false` for the account page, `true` when opened from checkout to choose one. |
| `onPicked` | Action | Only used in pick mode. |

---

## 7. `kandi_home_screen.dart`

**Widget name:** `KandiHomeScreen`

| Parameter | Type | Notes |
|---|---|---|
| `onOpenProduct` | Action **with one Integer parameter** | The product id. |
| `onOpenCategory` | Action **with one String parameter** | The category slug. |
| `onOpenSearch` | Action | Select the Search tab. |
| `onOpenCart` | Action | Select the Cart tab. |
| `onAddToCart` | Action | See below. |

**On `onAddToCart`:** it hands back a whole `KandiProduct`, which an action
parameter cannot carry. Leave it undeclared to start — the tile simply does not
show its quick-add button, and everything else works. When you want it, the
cleanest route is a Custom Action in Dart that takes the product and calls
`KandiCart.add(...)`; the README has the call.

---

## 8. `kandi_product_screen.dart`

**Widget name:** `KandiProductScreen`

| Parameter | Type | Notes |
|---|---|---|
| `productId` | Integer | **Required.** Pass the id from wherever you navigated. |
| `onAddToCart` | Action | Carries the product, variation and quantity — same caveat as above. |
| `onBuyNow` | Action | Same, then straight to checkout. |
| `onOpenCart` | Action | |
| `onOpenSeller` | Action with one String parameter | Store slug. |
| `onShare` | Action with one String parameter | The product URL. |

---

## 9. `kandi_browse_screen.dart`

**Widget name:** `KandiBrowseScreen`

| Parameter | Type | Notes |
|---|---|---|
| `query` | String | Blank unless opening a preset search. |
| `category` | String | The slug, when opening a department. |
| `title` | String | What the bar says. |
| `autofocus` | Boolean | `true` for the Search tab, `false` for a department. |
| `onOpenProduct` | Action with Integer | |
| `onAddToCart` | Action | Same caveat. |
| `onOpenCart` | Action | |

This one screen is both search and category — the old app had two.

---

## 10–15, the rest

| # | File | Widget name | Parameters worth declaring |
|---|---|---|---|
| 10 | `kandi_cart_screen.dart` | `KandiCartScreen` | `onCheckout` (Action), `onKeepShopping` (Action), `freeDeliveryFrom` (Double) |
| 11 | `kandi_checkout_screen.dart` | `KandiCheckoutScreen` | `onOrderPlaced` (Action), `onBackToCart` (Action) |
| 12 | `kandi_payment_screen.dart` | `KandiPaymentScreen` | `orderId` (Integer, required), `orderNumber` (String), `onDone`, `onOpenOrder`, `onRetry` |
| 13 | `kandi_support_screen.dart` | `KandiSupportScreen` | `phone`, `whatsapp`, `email` (Strings), `freeDeliveryFrom` (Double), `returnsDays` (Integer), `onCall`, `onWhatsApp` |
| 14 | `kandi_seller_screen.dart` | `KandiSellerScreen` | `onOpenWeb` (Action with one String parameter) |
| 15 | `kandi_shell.dart` | `KandiShell` | See below |

File 12 also gives you `KandiOrderPlacedScreen` (the cash-on-delivery
confirmation) and file 13 also gives you `KandiReviewScreen`.

---

## 15. The shell

`KandiShell` takes the four tabs **as widgets**, which FlutterFlow's parameter
panel cannot express — a widget is not a parameter type there.

So the shell is the one file you drive from a **page** rather than from the
widget panel. Two ways:

**Easiest:** skip `KandiShell` entirely and use FlutterFlow's own bottom
navigation, with `KandiHomeScreen`, `KandiBrowseScreen`, `KandiCartScreen` and
`KandiAccountScreen` on four pages. You lose the kept-alive tabs (each tab
rebuilds when you return to it), but everything works and the cache still makes
the second visit fast.

**Better, if you are comfortable in code:** make one Custom Widget with no
parameters that returns `KandiShell` with the four screens constructed inside
it, wiring the callbacks in Dart. That keeps the scroll position and the
lazy-build behaviour, which is most of why it feels quick.

Start with the easy route. The shell is an improvement, not a requirement.

---

## If something goes wrong

**"Undefined name `KandiColors`"** — `kandi_design.dart` is not in yet, or the
widget is not named exactly `KandiDesign`. Check the name first: an import of
`kandi_design.dart` cannot resolve if FlutterFlow filed the widget as
`kandi_design_preview.dart`.

**"Target of URI doesn't exist: '/custom_code/widgets/kandi_….dart'"** — same
cause. The widget that file belongs to is either missing or misnamed. The name
must snake_case to the path exactly.

**Every widget breaks at once** — check for the two `backend` imports at the
top of whichever file you pasted last. That is the failure mode described in
step 4, and it takes the whole build down rather than one file.

**A screen compiles but shows nothing** — check the parameter names match the
table exactly, including case. A mistyped parameter is silently null.

**The basket looks empty after switching** — check `KandiCartStore` shows
`kandi-cart-v2`. If it does and the basket is still empty, the old basket was
genuinely empty.
