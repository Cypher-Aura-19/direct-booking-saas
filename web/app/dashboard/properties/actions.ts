"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { dashboardContext } from "../_lib/context";
import {
  createProperty,
  parsePropertyBasics,
  setPropertyPublished,
  updatePropertyBasics,
} from "@/lib/properties/basics";
import { parseKnowledgeBase, updateKnowledgeBase } from "@/lib/properties/knowledge-base";
import { parseListing, updateListing } from "@/lib/properties/listing";
import { deletePropertyPhoto, reorderPropertyPhotos, setCoverPhoto } from "@/lib/properties/photos";

export type FormState = { error: string | null; success: boolean };

function basicsFrom(formData: FormData) {
  return parsePropertyBasics({
    name: formData.get("name"),
    propertyType: formData.get("propertyType"),
    address: formData.get("address"),
    baseRate: formData.get("baseRate"),
    maxGuests: formData.get("maxGuests"),
  });
}

function refreshProperties() {
  revalidatePath("/dashboard/properties", "layout");
}

// Explicit Promise<FormState> return types throughout: redirect() never
// returns, and without the annotation TS infers a state type that no longer
// matches useActionState's initial state, failing `next build` (see M3).
export async function createPropertyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = basicsFrom(formData);
  if (!parsed.ok) return { error: parsed.error, success: false };
  const { supabase, organization } = await dashboardContext();
  const { error, propertyId } = await createProperty(supabase, {
    organizationId: organization.id,
    basics: parsed.value,
  });
  if (error) return { error, success: false };
  refreshProperties();
  redirect(`/dashboard/properties/${propertyId}/photos`);
}

export async function updatePropertyAction(
  propertyId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = basicsFrom(formData);
  if (!parsed.ok) return { error: parsed.error, success: false };
  const { supabase } = await dashboardContext();
  const { error } = await updatePropertyBasics(supabase, propertyId, parsed.value);
  if (error) return { error, success: false };
  refreshProperties();
  return { error: null, success: true };
}

export async function setPublishedAction(propertyId: string, published: boolean): Promise<void> {
  const { supabase } = await dashboardContext();
  const { error } = await setPropertyPublished(supabase, propertyId, published);
  // The toggle is a plain <form action>, with no state to render an error
  // into; throwing hands it to Next's error boundary instead of pretending
  // the property changed visibility.
  if (error) throw new Error(error);
  refreshProperties();
}

export async function updateKnowledgeBaseAction(
  propertyId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseKnowledgeBase(Object.fromEntries(formData));
  if (!parsed.ok) return { error: parsed.error, success: false };
  const { supabase } = await dashboardContext();
  const { error } = await updateKnowledgeBase(supabase, propertyId, parsed.value);
  if (error) return { error, success: false };
  refreshProperties();
  return { error: null, success: true };
}

export async function updateListingAction(propertyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseListing({
    description: String(formData.get("description") ?? ""),
    amenities: formData.getAll("amenities").map(String),
  });
  if ("error" in parsed) return { error: parsed.error, success: false };
  const { supabase } = await dashboardContext();
  const { error } = await updateListing(supabase, propertyId, parsed.listing);
  if (error) return { error, success: false };
  revalidatePath(`/dashboard/properties/${propertyId}`);
  return { error: null, success: true };
}

export async function reorderPhotosAction(propertyId: string, orderedIds: string[]): Promise<{ error: string | null }> {
  const { supabase } = await dashboardContext();
  const result = await reorderPropertyPhotos(supabase, { propertyId, orderedIds });
  refreshProperties();
  return result;
}

export async function setCoverPhotoAction(propertyId: string, photoId: string): Promise<{ error: string | null }> {
  const { supabase } = await dashboardContext();
  const result = await setCoverPhoto(supabase, photoId);
  refreshProperties();
  return result;
}

export async function deletePhotoAction(propertyId: string, photoId: string): Promise<{ error: string | null }> {
  const { supabase } = await dashboardContext();
  const result = await deletePropertyPhoto(supabase, photoId);
  refreshProperties();
  return result;
}
