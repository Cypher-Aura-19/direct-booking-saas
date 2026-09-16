import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from './supabase/test-helpers'
import { createOrganization, getOrganizationForUser } from './organizations'

describe('organizations', () => {
  let userId: string | null = null

  afterEach(async () => {
    if (userId) await deleteTestUser(userId)
    userId = null
  })

  it('creates an organization owned by the current user', async () => {
    const user = await createTestUser()
    userId = user.userId

    const org = await createOrganization(user.client, {
      name: 'Hunza View Guesthouse',
      slug: `hunza-view-${user.userId.slice(0, 8)}`,
      contactPhone: '03001234567',
      contactName: 'Ali Khan',
    })

    expect(org.owner_user_id).toBe(user.userId)
    expect(org.name).toBe('Hunza View Guesthouse')
  })

  it('getOrganizationForUser returns null when the user has no organization yet', async () => {
    const user = await createTestUser()
    userId = user.userId

    const org = await getOrganizationForUser(user.client, user.userId)
    expect(org).toBeNull()
  })

  it('getOrganizationForUser returns the organization once one exists', async () => {
    const user = await createTestUser()
    userId = user.userId

    await createOrganization(user.client, {
      name: 'Naran Cabins',
      slug: `naran-cabins-${user.userId.slice(0, 8)}`,
      contactPhone: '03009999999',
      contactName: 'Sara Ahmed',
    })

    const org = await getOrganizationForUser(user.client, user.userId)
    expect(org?.name).toBe('Naran Cabins')
  })
})
