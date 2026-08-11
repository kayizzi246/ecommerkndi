import { cookies } from "next/headers";
import { SELLER_COOKIE, sellerApiBase } from "@/lib/seller-server";

/**
 * Business verification: identity document plus the registration answers.
 *
 * Multipart, so it needs its own route rather than the JSON catch-all — the
 * same reason product photos have one. The file is streamed through untouched.
 *
 * These are identity documents. Nothing about them is logged here, and the only
 * copy lives in the WordPress media library behind an unguessable filename; see
 * the note in kandi-seller-api.php about what that does and does not protect.
 */

/** Matches KANDI_SELLER_MAX_UPLOAD in the plugin. */
const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function POST(request: Request) {
  const token = (await cookies()).get(SELLER_COOKIE)?.value;
  if (!token) {
    return Response.json(
      { message: "Your session has expired. Please sign in again." },
      { status: 401 }
    );
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return Response.json({ message: "Nothing was received." }, { status: 400 });
  }

  const outgoing = new FormData();

  for (const field of ["business_registered", "business_name", "business_number"]) {
    const value = incoming.get(field);
    if (typeof value === "string") outgoing.append(field, value);
  }

  for (const field of ["id_document", "business_document"]) {
    const file = incoming.get(field);
    if (!(file instanceof File) || file.size === 0) continue;

    if (file.size > MAX_BYTES) {
      return Response.json(
        { message: "That file is larger than 8 MB. Please use a smaller one." },
        { status: 413 }
      );
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json(
        { message: "Documents must be a photo (JPEG, PNG, WebP) or a PDF." },
        { status: 415 }
      );
    }
    outgoing.append(field, file, file.name || "document");
  }

  let response: Response;
  try {
    response = await fetch(`${sellerApiBase()}/kyc`, {
      method: "POST",
      headers: {
        "X-Kandi-Secret": process.env.KANDI_API_SECRET ?? "",
        Authorization: `Bearer ${token}`,
      },
      body: outgoing,
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { message: "Could not reach the store backend. Please try again." },
      { status: 502 }
    );
  }

  const data = await response.json().catch(() => ({}));

  if ((data as { code?: string }).code === "rest_no_route") {
    return Response.json(
      {
        message:
          "Verification is not switched on yet: the Kandi Seller Centre plugin on " +
          "WordPress needs updating. Ask your administrator to re-upload it.",
      },
      { status: 501 }
    );
  }

  return Response.json(data, { status: response.status });
}
