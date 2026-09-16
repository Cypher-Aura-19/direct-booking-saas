import { describe, it, expect } from 'vitest'
import { createServiceRoleSupabaseClient } from './service-role'

describe('createServiceRoleSupabaseClient', () => {
  it('can connect to the local Supabase instance and query organizations', async () => {
    const supabase = createServiceRoleSupabaseClient()
    const { error } = await supabase.from('organizations').select('id').limit(1)
    expect(error).toBeNull()
  })
})
