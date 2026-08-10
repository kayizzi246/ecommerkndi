"use client";

import { useState } from "react";
import { useCustomerSession } from "@/lib/customer-session";

const SUBJECTS = [
  "Where is my order?",
  "I want to return something",
  "A product question",
  "A problem with my account",
  "Selling on Kandi",
  "Something else",
];

/**
 * Contact form. Signed-in shoppers get their name and email filled in, since
 * we already know them and retyping is just friction.
 *
 * The message goes to our own API route, which forwards it to WordPress with
 * the shared secret attached — the browser never holds a credential that could
 * be used to send mail through the shop.
 */
export default function ContactForm({ supportPhone }: { supportPhone: string }) {
  const { customer } = useCustomerSession();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // The session resolves after the first render, so the fields fall back to it
  // rather than being initialised from it.
  const nameValue = name || customer?.name || "";
  const emailValue = email || customer?.email || "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameValue,
          email: emailValue,
          order,
          subject,
          message,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setError(
          payload.message ?? `Could not send that. Please call ${supportPhone} instead.`
        );
        return;
      }

      setSent(true);
      setMessage("");
      setOrder("");
    } catch {
      setError(`Network error. Please call ${supportPhone} instead.`);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-shop-line bg-shop-successbg p-8 text-center"
      >
        <p className="text-[19px] font-semibold text-shop-success">Message sent</p>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-shop-body">
          We reply within one working day, to {emailValue}. If it is urgent, call{" "}
          {supportPhone}.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="btn-shop-outline mt-5 px-6 py-2.5 text-[15px]"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-shop-line bg-white p-6">
      <h2 className="text-[20px] font-extrabold text-shop-ink">Send us a message</h2>
      <p className="mt-1 text-[14px] text-shop-muted">
        We read every one and reply within a working day.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-shop-body">
            Your name
          </span>
          <input
            required
            value={nameValue}
            onChange={(event) => setName(event.target.value)}
            className="field-shop text-[15px]"
            autoComplete="name"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-shop-body">
            Email
          </span>
          <input
            required
            type="email"
            value={emailValue}
            onChange={(event) => setEmail(event.target.value)}
            className="field-shop text-[15px]"
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-shop-body">
            What is it about?
          </span>
          <select
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="field-shop text-[15px]"
          >
            {SUBJECTS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-shop-body">
            Order number <span className="font-normal text-shop-muted">(if you have one)</span>
          </span>
          <input
            value={order}
            onChange={(event) => setOrder(event.target.value)}
            placeholder="e.g. 1042"
            className="field-shop text-[15px]"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[14px] font-semibold text-shop-body">Message</span>
        <textarea
          required
          rows={5}
          minLength={10}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Tell us what happened, and what you would like us to do about it."
          className="field-shop resize-y text-[15px]"
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 text-[14px] font-medium text-shop-sale">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-shop mt-5 px-8 py-3 text-[15px]">
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
