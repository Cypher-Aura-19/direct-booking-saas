import type { SupabaseClient } from '@supabase/supabase-js'

export type Organization = {
  id: string
  owner_user_id: string
  name: string
  slug: string
  contact_phone: string
  contact_name: string
  contact_photo_url: string | null
  bio: string | null
  created_at: string
}

export async function createOrganization(
  supabase: SupabaseClient,
  input: { name: string; slug: string; contactPhone: string; contactName: string }
): Promise<Organization> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw userError ?? new Error('not authenticated')

  const { data, error } = await supabase
    .from('organizations')
    .insert({
      owner_user_id: userData.user.id,
      name: input.name,
      slug: input.slug,
      contact_phone: input.contactPhone,
      contact_name: input.contactName,
    })
    .select()
    .single()

  if (error) throw error
  return data as Organization
}

export async function getOrganizationForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select()
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as Organization | null
}
