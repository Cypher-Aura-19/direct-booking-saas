'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrganizationForUser } from '@/lib/organizations'
import { createProperty } from '@/lib/properties'

export async function createPropertyAction(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const org = await getOrganizationForUser(supabase, userData.user.id)
  if (!org) redirect('/dashboard/onboarding')

  let property
  try {
    property = await createProperty(supabase, {
      organizationId: org.id,
      name: String(formData.get('name')),
      slug: String(formData.get('slug')),
      maxGuests: Number(formData.get('maxGuests')),
      nightlyRatePkr: Number(formData.get('nightlyRatePkr')),
      description: String(formData.get('description') ?? ''),
      address: String(formData.get('address') ?? ''),
      city: String(formData.get('city') ?? ''),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create property'
    redirect(`/dashboard/properties/new?error=${encodeURIComponent(message)}`)
  }

  redirect(`/dashboard/properties/${property.id}`)
}
