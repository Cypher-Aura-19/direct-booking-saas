import { describe, it, expect, afterEach } from 'vitest'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/service-role'
import { createTestUser, deleteTestUser } from '@/lib/supabase/test-helpers'

describe('auth', () => {
  let userId: string | null = null

  afterEach(async () => {
    if (userId) await deleteTestUser(userId)
    userId = null
  })

  it('a created user can sign in and gets a valid session', async () => {
    const user = await createTestUser()
    userId = user.userId

    const { data, error } = await user.client.auth.getUser()
    expect(error).toBeNull()
    expect(data.user?.id).toBe(user.userId)
  })

  it('an unconfirmed random credential cannot sign in', async () => {
    const admin = createServiceRoleSupabaseClient()
    const { error } = await admin.auth.signInWithPassword({
      email: 'nobody@example.com',
      password: 'wrong-password',
    })
    expect(error).not.toBeNull()
  })
})
