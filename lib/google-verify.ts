/**
 * Server-side verification of a Google Identity Services ID token.
 *
 * The browser hands us a JWT; we never trust its contents until Google itself
 * confirms the signature. `tokeninfo` does that check and returns the decoded
 * claims, which we then validate against our own client id.
 */

export type GoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  picture: string;
};

export class GoogleAuthError extends Error {}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new GoogleAuthError(
      "Google sign-in is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local."
    );
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new GoogleAuthError("Google could not verify that sign-in. Please try again.");
  }

  const claims = (await response.json()) as Record<string, string>;

  // aud must be our app, or someone could replay a token minted for another site.
  if (claims.aud !== clientId) {
    throw new GoogleAuthError("That Google sign-in was issued for a different application.");
  }
  if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) {
    throw new GoogleAuthError("Unexpected token issuer.");
  }
  if (claims.email_verified !== "true" && claims.email_verified !== "1") {
    throw new GoogleAuthError("Your Google account does not have a verified email address.");
  }
  if (Number(claims.exp) * 1000 < Date.now()) {
    throw new GoogleAuthError("That sign-in has expired. Please try again.");
  }

  return {
    sub: claims.sub,
    email: claims.email,
    name: claims.name || claims.given_name || claims.email.split("@")[0],
    picture: claims.picture ?? "",
  };
}
