import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from './supabase/test-helpers'
import { createOrganization } from './organizations'
import { createProperty, listPropertiesForOrganization, getProperty, updateProperty } from './properties'

describe('properties', () => {
  let userId: string | null = null

  afterEach(async () => {
    if (userId) await deleteTestUser(userId)
    userId = null
  })

  it("creates a property scoped to the caller's organization with expected defaults", async () => {
    const user = await createTestUser()
    userId = user.userId
    const org = await createOrganization(user.client, {
      name: 'Hunza View Guesthouse',
      slug: `hunza-view-${user.userId.slice(0, 8)}`,
      contactPhone: '03001234567',
      contactName: 'Ali Khan',
    })

    const property = await createProperty(user.client, {
      organizationId: org.id,
      name: 'Deluxe Cabin',
      slug: 'deluxe-cabin',
      maxGuests: 4,
      nightlyRatePkr: 8000,
    })

    expect(property.organization_id).toBe(org.id)
    expect(property.status).toBe('draft')
    expect(property.airbnb_verified).toBe(false)
    expect(property.minimum_nights).toBe(1)
  })

  it('lists only properties belonging to the given organization', async () => {
    const user = await createTestUser()
    userId = user.userId
    const org = await createOrganization(user.client, {
      name: 'Naran Cabins',
      slug: `naran-cabins-${user.userId.slice(0, 8)}`,
      contactPhone: '03009999999',
      contactName: 'Sara Ahmed',
    })
    await createProperty(user.client, {
      organizationId: org.id,
      name: 'Garden Room',
      slug: 'garden-room',
      maxGuests: 2,
      nightlyRatePkr: 5000,
    })

    const properties = await listPropertiesForOrganization(user.client, org.id)
    expect(properties).toHaveLength(1)
    expect(properties[0].name).toBe('Garden Room')
  })

  it('updateProperty modifies the row and getProperty reflects the change', async () => {
    const user = await createTestUser()
    userId = user.userId
    const org = await createOrganization(user.client, {
      name: 'Skardu Stays',
      slug: `skardu-stays-${user.userId.slice(0, 8)}`,
      contactPhone: '03005555555',
      contactName: 'Bilal Raza',
    })
    const property = await createProperty(user.client, {
      organizationId: org.id,
      name: 'Lake View Room',
      slug: 'lake-view-room',
      maxGuests: 2,
      nightlyRatePkr: 6000,
    })

    await updateProperty(user.client, property.id, { wifiPassword: 'skardu-guest-2026' })

    const updated = await getProperty(user.client, property.id)
    expect(updated?.wifi_password).toBe('skardu-guest-2026')
  })
})
