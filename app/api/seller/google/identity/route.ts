import { verifyGoogleIdToken, GoogleAuthError } from "@/lib/google-verify";

/**
 * Reads a Google credential and hands back who it belongs to. Creates nothing.
 *
 * This is the first step of signing up with Google: the onboarding form needs
 * the seller's name and address to fill itself in, but the store does not exist
 * yet and must not be created until they have told us what it is called. So the
 * credential is verified here for display purposes only, and verified *again*
 * at registration — the account is created from that second check, never from
 * anything this route returned.
 *
 * That second verification is what makes this safe to be so permissive: nothing
 * a caller learns here grants them anything.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { credential?: string };

  if (!body.credential) {
    return Response.json({ message: "Missing Google credential." }, { status: 400 });
  }

  try {
    const identity = await verifyGoogleIdToken(body.credential);
    return Response.json({
      email: identity.email,
      name: identity.name ?? "",
    });
  } catch (error) {
    const message = error instanceof GoogleAuthError ? error.message : "Google sign-in failed.";
    return Response.json({ message }, { status: 401 });
  }
}
