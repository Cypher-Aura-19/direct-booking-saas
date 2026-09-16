'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateProperty, type UpdatePropertyInput } from '@/lib/properties'

export async function updatePropertyAction(propertyId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient()

  const fields = [
    'name', 'description', 'address', 'city',
    'wifiNetwork', 'wifiPassword', 'gateCode', 'generatorInstructions',
    'geyserInstructions', 'acInstructions', 'parkingInstructions',
    'checkinTime', 'checkoutTime', 'directions', 'nearbyRecommendations',
    'houseRules', 'additionalNotes', 'airbnbListingUrl',
  ] as const satisfies readonly (keyof UpdatePropertyInput)[]

  const input: UpdatePropertyInput = {}
  for (const field of fields) {
    const value = formData.get(field)
    if (value !== null) input[field] = String(value)
  }

  try {
    await updateProperty(supabase, propertyId, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update property'
    redirect(`/dashboard/properties/${propertyId}?error=${encodeURIComponent(message)}`)
  }

  revalidatePath(`/dashboard/properties/${propertyId}`)
  redirect(`/dashboard/properties/${propertyId}?saved=true`)
}

export async function togglePublishAction(propertyId: string, nextStatus: 'draft' | 'published') {
  const supabase = await createServerSupabaseClient()
  await updateProperty(supabase, propertyId, { status: nextStatus })
  revalidatePath(`/dashboard/properties/${propertyId}`)
  revalidatePath('/dashboard')
}
