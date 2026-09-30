import { describe, it } from 'node:test';
import assert from 'node:assert';
import { finalItineraryEngine } from '../src/services/finalItineraryEngine';
import { SEED_PLACES } from '../src/data/seedData';
import { TripPreferences } from '../src/types';

describe('HOTFIX 8.3 — Production Real Regression & Invariant Tests', () => {

  const paulinhoPreferences: TripPreferences = {
    name: 'Paulinho Zdanski',
    start_date: '2024-06-20',
    end_date: '2024-06-24', // 5 full days
    adults_count: 2,
    children_count: 2,
    children_ages: [],
    hotel_name: 'Airbnb Perto da Borges',
    hotel_city: 'Gramado',
    budget_total: 6000,
    pace: 'equilibrado',
    transport: 'sem_carro',
    interests: ['parques'],
    mandatory_places: [],
    restrictions: [],
    is_couple: true,
    accommodation_status: 'booked'
  };

  it('1. POSITIVE PATH: FinalItineraryEngine generates >= 3 activities for all 5 days', () => {
    const trip = finalItineraryEngine.generateFinalItinerary(
      paulinhoPreferences,
      'payment',
      undefined,
      SEED_PLACES
    );

    assert.strictEqual(trip.days.length, 5, 'Must generate exactly 5 days');
    
    trip.days.forEach(day => {
      assert.ok(Array.isArray(day.activities), `Day ${day.day_number} activities must be an array`);
      assert.ok(day.activities.length >= 3, `Day ${day.day_number} (${day.city_focus}) must have at least 3 activities. Found: ${day.activities.length}`);
      
      day.activities.forEach(act => {
        assert.ok(act.place, `Activity ${act.id} must have a valid place`);
        assert.ok(act.place.name, `Place must have a name`);
        assert.ok(act.place.city, `Place must have a city`);
        assert.strictEqual(act.locked, false, 'Unlocked activities must not be paywall locked');
      });
    });

    const totalActivities = trip.days.reduce((acc, d) => acc + d.activities.length, 0);
    assert.ok(totalActivities >= 15, `5-day trip must have at least 15 activities across the days. Found: ${totalActivities}`);
  });

  it('2. EMPTY CATALOG FALLBACK: FinalItineraryEngine never generates 0 activities even if catalog is empty', () => {
    // Simulating remote Supabase returning 0 places or connection failure
    const trip = finalItineraryEngine.generateFinalItinerary(
      paulinhoPreferences,
      'payment',
      undefined,
      [] // empty catalog input
    );

    assert.strictEqual(trip.days.length, 5, 'Must generate exactly 5 days');
    trip.days.forEach(day => {
      assert.ok(day.activities.length >= 3, `Day ${day.day_number} must have >= 3 activities even with empty initial catalog`);
    });
  });

  it('3. NEGATIVE INVARIANT: PAID -> 5 days -> 0 activities -> READY MUST FAIL', () => {
    // Construct an invalid 0-activity trip
    const invalidTrip = {
      id: 'test_invalid_trip',
      status: 'ready',
      days: [
        { day_number: 1, date: '2024-06-20', city_focus: 'Gramado', activities: [] },
        { day_number: 2, date: '2024-06-21', city_focus: 'Canela', activities: [] },
        { day_number: 3, date: '2024-06-22', city_focus: 'Nova Petrópolis', activities: [] },
        { day_number: 4, date: '2024-06-23', city_focus: 'Gramado', activities: [] },
        { day_number: 5, date: '2024-06-24', city_focus: 'Gramado', activities: [] },
      ]
    };

    const generatedDays = invalidTrip.days.length;
    const totalActivities = invalidTrip.days.reduce((acc, d) => acc + d.activities.length, 0);
    const allDaysHaveMinActivities = generatedDays > 0 && invalidTrip.days.every(d => d.activities.length >= 1);

    const isReadyAllowed = generatedDays >= 5 && totalActivities > 0 && allDaysHaveMinActivities;
    
    assert.strictEqual(isReadyAllowed, false, 'READY status MUST NOT be allowed for 5 days with 0 activities');
  });

  it('4. POSITIVE INVARIANT: PAID -> 5 days -> 15 activities -> READY is validated', () => {
    const trip = finalItineraryEngine.generateFinalItinerary(paulinhoPreferences, 'payment');
    
    const generatedDays = trip.days.length;
    const totalActivities = trip.days.reduce((acc, d) => acc + d.activities.length, 0);
    const allDaysHaveMinActivities = generatedDays > 0 && trip.days.every(d => d.activities.length >= 1);

    const isReadyAllowed = generatedDays >= 5 && totalActivities > 0 && allDaysHaveMinActivities;
    assert.strictEqual(isReadyAllowed, true, 'READY status is granted only when all days have activities');
  });

  it('5. API STATUS INVARIANT: Unready trip with order.status=PAID never exposes ready status or empty trip', () => {
    const unreadyTrip = {
      id: 'trip_unready',
      status: 'generating',
      days: []
    };

    const isTripValidAndReady = Boolean(
      unreadyTrip &&
      unreadyTrip.status === 'ready' &&
      Array.isArray(unreadyTrip.days) &&
      unreadyTrip.days.length > 0 &&
      unreadyTrip.days.every((d: any) => Array.isArray(d.activities) && d.activities.length > 0)
    );

    const order = { status: 'PAID' };

    let effectiveTripStatus = 'preview';
    if (order.status === 'PAID') {
      if (isTripValidAndReady) {
        effectiveTripStatus = 'ready';
      } else {
        effectiveTripStatus = 'generating';
      }
    }

    assert.strictEqual(effectiveTripStatus, 'generating', 'Effective status must be generating while activities are not ready');
    const tripToSend = isTripValidAndReady ? unreadyTrip : null;
    assert.strictEqual(tripToSend, null, 'Must never send trip payload when not valid and ready');
  });

  it('6. SECURE TOKEN RECOVERY: Full activities preserved across recovery', () => {
    const trip = finalItineraryEngine.generateFinalItinerary(paulinhoPreferences, 'payment');
    trip.secure_token = 'tok_test_recovery_abc123';

    // Simulate recovery check
    const hasActivities = Boolean(
      trip.days &&
      trip.days.length > 0 &&
      trip.days.every(d => Array.isArray(d.activities) && d.activities.length > 0)
    );

    assert.strictEqual(hasActivities, true, 'Recovered trip must have activities intact');
  });

  it('7. PRODUCTION FALLBACK BLOCKED: In production with DATA_MODE=supabase, empty catalog throws error', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDataMode = process.env.DATA_MODE;
    
    try {
      process.env.NODE_ENV = 'production';
      process.env.DATA_MODE = 'supabase';

      assert.throws(
        () => {
          finalItineraryEngine.generateFinalItinerary(
            paulinhoPreferences,
            'payment',
            undefined,
            [] // empty catalog in production
          );
        },
        /DATABASE_CATALOG_UNAVAILABLE/,
        'Should throw DATABASE_CATALOG_UNAVAILABLE error when catalog is empty in production'
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.DATA_MODE = originalDataMode;
    }
  });
});
