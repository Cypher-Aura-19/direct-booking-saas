// @vitest-environment node
import { test, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  RESERVED_SLUGS,
  isValidSlugFormat,
  isReservedSlug,
  isSlugAvailable,
  createOrganization,
} from "./actions";
import { supabaseEnv, createTestHost } from "../../tests/helpers";
import { resolveDashboardAccess } from "../auth/dashboard-access";

test("isValidSlugFormat accepts lowercase letters, digits and hyphens", () => {
  expect(isValidSlugFormat("sunset-villas-lahore")).toBe(true);
  expect(isValidSlugFormat("ab")).toBe(false); // too short
  expect(isValidSlugFormat("Has-Capitals")).toBe(false);
  expect(isValidSlugFormat("trailing-")).toBe(false);
  expect(isValidSlugFormat("has spaces")).toBe(false);
});

// @req AUTH-11
test("every reserved word is rejected", () => {
  for (const word of RESERVED_SLUGS) {
    expect(isReservedSlug(word)).toBe(true);
  }
  expect(isReservedSlug("sunset-villas-lahore")).toBe(false);
});

// @req AUTH-09
// @req AUTH-12
test("onboarding creates an organisation with name, slug, city and phone", async () => {
  const { apiUrl, anonKey } = supabaseEnv();
  const host = await createTestHost();
  try {
    const supabase = createClient(apiUrl, anonKey);
    await supabase.auth.signInWithPassword({ email: host.email, password: host.password });

    const slug = `sunset-villas-${crypto.randomUUID().slice(0, 8)}`;
    const { error, organizationId } = await createOrganization(supabase, {
      ownerId: host.userId,
      name: "Sunset Villas",
      slug,
      city: "Lahore",
      phone: "0300-1234567",
    });
    expect(error).toBeNull();
    expect(organizationId).toBeTruthy();

    const { data } = await supabase
      .from("organizations")
      .select("name, slug, profile")
      .eq("id", organizationId)
      .single();
    expect(data?.name).toBe("Sunset Villas");
    expect(data?.slug).toBe(slug);
    expect(data?.profile.city).toBe("Lahore");
    expect(data?.profile.phone).toBe("0300-1234567");
  } finally {
    await host.cleanup();
  }
});

// @req AUTH-10
test("the slug field rejects a slug already in use, even for a host who doesn't own it", async () => {
  const { apiUrl, anonKey } = supabaseEnv();
  const hostA = await createTestHost();
  const hostB = await createTestHost();
  try {
    const slug = `taken-slug-${crypto.randomUUID().slice(0, 8)}`;

    const supabaseA = createClient(apiUrl, anonKey);
    await supabaseA.auth.signInWithPassword({ email: hostA.email, password: hostA.password });
    const created = await createOrganization(supabaseA, {
      ownerId: hostA.userId,
      name: "Org A",
      slug,
      city: "Lahore",
      phone: "0300-0000000",
    });
    expect(created.error).toBeNull();

    // hostB owns no organisation at all and cannot see hostA's row under
    // RLS — this is exactly the case a plain `select` would get wrong.
    const supabaseB = createClient(apiUrl, anonKey);
    await supabaseB.auth.signInWithPassword({ email: hostB.email, password: hostB.password });
    const availableToB = await isSlugAvailable(supabaseB, slug);
    expect(availableToB).toBe(false);

    const { error } = await createOrganization(supabaseB, {
      ownerId: hostB.userId,
      name: "Org B",
      slug,
      city: "Karachi",
      phone: "0300-1111111",
    });
    expect(error).not.toBeNull();
  } finally {
    await hostA.cleanup();
    await hostB.cleanup();
  }
});

// @req AUTH-12
test("a host who completes onboarding still resolves to 'allow' after logging out and back in", async () => {
  const { apiUrl, anonKey } = supabaseEnv();
  const host = await createTestHost();
  try {
    const supabase = createClient(apiUrl, anonKey);
    await supabase.auth.signInWithPassword({ email: host.email, password: host.password });

    const slug = `stays-onboarded-${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await createOrganization(supabase, {
      ownerId: host.userId,
      name: "Stays Onboarded Villas",
      slug,
      city: "Lahore",
      phone: "0300-1234567",
    });
    expect(error).toBeNull();

    await supabase.auth.signOut();
    await supabase.auth.signInWithPassword({ email: host.email, password: host.password });

    const { data: organization } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", host.userId)
      .maybeSingle();

    const { data: userData } = await supabase.auth.getUser();
    expect(resolveDashboardAccess({ user: userData.user, organization })).toBe("allow");
  } finally {
    await host.cleanup();
  }
});
