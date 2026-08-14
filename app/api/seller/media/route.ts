import { cookies } from "next/headers";
import { privateJson } from "@/lib/private-json";
import { SELLER_COOKIE, sellerApiBase } from "@/lib/seller-server";

/**
 * Photo upload for the Seller Centre.
 *
 * The catch-all proxy beside this one reads every request as JSON, which a
 * multipart upload is not, so photographs get their own route: the file is
 * streamed through to `kandi/v1/seller/media` untouched, with the storefront
 * secret and the seller's session token attached the same way as everywhere
 * else. The browser never learns either.
 */

/** Matches KANDI_SELLER_MAX_UPLOAD in the WordPress plugin. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * The formats a seller may upload.
 *
 * WebP and AVIF are here because that is increasingly what a phone hands over:
 * every Android share sheet and every "save image" from a browser now produces
 * WebP, and a modern iPhone screenshot pipeline can produce AVIF. A seller
 * whose photo was refused for being "not an image" had no way to know it needed
 * converting first, and no tool on the phone to convert it with — so the
 * listing went up without a picture, which is the failure this whole uploader
 * exists to prevent.
 *
 * Kept in step with `ACCEPTED` in ImageUploader (what the file picker offers)
 * and `kandi_seller_image_mimes()` in the WordPress plugin (what finally
 * accepts the bytes). All three have to agree or a file passes one gate and is
 * refused by the next.
 */
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

export async function POST(request: Request) {
  const token = (await cookies()).get(SELLER_COOKIE)?.value;
  if (!token) {
    return privateJson(
      { message: "Your session has expired. Please sign in again." },
      { status: 401 }
    );
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return privateJson({ message: "No photo was received." }, { status: 400 });
  }

  const file = incoming.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return privateJson({ message: "No photo was received." }, { status: 400 });
  }

  // Checked here as well as in WordPress: a seller who picks a 12 MB photo
  // should be told before it goes up the (slow, metered) uplink, not after.
  if (file.size > MAX_BYTES) {
    return privateJson(
      { message: "That photo is larger than 8 MB. Please use a smaller one." },
      { status: 413 }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return privateJson(
      { message: "Photos must be JPEG, PNG, WebP, AVIF or GIF." },
      { status: 415 }
    );
  }

  const outgoing = new FormData();
  outgoing.append("file", file, file.name || "photo.jpg");

  let response: Response;
  try {
    response = await fetch(`${sellerApiBase()}/media`, {
      method: "POST",
      // No Content-Type header — fetch sets it, and only fetch knows the
      // multipart boundary it generated.
      headers: {
        "X-Kandi-Secret": process.env.KANDI_API_SECRET ?? "",
        Authorization: `Bearer ${token}`,
      },
      body: outgoing,
      cache: "no-store",
    });
  } catch (error) {
    console.error("[kandi-seller] photo upload failed:", error);
    return privateJson(
      { message: "Could not reach the store backend. Please try again." },
      { status: 502 }
    );
  }

  const data = await response.json().catch(() => ({}));

  // WordPress answers `rest_no_route` when the plugin file on the server predates
  // this endpoint — which is the single most likely reason an upload fails after
  // a storefront deploy, and "No route was found matching the URL" tells whoever
  // reads it nothing about what to do next.
  if ((data as { code?: string }).code === "rest_no_route") {
    console.error(
      "[kandi-seller] /seller/media is missing on WordPress — upload the current " +
        "wordpress/kandi-seller-api.php to wp-content/plugins/kandi-seller-api/."
    );
    return privateJson(
      {
        message:
          "Photo uploads are not switched on yet: the Kandi Seller Centre plugin on " +
          "WordPress needs updating. Ask your administrator to re-upload it.",
      },
      { status: 501 }
    );
  }

  return privateJson(data, { status: response.status });
}
