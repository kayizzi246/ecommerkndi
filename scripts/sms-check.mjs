/**
 * Checks the EgoSMS setup without going through the checkout.
 *
 *   npm run sms:check                  login + credit balance, sends nothing
 *   npm run sms:check -- 0772123456    also sends one real test message
 *
 * Reads the same KANDI_SMS_* variables as `lib/otp-send.ts`, from .env.local.
 * To check production's values, paste them into .env.local first.
 */

const url = process.env.KANDI_SMS_URL || "https://www.egosms.co/api/v1/json/";
const username = process.env.KANDI_SMS_USERNAME;
const password = process.env.KANDI_SMS_PASSWORD;
const senderId = process.env.KANDI_SMS_SENDER_ID || "KandiUg";

if (!username || !password) {
  console.error("✗ KANDI_SMS_USERNAME and KANDI_SMS_PASSWORD must both be set in .env.local");
  process.exit(1);
}

async function call(body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, userdata: { username, password } }),
    signal: AbortSignal.timeout(15_000),
  });
  return response.json().catch(() => ({ Status: "Failed", Message: `HTTP ${response.status}` }));
}

/** 0772…, 772…, +256772… and 256772… all become 256772…, as the gateway wants. */
function toGatewayNumber(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("256") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `256${digits.slice(1)}`;
  if (digits.length === 9) return `256${digits}`;
  return null;
}

const balance = await call({ method: "Balance" });
if (balance.Status !== "OK") {
  console.error(`✗ Login failed: ${balance.Message || JSON.stringify(balance)}`);
  process.exit(1);
}
console.log(`✓ Logged in to EgoSMS as ${username}. Balance: ${balance.Balance ?? "unknown"}`);

const target = process.argv[2];
if (!target) {
  console.log("  Add a phone number to also send a test message: npm run sms:check -- 0772123456");
  process.exit(0);
}

const number = toGatewayNumber(target);
if (!number) {
  console.error(`✗ "${target}" is not a Ugandan mobile number`);
  process.exit(1);
}

const sent = await call({
  method: "SendSms",
  msgdata: [
    {
      number,
      message: `Test from ${senderId}: if you can read this, verification codes will arrive.`,
      senderid: senderId,
      priority: "0",
    },
  ],
});

if (sent.Status !== "OK") {
  console.error(`✗ Send failed: ${sent.Message || JSON.stringify(sent)}`);
  process.exit(1);
}
console.log(`✓ Accepted for ${number} from sender "${senderId}" (cost ${sent.Cost ?? "?"}).`);
console.log("  If it does not arrive within a minute, the sender ID is probably not registered yet.");
