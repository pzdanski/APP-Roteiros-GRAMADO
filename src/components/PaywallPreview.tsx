import React from 'react';
import { 
  Lock, 
  ShieldCheck, 
  Check, 
  ArrowRight,
  Building2,
  Info,
  ArrowLeft,
  Sparkles,
  Star,
  Clock,
  MapPin,
  Utensils,
  Compass
} from 'lucide-react';
import { Trip, TripPreview, TripActivity, PlaceCategory, IndoorType } from '../types';
import { NearbyAccommodationSection } from './NearbyAccommodationSection';
import { formatSafeBrl, safeNumber, safeText } from '../utils/safeDisplay';
import { SEED_PLACES } from '../data/seedData';
import { PriceService } from '../services/payment/PriceService';

interface PaywallPreviewProps {
  preview?: TripPreview | null;
  trip?: Trip | null;
  onOpenDetails?: (activity: TripActivity) => void;
  onUnlockTrip?: () => void;
  onUnlockClick?: () => void;
  onSwapActivity?: (activity: TripActivity) => void;
  onBack?: () => void;
  onDevUnlock?: () => void;
}

export const PaywallPreview: React.FC<PaywallPreviewProps> = ({
  preview,
  trip,
  onOpenDetails,
  onUnlockTrip,
  onUnlockClick,
  onBack,
  onDevUnlock
}) => {
  const preferences = preview?.preferences || trip?.preferences;
  const daysCount = preview?.total_days || trip?.days?.length || 4;
  const firstName = preferences?.name ? safeText(preferences.name.split(' ')[0], 'Viajante') : 'Viajante';
  const priceDetail = PriceService.calculatePriceFromDates(
    preferences?.start_date,
    preferences?.end_date,
    daysCount
  );
  const priceBrl = preview?.price_brl || trip?.price_brl || priceDetail.priceBrl;

  const handleUnlock = () => {
    if (typeof onUnlockTrip === 'function') {
      onUnlockTrip();
    } else if (typeof onUnlockClick === 'function') {
      onUnlockClick();
    }
  };

  const hasAccommodation = 
    preferences?.accommodation_status === 'booked' || 
    (!!preferences?.hotel_name && preferences?.accommodation_status !== 'not_booked' && preferences?.accommodation_status !== 'undecided');

  const hotelName = preferences?.hotel_name || preferences?.accommodation?.name;
  const hotelCity = preferences?.hotel_city || preferences?.accommodation?.city || 'Gramado';

  const handleOpenTeaserDetails = (revealed: NonNullable<NonNullable<typeof preview>['days'][0]['activities'][0]['revealed_place']>) => {
    if (!onOpenDetails) return;
    const realPlace = SEED_PLACES.find(p => p.id === revealed.id) || {
      id: revealed.id,
      name: revealed.name,
      slug: 'lago-negro',
      city: revealed.city,
      category: revealed.category,
      description: revealed.description,
      latitude: -29.3888,
      longitude: -50.8808,
      address: 'Rua A. J. Renner, Gramado - RS',
      rating: revealed.rating,
      rating_count: 1240,
      price_level: (revealed.price_level || 1) as 1 | 2 | 3 | 4,
      price_info: {
        adult_price: 0,
        is_free: true,
        currency: 'BRL',
        source_name: 'Curadoria DUO21',
        checked_at: new Date().toISOString(),
        confidence: 'high'
      },
      average_duration_minutes: revealed.duration_minutes,
      reservation_required: false,
      accessible: true,
      pet_friendly: true,
      children_friendly: true,
      indoor_type: revealed.indoor_type,
      opening_hours: { 'seg': '24 horas', 'ter': '24 horas', 'qua': '24 horas', 'qui': '24 horas', 'sex': '24 horas', 'sab': '24 horas', 'dom': '24 horas' },
      media: [{ url: revealed.image_url || '', is_hero: true }],
      is_divulga_lugares_partner: false,
      active: true,
      is_demo: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const syntheticActivity: TripActivity = {
      id: 'act-teaser-1',
      time: '09:00',
      place: realPlace,
      duration_minutes: revealed.duration_minutes,
      travel_time_from_prev_minutes: 0,
      distance_km_from_prev: 0,
      estimated_cost_per_person: 0,
      locked: false
    };

    onOpenDetails(syntheticActivity);
  };

  return (
    <div className="w-full max-w-md mx-auto pb-28">
      {/* Back Button */}
      {onBack && (
        <button
          type="button"
          id="btn-back-preview"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-[#1B4332] bg-white border border-[#D9EADB] hover:bg-[#EBF3EE] active:scale-[0.98] px-3.5 py-2.5 rounded-xl transition-all shadow-xs min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 text-[#1B4332]" />
          <span>Voltar para confirmação</span>
        </button>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-b from-[#EBF3EE] to-transparent p-4 rounded-3xl mb-4 border border-[#D9EADB] space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-[#1B4332] text-white px-2 py-0.5 rounded-full">
            Prévia do Roteiro Gerada
          </span>
          <span className="text-xs font-semibold text-[#1B4332]">
            {daysCount} {daysCount === 1 ? 'dia planejado' : 'dias planejados'}
          </span>
        </div>

        <h2 className="text-xl font-extrabold text-[#1B4332] leading-tight">
          {firstName}, veja como estruturamos sua viagem!
        </h2>

        {/* Accommodation Logistics Banner */}
        {hasAccommodation ? (
          <div className="flex items-start gap-2 text-xs bg-white/90 p-2.5 rounded-xl border border-[#D9EADB] text-[#1B4332]">
            <Building2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Roteiro planejado a partir da sua hospedagem</p>
              <p className="text-[11px] text-[#475569]">{safeText(hotelName, 'Hospedagem')} • {hotelCity}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-xs bg-[#FAF9F6] p-2.5 rounded-xl border border-[#E7DFCE] text-[#475569]">
            <Info className="w-4 h-4 text-[#7A6F5D] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#1E293B]">Base regional: Centro de {hotelCity}</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Você ainda não informou onde vai ficar. Quando souber, recalculamos os trajetos exatos no app desbloqueado.
              </p>
            </div>
          </div>
        )}

        <p className="text-xs text-[#475569] leading-relaxed">
          Deguste a primeira atração do Dia 1 abaixo. Ao desbloquear o app, todos os dias revelam seus nomes exatos, mapa interativo, rotas inteligentes, reservas e suporte local.
        </p>

        <div className="flex flex-wrap gap-2 text-[11px] font-medium text-[#1B4332]">
          <span className="bg-white/80 px-2.5 py-1 rounded-lg border border-[#D9EADB] flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Zero zigue-zague
          </span>
          <span className="bg-white/80 px-2.5 py-1 rounded-lg border border-[#D9EADB] flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Clima considerado
          </span>
          <span className="bg-white/80 px-2.5 py-1 rounded-lg border border-[#D9EADB] flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Dentro do orçamento
          </span>
        </div>
      </div>

      {/* Days Preview Rendering */}
      <div className="space-y-6">
        {preview?.days.map((day) => (
          <div key={day.day_number} className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#E7DFCE] pb-2 px-1">
              <div>
                <span className="text-[11px] font-bold text-[#7A6F5D] uppercase tracking-wider">
                  DIA {day.day_number} • {safeText(day.city_focus, 'Serra')}
                </span>
                <h3 className="text-sm font-extrabold text-[#1E293B]">
                  {safeText(day.theme_title, `Dia ${day.day_number}`)}
                </h3>
              </div>

              {day.day_number > 1 ? (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Bloqueado
                </span>
              ) : (
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Degustação
                </span>
              )}
            </div>

            {/* Activities for this preview day */}
            <div className="space-y-3">
              {day.activities.map((act) => {
                // Revealed Day 1 Activity 1 Teaser
                if (!act.locked && act.revealed_place) {
                  return (
                    <div 
                      key={act.id} 
                      className="bg-white rounded-2xl border border-[#D9EADB] p-3.5 shadow-sm space-y-2.5 transition-all hover:border-[#1B4332]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#1B4332] bg-[#EBF3EE] px-2 py-0.5 rounded-md">
                            {act.time}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B4332] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            {act.category_label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-600">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{act.revealed_place.rating}</span>
                        </div>
                      </div>

                      <div className="flex gap-3 items-start">
                        {act.revealed_place.image_url && (
                          <img 
                            src={act.revealed_place.image_url} 
                            alt={act.revealed_place.name} 
                            className="w-20 h-20 rounded-xl object-cover shrink-0 border border-[#E7DFCE]"
                          />
                        )}
                        <div className="flex-1 space-y-1">
                          <h4 className="text-sm font-bold text-[#1E293B] leading-snug">
                            {act.revealed_place.name}
                          </h4>
                          <p className="text-xs text-[#475569] line-clamp-2">
                            {act.revealed_place.description}
                          </p>
                          <div className="flex items-center gap-2 pt-1 text-[11px] text-[#64748B]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {act.revealed_place.duration_minutes} min
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {act.revealed_place.city}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenTeaserDetails(act.revealed_place!)}
                        className="w-full py-2 bg-[#FAF9F6] hover:bg-[#EBF3EE] text-[#1B4332] text-xs font-bold rounded-xl border border-[#D9EADB] transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span>Ver detalhes da atração</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                // Strictly Locked Teaser Card (NO secret place name or place ID in DOM/JSON!)
                return (
                  <div
                    key={act.id}
                    onClick={handleUnlock}
                    className="group cursor-pointer relative overflow-hidden rounded-2xl bg-white border border-[#E7DFCE] hover:border-amber-400 p-3.5 shadow-xs transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#7A6F5D] bg-[#FAF9F6] px-2 py-0.5 rounded-md border border-[#E7DFCE]">
                          {act.time}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-md">
                          {act.category_label}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Bloqueado
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-[#1E293B] group-hover:text-[#1B4332] transition-colors flex items-center gap-1.5">
                        <span>{act.teaser_title}</span>
                      </h4>
                      <p className="text-[11px] text-[#64748B] leading-relaxed">
                        {act.teaser_description}
                      </p>
                    </div>

                    {act.estimated_cost_range && (
                      <div className="mt-2 pt-2 border-t border-[#F1EBE0] flex items-center justify-between text-[10px] text-[#7A6F5D]">
                        <span>Orçamento estimado: {act.estimated_cost_range}</span>
                        <span className="text-amber-800 font-semibold group-hover:underline flex items-center gap-0.5">
                          Liberar com app <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Proximity / Accommodation Section */}
      <NearbyAccommodationSection 
        preferences={preferences} 
        onSelectPlaceName={() => {
          handleUnlock();
        }}
      />

      {/* DEV Mode Unlock Box (Sprint requirement: only rendered when not in production) */}
      {Boolean((import.meta as any).env?.DEV || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production')) && (
        <div 
          id="dev-mode-unlock-box"
          className="mt-6 p-4 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-amber-950 space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
              MODO DE DESENVOLVIMENTO
            </span>
            <span className="text-[10px] font-semibold text-amber-700">
              Admin / Testes Internos
            </span>
          </div>

          <p className="text-xs text-amber-900 leading-relaxed">
            Permite testar 100% do app completo sem cobrança real, sem chamar o Asaas e chamando o FinalItineraryEngine oficial.
          </p>

          <button
            id="btn-dev-unlock"
            type="button"
            onClick={onDevUnlock}
            className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Desbloquear roteiro para teste</span>
          </button>
        </div>
      )}

      {/* Social Proof / Trust Teaser */}
      <div className="mt-6 bg-white p-4 rounded-2xl border border-[#E7DFCE] text-center space-y-2">
        <p className="text-xs font-bold text-[#1B4332] flex items-center justify-center gap-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Acesso Seguro e Imediato no seu Smartphone
        </p>
        <p className="text-[11px] text-[#64748B] leading-relaxed">
          Sem precisar criar senhas ou cadastros longos. Você recebe um link seguro exclusivo por e-mail e WhatsApp para usar durante toda a sua viagem.
        </p>
      </div>

      {/* Floating Bottom Paywall CTA Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E7DFCE] p-3.5 shadow-2xl">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] text-[#64748B] uppercase font-bold block">
              {priceDetail.isPromotional ? 'Oferta de Lançamento' : 'Investimento Único'}
            </span>
            <div className="flex items-baseline gap-1.5">
              {priceDetail.isPromotional && (
                <span className="text-xs text-slate-400 line-through">
                  {formatSafeBrl(priceDetail.officialPriceBrl)}
                </span>
              )}
              <span className="text-lg font-black text-[#1B4332]">
                {formatSafeBrl(priceBrl)}
              </span>
              <span className="text-[10px] text-[#7A6F5D]">
                ({daysCount} {daysCount === 1 ? 'dia' : 'dias'})
              </span>
            </div>
          </div>

          <button
            id="btn-unlock-paywall-cta"
            onClick={handleUnlock}
            className="flex-1 py-3 px-4 bg-[#1B4332] hover:bg-[#2D6A4F] active:scale-[0.98] text-white font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 min-h-[44px]"
          >
            <span>Desbloquear meu roteiro — {formatSafeBrl(priceBrl)}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
