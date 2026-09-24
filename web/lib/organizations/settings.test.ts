// @vitest-environment node
import { test, expect } from "vitest";
import { getCurrentOrganization, updateOrganizationSettings } from "./settings";
import { createTestHostWithOrg } from "../../tests/helpers";

const uniqueSlug = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

// @req PROP-13
test("a host can edit organisation name, public slug and catalogue headline", async () => {
  const host = await createTestHostWithOrg();
  try {
    await host.supabase.from("organizations").update({ profile: { city: "Lahore", phone: "0300-1234567" } }).eq("id", host.organizationId);

    const slug = uniqueSlug("hunza-stays");
    const { error } = await updateOrganizationSettings(host.supabase, {
      organizationId: host.organizationId,
      name: "Hunza Stays",
      slug,
      headline: "Four cabins above the Attabad lake",
    });
    expect(error).toBeNull();

    expect(await getCurrentOrganization(host.supabase, host.userId)).toEqual({
      id: host.organizationId,
      name: "Hunza Stays",
      slug,
      headline: "Four cabins above the Attabad lake",
    });

    // Onboarding's city and phone survive the headline being merged in.
    const { data } = await host.supabase.from("organizations").select("profile").eq("id", host.organizationId).single();
    expect(data!.profile).toMatchObject({ city: "Lahore", phone: "0300-1234567" });
  } finally {
    await host.cleanup();
  }
});

// @req PROP-13
test("organisation settings reject a malformed, reserved or taken slug and keep the old one", async () => {
  const host = await createTestHostWithOrg();
  const other = await createTestHostWithOrg();
  try {
    const base = { organizationId: host.organizationId, name: "Hunza Stays", headline: "" };
    expect((await updateOrganizationSettings(host.supabase, { ...base, slug: "Bad Slug" })).error).toMatch(/lowercase/);
    expect((await updateOrganizationSettings(host.supabase, { ...base, slug: "dashboard" })).error).toMatch(/reserved/);
    expect((await updateOrganizationSettings(host.supabase, { ...base, slug: other.organizationSlug })).error).toMatch(/taken/);
    expect((await updateOrganizationSettings(host.supabase, { ...base, name: " ", slug: host.organizationSlug })).error).toMatch(/name/i);
    expect((await updateOrganizationSettings(host.supabase, { ...base, slug: host.organizationSlug, headline: "x".repeat(121) })).error).toMatch(/headline/i);

    expect((await getCurrentOrganization(host.supabase, host.userId))!.slug).toBe(host.organizationSlug);
  } finally {
    await host.cleanup();
    await other.cleanup();
  }
});

// @req PROP-14
test("a host cannot edit another organisation's settings", async () => {
  const owner = await createTestHostWithOrg();
  const intruder = await createTestHostWithOrg();
  try {
    const { error } = await updateOrganizationSettings(intruder.supabase, {
      organizationId: owner.organizationId,
      name: "Hijacked",
      slug: uniqueSlug("hijacked"),
      headline: "",
    });
    expect(error).not.toBeNull();
    expect(await getCurrentOrganization(intruder.supabase, owner.userId)).toBeNull();
    expect((await getCurrentOrganization(owner.supabase, owner.userId))!.name).toBe("Test Org");
  } finally {
    await owner.cleanup();
    await intruder.cleanup();
  }
});

test("getCurrentOrganization treats a malformed owner id as no organisation", async () => {
  const host = await createTestHostWithOrg();
  try {
    expect(await getCurrentOrganization(host.supabase, "not-a-uuid")).toBeNull();
  } finally {
    await host.cleanup();
  }
});
