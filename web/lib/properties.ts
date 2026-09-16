import type { SupabaseClient } from '@supabase/supabase-js'

export type Property = {
  id: string
  organization_id: string
  name: string
  slug: string
  description: string | null
  address: string | null
  city: string | null
  max_guests: number
  nightly_rate_pkr: number
  minimum_nights: number
  status: 'draft' | 'published'
  wifi_network: string | null
  wifi_password: string | null
  gate_code: string | null
  generator_instructions: string | null
  geyser_instructions: string | null
  ac_instructions: string | null
  parking_instructions: string | null
  checkin_time: string | null
  checkout_time: string | null
  directions: string | null
  nearby_recommendations: string | null
  house_rules: string | null
  additional_notes: string | null
  airbnb_listing_url: string | null
  airbnb_verification_code: string | null
  airbnb_verified: boolean
  airbnb_verified_at: string | null
  created_at: string
}

export type CreatePropertyInput = {
  organizationId: string
  name: string
  slug: string
  maxGuests: number
  nightlyRatePkr: number
  description?: string
  address?: string
  city?: string
}

export async function createProperty(
  supabase: SupabaseClient,
  input: CreatePropertyInput
): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .insert({
      organization_id: input.organizationId,
      name: input.name,
      slug: input.slug,
      max_guests: input.maxGuests,
      nightly_rate_pkr: input.nightlyRatePkr,
      description: input.description,
      address: input.address,
      city: input.city,
    })
    .select()
    .single()

  if (error) throw error
  return data as Property
}

export async function listPropertiesForOrganization(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select()
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Property[]
}

export async function getProperty(
  supabase: SupabaseClient,
  propertyId: string
): Promise<Property | null> {
  const { data, error } = await supabase
    .from('properties')
    .select()
    .eq('id', propertyId)
    .maybeSingle()

  if (error) throw error
  return data as Property | null
}

export type UpdatePropertyInput = Partial<{
  name: string
  description: string
  address: string
  city: string
  maxGuests: number
  nightlyRatePkr: number
  minimumNights: number
  status: 'draft' | 'published'
  wifiNetwork: string
  wifiPassword: string
  gateCode: string
  generatorInstructions: string
  geyserInstructions: string
  acInstructions: string
  parkingInstructions: string
  checkinTime: string
  checkoutTime: string
  directions: string
  nearbyRecommendations: string
  houseRules: string
  additionalNotes: string
  airbnbListingUrl: string
}>

const UPDATE_COLUMN_MAP: Record<keyof UpdatePropertyInput, string> = {
  name: 'name',
  description: 'description',
  address: 'address',
  city: 'city',
  maxGuests: 'max_guests',
  nightlyRatePkr: 'nightly_rate_pkr',
  minimumNights: 'minimum_nights',
  status: 'status',
  wifiNetwork: 'wifi_network',
  wifiPassword: 'wifi_password',
  gateCode: 'gate_code',
  generatorInstructions: 'generator_instructions',
  geyserInstructions: 'geyser_instructions',
  acInstructions: 'ac_instructions',
  parkingInstructions: 'parking_instructions',
  checkinTime: 'checkin_time',
  checkoutTime: 'checkout_time',
  directions: 'directions',
  nearbyRecommendations: 'nearby_recommendations',
  houseRules: 'house_rules',
  additionalNotes: 'additional_notes',
  airbnbListingUrl: 'airbnb_listing_url',
}

export async function updateProperty(
  supabase: SupabaseClient,
  propertyId: string,
  input: UpdatePropertyInput
): Promise<Property> {
  const columns: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    columns[UPDATE_COLUMN_MAP[key as keyof UpdatePropertyInput]] = value
  }

  const { data, error } = await supabase
    .from('properties')
    .update(columns)
    .eq('id', propertyId)
    .select()
    .single()

  if (error) throw error
  return data as Property
}
