# Adding the app to FlutterFlow

Three custom widgets. **No parameters to declare on any of them.** No pubspec
changes needed.

| Name it exactly | Paste this file |
|---|---|
| `KandiHomeScreen` | `kandi_home_screen.dart` |
| `KandiProductScreen` | `kandi_product_screen.dart` |
| `KandiCartScreen` | `kandi_cart_screen.dart` |

**Custom Code → Widgets → `+` → Widget**, then paste the whole file over
whatever is in the editor.

Names must match exactly. FlutterFlow turns the widget name into the file path —
`KandiHomeScreen` becomes `lib/custom_code/widgets/kandi_home_screen.dart` — and
the two navigation imports are written against those paths.

---

## Paste order

Any. That is the point of this rebuild and it is worth saying plainly, because
the version this replaces had fifteen widgets and exactly **one** legal order:
each screen imported the others for colours, models and helpers, so a file
pasted before the ones it referenced failed to compile with an error that
pointed at the wrong thing.

Every page here carries its own palette, type scale, HTTP client and product
model, all of it file-private. The only cross-file imports are for
**navigation** — Home opens Product and Cart, Product opens Cart — and Dart
resolves those once all three exist.

If you paste Home first it will not compile until the other two are in. That is
the only ordering effect left, and it clears as soon as the third file is
pasted.

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
3. Compile. Wait for the tick before the next one.

There is no step for parameters. Leave the parameter list empty on all three —
each accepts nothing but the width and height FlutterFlow supplies. A product
id travels on the ROUTE instead, which FlutterFlow never reads or rewrites. If
the builder offers to add a parameter for you, decline.

**Never add an import above `// DO NOT REMOVE OR MODIFY THE CODE ABOVE!`.**
FlutterFlow rewrites those first lines on save and silently drops anything you
put there. The file then stops compiling, and the error it gives is
`No widget "…" found` — which reads like the name is wrong and never is.

---

## What the three pages do

**Home** — one request to `/api/app/home` builds the whole screen: the shop's
terms, the departments, every merchandising rail already composed and ordered by
the server, and the picked-for-you grid. It is the same feed the website's
homepage renders from, so what is trending and how deep a discount has to be is
decided once and both clients read the result.

Tapping a product opens **Product**. The basket icon opens **Cart**.

**Product** — reads the id from the route, fetches `/api/app/product/{id}`,
shows the gallery, the price, the size and colour pickers, and adds to the
basket. A product with options cannot be added from a tile on Home; it opens
here, where the picker is.

**Cart** — reads the saved basket, then asks the shop what each line costs *now*
and shows any price that moved or item that sold out. Quantity, remove with
undo, and a free-delivery meter.

---

## How the basket is shared

Through the device, not through code. All three pages read and write one
SharedPreferences key:

```
kandi-cart-v1
```

A JSON list of `{key, productId, name, image, price, priceLabel, quantity,
variantLabel}`. `key` is `productId::variantLabel`, so the same shoe in two
sizes is two lines rather than one merged line with a size missing.

**If you change that key, change it in all three files at once.** It is the one
string they agree on, and nothing enforces the agreement.

---

## What is not built yet

Checkout. The Cart page's checkout button says so rather than opening a
half-finished flow — payment is the one place a shopper must never be left
guessing whether something happened. The basket is saved on the device either
way.

Search, shop/category browsing, account and orders are also not in this set.
They follow the same one-file-per-page pattern: copy `kandi_home_screen.dart`
as the template, keep every helper file-private with a leading underscore, and
add only the navigation imports the page actually needs.

---

## Verified

The three files were type-checked against Flutter 3.35 / Dart 3.9 in a
throwaway package with the FlutterFlow-only imports stubbed out:
`flutter analyze` reports **no issues**. That catches syntax and type errors,
not layout — how they look on a device is still worth a look in the builder.
