# Kandi app in FlutterFlow

**Six pages, two bottom sheets.** Everything is a self-contained custom widget:
no parameters, no shared file.

| Widget name (exact) | File | Shown as |
|---|---|---|
| `KandiHomeScreen` | `kandi_home_screen.dart` | **Page**: Home (first page) |
| `KandiShopScreen` | `kandi_shop_screen.dart` | **Page**: Shop (search, departments, sort) |
| `KandiCartScreen` | `kandi_cart_screen.dart` | **Page**: Cart |
| `KandiCheckoutScreen` | `kandi_checkout_screen.dart` | **Page**: Checkout |
| `KandiAccountScreen` | `kandi_account_screen.dart` | **Page**: Account (orders, sign out) |
| `KandiRewardsScreen` | `kandi_rewards_screen.dart` | **Page**: Rewards |
| `KandiProductScreen` | `kandi_product_screen.dart` | **Bottom sheet** when a product is tapped |
| `KandiAddressPickerScreen` | `kandi_address_picker_screen.dart` | **Bottom sheet** from Checkout and Account |

The last two need **no page**: the other screens open them as sheets.

## Where the data lives

- **Products and categories:** Supabase (copied from WooCommerce automatically).
- **Sign-in:** Google, through Supabase.
- **Account, saved addresses, orders, reward points:** WooCommerce, through
  the WordPress plugin `kandi-mobile-api.php`.
- **Delivery price, place search, Pesapal payment:** the website, the same
  code the web checkout uses.

---

## 1. Connect Supabase

**Settings & Integrations > Integrations > Supabase**: on, with
`https://lorcztiuvskywjldjfxc.supabase.co` and the **anon** key. Click
**Get Schema**.

## 2. Turn on Google sign-in

1. **Settings & Integrations > App Settings > Authentication**: enable,
   **Authentication Type = Supabase**.
2. Set **Entry Page** and **Logged In Page** both to **Home** (the app works
   signed out and only asks to sign in at checkout).
3. Under the sign-in methods, switch **Google** on and follow FlutterFlow's
   prompts for the Google client IDs (the same Web client ID you put in
   Supabase, see `supabase/README.md`).

This is what gives the screens `'/auth/supabase_auth/auth_util.dart'`, which
they use for the Google button. Without it they do not compile.

## 3. Add one dependency

**Custom Code > Dependencies**: `webview_flutter: ^4.7.0` (the Pesapal sheet).

## 4. Add the eight widgets

For each row of the table: **Custom Code > Widgets > + > Widget**, the name
exactly as shown, select everything in the editor, paste the whole file,
**Save**. Leave the parameters empty.

Delete every older Kandi widget that is not in the table (Categories, Deals,
Orders, Search, Seller…, Stores, Track order, Verify, Wishlist).

Never type above `// DO NOT REMOVE OR MODIFY THE CODE ABOVE!`.

## 5. Make the six pages

Home, Shop, Cart, Checkout, Account, Rewards: on each, add its widget, make it
fill the page (width and height infinity), remove the page's own app bar.
Home is the first page. No navigation actions are needed.

---

## Keys kept on the phone

| Key | Holds |
|---|---|
| `kandi-cart-v2` | The basket |
| `kandi-open-product` | The product the product sheet shows |
| `kandi-shop-category`, `kandi-shop-query`, `kandi-shop-sort` | What Shop opens on |
| `kandi-address-id` | The address chosen at checkout |
