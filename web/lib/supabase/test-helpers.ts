import { createClient } from '@supabase/supabase-js'
import { createServiceRoleSupabaseClient } from './service-role'

let counter = 0

export async function createTestUser() {
  counter += 1
  const email = `test-user-${Date.now()}-${counter}@example.com`
  const password = 'test-password-123'

  const admin = createServiceRoleSupabaseClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw error ?? new Error('failed to create test user')

  const signedInClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: session, error: signInError } = await signedInClient.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !session.session) throw signInError ?? new Error('failed to sign in test user')

  return { userId: data.user.id, client: signedInClient, email }
}

export async function deleteTestUser(userId: string) {
  const admin = createServiceRoleSupabaseClient()
  await admin.auth.admin.deleteUser(userId)
}
