# Adding the app to FlutterFlow

Fifteen custom widgets. Budget an hour. Most of it is pasting; the only parts
that need care are the **widget names** and the **order**, and both are
explained before the list.

---

## Three things to know first

### 1. No pubspec changes

The new files use `google_fonts`, `cached_network_image`, `http` and
`shared_preferences`. All four are already in the project — the old screens
used those plus `url_launcher`.

### 2. The widget name decides the file name, and the imports depend on it

Each file imports the ones it needs by path:

```dart
import '/custom_code/widgets/kandi_design.dart';
```

FlutterFlow writes a custom widget to
`lib/custom_code/widgets/<widget_name_in_snake_case>.dart`. So a widget named
`KandiDesign` lands at `kandi_design.dart` and that import resolves. Name it
`KandiDesignPreview` and it lands at `kandi_design_preview.dart` — the import
finds nothing, and every screen that depends on it fails.

**Use the exact names in the table below.** All fifteen were chosen so their
snake_case matches the file name in this folder.

> **Why not just use `index.dart`?** FlutterFlow generates
> `/custom_code/widgets/index.dart` and re-exports each widget with a
> `show <WidgetName>` clause — so it carries the widget class across files and
> nothing else. That was enough for the old screens, which only ever referenced
> each other's widgets. It is not enough here: every screen needs
> `KandiColors`, `KandiType`, `KandiCache` and `KandiCart`, none of which is a
> widget. A direct import takes the whole file.

### 3. The old widgets can stay while you do this

Your project still has `KandiCheckout`, `KandiOrdersPage`, `KandiSellerCentre`,
`ProductDetailPage`, `SearchPage`, `ShoppingCartPage` and `WishlistPage`.
Deleting the `.dart` files from the repo did not remove them from FlutterFlow,
and it did not need to.

**Nothing here collides with them**, which was checked rather than assumed: no
class name appears in both sets, every public top-level name in the new files
is `kandi`-prefixed, and every top-level name in the old widgets is private.

So **migrate page by page**. Add the fifteen, re-point one page, check it, then
move on. Delete an old widget only when its replacement is live on the page
that used it. A big-bang switch gives you fifteen new widgets and seven broken
pages in the same moment, with nothing to say which change caused what.

---

## The order

Not optional, for two reasons: a screen needs the names the earlier files
declare, **and** a direct import of a file that does not exist yet is a hard
error rather than a warning.

| # | Widget name — use exactly | File to paste |
|---|---|---|
| 1 | `KandiDesign` | `kandi_design.dart` |
| 2 | `KandiCartStore` | `kandi_cart_store.dart` |
| 3 | `KandiOrdersScreen` | `kandi_orders_screen.dart` |
| 4 | `KandiAuthScreen` | `kandi_auth_screen.dart` |
| 5 | `KandiAccountScreen` | `kandi_account_screen.dart` |
| 6 | `KandiAddressesScreen` | `kandi_addresses_screen.dart` |
| 7 | `KandiHomeScreen` | `kandi_home_screen.dart` |
| 8 | `KandiProductScreen` | `kandi_product_screen.dart` |
| 9 | `KandiBrowseScreen` | `kandi_browse_screen.dart` |
| 10 | `KandiCartScreen` | `kandi_cart_screen.dart` |
| 11 | `KandiCheckoutScreen` | `kandi_checkout_screen.dart` |
| 12 | `KandiPaymentScreen` | `kandi_payment_screen.dart` |
| 13 | `KandiSupportScreen` | `kandi_support_screen.dart` |
| 14 | `KandiSellerScreen` | `kandi_seller_screen.dart` |
| 15 | `KandiShell` | `kandi_shell.dart` |

1–6 declare things the later files read. 7–14 can go in any order among
themselves. 15 is last because it references four of them.

---

## The paste, step by step

For each row in that table:

1. **Custom Code → Widgets → the green `+` → Widget**
2. Name it **exactly** as the table says. Case matters.
3. In the code editor, **select all and paste the whole file over it.**
4. **Check the top of what you pasted.** It must **not** contain these:

   ```dart
   import '/backend/backend.dart';
   import '/backend/supabase/supabase.dart';
   ```

   FlutterFlow adds them for projects with Firestore or Supabase. Yours has
   neither. If they appear, delete them — their presence fails the web build in
   *every* custom widget at once, which looks like fifteen broken files rather
   than one bad paste.

5. Declare the parameters from the reference below.
6. Compile, and wait for the tick before the next one.

> Compile after each. Fifteen pastes then one compile gives you an error you
> cannot place.

---

## Check after the first two

Paste 1 and 2, then stop and put both on a blank test page.

- **`KandiDesign`** renders the palette and the type scale. Right orange, prices
  in tabular figures → the foundation is in.
- **`KandiCartStore`** shows your live basket and the storage key. It should
  read `kandi-cart-v2` — the same key the old app wrote, so an existing basket
  survives the switch.

Neither is meant to ship on a shopper-facing screen. If both render, the
remaining thirteen are the same motion.

---

## Parameters

Only the ones worth declaring are listed. Anything omitted has a sensible
default.

### 7. `KandiHomeScreen`

| Parameter | Type |
|---|---|
| `onOpenProduct` | Action **with one Integer parameter** (the product id) |
| `onOpenCategory` | Action **with one String parameter** (the slug) |
| `onOpenSearch` | Action |
| `onOpenCart` | Action |

### 8. `KandiProductScreen`

| Parameter | Type |
|---|---|
| `productId` | Integer — **required** |
| `onOpenCart` | Action |
| `onOpenSeller` | Action with one String parameter |
| `onShare` | Action with one String parameter |

### 9. `KandiBrowseScreen`

| Parameter | Type |
|---|---|
| `query` | String — blank unless opening a preset search |
| `category` | String — the slug, when opening a department |
| `title` | String — what the bar says |
| `autofocus` | Boolean — `true` for the Search tab |
| `onOpenProduct` | Action with one Integer parameter |
| `onOpenCart` | Action |

This one screen is both search and category. The old app had two.

### The rest

| Widget | Parameters |
|---|---|
| `KandiOrdersScreen` | `onSignIn`, `onStartShopping` (Actions) |
| `KandiAuthScreen` | `onSignedIn` (Action) |
| `KandiAccountScreen` | `onSignIn`, `onOpenOrders`, `onOpenWishlist`, `onOpenAddresses`, `onOpenHelp`, `onOpenSellerCentre`, `onSignedOut` (all Actions) |
| `KandiAddressesScreen` | `pickMode` (Boolean), `onPicked` (Action) |
| `KandiCartScreen` | `onCheckout`, `onKeepShopping` (Actions), `freeDeliveryFrom` (Double) |
| `KandiCheckoutScreen` | `onOrderPlaced`, `onBackToCart` (Actions) |
| `KandiPaymentScreen` | `orderId` (Integer, required), `orderNumber` (String), `onDone`, `onOpenOrder`, `onRetry` (Actions) |
| `KandiSupportScreen` | `phone`, `whatsapp`, `email` (Strings), `freeDeliveryFrom` (Double), `returnsDays` (Integer), `onCall`, `onWhatsApp` (Actions) |
| `KandiSellerScreen` | `onOpenWeb` (Action with one String parameter) |

Several files carry a second screen you get for free and reach from a page
rather than the palette: `KandiOrderScreen` (order detail),
`KandiWishlistScreen`, `KandiOrderPlacedScreen` (the cash-on-delivery
confirmation) and `KandiReviewScreen`.

---

## Two callbacks that do not fit, and the shell

Worth knowing before you go hunting for a setting that is not there.

**`onAddToCart` and `onOpenOrder`** hand back a whole object — a `KandiProduct`,
a `KandiOrder` — and a FlutterFlow action parameter cannot carry one.

*Leave them undeclared to start.* Everything still works; the product tile
simply does not show its quick-add button, and an order row does not open. When
you want them, the route is a **Custom Action** in Dart that takes the object
and calls `KandiCart.add(...)` — the README has the call.

**`KandiShell`** takes the four tabs as widgets, which the parameter panel
cannot express either.

*Start without it.* Use FlutterFlow's own bottom navigation with
`KandiHomeScreen`, `KandiBrowseScreen`, `KandiCartScreen` and
`KandiAccountScreen` on four pages. You lose the kept-alive tabs — each rebuilds
when you return to it — but everything works, and the cache still makes the
second visit fast.

When you want the real thing: one custom widget with no parameters that returns
`KandiShell` with the four screens constructed inside it, wiring the callbacks
in Dart. The shell is an improvement, not a requirement.

---

## If something goes wrong

**`Target of URI doesn't exist: '/custom_code/widgets/kandi_….dart'`**
The widget that file belongs to is missing or misnamed. The name has to
snake_case to the path exactly — see point 2 at the top.

**`Undefined name 'KandiColors'`**
`kandi_design.dart` is not in yet, or its widget is not named exactly
`KandiDesign`.

**Every widget breaks at once**
Check the last file you pasted for the two `backend` imports. That failure takes
the whole build down rather than one file.

**A screen compiles but shows nothing**
Check the parameter names against the table, including case. A mistyped
parameter is silently null.

**The basket looks empty after switching**
Put `KandiCartStore` on a page and confirm it reads `kandi-cart-v2`. If it does,
the old basket was genuinely empty.

---

## How these were checked

Every file was run through `dart analyze` against a real Flutter SDK, not read
over. The harness strips the `/flutter_flow/` imports, rewrites
`import '/custom_code/widgets/kandi_x.dart'` to `import 'kandi_x.dart'` — the
same import, addressed relatively — and analyses.

It is deliberately not allowed to paper over a missing import: deleting one
import line from the home screen produces 119 errors, and putting it back
produces none. A check that cannot fail is not a check.
