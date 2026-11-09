# Kandi app in FlutterFlow

Eight screens, each one **self-contained custom widget**. Nothing to declare,
no parameters, no shared file. Do the Supabase setup first
(`supabase/README.md`), because the app reads everything from it.

| Name it exactly | Paste this file | What it is |
|---|---|---|
| `KandiHomeScreen` | `kandi_home_screen.dart` | Search, departments, Super deals, New in, a carousel per department, Best sellers |
| `KandiShopScreen` | `kandi_shop_screen.dart` | Search, filters by department and section, sort, endless grid |
| `KandiProductScreen` | `kandi_product_screen.dart` | Photos, price, sizes and colours, add to cart, similar products |
| `KandiCartScreen` | `kandi_cart_screen.dart` | The basket |
| `KandiCheckoutScreen` | `kandi_checkout_screen.dart` | Address, delivery price, points, cash on delivery or Mobile Money / card |
| `KandiAddressPickerScreen` | `kandi_address_picker_screen.dart` | Saved addresses and the new-address form |
| `KandiAccountScreen` | `kandi_account_screen.dart` | Phone sign-in, orders, addresses, help |
| `KandiRewardsScreen` | `kandi_rewards_screen.dart` | Points balance, how it works, history |

The seller screens and the old Search, Wishlist, Orders, Deals, Stores,
Categories, Track order and Verify screens are gone. Search and categories
are inside Shop, orders are inside Account.

---

## 1. Connect Supabase (once)

**Settings > Integrations > Supabase**: turn it on and paste your project's
**URL** and **anon (public) key** (Supabase > Project Settings > API). Never
paste the `service_role` key into the app.

This also adds the `supabase_flutter` package the screens use.

## 2. Add one dependency (once)

**Custom Code > Dependencies**: add

```yaml
webview_flutter: ^4.7.0
```

It is the Pesapal payment sheet on checkout. iOS needs a minimum deployment
target of 12.0, which FlutterFlow already sets.

## 3. Add the eight widgets

For each row of the table: **Custom Code > Widgets > + > Widget**, give it the
name exactly as shown, select everything in the editor and paste the whole
file over it, then **Save**. Leave the parameter list empty.

- Names must match exactly. Other screens open each other by these names.
- If FlutterFlow added `import '/backend/supabase/supabase.dart';` or
  `import '/backend/backend.dart';` at the top, you can leave them; the files do
  not need them.
- **Never type anything above `// DO NOT REMOVE OR MODIFY THE CODE ABOVE!`**.
  FlutterFlow rewrites those lines on save.

Paste all eight, then compile once at the end: they refer to each other, so
the project only compiles when the set is complete.

## 4. Make the pages

Create one page per screen (Home, Shop, Product, Cart, Checkout, Address,
Account, Rewards). On each page add its custom widget, set it to fill the page
(width and height = infinity), and remove the page's own app bar. Set
**Home** as the initial page.

Navigation is handled inside the widgets (the bottom bar, product taps, the
checkout flow), so you do not need to wire any Navigate actions. If you add
your own, they work too: screens pass information through the device, not
through route parameters.

---

## How the data flows

- **Products and categories**: WooCommerce sends them to Supabase
  (`kandi-supabase-sync.php`), the app reads them from Supabase.
- **Sign in**: phone number and SMS code (Supabase Auth, sent through EgoSMS).
- **Orders**: the app calls the Supabase function `place-order`, which creates
  the real order in WooCommerce with the website's prices, stock and delivery
  rules, and keeps a copy for the app. Status changes in WooCommerce come back
  to the app automatically.
- **Delivery price, place search and Pesapal**: from the website
  (`https://kandiug.com`), the same code the web checkout uses.
- **Rewards**: 1 point per UGX 1,000 of items, added when the order is marked
  **Completed** in WooCommerce; 100 points = UGX 1,000 off, up to half the
  items. Change the numbers in Supabase > Table editor > `reward_settings`.

## Keys kept on the device

| Key | Holds |
|---|---|
| `kandi-cart-v2` | The basket |
| `kandi-open-product` | The product the Product screen should show |
| `kandi-shop-category`, `kandi-shop-query`, `kandi-shop-sort` | What Shop should open on |
| `kandi-address-id` | The delivery address chosen at checkout |

The sign-in session is kept by Supabase itself.
