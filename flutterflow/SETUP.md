# Adding the app to FlutterFlow

15 custom widgets. No pubspec changes needed.

**Rules:** paste in order, name each widget exactly as listed, compile after
each one.

---

## Order

**Custom Code → Widgets → `+` → Widget**, then paste. In this order:

| # | Name it exactly | Paste this file |
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

Names must match exactly — they decide the file path the imports use.

---

## On every paste

1. Select all in the editor, paste the whole file over it.
2. Delete these two lines if FlutterFlow added them:
   ```dart
   import '/backend/backend.dart';
   import '/backend/supabase/supabase.dart';
   ```
3. Add the parameters (below).
4. Compile. Wait for the tick before the next one.

---

## After 1 and 2, stop and check

Put both on a blank page and run:

- `KandiDesign` → palette and type scale.
- `KandiCartStore` → your basket, reading `kandi-cart-v2`.

Both render → carry on with 3–15.

---

## Parameters

### `KandiHomeScreen`
- `onOpenProduct` — Action, **one Integer parameter**
- `onOpenCategory` — Action, **one String parameter**
- `onOpenSearch` — Action
- `onOpenCart` — Action

### `KandiProductScreen`
- `productId` — Integer, **required**
- `onOpenCart` — Action
- `onOpenSeller` — Action, one String parameter
- `onShare` — Action, one String parameter

### `KandiBrowseScreen`
- `query` — String
- `category` — String
- `title` — String
- `autofocus` — Boolean (`true` for the Search tab)
- `onOpenProduct` — Action, one Integer parameter
- `onOpenCart` — Action

### Rest

| Widget | Parameters |
|---|---|
| `KandiOrdersScreen` | `onSignIn`, `onStartShopping` |
| `KandiAuthScreen` | `onSignedIn` |
| `KandiAccountScreen` | `onSignIn`, `onOpenOrders`, `onOpenWishlist`, `onOpenAddresses`, `onOpenHelp`, `onOpenSellerCentre`, `onSignedOut` |
| `KandiAddressesScreen` | `pickMode` (Boolean), `onPicked` |
| `KandiCartScreen` | `onCheckout`, `onKeepShopping`, `freeDeliveryFrom` (Double) |
| `KandiCheckoutScreen` | `onOrderPlaced`, `onBackToCart` |
| `KandiPaymentScreen` | `orderId` (Integer, required), `orderNumber` (String), `onDone`, `onOpenOrder`, `onRetry` |
| `KandiSupportScreen` | `phone`, `whatsapp`, `email` (Strings), `freeDeliveryFrom` (Double), `returnsDays` (Integer), `onCall`, `onWhatsApp` |
| `KandiSellerScreen` | `onOpenWeb` — Action, one String parameter |

All unlisted types are Action.

Free extra screens inside those files, reached from a page rather than the
palette: `KandiOrderScreen`, `KandiWishlistScreen`, `KandiOrderPlacedScreen`,
`KandiReviewScreen`.

---

## Skip these three

- **`onAddToCart`** and **`onOpenOrder`** — leave undeclared. Everything works;
  the tile loses its quick-add button.
- **`KandiShell`** — use FlutterFlow's own bottom navigation instead, with
  `KandiHomeScreen`, `KandiBrowseScreen`, `KandiCartScreen`,
  `KandiAccountScreen` on four pages.
- **`index.dart`** — do not create it. FlutterFlow generates it.

---

## Migrating

Add all 15, then re-point one page at a time. Delete an old widget only once its
replacement is live. Nothing here collides with `KandiCheckout`,
`ProductDetailPage`, `SearchPage` etc., so both sets can coexist.

---

## Errors

| Error | Fix |
|---|---|
| `Target of URI doesn't exist: '/custom_code/widgets/kandi_….dart'` | That widget is missing or misnamed |
| `Undefined name 'KandiColors'` | `KandiDesign` not added yet, or misnamed |
| Every widget breaks at once | The two `backend` imports are in the last file you pasted |
| Screen compiles, shows nothing | Parameter name typo — check case |
| Basket looks empty | Check `KandiCartStore` reads `kandi-cart-v2` |

---

Reasoning behind all of this is in `README.md`.
