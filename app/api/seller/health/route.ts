import { callSellerApi } from "@/lib/seller-server";
import { privateJson } from "@/lib/private-json";

export const dynamic = "force-dynamic";

/**
 * What the WordPress end of the Seller Centre actually is.
 *
 * The storefront and the plugin are deployed separately — one by `git push`,
 * the other by somebody pasting a file into wp-admin — so they drift, and
 * nothing until now could tell you they had. A fix shipped here against a
 * plugin that was never updated looks exactly like a fix that did not work.
 *
 * `expected_version` is this repository's opinion of what should be on the
 * server. When it disagrees with what answered, the Seller Centre says so.
 */
export const EXPECTED_PLUGIN_VERSION = "2.5.0";

export type SellerHealth = {
  reachable: boolean;
  version?: string;
  expected_version: string;
  up_to_date: boolean;
  loaded_from?: string;
  duplicates: string[];
  signin_requires_verified_email?: boolean;
  seller_count?: number;
  message?: string;
};

export async function GET() {
  const { status, data } = await callSellerApi("/health", { authenticated: false });

  if (status !== 200) {
    const payload = data as { message?: string; code?: string };
    return privateJson(
      {
        reachable: false,
        expected_version: EXPECTED_PLUGIN_VERSION,
        up_to_date: false,
        duplicates: [],
        // A 404/501 here is itself the answer: /seller/health only exists from
        // 2.0.0 onwards, so "no such route" means the server is running an
        // older build than this repository.
        message:
          status === 404 || status === 501
            ? "The Kandi Seller plugin on WordPress is older than this storefront — it has no /seller/health route. Re-upload wordpress/kandi-seller-api.php."
            : payload.message ?? `The seller backend answered ${status}.`,
      } satisfies SellerHealth,
      { status: 200 }
    );
  }

  const wp = data as {
    version?: string;
    loaded_from?: string;
    duplicates?: string[];
    signin_requires_verified_email?: boolean;
    seller_count?: number;
  };

  return privateJson(
    {
      reachable: true,
      version: wp.version,
      expected_version: EXPECTED_PLUGIN_VERSION,
      up_to_date: wp.version === EXPECTED_PLUGIN_VERSION,
      loaded_from: wp.loaded_from,
      duplicates: wp.duplicates ?? [],
      signin_requires_verified_email: wp.signin_requires_verified_email,
      seller_count: wp.seller_count,
    } satisfies SellerHealth,
    { status: 200 }
  );
}
