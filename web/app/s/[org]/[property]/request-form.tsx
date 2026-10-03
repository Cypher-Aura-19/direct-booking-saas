"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { requestBookingAction } from "./request-actions";

const GENERIC = "Something went wrong. Please try again in a moment.";

// Same per-property key ChatPanel uses, so the chat this request opens is the
// one the guest sees next time (storage can throw — private mode).
const chatKey = (propertyId: string) => `qayam-chat:${propertyId}`;
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* not remembered */ } };

export function RequestForm({ propertyId, checkIn, checkOut }: { propertyId: string; checkIn: string; checkOut: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentToken, setSentToken] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await requestBookingAction({ propertyId, token: read(chatKey(propertyId)), checkIn, checkOut, name, phone });
      if (result.ok) {
        write(chatKey(propertyId), result.token);
        setSentToken(result.token);
      } else {
        setError(result.message);
      }
    } catch {
      setError(GENERIC);
    } finally {
      setPending(false);
    }
  }

  if (sentToken) {
    return (
      <div className="request-sent" role="status">
        <strong>Request sent</strong>
        <p>The host will review it and reply in your chat. Nothing is charged now.</p>
        <Link href={`/c/${sentToken}`} className="request-sent-link">Open your chat</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="request-form">
      <Field label="Your name">
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" className={INPUT_CLASSES} />
      </Field>
      <Field label="Phone number" hint="So the host can reach you.">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" className={INPUT_CLASSES} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending…" : "Request to book"}</Button>
      <p className="request-form-note">The host confirms before anything is booked. You pay them directly.</p>
    </form>
  );
}
