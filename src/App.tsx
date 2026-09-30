/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LandingView } from './views/LandingView';
import { CollectView } from './views/CollectView';
import { MissingQuestionsView } from './views/MissingQuestionsView';
import { ConfirmationView } from './views/ConfirmationView';
import { TripGenerationScreen } from './components/TripGenerationScreen';
import { PaywallPreview } from './components/PaywallPreview';
import { DevToolbar } from './components/DevToolbar';
import { AppTab } from './components/BottomNav';

// Code Splitting & Lazy Loading (Sprint 8B - Mobile Performance)
const UnlockedAppView = React.lazy(() => import('./views/UnlockedAppView').then(m => ({ default: m.UnlockedAppView })));
const CheckoutModal = React.lazy(() => import('./components/CheckoutModal').then(m => ({ default: m.CheckoutModal })));
const PlaceDetailModal = React.lazy(() => import('./components/PlaceDetailModal').then(m => ({ default: m.PlaceDetailModal })));
const ReportErrorModal = React.lazy(() => import('./components/ReportErrorModal').then(m => ({ default: m.ReportErrorModal })));
const RecoveryModal = React.lazy(() => import('./components/RecoveryModal').then(m => ({ default: m.RecoveryModal })));
const ActivitySwapModal = React.lazy(() => import('./components/ActivitySwapModal').then(m => ({ default: m.ActivitySwapModal })));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

import { 
  Trip, 
  TripPreview,
  TripPreferences, 
  TripActivity, 
  Place, 
  UserReport 
} from './types';
import { itineraryEngine } from './services/itineraryEngine';
import { previewEngine } from './services/previewEngine';
import { finalItineraryEngine } from './services/finalItineraryEngine';
import { aiProvider } from './services/ai/GeminiProvider';
import { trackEvent } from './services/analytics';
import { SEED_PLACES } from './data/seedData';

type AppScreen = 'landing' | 'collect' | 'missing' | 'confirm' | 'generating' | 'preview' | 'unlocked';

const STORAGE_KEY = 'duo21_serra_current_trip';
const ADMIN_PARAM = 'admin';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('landing');
  const [preview, setPreview] = useState<TripPreview | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [pendingPreferences, setPendingPreferences] = useState<TripPreferences | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [rawPromptText, setRawPromptText] = useState<string>('');
  const [isParsingInput, setIsParsingInput] = useState(false);

  // Modals state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [detailActivity, setDetailActivity] = useState<TripActivity | null>(null);
  const [swapActivity, setSwapActivity] = useState<TripActivity | null>(null);
  const [reportPlace, setReportPlace] = useState<Place | null>(null);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [activeAppTab, setActiveAppTab] = useState<AppTab>('hoje');

  // User reports storage
  const [reports, setReports] = useState<UserReport[]>([]);

  // Check URL parameters for direct access /v/{token} or admin
  useEffect(() => {
    trackEvent('app_init');
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    // Check DUO21 Control Plane (/duo-control) or ?admin=true (Sprint 8C)
    if (params.get(ADMIN_PARAM) === 'true' || path === '/duo-control' || path.startsWith('/duo-control')) {
      setIsAdminOpen(true);
    }

    // Check secure token in path or param
    let token = params.get('token');
    if (!token && path.startsWith('/v/')) {
      token = path.replace('/v/', '');
    }

    if (token) {
      handleRecoverTrip(token);
      return;
    }

    // Restore from localStorage if exists
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedTrip: Trip = JSON.parse(saved);
        const hasActivities = Boolean(
          parsedTrip.days && 
          parsedTrip.days.length > 0 && 
          parsedTrip.days.every(d => d.activities && d.activities.length > 0)
        );
        let validTrip = parsedTrip;
        if (!hasActivities && (parsedTrip.status === 'paid' || parsedTrip.status === 'ready')) {
          validTrip = finalItineraryEngine.generateFinalItinerary(parsedTrip.preferences, 'payment');
          validTrip.secure_token = parsedTrip.secure_token;
        }
        setTrip(validTrip);
        if (validTrip.status === 'paid' || validTrip.status === 'ready') {
          setCurrentScreen('unlocked');
        } else if (validTrip.status === 'preview') {
          setCurrentScreen('preview');
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Sync trip with localStorage
  useEffect(() => {
    if (trip) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
      } catch {
        // ignore
      }
    }
  }, [trip]);

  // 1. Submit Voice/Text Prompt from Collect Screen
  const handleSubmitPrompt = async (rawPrompt: string) => {
    setIsParsingInput(true);
    setRawPromptText(rawPrompt);
    try {
      const result = await aiProvider.parseTripInput(rawPrompt);
      const parsedPrefs = result.preferences;

      // Ensure mandatory fallback defaults
      const mergedPrefs: TripPreferences = {
        name: parsedPrefs.name || '',
        start_date: parsedPrefs.start_date || new Date().toISOString().split('T')[0],
        end_date: parsedPrefs.end_date || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        adults_count: parsedPrefs.adults_count || 2,
        children_count: parsedPrefs.children_count || 0,
        children_ages: parsedPrefs.children_ages || [],
        hotel_name: parsedPrefs.hotel_name,
        hotel_city: parsedPrefs.hotel_city || 'Gramado',
        budget_total: parsedPrefs.budget_total || 3000,
        pace: parsedPrefs.pace || 'equilibrado',
        transport: parsedPrefs.transport || 'carro_alugado',
        interests: parsedPrefs.interests?.length ? parsedPrefs.interests : ['Gastronomia', 'Natureza', 'Fotos'],
        mandatory_places: parsedPrefs.mandatory_places || [],
        restrictions: parsedPrefs.restrictions || [],
        is_couple: parsedPrefs.is_couple || false
      };

      setPendingPreferences(mergedPrefs);

      if (result.missingFields && result.missingFields.length > 0) {
        setMissingFields(result.missingFields);
        setCurrentScreen('missing');
      } else {
        setCurrentScreen('confirm');
      }
    } catch (err) {
      console.error('Error parsing prompt:', err);
    } finally {
      setIsParsingInput(false);
    }
  };

  // Navigation Handlers for strict backwards flow (Sprint 0B.1)
  const handleBackFromCollect = () => {
    setCurrentScreen('landing');
  };

  const handleBackFromMissing = () => {
    setCurrentScreen('collect');
  };

  const handleBackFromConfirm = (currentPrefs?: TripPreferences) => {
    if (currentPrefs) {
      setPendingPreferences(currentPrefs);
    }
    setCurrentScreen('collect');
  };

  const handleBackFromGeneration = () => {
    // Return safely to confirmation screen without losing preferences
    setCurrentScreen('confirm');
  };

  const handleBackFromPreview = () => {
    if (preview?.preferences) {
      setPendingPreferences(preview.preferences);
    } else if (trip?.preferences) {
      setPendingPreferences(trip.preferences);
    }
    setCurrentScreen('confirm');
  };

  // 2. Start Generation Process (Pre-Payment: Preview Only)
  const handleStartGeneration = (confirmedPrefs: TripPreferences) => {
    setPendingPreferences(confirmedPrefs);
    setCurrentScreen('generating');
  };

  // 3. Preview Generation Complete (Secure Teaser, No Leaks)
  const handlePreviewComplete = (generatedPreview: TripPreview) => {
    setPreview(generatedPreview);
    if (generatedPreview.preferences) {
      setPendingPreferences(generatedPreview.preferences);
    }
    setCurrentScreen('preview');
  };

  // 4. Payment Completed -> Retrieves Server-Generated Itinerary or Calls FinalItineraryEngine!
  const handlePaymentSuccess = async (token?: string, email?: string) => {
    setIsCheckoutOpen(false);
    const targetTripId = trip?.id || preview?.id;
    let unlockedTrip: Trip | null = null;

    if (token) {
      try {
        const res = await fetch(`/api/db/trips/token/${encodeURIComponent(token)}`);
        if (res.ok) {
          unlockedTrip = await res.json();
        }
      } catch {
        // ignore
      }
    }

    if (!unlockedTrip && targetTripId) {
      try {
        const res = await fetch(`/api/payments/trip-status/${encodeURIComponent(targetTripId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.trip && (data.isPaid || data.status === 'ready' || data.status === 'paid')) {
            unlockedTrip = data.trip;
          }
        }
      } catch {
        // ignore
      }
    }

    const hasActivities = Boolean(
      unlockedTrip && 
      unlockedTrip.days && 
      unlockedTrip.days.length > 0 && 
      unlockedTrip.days.every(d => d.activities && d.activities.length > 0)
    );

    if (!unlockedTrip || !hasActivities) {
      const prefs = pendingPreferences || preview?.preferences || trip?.preferences || {
        name: 'Viajante',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        adults_count: 2,
        children_count: 0,
        children_ages: [],
        pace: 'equilibrado' as const,
        transport: 'carro_alugado' as const,
        interests: ['Gastronomia', 'Natureza'],
        mandatory_places: [],
        restrictions: []
      };

      unlockedTrip = finalItineraryEngine.generateFinalItinerary(prefs, 'payment');
      if (email) {
        unlockedTrip.preferences.email = email;
      }
      if (token) {
        unlockedTrip.secure_token = token;
      }
    }

    setTrip(unlockedTrip);
    setCurrentScreen('unlocked');
    trackEvent('payment_completed', { trip_id: unlockedTrip.id });

    // Update browser URL silently to secure token link
    try {
      if (unlockedTrip.secure_token) {
        window.history.replaceState(null, '', `?token=${unlockedTrip.secure_token}`);
      }
    } catch {
      // ignore
    }
  };

  // 5. Trip Recovery
  const handleRecoverTrip = async (tokenOrEmail: string) => {
    // If it's a demo or matches current
    if (trip && (trip.secure_token === tokenOrEmail || trip.preferences.name?.toLowerCase() === tokenOrEmail.toLowerCase())) {
      setIsRecoveryOpen(false);
      setCurrentScreen(trip.status === 'paid' || trip.status === 'ready' ? 'unlocked' : 'preview');
      return;
    }

    try {
      const res = await fetch(`/api/db/trips/token/${encodeURIComponent(tokenOrEmail)}`);
      if (res.ok) {
        const fetchedTrip: Trip = await res.json();
        const hasActivities = Boolean(
          fetchedTrip.days && 
          fetchedTrip.days.length > 0 && 
          fetchedTrip.days.every(d => d.activities && d.activities.length > 0)
        );
        let finalToSet = fetchedTrip;
        if (!hasActivities && (fetchedTrip.status === 'ready' || fetchedTrip.status === 'paid')) {
          finalToSet = finalItineraryEngine.generateFinalItinerary(fetchedTrip.preferences, 'payment');
          finalToSet.secure_token = fetchedTrip.secure_token;
        }
        setTrip(finalToSet);
        setIsRecoveryOpen(false);
        setCurrentScreen(finalToSet.status === 'ready' || finalToSet.status === 'paid' ? 'unlocked' : 'preview');
        return;
      }
    } catch {
      // ignore and fallback
    }

    // Default sample recovered trip
    const recovered: Trip = itineraryEngine.generateItinerary({
      name: 'Viajante Serra',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      adults_count: 2,
      children_count: 0,
      children_ages: [],
      hotel_name: 'Hotel Casa da Montanha',
      hotel_city: 'Gramado',
      budget_total: 3500,
      pace: 'equilibrado',
      transport: 'carro_alugado',
      interests: ['Gastronomia', 'Natureza', 'Chocolate'],
      mandatory_places: [],
      restrictions: [],
      is_couple: true
    });
    recovered.status = 'paid';
    setTrip(recovered);
    setIsRecoveryOpen(false);
    setCurrentScreen('unlocked');
  };

  // 6. Activity Swapping (Item 25 - surgical swap)
  const handleSwapPlace = (newPlace: Place) => {
    if (!trip || !swapActivity) return;

    const updatedDays = trip.days.map(day => {
      const updatedActivities = day.activities.map(act => {
        if (act.id === swapActivity.id) {
          return {
            ...act,
            place: newPlace,
            estimated_cost_per_person: newPlace.price_info.adult_price
          };
        }
        return act;
      });
      return { ...day, activities: updatedActivities };
    });

    const updatedTrip = {
      ...trip,
      days: updatedDays,
      usage_stats: {
        ...trip.usage_stats,
        structural_changes_today: trip.usage_stats.structural_changes_today + 1
      }
    };

    setTrip(updatedTrip);
    setSwapActivity(null);
    trackEvent('swap_activity', { new_place_id: newPlace.id });
  };

  // 7. Submit Tourist Error Report
  const handleSubmitReport = (reportData: Partial<UserReport>) => {
    const newRep: UserReport = {
      id: `rep_${Date.now()}`,
      place_id: reportData.place_id || 'unknown',
      place_name: reportData.place_name || '',
      report_type: reportData.report_type || 'outro',
      description: reportData.description || '',
      contact_email: reportData.contact_email,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    setReports(prev => [newRep, ...prev]);
    trackEvent('report_submitted', { place_id: newRep.place_id });
  };

  // Demo direct shortcut (Pre-Payment Preview Mode)
  const handleLoadDemoTrip = () => {
    const demoPrefs: TripPreferences = {
      name: 'Mariana & Lucas',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      adults_count: 2,
      children_count: 0,
      children_ages: [],
      hotel_name: 'Hotel Saint Andrews',
      hotel_city: 'Gramado',
      budget_total: 4500,
      budget_food_per_person: 80,
      pace: 'equilibrado',
      transport: 'carro_alugado',
      interests: ['Gastronomia', 'Romântico', 'Vinho', 'Natureza'],
      mandatory_places: ['Sequência de Fondue Tradicional'],
      must_have: ['Sequência de Fondue Tradicional'],
      restrictions: [],
      is_couple: true
    };
    const demoPreview = previewEngine.generatePreview(demoPrefs);
    setPendingPreferences(demoPrefs);
    setPreview(demoPreview);
    setTrip(null);
    setCurrentScreen('preview');
  };

  // 8. DEV Mode Unlock (Generates FinalItinerary with dev_test flag)
  const handleDevUnlock = () => {
    const targetPrefs: TripPreferences = pendingPreferences || preview?.preferences || trip?.preferences || {
      name: 'Mariana & Lucas',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      adults_count: 2,
      children_count: 0,
      children_ages: [],
      hotel_name: 'Hotel Saint Andrews',
      hotel_city: 'Gramado',
      budget_total: 4500,
      pace: 'equilibrado',
      transport: 'carro_alugado',
      interests: ['Gastronomia', 'Romântico', 'Vinho', 'Natureza'],
      mandatory_places: [],
      restrictions: [],
      is_couple: true
    };

    const devUnlockedTrip = finalItineraryEngine.generateFinalItinerary(targetPrefs, 'dev_test');
    setTrip(devUnlockedTrip);
    setCurrentScreen('unlocked');
    trackEvent('dev_unlock', { trip_id: devUnlockedTrip.id });
  };

  // 9. Reset Test
  const handleResetTest = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setTrip(null);
    setPreview(null);
    setPendingPreferences(null);
    setMissingFields([]);
    setRawPromptText('');
    setCurrentScreen('landing');
  };

  // Header contextual back navigation configuration
  const getHeaderBackConfig = () => {
    switch (currentScreen) {
      case 'collect':
        return { show: true, onBack: handleBackFromCollect, label: 'Início' };
      case 'missing':
        return { show: true, onBack: handleBackFromMissing, label: 'Voltar' };
      case 'confirm':
        return { show: true, onBack: () => handleBackFromConfirm(pendingPreferences || undefined), label: 'Voltar' };
      case 'generating':
        return { show: true, onBack: handleBackFromGeneration, label: 'Voltar' };
      case 'preview':
        return { show: true, onBack: handleBackFromPreview, label: 'Voltar' };
      default:
        return { show: false, onBack: undefined, label: 'Voltar' };
    }
  };

  const headerBackConfig = getHeaderBackConfig();

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1E293B] flex flex-col font-sans selection:bg-[#1B4332] selection:text-white">
      {/* Header with Contextual Back Navigation */}
      <Header
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenRecovery={() => setIsRecoveryOpen(true)}
        onGoHome={() => {
          if (trip?.status === 'paid') {
            setCurrentScreen('unlocked');
          } else {
            setCurrentScreen('landing');
          }
        }}
        showBack={headerBackConfig.show}
        onBack={headerBackConfig.onBack}
        backLabel={headerBackConfig.label}
        isPaidView={trip?.status === 'paid'}
      />

      {/* Main View Container */}
      <main className="flex-1 px-4 pt-3 pb-8 max-w-md w-full mx-auto">
        {/* LANDING SCREEN */}
        {currentScreen === 'landing' && (
          <LandingView
            onStartTrip={() => setCurrentScreen('collect')}
            onOpenRecovery={() => setIsRecoveryOpen(true)}
          />
        )}

        {/* COLLECT SCREEN (Audio/Text) */}
        {currentScreen === 'collect' && (
          <CollectView
            onBack={handleBackFromCollect}
            onSubmitPrompt={handleSubmitPrompt}
            isLoading={isParsingInput}
            initialPrompt={rawPromptText}
          />
        )}

        {/* MISSING QUESTIONS SCREEN (Surgical only) */}
        {currentScreen === 'missing' && pendingPreferences && (
          <MissingQuestionsView
            initialPreferences={pendingPreferences}
            missingFields={missingFields}
            onBack={handleBackFromMissing}
            onComplete={(updated) => {
              setPendingPreferences(updated as TripPreferences);
              setCurrentScreen('confirm');
            }}
          />
        )}

        {/* CONFIRMATION SCREEN (Editable cards) */}
        {currentScreen === 'confirm' && pendingPreferences && (
          <ConfirmationView
            preferences={pendingPreferences}
            onBack={handleBackFromConfirm}
            onConfirm={handleStartGeneration}
          />
        )}

        {/* GENERATION SCREEN */}
        {currentScreen === 'generating' && pendingPreferences && (
          <TripGenerationScreen
            preferences={pendingPreferences}
            onBack={handleBackFromGeneration}
            onPreviewComplete={handlePreviewComplete}
            onComplete={handlePreviewComplete}
          />
        )}

        {/* PAYWALL PREVIEW SCREEN (PreviewEngine: Day 1 teaser visible, Days 2+ gated, no leaked places) */}
        {currentScreen === 'preview' && (preview || trip) && (
          <PaywallPreview
            preview={preview}
            trip={trip}
            onBack={handleBackFromPreview}
            onUnlockTrip={() => {
              trackEvent('open_checkout');
              setIsCheckoutOpen(true);
            }}
            onUnlockClick={() => {
              trackEvent('open_checkout');
              setIsCheckoutOpen(true);
            }}
            onDevUnlock={handleDevUnlock}
            onOpenDetails={(act) => setDetailActivity(act)}
            onSwapActivity={(act) => setSwapActivity(act)}
          />
        )}

        {/* UNLOCKED APP VIEW (HOJE, ROTEIRO, MAPA, GUIA) - LAZY LOADED */}
        {currentScreen === 'unlocked' && trip && (
          <React.Suspense fallback={
            <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[#7A6F5D] font-medium">Carregando sua viagem...</p>
            </div>
          }>
            <UnlockedAppView
              trip={trip}
              initialTab={activeAppTab}
              onOpenDetails={(act) => setDetailActivity(act)}
              onSwapActivity={(act) => setSwapActivity(act)}
              onFindNearby={(act) => {
                // Open detail with nearby tips
                setDetailActivity(act);
              }}
              onUpdateTrip={(updated) => setTrip(updated)}
            />
          </React.Suspense>
        )}

        {/* Demo Shortcut for fast testing */}
        {currentScreen === 'landing' && (
          <div className="mt-8 text-center">
            <button
              onClick={handleLoadDemoTrip}
              className="text-[11px] text-[#7A6F5D] hover:text-[#1B4332] underline font-medium"
            >
              Testar roteiro de exemplo em 1 clique
            </button>
          </div>
        )}
      </main>

      {/* MODALS - LAZY LOADED */}
      <React.Suspense fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-8 h-8 border-3 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        {/* 1. Checkout Modal (Asaas Gateway / PIX / Card) */}
        {isCheckoutOpen && (preview || trip) && (
          <CheckoutModal
            trip={trip}
            preview={preview}
            onClose={() => setIsCheckoutOpen(false)}
            onPaymentSuccess={handlePaymentSuccess}
          />
        )}

        {/* 2. Place Detail Modal */}
        {detailActivity && (
          <PlaceDetailModal
            activity={detailActivity}
            onClose={() => setDetailActivity(null)}
            onReportError={(place) => {
              setReportPlace(place);
            }}
          />
        )}

        {/* 3. Activity Swap Modal */}
        {swapActivity && (
          <ActivitySwapModal
            activity={swapActivity}
            onClose={() => setSwapActivity(null)}
            onSelectNewPlace={handleSwapPlace}
            remainingChangesToday={trip ? Math.max(0, trip.usage_stats.structural_changes_limit - trip.usage_stats.structural_changes_today) : 3}
          />
        )}

        {/* 4. Report Error Modal */}
        {reportPlace && (
          <ReportErrorModal
            placeName={reportPlace.name}
            placeId={reportPlace.id}
            onClose={() => setReportPlace(null)}
            onSubmitReport={handleSubmitReport}
          />
        )}

        {/* 5. Recovery Modal */}
        {isRecoveryOpen && (
          <RecoveryModal
            onClose={() => setIsRecoveryOpen(false)}
            onRecoverTrip={handleRecoverTrip}
          />
        )}

        {/* 6. Admin Panel Modal */}
        {isAdminOpen && (
          <AdminDashboard
            onClose={() => setIsAdminOpen(false)}
            reports={reports}
            onApproveReport={(id) => {
              setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
            }}
            onRejectReport={(id) => {
              setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
            }}
          />
        )}
      </React.Suspense>

      {/* 7. DEV Floating Toolbar (Sprint 0C requirement 23) */}
      <DevToolbar
        currentScreen={currentScreen}
        trip={trip}
        onDevUnlock={handleDevUnlock}
        onResetTest={handleResetTest}
        onNavigateTab={(tab) => {
          setActiveAppTab(tab);
          if (trip && trip.status === 'paid') {
            setCurrentScreen('unlocked');
          } else {
            handleDevUnlock();
          }
        }}
        onNavigateScreen={(screen) => setCurrentScreen(screen as AppScreen)}
      />
    </div>
  );
}
