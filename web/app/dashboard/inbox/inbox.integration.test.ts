// @vitest-environment node
import { test, expect, beforeAll, afterAll, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createProperty, setPropertyPublished } from "@/lib/properties/basics";
import { startConversation, getConversation } from "@/lib/chat/conversations";
import { createTestHostWithOrg, supabaseAdmin } from "@/tests/helpers";
import { refreshMessagesAction, sendHostMessageAction, setAiEnabledAction } from "./actions";

// dashboardContext() reads the request's cookies via next/headers, which
// has no meaning outside a real request — every dashboard Server Action
// test in this repo mocks dashboardContext() to return a real signed-in
// host's own client instead (see ai-settings/actions.test.ts, M8). vi.mock
// is hoisted above every import in this file (including the ./actions one
// above), so actions.ts's own "../_lib/context" import — which resolves to
// the same module this mock targets, since both files live in
// web/app/dashboard/inbox/ — picks up the mock automatically.
let host: Awaited<ReturnType<typeof createTestHostWithOrg>>;
vi.mock("../_lib/context", () => ({
  dashboardContext: async () => ({ supabase: host.supabase, organization: { id: host.organizationId, slug: host.organizationSlug, name: "Test Org" } }),
}));

// revalidatePath() is the other half of the Next.js request machinery this
// file has no real request for: it needs a static-generation/work-unit
// store that Next only sets up while actually rendering a route or running
// a Server Action inside its own server, and throws an "Invariant: static
// generation store missing" otherwise. setAiEnabledAction and
// sendHostMessageAction both call it purely as a cache-invalidation side
// effect after their real work (setAiEnabled/addMessage) has already
// committed — nothing this file asserts on depends on revalidation firing,
// so it's stubbed out the same way dashboardContext() is above.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let service: SupabaseClient;
let propertyId: string;
let conversationId: string;

beforeAll(async () => {
  host = await createTestHostWithOrg();
  service = supabaseAdmin();
  const { propertyId: id, error } = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "Integration Cabin", property_type: "cabin", address: "Somewhere", base_rate_cents: 500_000, max_guests: 2 },
  });
  if (error) throw new Error(error);
  propertyId = id!;
  await setPropertyPublished(host.supabase, propertyId, true);
  const started = await startConversation(service, propertyId);
  if (!("token" in started)) throw new Error("could not start conversation");
  conversationId = (await getConversation(service, started.token))!.id;
});

afterAll(async () => {
  await host?.cleanup();
});

// @req INBOX-04
// @req INBOX-06
// @req INBOX-07
test("the full take-over loop: turn AI off, send as host, turn it back on, message is stored and readable", async () => {
  await setAiEnabledAction(conversationId, false);
  let { data: row } = await service.from("conversations").select("ai_enabled").eq("id", conversationId).single();
  expect(row!.ai_enabled).toBe(false);

  const formData = new FormData();
  formData.set("body", "I'll confirm your dates shortly.");
  const sendResult = await sendHostMessageAction(conversationId, { error: null, success: false }, formData);
  expect(sendResult).toEqual({ error: null, success: true });

  await setAiEnabledAction(conversationId, true);
  ({ data: row } = await service.from("conversations").select("ai_enabled").eq("id", conversationId).single());
  expect(row!.ai_enabled).toBe(true);

  const messages = await refreshMessagesAction(conversationId);
  expect(messages.map((m) => [m.sender, m.body])).toContainEqual(["host", "I'll confirm your dates shortly."]);
});

// @req INBOX-09
test("refreshMessagesAction marks the conversation read as a side effect", async () => {
  await refreshMessagesAction(conversationId);
  const { data } = await service.from("conversations").select("host_last_read_at").eq("id", conversationId).single();
  expect(data!.host_last_read_at).not.toBeNull();
});

// @req INBOX-02
// Every UI test in Tasks 4/5 mocks the realtime channel entirely (a fake
// object that immediately calls back "SUBSCRIBED") — none of them proves a
// message actually arrives over a live channel. This is the one real,
// end-to-end proof: a genuine @supabase/supabase-js client (host.supabase,
// signed in exactly like the browser client will be) opens a real
// postgres_changes subscription against the local stack's real Realtime
// service, a service-role insert simulates a guest message landing, and the
// callback must fire with that row. The conversations-table path
// (ai_enabled/escalated changes) shares the identical publication and
// postgres_changes mechanism — this one test is the proof for both; a
// second, near-identical WebSocket test would only add flakiness, not
// coverage of anything materially different.
test("a message inserted by the service role arrives over the host's own realtime subscription", async () => {
  const received = new Promise<{ body: string }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("realtime event did not arrive within 10s")), 10_000);
    host.supabase
      .channel(`test-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        // The first test in this file already inserted a host message into
        // this same conversationId a moment earlier; Postgres logical
        // replication (what Realtime's postgres_changes is built on) can
        // still be draining that earlier WAL entry when this subscription
        // goes SUBSCRIBED, so the very first callback invocation isn't
        // guaranteed to be *this* probe row. Matching on body content (not
        // just "an insert happened") is what makes this still a real proof
        // of live delivery rather than a coincidental pass on stale data.
        (payload) => {
          const row = payload.new as { body: string };
          if (row.body !== "Realtime probe message") return;
          clearTimeout(timeout);
          resolve(row);
        },
      )
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        // Must be awaited: a supabase-js query builder is a lazy thenable and
        // sends nothing until awaited, so `void builder` never inserts.
        const { error } = await service.from("messages").insert({ conversation_id: conversationId, sender: "guest", body: "Realtime probe message" });
        if (error) { clearTimeout(timeout); reject(error); }
      });
  });
  expect((await received).body).toBe("Realtime probe message");
}, 15_000);
