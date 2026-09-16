'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createOrganization } from '@/lib/organizations'

export async function createOrganizationAction(formData: FormData) {
  const supabase = await createServerSupabaseClient()

  try {
    await createOrganization(supabase, {
      name: String(formData.get('name')),
      slug: String(formData.get('slug')),
      contactPhone: String(formData.get('contactPhone')),
      contactName: String(formData.get('contactName')),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create organization'
    redirect(`/dashboard/onboarding?error=${encodeURIComponent(message)}`)
  }

  redirect('/dashboard')
}
