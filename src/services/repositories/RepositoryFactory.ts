import { PlaceRepository, SupabasePlaceRepository, InMemoryPlaceRepository } from './PlaceRepository';
import { TripRepository, SupabaseTripRepository, InMemoryTripRepository } from './TripRepository';
import { EventRepository, SupabaseEventRepository, InMemoryEventRepository } from './EventRepository';
import { PriceRepository, SupabasePriceRepository, InMemoryPriceRepository } from './PriceRepository';
import { HoursRepository, SupabaseHoursRepository, InMemoryHoursRepository } from './HoursRepository';
import { PaymentRepository, SupabasePaymentRepository, InMemoryPaymentRepository } from './PaymentRepository';
import { 
  ApiUsageRepository, 
  SupabaseApiUsageRepository, 
  InMemoryApiUsageRepository,
  TripQuotaRepository,
  SupabaseTripQuotaRepository,
  InMemoryTripQuotaRepository
} from './UsageRepository';
import { UserReportRepository, SupabaseUserReportRepository, InMemoryUserReportRepository } from './UserReportRepository';
import { CacheRepository, SupabaseCacheRepository, InMemoryCacheRepository } from './CacheRepository';

export type DataMode = 'supabase' | 'mock';

export class RepositoryFactory {
  private static forcedMode: DataMode | null = null;

  static setDataMode(mode: DataMode) {
    this.forcedMode = mode;
  }

  static getDataMode(): DataMode {
    if (this.forcedMode) return this.forcedMode;
    // Check environment in Vite client or Node server
    if (typeof process !== 'undefined' && process.env?.DATA_MODE) {
      return process.env.DATA_MODE.toLowerCase() === 'mock' ? 'mock' : 'supabase';
    }
    let viteMode: string | undefined;
    try {
      if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
        viteMode = (import.meta as any).env.VITE_DATA_MODE;
      }
    } catch {
      // Ignored in non-ESM environments
    }
    if (viteMode) {
      return viteMode.toLowerCase() === 'mock' ? 'mock' : 'supabase';
    }
    // Default to supabase (Source of Truth)
    return 'supabase';
  }

  static createPlaceRepository(mode?: DataMode): PlaceRepository {
    const active = mode || this.getDataMode();
    return active === 'mock' ? new InMemoryPlaceRepository() : new SupabasePlaceRepository();
  }

  static createTripRepository(mode?: DataMode): TripRepository {
    const active = mode || this.getDataMode();
    return active === 'mock' ? new InMemoryTripRepository() : new SupabaseTripRepository();
  }

  static createEventRepository(mode?: DataMode): EventRepository {
    const active = mode || this.getDataMode();
    return active === 'mock' ? new InMemoryEventRepository() : new SupabaseEventRepository();
  }

  static createPriceRepository(mode?: DataMode): PriceRepository {
    const active = mode || this.getDataMode();
    return active === 'mock' ? new InMemoryPriceRepository() : new SupabasePriceRepository();
  }

  static createHoursRepository(mode?: DataMode): HoursRepository {
    const active = mode || this.getDataMode();
    return active === 'mock' ? new InMemoryHoursRepository() : new SupabaseHoursRepository();
  }

  static createPaymentRepository(mode?: DataMode): PaymentRepository {
    const active = mode || this.getDataMode();
    return active === 'mock' ? new InMemoryPaymentRepository() : new SupabasePaymentRepository();
  }

  static createApiUsageRepository(mode?: DataMode): ApiUsageRepository {
    const active = mode || this.getDataMode();
    return active === 'mock' ? new InMemoryApiUsageRepository() : new SupabaseApiUsageRepository();
  }

  static createTripQuotaRepository(mode?: DataMode): TripQuotaRepository {
    const active = mode || this.getDataMode();
    return active === 'mock' ? new InMemoryTripQuotaRepository() : new SupabaseTripQuotaRepository();
  }

  static createUserReportRepository(mode?: DataMode): UserReportRepository {
    const active = mode || this.getDataMode();
    return active === 'mock' ? new InMemoryUserReportRepository() : new SupabaseUserReportRepository();
  }

  static createCacheRepository(mode?: DataMode): CacheRepository {
    const active = mode || this.getDataMode();
    return active === 'mock' ? new InMemoryCacheRepository() : new SupabaseCacheRepository();
  }
}

// Singletons initialized through RepositoryFactory based on active DATA_MODE
export const placeRepository = RepositoryFactory.createPlaceRepository();
export const tripRepository = RepositoryFactory.createTripRepository();
export const eventRepository = RepositoryFactory.createEventRepository();
export const priceRepository = RepositoryFactory.createPriceRepository();
export const hoursRepository = RepositoryFactory.createHoursRepository();
export const paymentRepository = RepositoryFactory.createPaymentRepository();
export const apiUsageRepository = RepositoryFactory.createApiUsageRepository();
export const tripQuotaRepository = RepositoryFactory.createTripQuotaRepository();
export const userReportRepository = RepositoryFactory.createUserReportRepository();
export const cacheRepository = RepositoryFactory.createCacheRepository();
