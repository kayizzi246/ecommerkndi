# Kandi app in FlutterFlow

**Four widgets, four pages: the four tabs.** Each is a self-contained custom
widget: no parameters, no shared file.

| Widget name (exact) | File | Page | Its sheets |
|---|---|---|---|
| `KandiHomeScreen` | `kandi_home_screen.dart` | Home (first page) | |
| `KandiShopScreen` | `kandi_shop_screen.dart` | Shop (search, departments) | Sort |
| `KandiCartScreen` | `kandi_cart_screen.dart` | Cart | Checkout, then Pesapal payment |
| `KandiAccountScreen` | `kandi_account_screen.dart` | Account (orders, sign out) | Rewards |

Everything else is a **liquid-glass sheet** built into every file: a
product, the delivery addresses and the address form, and Google sign-in.

## The look: liquid glass

A floating glass tab bar with a lens that springs to the chosen tab, glass
top bars the page scrolls under, glass sheets inset from the screen's edges,
round glass buttons over product photos, a glass Add to cart bar, glass
toasts. Plus iOS rubber-band scrolling and pull-to-refresh, squeeze-on-press,
springy motion and haptic ticks.

It is built from Flutter's own blur and colour filters (`_KGlass` in the
shared block), so it **needs no extra dependency** and looks the same on
iOS, Android and the web. The one Flutter package that renders Apple's
refraction (`liquid_glass_renderer`) is prerelease only, needs Flutter 3.47
and a `--enable-flutter-gpu` build flag FlutterFlow cannot set, and on the
web it falls back to plain blur anyway.

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

The screens sign in through Supabase themselves (`signInWithOAuth`), not
through FlutterFlow's generated `auth_util.dart`, so they compile either way.
Two things make the round trip back to the app work:

4. **Supabase > Authentication > URL Configuration > Redirect URLs**: add the
   web app's address (for example `https://kandiug.flutterflow.app` and the
   FlutterFlow test-mode address) and `kandiug://kandiug.com/auth-callback`.
5. For the phone app: **Settings & Integrations > App Settings > App Details >
   Deep Linking**, enable it with scheme `kandiug` and host `kandiug.com`. If
   you pick another, change `appRedirect` in the widgets to match.

## 3. Add one dependency

**Custom Code > Dependencies**: `webview_flutter: ^4.7.0` (the Pesapal sheet,
in the Cart widget). Everything else the widgets import (`cached_network_image`,
`http`, `shared_preferences`, `url_launcher`, Supabase, and Flutter's own
`cupertino`, `services` and `dart:ui`) already comes with FlutterFlow.

## 4. Add the four widgets

For each row of the table: **Custom Code > Widgets > + > Widget**, the name
exactly as shown, select everything in the editor, paste the whole file,
**Save**. Leave the parameters empty.

Delete every older Kandi widget that is not in the table, above all
**`KandiCheckoutScreen`** and **`KandiRewardsScreen`** (now sheets inside Cart
and Account; left in, they no longer compile), and also Categories, Deals,
Orders, Search, Seller…, Stores, Track order, Verify, Wishlist,
`KandiProductScreen` and `KandiAddressPickerScreen`.

Never type above `// DO NOT REMOVE OR MODIFY THE CODE ABOVE!`.

## 5. Make the four pages

Home, Shop, Cart, Account: on each, add its widget, make it fill the page
(width and height infinity), remove the page's own app bar and leave the
page's background as it is (the widget paints its own). Home is the first
page. Delete the old Checkout and Rewards pages. No navigation actions are
needed: the glass tab bar switches between the four.

---

## Keys kept on the phone

| Key | Holds |
|---|---|
| `kandi-cart-v2` | The basket |
| `kandi-shop-category`, `kandi-shop-query`, `kandi-shop-sort` | What Shop opens on |
| `kandi-address-id` | The address chosen at checkout |
