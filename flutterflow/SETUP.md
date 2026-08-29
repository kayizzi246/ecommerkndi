# Adding the app to FlutterFlow

15 custom widgets. **No parameters to declare on any of them.** No pubspec
changes needed.

**Rules:** paste in order, name each widget exactly as listed, compile after
each one.

---

## Order

**Custom Code → Widgets → `+` → Widget**, then paste. In this order:

| # | Name it exactly | Paste this file |
|---|---|---|
| 1 | `KandiDesign` | `kandi_design.dart` |
| 2 | `KandiCartStore` | `kandi_cart_store.dart` |
| 3 | `KandiAuthScreen` | `kandi_auth_screen.dart` |
| 4 | `KandiSupportScreen` | `kandi_support_screen.dart` |
| 5 | `KandiProductScreen` | `kandi_product_screen.dart` |
| 6 | `KandiOrdersScreen` | `kandi_orders_screen.dart` |
| 7 | `KandiAddressesScreen` | `kandi_addresses_screen.dart` |
| 8 | `KandiSellerScreen` | `kandi_seller_screen.dart` |
| 9 | `KandiAccountScreen` | `kandi_account_screen.dart` |
| 10 | `KandiBrowseScreen` | `kandi_browse_screen.dart` |
| 11 | `KandiPaymentScreen` | `kandi_payment_screen.dart` |
| 12 | `KandiCheckoutScreen` | `kandi_checkout_screen.dart` |
| 13 | `KandiCartScreen` | `kandi_cart_screen.dart` |
| 14 | `KandiHomeScreen` | `kandi_home_screen.dart` |
| 15 | `KandiShell` | `kandi_shell.dart` |

Names must match exactly — they decide the file path the imports use.

The order is not a preference. Each screen names the screens it opens and
imports them by path, so a file pasted before the ones it opens will not
compile. This order is the one that works; there is no other.

---

## On every paste

1. Select all in the editor, paste the whole file over it.
2. Delete these two lines if FlutterFlow added them:
   ```dart
   import '/backend/backend.dart';
   import '/backend/supabase/supabase.dart';
   ```
3. Compile. Wait for the tick before the next one.

There is no step for parameters. Leave the parameter list empty on all 15 —
every one of them now accepts nothing but the width and height FlutterFlow
supplies. A product id, a category, an order: those travel on the ROUTE, which
FlutterFlow never reads. If the builder offers to add a parameter for you,
decline.

**Never add an import above `// DO NOT REMOVE OR MODIFY THE CODE ABOVE!`.**
FlutterFlow rewrites those first few lines on save and drops anything you put
there. The file then stops compiling, and the error it gives you is
`No widget "…" found` — which reads like the name is wrong and never is. Every
import belongs below that line.

---

## After 1 and 2, stop and check

Put both on a blank page and run:

- `KandiDesign` → palette and type scale.
- `KandiCartStore` → your basket, reading `kandi-cart-v2`.

Both render → carry on with 3–15.

---

## Then one page, one widget

Make **one** page. Put **`KandiShell`** on it. Set it as the initial page. That
is the app.

> **This is the step that turns the buttons on.** A page with `KandiHomeScreen`
> on it instead gives you the home feed and nothing else: no bottom bar, and
> every tap that means "go to the cart" or "go to search" has no tab to go to,
> so it does nothing. `KandiShell` is what draws the bar and what the screens
> reach for. If only the home screen works, this is why.

All fifteen are added under **Custom Code → Widgets**, and exactly one of them
is ever placed on a page. The other fourteen are reached by `KandiShell` and by
each other, in code — a tap on a product opens the product screen because
`kandi_home_screen.dart` names it, not because a route exists.

So: **no pages for the other fourteen.** No routes, no route parameters, no
navigation actions in the builder. If you find yourself making a `ProductPage`
to pass a product id to, stop — that is the thing this version removed.

---

## Haptics

On by default, in four strengths — a tap for a selection, a press for a button,
a heavier one when something lands or fails. All of it routes through
`KandiFeel` in `kandi_design.dart`.

To turn the whole thing off, set `KandiFeel.enabled = false` once at startup.
There is nothing to configure per screen, and nothing to add to the pubspec:
haptics are part of Flutter. They are silent on the web.

---

## The one package this needs

`url_launcher`, for dialling, WhatsApp, and opening kandiug.com. Every
FlutterFlow project ships with it, so there is normally nothing to do.

If `import 'package:url_launcher/url_launcher.dart'` is flagged as missing, add
`url_launcher: ^6.2.5` under **Settings → App Settings → Pubspec Dependencies**
before pasting file 1.

---

## Screens you do not add

Four screens live inside the files above and are opened by other screens, never
placed on a page:

| Screen | Already in | Opened from |
|---|---|---|
| `KandiOrderScreen` | `kandi_orders_screen.dart` | tapping an order |
| `KandiWishlistScreen` | `kandi_account_screen.dart` | Account → Saved items |
| `KandiOrderPlacedScreen` | `kandi_payment_screen.dart` | a cash-on-delivery order |
| `KandiReviewScreen` | `kandi_support_screen.dart` | Product → Reviews → Write one |

Do not create custom widgets for these. Adding them again would put two copies
of each class in the project.

**`index.dart`** — do not create it either. FlutterFlow generates it.

---

## Errors

| Error | Fix |
|---|---|
| `Target of URI doesn't exist: '/custom_code/widgets/kandi_….dart'` | That widget is missing or misnamed, or you pasted out of order |
| `Undefined name 'KandiColors'` | `KandiDesign` not added yet, or misnamed |
| `Undefined name 'KandiNav'` / `'KandiShop'` / `'KandiSession'` | Same — all three live in `kandi_design.dart` |
| `Target of URI doesn't exist: 'package:url_launcher/…'` | Add the pubspec dependency above |
| `No widget "Kandi…" found. Are you sure you want to save?` | The file does not compile — **do not save**. Usually an import that was placed above `// DO NOT REMOVE OR MODIFY THE CODE ABOVE!` and got stripped. Re-paste the file unedited |
| `Unable to process parameter "…". Are you sure you want to save?` | **Do not save.** FlutterFlow reads the widget class's constructor and cannot map that parameter's Dart type onto one of its own. It handles `int`, `String`, `bool` and `double` and nothing else — an enum or a class will not go through. Re-paste the current file |
| Every widget breaks at once | The two `backend` imports are in the last file you pasted |
| A tap that should switch tabs pops the screen instead | The screens are running without `KandiShell` |
| Basket looks empty | Check `KandiCartStore` reads `kandi-cart-v2` |
