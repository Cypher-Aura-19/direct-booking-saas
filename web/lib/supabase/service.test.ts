// @vitest-environment node
import { test, expect } from "vitest";
import { createServiceClient } from "./service";

// @req AI-17
test("createServiceClient throws when SUPABASE_SERVICE_ROLE_KEY is not set", () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    expect(() => createServiceClient()).toThrow("SUPABASE_SERVICE_ROLE_KEY is not set");
  } finally {
    if (previous !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  }
});

// Guards against a resolution failure, not just a behavioural one: this file
// imports service.ts, which starts with `import "server-only"`. Vitest has
// no bundler-level alias for that bare specifier the way Next/Turbopack do,
// so without the alias in vitest.config.mts this whole file fails before the
// test above even runs, with "Failed to resolve import server-only".
test("createServiceClient resolves and constructs a client when the key is set", () => {
  expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy();
  const client = createServiceClient();
  expect(client).toBeTruthy();
  expect(client.auth).toBeTruthy();
});
