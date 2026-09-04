import { cookies } from "next/headers";
import { completeCustomerSession } from "@/lib/customer-auth";
import { privateJson } from "@/lib/private-json";
import { clientIp, rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import { readVerified, VERIFIED_COOKIE } from "@/lib/otp";

/** Creates a shopper account from an email address and a password. */
export async function POST(request: Request) {
  // Unthrottled account creation is how a shop acquires ten thousand junk
  // customers overnight — each one a row in WordPress and, because registration
  // sends mail, a message from our domain. Enough spam sent on our behalf and
  // the shop's real order confirmations start landing in junk folders, which is
  // the expensive part.
  const limit = rateLimit("register", clientIp(request), LIMITS.register);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
  };

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();

  if (!email) {
    return privateJson({ message: "Enter your email address." }, { status: 400 });
  }

  // Checked here as well as in WordPress. The same rule enforced in both
  // places means the shopper is told immediately, rather than after a round
  // trip, while the server still refuses anything that arrives another way.
  if (password.length < 8) {
    return privateJson(
      { message: "Use at least 8 characters for your password." },
      { status: 400 }
    );
  }

  /* ---- A new account carries a proved contact ----
   *
   * The sign-up form makes the shopper pass the same one-time-code check that
   * stands in front of checkout, and this is where that is required rather than
   * merely requested. The reason it is required at REGISTRATION and not only at
   * checkout is that an account is the thing orders, addresses and reviews hang
   * off: an account created against a number nobody holds is a permanent row
   * that looks exactly like a real customer until a rider is sent to it.
   *
   * The phone is taken from the sealed cookie and NOT from the body. That is
   * the whole point — a number in the request is a number the caller typed, and
   * the only number worth storing here is the one the server watched somebody
   * prove. A body field would be a verification badge the client writes itself.
   */
  const proved = await readVerified((await cookies()).get(VERIFIED_COOKIE)?.value);
  if (!proved) {
    return privateJson(
      {
        message: "Verify your phone number or email address first.",
        /* The panel reads this and opens the dialog rather than printing a
           sentence the shopper has no way to act on. */
        code: "verification_required",
      },
      { status: 403 }
    );
  }

  return completeCustomerSession("/register", {
    email,
    password,
    name,
    /* Only when it is a phone. A shopper who proved an email has proved
       something real, but it is not the field the rider calls, and writing an
       address into a phone column would be worse than leaving it empty. */
    ...(proved.channel === "sms" ? { phone: proved.value } : {}),
  });
}
