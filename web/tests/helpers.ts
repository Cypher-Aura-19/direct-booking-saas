import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

let cachedEnv: { apiUrl: string; anonKey: string; serviceRoleKey: string; mailpitUrl: string } | undefined;

// execSync always goes through a shell, so "npx" resolves correctly on
// Windows without the execFileSync("npx.cmd", ..., {shell:true}) dance
// tests/db/helpers.mjs needed at the repo root — no DEP0190 noise here.
export function supabaseEnv() {
  if (cachedEnv) return cachedEnv;
  const raw = execSync("npx supabase status -o json", { cwd: repoRoot, encoding: "utf8" });
  const status = JSON.parse(raw);
  cachedEnv = {
    apiUrl: status.API_URL,
    anonKey: status.ANON_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
    mailpitUrl: status.MAILPIT_URL,
  };
  return cachedEnv;
}

// Creates a real auth.users row with a real, known password, via the local
// GoTrue admin API. Callers must call cleanup().
export async function createTestHost(overrides: { emailConfirm?: boolean } = {}) {
  const { apiUrl, serviceRoleKey } = supabaseEnv();
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `test-host-${crypto.randomUUID()}@example.test`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: overrides.emailConfirm ?? true,
  });
  if (error) throw error;
  const userId = data.user.id;
  return {
    userId,
    email,
    password,
    async cleanup() {
      await admin.auth.admin.deleteUser(userId);
    },
  };
}

export function supabaseAdmin() {
  const { apiUrl, serviceRoleKey } = supabaseEnv();
  return createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type MailpitMessage = { ID: string; To: Array<{ Address: string }>; Subject: string };

// Polls Mailpit (the local stack's email-testing service) for the most
// recent message to `email`, up to `timeoutMs`. Returns its rendered text
// and HTML bodies. Real email delivery, not a mock.
export async function pollMailpitFor(
  email: string,
  { timeoutMs = 10_000, intervalMs = 250 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<{ subject: string; text: string; html: string }> {
  const { mailpitUrl } = supabaseEnv();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const listResponse = await fetch(`${mailpitUrl}/api/v1/messages`);
    const list = (await listResponse.json()) as { messages: MailpitMessage[] };
    const match = list.messages.find((m) => m.To.some((to) => to.Address === email));
    if (match) {
      const detailResponse = await fetch(`${mailpitUrl}/api/v1/message/${match.ID}`);
      const detail = (await detailResponse.json()) as { Subject: string; Text: string; HTML: string };
      return { subject: detail.Subject, text: detail.Text, html: detail.HTML };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`no email arrived for ${email} within ${timeoutMs}ms`);
}

// Extracts the first http(s) URL from an email body, regardless of the
// exact Supabase email template wording — robust to template changes.
//
// The HTML body Supabase's default templates render encodes `&` as `&amp;`
// inside href attributes (standard HTML escaping). A GoTrue confirmation
// link has multiple query params (token, type, redirect_to) joined by `&`,
// so pulling the raw match out of HTML leaves literal "&amp;" in the URL —
// `&type=signup` becomes `&amp;type=signup`, which parses as a query param
// named "amp;type" instead of "type". GoTrue then can't tell what the link
// is for and silently fails to confirm the user. Decoding the entity here
// (rather than in every caller) keeps callers free to pass mail.html.
export function firstLinkIn(text: string): string {
  const match = text.match(/https?:\/\/[^\s"<>]+/);
  if (!match) throw new Error(`no link found in: ${text}`);
  return match[0].replace(/&amp;/g, "&");
}
