import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from './supabase/test-helpers'
import { createOrganization } from './organizations'
import { createProperty, getProperty, updateProperty } from './properties'

describe('properties RLS', () => {
  let hostAId: string | null = null
  let hostBId: string | null = null

  afterEach(async () => {
    if (hostAId) await deleteTestUser(hostAId)
    if (hostBId) await deleteTestUser(hostBId)
    hostAId = null
    hostBId = null
  })

  it("a second host cannot read or update the first host's property", async () => {
    const hostA = await createTestUser()
    hostAId = hostA.userId
    const orgA = await createOrganization(hostA.client, {
      name: 'Hunza View Guesthouse',
      slug: `hunza-view-${hostA.userId.slice(0, 8)}`,
      contactPhone: '03001234567',
      contactName: 'Ali Khan',
    })
    const property = await createProperty(hostA.client, {
      organizationId: orgA.id,
      name: 'Deluxe Cabin',
      slug: 'deluxe-cabin',
      maxGuests: 4,
      nightlyRatePkr: 8000,
    })

    const hostB = await createTestUser()
    hostBId = hostB.userId

    const seenByHostB = await getProperty(hostB.client, property.id)
    expect(seenByHostB).toBeNull()

    await expect(
      updateProperty(hostB.client, property.id, { wifiPassword: 'hacked' })
    ).rejects.toThrow()
  })
})
