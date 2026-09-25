import React, { useState } from 'react';
import { 
  Compass, 
  CalendarDays, 
  Map as MapIcon, 
  MessageSquareText, 
  Sun, 
  CloudRain, 
  Clock, 
  MapPin, 
  Navigation, 
  RefreshCw, 
  Utensils, 
  Sparkles, 
  Send, 
  Tag, 
  ShieldCheck, 
  AlertCircle,
  Percent,
  CheckCircle2,
  Lock,
  Mic,
  ArrowRight,
  Coffee,
  Building2,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { Trip, TripActivity, Place, TravelPace } from '../types';
import { AppTab, BottomNav } from '../components/BottomNav';
import { PlaceCard } from '../components/PlaceCard';
import { NearbyAccommodationSection } from '../components/NearbyAccommodationSection';
import { NearbyOverlayModal } from '../components/NearbyOverlayModal';
import { SEED_PLACES } from '../data/seedData';
import { DEMO_ACCOMMODATIONS } from '../services/accommodation/AccommodationEngine';
import { mapProvider } from '../services/map/MapProvider';
import { aiProvider } from '../services/ai/GeminiProvider';
import { trackEvent } from '../services/analytics';
import { formatSafeBrl } from '../utils/safeDisplay';

interface UnlockedAppViewProps {
  trip: Trip;
  onOpenDetails: (activity: TripActivity) => void;
  onSwapActivity: (activity: TripActivity) => void;
  onFindNearby: (activity: TripActivity) => void;
  onUpdateTrip: (updatedTrip: Trip) => void;
  initialTab?: AppTab;
}

export const UnlockedAppView: React.FC<UnlockedAppViewProps> = ({
  trip,
  onOpenDetails,
  onSwapActivity,
  onFindNearby,
  onUpdateTrip,
  initialTab = 'hoje'
}) => {
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [quickFilter, setQuickFilter] = useState<'todos' | 'comer' | 'passeios' | 'gratis' | 'ofertas'>('todos');
  const [isNearbyModalOpen, setIsNearbyModalOpen] = useState(false);
  const [selectedMarkerPlace, setSelectedMarkerPlace] = useState<Place | null>(null);

  // Guide Chat State
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; isDemo?: boolean }>>([
    {
      sender: 'assistant',
      text: `Olá, ${trip.preferences.name || 'Viajante'}! Sou seu Guia Inteligente da Serra Gaúcha. Tenho o contexto completo da sua estadia em ${trip.preferences.hotel_city || 'Gramado'}, ritmo ${trip.preferences.pace} e paradas programadas. Como posso te orientar agora?`,
      isDemo: true
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGuideLoading, setIsGuideLoading] = useState(false);

  const firstName = trip.preferences.name ? trip.preferences.name.split(' ')[0] : 'Viajante';

  // Calculate temporal context
  const today = new Date();
  const startDate = new Date(trip.preferences.start_date);
  const endDate = new Date(trip.preferences.end_date);
  const diffTime = startDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let temporalGreeting = "Sua viagem pela Serra";
  if (diffDays > 0) {
    temporalGreeting = `Faltam ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'} para sua viagem!`;
  } else if (diffDays <= 0 && today.getTime() <= endDate.getTime() + 86400000) {
    temporalGreeting = "Hoje na Serra Gaúcha";
  }

  const currentDay = trip.days.find(d => d.day_number === selectedDayNumber) || trip.days[0] || {
    day_number: 1,
    date: trip.preferences.start_date,
    city_focus: 'Gramado' as const,
    theme_title: 'Boas-vindas à Serra',
    activities: [],
    total_day_cost_estimated: 0
  };

  // Filter activities for today according to quick filter
  const filteredActivities = currentDay.activities.filter(act => {
    if (quickFilter === 'comer') {
      return act.place.category === 'restaurante' || act.place.category === 'cafe' || act.place.category === 'chocolate';
    }
    if (quickFilter === 'passeios') {
      return act.place.category === 'parque' || act.place.category === 'museu' || act.place.category === 'mirante';
    }
    if (quickFilter === 'gratis') {
      return act.place.price_info.is_free;
    }
    return true;
  });

  const nextActivity = currentDay.activities[0];

  const hasHotel = 
    trip.preferences.accommodation_status === 'booked' || 
    (!!trip.preferences.hotel_name && trip.preferences.accommodation_status !== 'not_booked' && trip.preferences.accommodation_status !== 'undecided');

  // Guide message sending
  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || isGuideLoading) return;

    if (trip.usage_stats.guide_messages_today >= trip.usage_stats.guide_messages_limit) {
      setMessages(prev => [
        ...prev,
        { sender: 'user', text: userText },
        { sender: 'assistant', text: 'Você atingiu o limite diário de mensagens do Guia. Ele será renovado amanhã para garantir a sustentabilidade do sistema!' }
      ]);
      return;
    }

    const newMsgs = [...messages, { sender: 'user' as const, text: userText }];
    setMessages(newMsgs);
    setInputMessage('');
    setIsGuideLoading(true);
    trackEvent('guide_message');

    onUpdateTrip({
      ...trip,
      usage_stats: {
        ...trip.usage_stats,
        guide_messages_today: trip.usage_stats.guide_messages_today + 1
      }
    });

    try {
      const response = await aiProvider.askTripGuide(userText, {
        preferences: trip.preferences,
        hotel: trip.preferences.hotel_name,
        city: currentDay.city_focus,
        todayActivities: currentDay.activities.map(a => a.place.name)
      });

      setMessages(prev => [...prev, { sender: 'assistant', text: response.replyText, isDemo: true }]);
    } catch {
      // Local contextual fallback
      const lower = userText.toLowerCase();
      let reply = 'Para o seu dia em ' + currentDay.city_focus + ', recomendo conferir a rota do dia ou os pontos próximos no Mapa.';
      if (lower.includes('chuva') || lower.includes('chovendo')) {
        reply = 'Para momentos de chuva na Serra, opte por atrações 100% cobertas: Snowland (climatizado), museus temáticos em Gramado ou um aconchegante café colonial.';
      } else if (lower.includes('fondue') || lower.includes('jantar')) {
        reply = 'A tradicional sequência de fondue (queijo, carnes na pedra e chocolate) é indispensável à noite na Serra. No centro de Gramado e Canela há opções a partir de R$ 89 por pessoa.';
      } else if (lower.includes('cansado') || lower.includes('cansada')) {
        reply = 'Respeitando o ritmo da viagem, que tal pausar para um chocolate quente em uma das charmosas chocolaterias na Av. Borges de Medeiros?';
      }

      setMessages(prev => [
        ...prev, 
        { sender: 'assistant', text: reply, isDemo: true }
      ]);
    } finally {
      setIsGuideLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto pb-28">
      {/* DEV Status Pill Banner */}
      {trip.unlock_source === 'dev_test' && (
        <div className="mb-3 px-3 py-1.5 bg-amber-100/90 border border-amber-300/80 rounded-xl text-amber-900 text-[11px] font-bold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>MODO DE TESTE / DEV UNLOCK ATIVO</span>
          </span>
          <span className="text-[10px] bg-amber-200/80 px-2 py-0.5 rounded text-amber-800">
            DEMO DATA
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: HOJE */}
      {/* ========================================================================= */}
      {activeTab === 'hoje' && (
        <div className="space-y-4">
          {/* Welcome & Context Header */}
          <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#1B4332] bg-[#EBF3EE] px-2.5 py-0.5 rounded-full">
                {temporalGreeting}
              </span>
              <span className="text-xs text-[#7A6F5D] font-semibold flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#1B4332]" />
                {trip.preferences.hotel_city || 'Gramado'}
              </span>
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-[#1E293B]">
                Olá, {firstName}!
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Hoje seu foco principal é explorar <strong className="text-[#1B4332]">{currentDay.city_focus}</strong> com logística inteligente.
              </p>
            </div>

            {/* Weather Widget */}
            <div className="mt-2 bg-[#FAF9F6] p-3 rounded-2xl border border-[#F1EBE0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#1E293B]">
                      {currentDay.weather_forecast?.summary || 'Clima Ameno da Serra'}
                    </span>
                    <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                      MOCK
                    </span>
                  </div>
                  <span className="text-[11px] text-[#64748B] block">
                    Min {currentDay.weather_forecast?.temp_min || 13}°C • Máx {currentDay.weather_forecast?.temp_max || 22}°C • Chuva {currentDay.weather_forecast?.rain_probability || 10}%
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                  Ideal ao Ar Livre
                </span>
              </div>
            </div>

            {/* Daily Estimated Budget */}
            <div className="pt-2 flex items-center justify-between text-xs text-[#64748B] border-t border-[#F1EBE0]">
              <span>Orçamento estimado do dia:</span>
              <strong className="text-sm font-extrabold text-[#1B4332]">
                {formatSafeBrl(currentDay.total_day_cost_estimated || 180)}
              </strong>
            </div>
          </div>

          {/* Functional Quick Filter Shortcuts (Comer, Passeios, Grátis, Ofertas, Perto) */}
          <div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
              {[
                { id: 'todos', label: 'Tudo' },
                { id: 'comer', label: '🍽️ Comer' },
                { id: 'passeios', label: '🎡 Passeios' },
                { id: 'gratis', label: '🌿 Grátis' },
                { id: 'ofertas', label: '🏷️ Ofertas' },
                { id: 'perto', label: '📍 Perto de Mim' }
              ].map(chip => (
                <button
                  key={chip.id}
                  id={`shortcut-${chip.id}`}
                  onClick={() => {
                    if (chip.id === 'perto' || chip.id === 'ofertas') {
                      setIsNearbyModalOpen(true);
                    } else {
                      setQuickFilter(chip.id as any);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors border cursor-pointer min-h-[36px] ${
                    quickFilter === chip.id
                      ? 'bg-[#1B4332] text-white border-[#1B4332]'
                      : 'bg-white text-[#64748B] border-[#E7DFCE] hover:bg-[#FAF9F6]'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Next Immediate Activity Card Highlight */}
          {nextActivity && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-[#7A6F5D] uppercase tracking-wider px-1">
                Próxima Atividade Programada
              </span>
              <PlaceCard
                activity={nextActivity}
                onOpenDetails={onOpenDetails}
                onSwapActivity={onSwapActivity}
                onFindNearby={onFindNearby}
                isPaywallLocked={false}
              />
            </div>
          )}

          {/* Upcoming sequence for today */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-[#7A6F5D] uppercase tracking-wider">
                Sequência do Seu Dia ({filteredActivities.length} paradas)
              </span>
              <button
                id="btn-goto-roteiro-tab"
                onClick={() => setActiveTab('roteiro')}
                className="text-xs font-bold text-[#1B4332] hover:underline"
              >
                Ver todos os dias
              </button>
            </div>

            {filteredActivities.slice(1).map(act => (
              <PlaceCard
                key={act.id}
                activity={act}
                onOpenDetails={onOpenDetails}
                onSwapActivity={onSwapActivity}
                onFindNearby={onFindNearby}
                isPaywallLocked={false}
              />
            ))}
          </div>

          {/* Accommodation / Proximity Section (Requirement 11 & 12) */}
          {hasHotel ? (
            <NearbyAccommodationSection 
              trip={trip}
              onSelectPlaceName={(name) => {
                setActiveTab('guia');
                setInputMessage(`O que tem de interessante perto de ${name}?`);
              }}
            />
          ) : (
            /* Requirement 12: Encontre onde ficar for users without accommodation */
            <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] shadow-xs space-y-3" id="section-find-hotel">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-[#1E293B]">
                      Encontre onde ficar
                    </h3>
                    <span className="text-[10px] text-[#64748B]">
                      Sugestões para {trip.preferences.adults_count} adultos em {trip.preferences.hotel_city || 'Gramado'}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  DEMO DATA
                </span>
              </div>

              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Opções compatíveis com seu perfil de viagem para definir sua hospedagem e calibrar as distâncias com máxima precisão:
              </p>

              <div className="space-y-2.5">
                {DEMO_ACCOMMODATIONS.slice(0, 3).map((acc) => (
                  <div 
                    key={acc.id} 
                    className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#F1EBE0] flex items-center gap-3 shadow-xs"
                  >
                    <div className="w-16 h-16 rounded-xl bg-slate-200 overflow-hidden shrink-0">
                      <img 
                        src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=300&q=80" 
                        alt={acc.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-[#1B4332]">
                          {acc.city} • {acc.type}
                        </span>
                        <span className="text-[10px] font-bold text-amber-600">
                          ★ {acc.rating}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-[#1E293B] truncate mt-0.5">
                        {acc.name}
                      </h4>

                      <p className="text-[11px] text-[#64748B] font-medium">
                        {acc.price_display}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[#7A6F5D]">
                        <span>{acc.amenities?.slice(0, 2).join(' • ')}</span>
                      </div>
                    </div>

                    <a
                      href={acc.booking_url || 'https://booking.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white hover:bg-[#EBF3EE] text-[#1B4332] border border-[#E7DFCE] rounded-xl text-xs font-bold shrink-0"
                      title="Ver detalhes de reserva"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ROTEIRO (Requirement 5) */}
      {/* ========================================================================= */}
      {activeTab === 'roteiro' && (
        <div className="space-y-4">
          {/* Day Selector Tabs Ribbon */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar" id="day-selector-ribbon">
            {trip.days.map(day => (
              <button
                key={day.day_number}
                id={`tab-day-${day.day_number}`}
                onClick={() => setSelectedDayNumber(day.day_number)}
                className={`px-4 py-2.5 rounded-2xl whitespace-nowrap text-xs font-bold transition-all border cursor-pointer min-h-[44px] ${
                  selectedDayNumber === day.day_number
                    ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-sm'
                    : 'bg-white text-[#475569] border-[#E7DFCE] hover:bg-[#FAF9F6]'
                }`}
              >
                <span>DIA {day.day_number}</span>
                <span className="block text-[10px] opacity-80">{day.city_focus}</span>
              </button>
            ))}
          </div>

          {/* Day Header Info */}
          <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#1B4332]">
                {currentDay.date} • {currentDay.city_focus}
              </span>
              <span className="text-[11px] font-extrabold text-[#7A6F5D]">
                Est. R$ {currentDay.total_day_cost_estimated || 180}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-[#1E293B]">
              {currentDay.theme_title}
            </h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {currentDay.activities.length} atividades pensadas para evitar trânsito cruzando cidades.
            </p>
          </div>

          {/* Day Activities List */}
          <div className="space-y-3">
            {currentDay.activities.map(act => (
              <PlaceCard
                key={act.id}
                activity={act}
                onOpenDetails={onOpenDetails}
                onSwapActivity={onSwapActivity}
                onFindNearby={onFindNearby}
                isPaywallLocked={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MAPA (Requirement 8) */}
      {/* ========================================================================= */}
      {activeTab === 'mapa' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#1B4332]">
                Mapa Logístico da Serra
              </h3>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                SIMULAÇÃO / DEMO
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Visualização espacial com clusters para evitar trajetos desnecessários na Av. das Hortênsias.
            </p>
          </div>

          {/* Interactive Simulation Map Canvas */}
          <div className="relative w-full h-84 rounded-3xl overflow-hidden border border-[#E7DFCE] bg-[#E8ECE9] shadow-inner flex flex-col justify-between p-3">
            
            {/* Top Cluster Labels */}
            <div className="flex justify-between items-start z-10">
              <div className="bg-white/90 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-emerald-300 text-[11px] font-bold text-emerald-900 shadow-xs">
                📍 Cluster Gramado (Centro)
              </div>
              <div className="bg-white/90 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-amber-300 text-[11px] font-bold text-amber-900 shadow-xs">
                📍 Cluster Canela
              </div>
            </div>

            {/* Clickable Marker Nodes */}
            <div className="grid grid-cols-3 gap-2 my-auto z-10">
              {currentDay.activities.slice(0, 6).map((act, idx) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => setSelectedMarkerPlace(act.place)}
                  className={`p-2 rounded-2xl text-left border shadow-md transition-all active:scale-95 ${
                    selectedMarkerPlace?.id === act.place.id
                      ? 'bg-[#1B4332] text-white border-[#1B4332] ring-2 ring-emerald-400'
                      : 'bg-white/95 text-[#1E293B] border-[#E7DFCE] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold opacity-80 mb-0.5">
                    <span>#{idx + 1} • {act.time}</span>
                    <span>{act.place.city.slice(0, 4)}</span>
                  </div>
                  <div className="text-xs font-extrabold truncate">
                    {act.place.name}
                  </div>
                  <div className="text-[10px] opacity-70 truncate mt-0.5">
                    {act.place.category}
                  </div>
                </button>
              ))}
            </div>

            {/* Map Attribution Footer */}
            <div className="flex justify-between items-center z-10 text-[10px] text-slate-700 bg-white/80 backdrop-blur-xs px-2.5 py-1 rounded-lg">
              <span>{mapProvider.getAttribution()}</span>
              <span>MapLibre Ready</span>
            </div>
          </div>

          {/* Selected Marker Details Drawer */}
          {selectedMarkerPlace && (
            <div className="bg-white p-3.5 rounded-2xl border border-[#1B4332] shadow-md flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <img 
                  src={selectedMarkerPlace.media?.[0]?.url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=200&q=80'} 
                  alt={selectedMarkerPlace.name}
                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-[#1B4332] uppercase">
                    {selectedMarkerPlace.city} • {selectedMarkerPlace.category}
                  </span>
                  <h4 className="text-xs font-bold text-[#1E293B] truncate">
                    {selectedMarkerPlace.name}
                  </h4>
                  <p className="text-[11px] text-[#64748B]">
                    {selectedMarkerPlace.price_info.is_free ? 'Grátis' : `R$ ${selectedMarkerPlace.price_info.adult_price}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const matchingAct = currentDay.activities.find(a => a.place.id === selectedMarkerPlace.id) || {
                    id: `act-temp-${selectedMarkerPlace.id}`,
                    time: '14:00',
                    place: selectedMarkerPlace,
                    duration_minutes: 90,
                    travel_time_from_prev_minutes: 15,
                    distance_km_from_prev: 3,
                    estimated_cost_per_person: 50
                  };
                  onOpenDetails(matchingAct);
                }}
                className="px-3 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer"
              >
                Ver detalhes
              </button>
            </div>
          )}

          {/* Logistics Distances Card */}
          <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#E7DFCE] space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B4332]">
              Tempos Médios de Deslocamento
            </h4>
            <div className="text-xs text-[#475569] space-y-1.5">
              <div className="flex justify-between py-1 border-b border-[#F1EBE0]">
                <span>Gramado ↔ Canela:</span>
                <strong className="text-[#1E293B]">8 km (~15 a 25 min)</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F1EBE0]">
                <span>Gramado ↔ Nova Petrópolis:</span>
                <strong className="text-[#1E293B]">34 km (~45 min)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: GUIA (Requirement 9) */}
      {/* ========================================================================= */}
      {activeTab === 'guia' && (
        <div className="flex flex-col h-[75vh]">
          {/* Header with Context */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE] shadow-xs mb-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-[#1E293B]">Guia Inteligente da Serra</h3>
                <span className="text-[10px] text-emerald-700 font-semibold">Contexto ativo: {trip.preferences.hotel_city || 'Gramado'}</span>
              </div>
            </div>

            <span className="text-[10px] font-bold text-[#7A6F5D] bg-[#FAF9F6] border border-[#E7DFCE] px-2 py-0.5 rounded">
              {trip.usage_stats.guide_messages_today}/{trip.usage_stats.guide_messages_limit} msgs
            </span>
          </div>

          {/* Quick Suggestions Chips (Requirement 9) */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 shrink-0 no-scrollbar">
            {[
              "Começou a chover",
              "Estamos cansados",
              "Quero comer fondue",
              "O que tem perto daqui?",
              "Troque meu passeio da tarde"
            ].map(pill => (
              <button
                key={pill}
                type="button"
                onClick={() => handleSendMessage(pill)}
                className="px-3 py-1.5 bg-white hover:bg-[#F3EFE6] border border-[#E7DFCE] text-[11px] font-semibold text-[#1B4332] rounded-full whitespace-nowrap shadow-xs active:scale-95 cursor-pointer min-h-[36px]"
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-[#FAF9F6] rounded-2xl border border-[#E7DFCE]">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-[#1B4332] text-white rounded-br-xs'
                      : 'bg-white text-[#1E293B] border border-[#E7DFCE] rounded-bl-xs shadow-xs'
                  }`}
                >
                  <p>{m.text}</p>
                  {m.isDemo && (
                    <span className="text-[9px] text-slate-400 block mt-1">
                      Informação de curadoria DUO21
                    </span>
                  )}
                </div>
              </div>
            ))}

            {isGuideLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[#E7DFCE] p-3 rounded-2xl text-xs text-[#64748B] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#1B4332] animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-[#1B4332] animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-[#1B4332] animate-bounce [animation-delay:0.4s]" />
                  <span>Consultando curadoria DUO21...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Bar with Prepared Microphone button */}
          <div className="pt-3 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputMessage);
              }}
              className="flex gap-2"
            >
              <input
                id="input-guide-chat"
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Pergunte qualquer coisa sobre sua viagem..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#E7DFCE] bg-white text-xs outline-none focus:border-[#1B4332]"
              />

              <button
                type="button"
                onClick={() => {
                  setInputMessage("Qual restaurante típico recomenda para hoje?");
                }}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-[#1B4332] rounded-xl border border-[#E7DFCE] transition-colors"
                title="Entrada por voz (Preparada para áudio)"
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                id="btn-guide-send"
                type="submit"
                disabled={!inputMessage.trim() || isGuideLoading}
                className="p-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl shadow transition-colors disabled:opacity-50 min-w-[44px] flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Bottom App Navigation (Requirement 3) */}
      {/* ========================================================================= */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      />

      {/* Nearby & Offers Overlay Modal (Requirement 10) */}
      <NearbyOverlayModal
        isOpen={isNearbyModalOpen}
        onClose={() => setIsNearbyModalOpen(false)}
        onSelectPlace={(p) => {
          const act: TripActivity = {
            id: `act-nearby-${p.id}`,
            time: '15:00',
            place: p,
            duration_minutes: p.average_duration_minutes || 90,
            travel_time_from_prev_minutes: 10,
            distance_km_from_prev: 1.5,
            estimated_cost_per_person: p.price_info.is_free ? 0 : p.price_info.adult_price
          };
          onOpenDetails(act);
        }}
        referenceCity={trip.preferences.hotel_city || 'Gramado'}
      />
    </div>
  );
};
