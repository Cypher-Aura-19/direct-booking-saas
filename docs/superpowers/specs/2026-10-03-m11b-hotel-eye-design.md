# M11b Hotel Eye (CNIC capture, register, export, retention) — Design

| | |
|---|---|
| **Status** | Design approved 2026-10-03, pending written-spec review and implementation plan |
| **Milestone** | M11b (CNIC-01 … CNIC-15). Follows M11a (PAY-01 … PAY-06, deployed). The CI audit gate moves M10 → M11 when this lands. |
| **Parent spec** | `2026-09-20-phase-1-design.md` (D-11 retention, §routes `/id/[uploadToken]`, `/dashboard/guests*`, `/api/guests/export`, `/api/cron/retention`, risk R-03, open item O-01) |
| **Builds on** | M2 (`guests`, `guest_documents`, RLS), M4 (private storage + browser image resize), M10 (`bookings.guest_id`, guest card), M11a (`mark_booking_paid`) |

## Goal

After payment is confirmed the guest is prompted, on a separate expiring link, to upload an ID photo with name, CNIC number and phone. The host sees each record in a dashboard register with copy-to-clipboard fields (they retype these into the government Hotel Eye portal by hand — the portal has no public API, per the parent spec's out-of-scope table), can filter and export it as CSV, sees how long each record has left, and can only shorten that period. A nightly job deletes expired records and their images.

Out of scope: more than one ID per booking (one adult per link), regenerating an expired link, finalising the privacy policy wording (O-01 — the page ships as a clearly marked draft), application-level encryption of the CNIC number column (Supabase encrypts storage and disk at rest; this is the parent spec's stated control), any automatic portal submission.

## Decisions

| # | Decision | Why |
|---|---|---|
| M11b-1 | The guest gets the link **both** on their booking card and as a line in the "Payment received" chat message | CNIC-01 ("prompted"): a guest who never reopens the card still sees it in the chat. |
| M11b-2 | `mark_booking_paid` (replaced via `create or replace`) **creates the link in the same transaction** and appends the link to its acknowledgement | One atomic step, as M11a-1. The function stays `security invoker`; no `security definer`. |
| M11b-3 | The link is a row in a new table `id_upload_links`: 64-hex-char random token, one per booking, `expires_at` = end of the stay's last day (Asia/Karachi), `used_at` | Expiry is data, checked server-side (CNIC-02). One link per booking enforces one ID per booking. |
| M11b-4 | `id_upload_links` is readable/insertable by the **host only through an `owns_property` policy**; anon and the guest get no table access. The guest side reads it **by token with the service role** inside a Server Action | Same split as the guest chat (`/c/[token]`): possession of the unguessable token is the credential, the service role is only ever used behind a token check. |
| M11b-5 | **Upload is server-mediated**: a Server Action validates token, expiry, unused, file type and size, then writes to a private bucket and the rows with the service role | All validation in one place. A signed direct-to-storage upload would split it. |
| M11b-6 | The guest page shows the **stay dates from the booking, read-only**; the server stores the booking's dates, not client-supplied ones | The retention cap derives from `stay_end`. If a guest could type the dates they could stretch their own retention. CNIC-03 is met by showing and confirming the dates alongside the typed name, number and phone. |
| M11b-7 | `guest_documents.retention_expires_at` is set at upload to **`stay_end + 90 days`**; a trigger rejects any update that moves it past that cap | CNIC-11/12: checkout-based default (the M2 default `now() + 90 days` is wrong for this) and "shorten but never extend", enforced in the database so RLS plus the trigger are the whole authorization story. |
| M11b-8 | The image is served to the host only via a **60-second signed URL created server-side per page render**, authorised by a storage policy on `<org_id>/…` + `owns_organization` | CNIC-05/15. The bucket is private; there is no public path. |
| M11b-9 | The guest never sees the image again: the success screen shows only a confirmation | CNIC-06. |
| M11b-10 | Retention deletion is a **bearer-secret route**, `/api/cron/retention`, triggered daily by a `vercel.json` cron. It deletes **storage objects first, then rows**, and is safe to re-run | CNIC-13. A crash between the two steps leaves a row with no image, which the next run deletes; the reverse order would orphan images with no row pointing at them. |
| M11b-11 | `CRON_SECRET` is added to **CI's env-writing step and `docs/deployment.md` in the same task that introduces it** | The M7 lesson: a new required env var that exists only in local `.env.local` breaks CI on first push. |

## Data model — migration `20261004010000_m11b_hotel_eye.sql`

**`id_upload_links`** (new)
- `token text primary key` (64 hex chars from `encode(extensions.gen_random_bytes(32), 'hex')`), `booking_id uuid not null unique references bookings(id) on delete cascade`, `organization_id uuid not null references organizations(id) on delete cascade`, `expires_at timestamptz not null`, `used_at timestamptz`, `created_at timestamptz not null default now()`.
- RLS enabled. Policy `id_upload_links_all_own` for `authenticated`: `owns_organization(organization_id)` (denormalised, same reason as `guest_documents`). `revoke all … from anon`. The guest path uses the service role.

**`guest_documents`** (altered)
- Add `booking_id uuid unique references bookings(id) on delete cascade` (nullable for any pre-existing rows; the register joins on it).
- `retention_expires_at` default dropped (set explicitly at insert).
- Trigger `guest_documents_cap_retention` (`before insert or update`): computes `cap = (stay_end + 90) at 00:00 Asia/Karachi`; raises `check_violation` if `retention_expires_at > cap` (insert and update). The service-role insert sets it equal to the cap.

**`mark_booking_paid`** (replaced) — same checks and flow as M11a, plus, after the state flip: insert the `id_upload_links` row (`expires_at` = start of the day after `end_date`, Asia/Karachi), and the acknowledgement becomes *"Payment received - you're confirmed. Please upload your ID before you arrive: /id/<token> . Ask me anything about check-in or the house."* The relative path is deliberate: the database does not know the site origin; the guest chat renders `/id/<token>` as a same-origin link. Still exactly one AI message, still inserted **after** the flip.

**Storage** — private bucket `guest-ids` (not public; 4 MB limit; `image/jpeg`, `image/png`, `image/webp`). Policies: `authenticated` may `select` objects where the first path segment is an organisation they own (`owns_organization`); **no** insert/update/delete policy for `authenticated`, **no** anon policy. Uploads and deletions use the service role.

No change to the AI money-block or any other trigger.

## Components

- **`web/lib/hotel-eye/links.ts`** — `getUploadLink(service, token)` → `{ status: 'open' | 'used' | 'expired' | 'unknown', booking summary }` (service role; never leaks other bookings).
- **`web/lib/hotel-eye/upload.ts`** — `submitGuestId(service, { token, name, cnic, phone, file })`: re-checks link state, validates (`cnic` = 13 digits after stripping dashes; phone via the existing normaliser; MIME sniffed from magic bytes, not just the declared type; ≤ 4 MB), writes the object to `<org>/<booking>/<uuid>.<ext>`, then in order updates `guests` (name, phone), inserts `guest_documents` (booking dates, cap retention), sets `used_at` conditionally (`where used_at is null`). If the conditional update affects 0 rows (a concurrent submit), the new object is deleted and `already_used` is returned.
- **`web/lib/hotel-eye/records.ts`** — host reads through the **host's own RLS client**: `listRecords(supabase, { from, to })` (overlap with stay dates), `getRecord(supabase, id)`, `recordImageUrl(supabase, path)` (60 s signed URL), `shortenRetention(supabase, id, newExpiry)`; CSV builder `recordsToCsv(rows)` (RFC 4180 quoting; cells starting with `= + - @ \t \r` prefixed with `'` against spreadsheet formula injection).
- **`web/lib/hotel-eye/retention.ts`** — `deleteExpired(service, now)` → `{ rows, images }`.
- **`web/app/id/[token]/`** — page + client form (privacy notice first, then fields, camera/file input with browser resize reusing the M4 resize helper, success screen). Server Action `submitIdAction`. `serverActions.bodySizeLimit` raised to fit a resized image.
- **`web/app/privacy/page.tsx`** — draft policy, banner "Draft — pending legal review (O-01)", linked from the upload page.
- **`web/app/c/[token]/guest-booking-card.tsx`** — adds an "Upload your ID" prompt while the link is open, "ID received" once used, nothing once expired. Chat bubble linkifies `/id/<64-hex>` paths only.
- **`web/app/dashboard/guests/`** — register page (date-range filter, retention countdown), `[id]` record page (signed image, copy-to-clipboard fields, shorten-retention control), CSV link. Booking detail shows ID status (pending / received / expired). Nav gains no new mobile tab (see "Navigation and link visibility").
- **`web/app/api/guests/export/route.ts`** — `GET ?from&to`, host session, `text/csv`, `Content-Disposition: attachment`, no image data.
- **`web/app/api/cron/retention/route.ts`** + `vercel.json` cron `0 2 * * *` — `Authorization: Bearer $CRON_SECRET` or 401; runs `deleteExpired`.

## Error handling

- Unknown / expired / used token → a plain page ("This link has expired — ask your host to resend"), no booking details.
- Validation errors re-render the form with the message; the file is not retained server-side.
- Concurrent double submit → exactly one record; the loser's object is removed.
- Storage write fails → nothing inserted, link stays open. DB insert fails after the object was written → object deleted, link stays open.
- Cron: per-record failures are logged (id + error class, never the CNIC) and skipped so one bad object doesn't block the rest; a non-2xx response if any failed so Vercel shows it.

## Testing (real local Supabase; no mocks for `lib/`)

| Req | Proof |
|---|---|
| CNIC-01 | `mark_booking_paid` creates the link and the ack contains `/id/<token>`; the guest card test shows the prompt while open |
| CNIC-02 | expired/used/unknown token each refused by `submitGuestId` and the page |
| CNIC-03 | `submitGuestId` stores name, CNIC, phone and the **booking's** dates; client-supplied dates are ignored |
| CNIC-04 | anon cannot list/read/sign anything in `guest-ids`; bucket is not public |
| CNIC-05 | host gets a working signed URL that fails after expiry; no URL is ever persisted |
| CNIC-06 | success page and card render no image |
| CNIC-07 | the privacy notice and `/privacy` link render before the form's file input |
| CNIC-08 | record page renders each field with a copy button (component test) |
| CNIC-09 | `listRecords` date-range overlap, inclusive edges |
| CNIC-10 | CSV for a range: header, quoting, formula-injection escaping, only in-range rows, own organisation only |
| CNIC-11 | default expiry = `stay_end + 90 days` |
| CNIC-12 | shortening works; extending beyond the cap raises; non-owner cannot change it |
| CNIC-13 | `deleteExpired` removes rows and objects; leaves unexpired; re-run is a no-op; route 401s without the secret |
| CNIC-14 | countdown text for the remaining days, including "deletes tomorrow" and "expired" edges |
| CNIC-15 | org B cannot select A's `guest_documents`, `id_upload_links`, or storage objects |

Plus a prod-build browser walk (desktop + 390 px): pay → open `/id/<token>` → upload → success → host register → record → copy → CSV download → shorten retention → run the cron route locally with a past-dated record.

## Risks and notes

- **Legal (O-01):** the 90-day retention and the privacy wording are assumptions awaiting legal review; the draft banner and spec both say so. This milestone does not make real guest data acceptable on its own.
- **Image size:** Server Actions default to a 1 MB body; the form resizes in the browser and the limit is raised just enough. The server still enforces 4 MB and magic-byte type checks.
- **Free-plan cron:** Vercel Hobby crons run at most daily, which is all this needs; the job is idempotent so a missed day is caught the next.

## Navigation and link visibility (decided)

- **Guests register reachability:** the six-tab mobile bar is already full, so the register is **not** a new tab. It is reached from the dashboard Home (a "Guest IDs" shortcut) and from each booking's ID-status row. The desktop sidebar may list it, since that has room; the mobile bar stays at six.
- **Host sees the link:** the booking page shows the open upload link as a read-only copy-to-clipboard field (host can resend it over WhatsApp). It is hidden once the link is used or expired.
