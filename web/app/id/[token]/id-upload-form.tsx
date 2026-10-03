"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { resizeIdPhoto } from "@/lib/hotel-eye/resize";
import { submitIdAction } from "./actions";

const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (iso: string) => SHORT.format(new Date(`${iso}T00:00:00Z`));

type Props = {
  token: string; hostName: string; propertyName: string;
  defaultName: string; defaultPhone: string; startDate: string; endDate: string;
};

export function IdUploadForm({ token, hostName, propertyName, defaultName, defaultPhone, startDate, endDate }: Props) {
  const [name, setName] = useState(defaultName);
  const [cnic, setCnic] = useState("");
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const file = fileInput.current?.files?.[0];
    if (!file) { setError("Add a photo of your ID."); return; }
    setPending(true);
    try {
      let photo: Blob;
      try {
        photo = await resizeIdPhoto(file);
      } catch {
        setError("We couldn't prepare that photo. Try taking it again.");
        return;
      }
      const body = new FormData();
      body.set("token", token);
      body.set("name", name);
      body.set("cnic", cnic);
      body.set("phone", phone);
      body.set("photo", photo, "id.jpg");
      const result = await submitIdAction(body);
      if (result.error) setError(result.error);
      else setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="request-sent" role="status">
        <strong>Thank you — your ID has been received.</strong>
        <p>{hostName} has what they need for your stay at {propertyName}. You can close this page.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="request-form id-form">
      <section aria-label="Privacy notice" className="id-privacy">
        <strong>Before you upload</strong>
        <p>
          Your host is required to register guests&apos; identification. {hostName} will see your ID photo and the details below, and
          they are deleted automatically 90 days after your stay. Nobody else can open them.{" "}
          <Link href="/privacy" target="_blank" rel="noreferrer">Read the privacy policy</Link>.
        </p>
      </section>
      <p className="id-stay">Your stay: <strong>{fmt(startDate)} → {fmt(endDate)}</strong> at {propertyName}</p>
      <Field label="Full name (as on your ID)">
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" className={INPUT_CLASSES} />
      </Field>
      <Field label="CNIC number" hint="13 digits, e.g. 35202-1234567-1">
        <input value={cnic} onChange={(e) => setCnic(e.target.value)} required inputMode="numeric" autoComplete="off" className={INPUT_CLASSES} />
      </Field>
      <Field label="Phone number">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" className={INPUT_CLASSES} />
      </Field>
      <Field label="Photo of your ID" hint="Take a clear photo of the front, or choose one from your phone.">
        <input ref={fileInput} type="file" accept="image/*" capture="environment" className={INPUT_CLASSES} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending…" : "Send my ID"}</Button>
    </form>
  );
}
