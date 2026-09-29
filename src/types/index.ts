export type City = 'Gramado' | 'Canela' | 'Nova Petrópolis';

export type PlaceCategory = 
  | 'parque' 
  | 'restaurante' 
  | 'cafe' 
  | 'museu' 
  | 'vinicola' 
  | 'chocolate' 
  | 'mirante' 
  | 'show' 
  | 'compras'
  | 'noturno';

export type IndoorType = 'indoor' | 'outdoor' | 'mixed' | 'rain_ok';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface PlacePriceInfo {
  adult_price: number;
  child_price?: number;
  senior_price?: number;
  is_free: boolean;
  currency: string;
  source_name: string;
  checked_at: string;
  valid_until?: string;
  confidence: ConfidenceLevel;
}

export type DataStatus = 
  | 'DISCOVERED' 
  | 'PENDING_REVIEW' 
  | 'VERIFIED' 
  | 'ACTIVE' 
  | 'INACTIVE' 
  | 'REJECTED' 
  | 'STALE';

export type BusinessStatus = 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';

export type WalkingIntensity = 'LOW' | 'MODERATE' | 'HIGH';

export type CostBand = 'FREE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'PREMIUM' | 'UNKNOWN' | 'ECONOMICO' | 'MODERADO' | 'SUPERIOR';

export type PriceSeasonality = 'LOW_SEASON' | 'REGULAR' | 'HIGH_SEASON' | 'SPECIAL_EVENT';

export interface FieldProvenance {
  coordinates_source?: string;
  hours_source?: string;
  cost_source?: string;
  duration_source?: string;
  tags_source?: string;
  children_profile_source?: string;
  senior_profile_source?: string;
}

export interface DataObservation {
  id: string;
  place_id: string;
  field_name: string;
  value: any;
  source_id: string;
  source_name: string;
  source_url?: string;
  observed_at: string;
  valid_from?: string;
  valid_until?: string;
  confidence: ConfidenceLevel;
}

export interface PriceObservation {
  id: string;
  place_id: string;
  seasonality: PriceSeasonality;
  cost_category: CostBand;
  estimated_min: number;
  estimated_max: number;
  currency: string;
  source_name: string;
  source_url?: string;
  observed_at: string;
  valid_until?: string;
  confidence: ConfidenceLevel;
  notes?: string;
}

export type DataFreshnessStatus = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';

export interface FieldFreshness {
  field_name: string;
  status: DataFreshnessStatus;
  last_observed_at?: string;
  age_days?: number;
  max_age_days: number;
}

export interface PlaceFreshnessReport {
  place_id: string;
  overall_status: DataFreshnessStatus;
  is_stale: boolean;
  needs_validation: boolean;
  fields: FieldFreshness[];
}

export interface DataQualityScore {
  place_id: string;
  score: number; // 0 - 100
  grade: 'A' | 'B' | 'C' | 'D';
  breakdown: {
    has_coordinates: boolean;
    has_place_id: boolean;
    has_hours: boolean;
    has_cost_range: boolean;
    has_tags: boolean;
    is_fresh: boolean;
    source_reliability: ConfidenceLevel;
    verified: boolean;
  };
  missing_fields: string[];
}

export type IngestionJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export interface DataIngestionJob {
  id: string;
  source_id: string;
  source_name: string;
  started_at: string;
  finished_at?: string;
  status: IngestionJobStatus;
  records_found: number;
  records_created: number;
  records_updated: number;
  records_flagged: number;
  estimated_cost_brl: number;
  ai_calls_count: number;
  provider_calls_count: number;
  errors: string[];
}

export interface DataSourceInfo {
  id: string;
  name: string;
  type: 'OFFICIAL_WEBSITE' | 'OFFICIAL_TOURISM' | 'OFFICIAL_API' | 'REGIONAL_PARTNER' | 'GOOGLE_PLACES' | 'EDITORIAL_DUO21' | 'COLLABORATIVE' | 'SCRAPED';
  base_url: string;
  status: ProviderStatus;
  city?: City;
  refresh_frequency_days: number;
  last_ingested_at?: string;
  last_success_at?: string;
  records_count?: number;
  error_count?: number;
  reliability_level: ConfidenceLevel;
}

export interface PlaceMedia {
  url: string;
  caption?: string;
  is_hero?: boolean;
  video_url?: string;
}

export interface Place {
  id: string;
  name: string;
  slug: string;
  city: City;
  category: PlaceCategory;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  google_place_id?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  booking_url?: string;
  rating: number; // e.g. 4.8
  rating_count: number;
  price_level: 1 | 2 | 3 | 4; // 1: Grátis/Econômico, 2: Moderado, 3: Premium, 4: Luxo
  price_info: PlacePriceInfo;
  average_duration_minutes: number;
  reservation_required: boolean;
  accessible: boolean;
  pet_friendly: boolean;
  children_friendly: boolean;
  indoor_type: IndoorType;
  opening_hours: Record<string, string>; // e.g. { "seg": "09:00 - 18:00", ... }
  media: PlaceMedia[];
  
  // DUO21 / Divulga Lugares curatorship
  is_divulga_lugares_partner: boolean;
  divulga_lugares_tip?: {
    title: string;
    text: string;
    video_url?: string;
    curator_badge: string;
  };
  
  tags?: string[];
  suitable_for?: string[];
  active: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;

  // Sprint 5 Real Tourism Base Extensions
  data_status?: DataStatus;
  business_status?: BusinessStatus;
  duration_min?: number;
  duration_max?: number;
  suitable_for_children?: boolean;
  child_interest_score?: number; // 1 to 10
  age_min?: number;
  age_max?: number;
  senior_friendly?: boolean;
  walking_intensity?: WalkingIntensity;
  cost_band?: CostBand;
  cost_min?: number;
  cost_max?: number;
  provenance?: FieldProvenance;
  source_id?: string;
  source_url?: string;
  checked_at?: string;
  confidence?: ConfidenceLevel;
  content_id?: string;
  content_type?: 'REEL' | 'VIDEO' | 'ARTICLE' | 'PHOTO' | 'TIP';
  content_url?: string;
}

export interface SerraEvent {
  id: string;
  name: string;
  slug: string;
  city: City;
  description: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  default_time?: string; // HH:MM
  is_anchor_event: boolean; // Natal Luz, Festival de Cinema, etc.
  location_name: string;
  price_info: string;
  ticket_required: boolean;
  ticket_url?: string;
  banner_url?: string;
  is_demo: boolean;
}

export type TravelPace = 'tranquilo' | 'equilibrado' | 'aproveitar_bastante';

export type TransportType = 
  | 'carro_proprio' 
  | 'carro_alugado' 
  | 'transfer_uber' 
  | 'sem_carro';

export type ArrivalAirport = 'porto_alegre' | 'caxias_do_sul' | 'outro';

export type AccommodationStatus = 'booked' | 'not_booked' | 'undecided';

export type AccommodationType = 'hotel' | 'pousada' | 'apartamento' | 'cabana' | 'tanto_faz';

export interface AccommodationDetails {
  name?: string;
  city?: City;
  address?: string;
  latitude?: number;
  longitude?: number;
  provider?: string;
  wants_help_finding?: boolean;
  type_preference?: AccommodationType;
  price_range_text?: string;
  amenities_preference?: string[];
}

export interface LogisticsBase {
  status: 'confirmed' | 'provisional';
  name: string;
  city: City;
  address?: string;
  latitude: number;
  longitude: number;
  is_provisional: boolean;
  notes?: string;
}

export type PriceType = 'exact' | 'estimate' | 'range' | 'unknown';

export interface AccommodationRecommendation {
  id: string;
  name: string;
  type: AccommodationType;
  city: City;
  neighborhood?: string;
  estimated_avg_price_brl?: number;
  price_type: PriceType;
  price_display: string; // e.g. "R$ 380 - R$ 520 / diária" ou "Faixa estimada"
  rating: number; // e.g. 4.7
  distance_to_center_km?: number;
  distance_points?: Array<{ label: string; distance_km: number; time_minutes: number }>;
  amenities: string[];
  booking_url?: string;
  source: string; // e.g. "Parceiro Local DUO21", "Google Places", "Booking (Preparo)"
  checked_at: string;
  confidence: ConfidenceLevel;
  is_demo: boolean;
}

export type BudgetFlexibility = 'economico' | 'equilibrado' | 'conforto' | 'luxo';

export interface TripPreferences {
  name: string;
  email?: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  number_of_days?: number;
  destination?: string;
  cities_desired?: City[];
  adults_count: number;
  children_count: number;
  children_ages: number[];
  accommodation_status?: AccommodationStatus;
  accommodation?: AccommodationDetails;
  hotel_name?: string;
  hotel_city?: City;
  hotel_address?: string;
  accommodation_place_id?: string;
  logistics_anchor?: { latitude: number; longitude: number; label: string; city: City };
  budget_total?: number;
  budget_attractions?: number;
  budget_food_per_person?: number;
  budget_dinner_per_person?: number;
  budget_flexibility?: BudgetFlexibility;
  pace: TravelPace;
  transport: TransportType;
  arrival_airport?: ArrivalAirport;
  interests: string[];
  mandatory_places: string[];
  must_have?: string[];
  nice_to_have?: string[];
  restrictions: string[];
  avoid?: string[];
  is_couple?: boolean;
  has_elderly?: boolean;
  required_for_generation_satisfied?: boolean;
}

export type PreviewSlotType = 'morning' | 'lunch' | 'afternoon' | 'pause' | 'dinner' | 'night' | 'event';

export interface PreviewActivity {
  id: string;
  time: string; // HH:MM
  slot_type: PreviewSlotType;
  category_label: string;
  city: City;
  locked: boolean;
  teaser_title: string;
  teaser_description: string;
  estimated_cost_range?: string;
  indoor_outdoor_tag?: 'coberto' | 'ao_ar_livre' | 'misto';
  // Revealed ONLY for the teaser activity (e.g. Day 1 first place)
  revealed_place?: {
    id: string;
    name: string;
    category: PlaceCategory;
    description: string;
    image_url?: string;
    rating: number;
    city: City;
    indoor_type: IndoorType;
    price_level: number;
    duration_minutes: number;
  };
}

export type WeatherCondition = 
  | 'CLEAR' 
  | 'PARTLY_CLOUDY' 
  | 'CLOUDY' 
  | 'RAIN' 
  | 'HEAVY_RAIN' 
  | 'STORM' 
  | 'COLD' 
  | 'HOT' 
  | 'UNKNOWN';

export type PlaceWeatherSuitability = 'INDOOR' | 'OUTDOOR' | 'MIXED' | 'RAIN_OK';

export interface NormalizedWeatherForecast {
  date: string; // YYYY-MM-DD
  city: City;
  condition: WeatherCondition;
  temp_min: number;
  temp_max: number;
  rain_probability: number;
  precipitation_mm?: number;
  is_indoor_recommended: boolean;
  summary: string;
  forecast_unavailable?: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  provider: 'OPEN_METEO' | 'GOOGLE_WEATHER' | 'MOCK' | 'SEASONAL';
  cached?: boolean;
}

export interface RouteSegment {
  origin: { lat: number; lng: number; label?: string };
  destination: { lat: number; lng: number; label?: string };
  distance_km: number;
  duration_minutes: number;
  duration_with_buffer_minutes: number;
  traffic_status?: 'light' | 'moderate' | 'heavy';
  travel_mode: 'DRIVING' | 'WALKING' | 'TRANSIT';
  polyline?: string;
  provider: 'GOOGLE_ROUTES' | 'OSRM' | 'HAVERSINE_MOUNTAIN' | 'CACHE' | 'MOCK';
  cached?: boolean;
}

export interface PreviewDay {
  day_number: number;
  date: string; // YYYY-MM-DD
  city_focus: City;
  theme_title: string;
  activities: PreviewActivity[];
  summary_counts: {
    total_activities: number;
    meals: number;
    locked_count: number;
  };
}

export interface TripPreview {
  id: string;
  preferences: TripPreferences;
  days: PreviewDay[];
  total_days: number;
  price_brl: number;
  logistics_base_city: City;
  has_hotel_confirmed: boolean;
  hotel_name?: string;
  revealed_place_name: string;
  created_at: string;
  is_preview_only: true;
}

export interface TripActivity {
  id: string;
  time: string; // HH:MM
  place: Place;
  duration_minutes: number;
  travel_time_from_prev_minutes: number;
  distance_km_from_prev: number;
  travel_buffer_minutes?: number;
  estimated_cost_per_person: number;
  is_anchor_event?: boolean;
  event_details?: SerraEvent;
  locked?: boolean; // For preview paywall (blurred info)
  weather_status?: 'ideal' | 'indoor_safe' | 'alert';
  weather_suitability?: PlaceWeatherSuitability;
  route_segment?: RouteSegment;
  notes?: string;
}

export interface TripDay {
  day_number: number;
  date: string; // YYYY-MM-DD
  city_focus: City;
  theme_title: string;
  activities: TripActivity[];
  total_day_cost_estimated: number;
  estimated_daily_cost_min?: number;
  estimated_daily_cost_max?: number;
  weather_forecast?: NormalizedWeatherForecast | {
    summary: string;
    temp_min: number;
    temp_max: number;
    rain_probability: number;
  };
}

export interface TripUsageStats {
  guide_messages_today: number;
  guide_messages_limit: number;
  structural_changes_today: number;
  structural_changes_limit: number;
  full_regenerations_used: number;
  full_regenerations_limit: number;
}

export type TripStatus = 'draft' | 'preview' | 'paid' | 'ready' | 'archived';

export type UnlockSource = 'payment' | 'dev_test' | 'admin';

export interface Trip {
  id: string;
  secure_token: string;
  status: TripStatus;
  preferences: TripPreferences;
  days: TripDay[];
  price_tier_id: string;
  price_brl: number;
  total_estimated_spend_brl: number;
  estimated_trip_cost_min?: number;
  estimated_trip_cost_max?: number;
  logistics_base?: LogisticsBase;
  created_at: string;
  paid_at?: string;
  usage_stats: TripUsageStats;
  is_demo: boolean;
  unlock_source?: UnlockSource;
  unlockSource?: UnlockSource;
}

export type ProviderStatus = 'CONNECTED' | 'CONFIGURATION_REQUIRED' | 'MOCK' | 'DISABLED';

export interface ProviderInfo {
  id: string;
  name: string;
  category: 'database' | 'payment' | 'ai' | 'places' | 'maps' | 'routes' | 'weather' | 'analytics';
  providerName: string;
  status: ProviderStatus;
  environment: 'production' | 'sandbox' | 'mock' | 'development';
  lastCheckedAt?: string;
  details?: string;
  canTestConnection?: boolean;
}

export interface Offer {
  id: string;
  placeId: string;
  placeName: string;
  city: City;
  title: string;
  description: string;
  originalPrice: number;
  offerPrice: number;
  discountPercent: number;
  startAt: string;
  endAt: string;
  conditions: string;
  source: string;
  sourceUrl?: string;
  checkedAt: string;
  confidence: ConfidenceLevel;
  isDemo: boolean;
}

export type MediaType = 'own' | 'partner' | 'official' | 'google' | 'external' | 'demo';

export interface MediaItem {
  id: string;
  placeId: string;
  source: MediaType;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  attribution?: string;
  type: 'image' | 'video' | 'reel';
  active: boolean;
  isDemo: boolean;
}

export type PaymentMethod = 'pix' | 'credit_card';

export type NormalizedPaymentStatus = 
  | 'CREATED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'EXPIRED';

export type PaymentStatus = 
  | NormalizedPaymentStatus
  | 'pending' 
  | 'processing' 
  | 'paid' 
  | 'failed' 
  | 'refunded' 
  | 'cancelled';

export interface PaymentOrder {
  id: string;
  trip_id: string;
  amount_brl: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  asaas_payment_id?: string;
  asaas_customer_id?: string;
  pix_qr_code?: string;
  pix_copy_paste?: string;
  pix_expiration_date?: string;
  customer_name?: string;
  customer_email?: string;
  customer_cpf?: string;
  created_at: string;
  updated_at: string;
  paid_at?: string;
  is_sandbox: boolean;
  idempotency_key?: string;
}

export interface UserReport {
  id: string;
  place_id: string;
  place_name: string;
  report_type: 'preco_diferente' | 'horario_diferente' | 'fechado' | 'outro';
  description: string;
  contact_email?: string;
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  created_at: string;
}

export interface AdminMetrics {
  total_trips_created: number;
  total_trips_paid: number;
  conversion_rate: number;
  gross_revenue_brl: number;
  estimated_ai_cost_brl: number;
  estimated_api_cost_brl: number;
  estimated_payment_fees_brl: number;
  net_margin_percent: number;
}

export type AppTab = 'hoje' | 'roteiro' | 'mapa' | 'guia';
