import React from 'react';
import { 
  Clock, 
  MapPin, 
  Navigation, 
  RefreshCw, 
  Star, 
  Lock, 
  Umbrella, 
  Sun,
  Compass,
  Ticket
} from 'lucide-react';
import { TripActivity } from '../types';
import { formatPlaceCategory, formatRating, formatDuration } from '../utils/formatters';

interface PlaceCardProps {
  activity: TripActivity;
  onOpenDetails: (activity: TripActivity) => void;
  onSwapActivity?: (activity: TripActivity) => void;
  onFindNearby?: (activity: TripActivity) => void;
  isPaywallLocked?: boolean;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({
  activity,
  onOpenDetails,
  onSwapActivity,
  onFindNearby,
  isPaywallLocked = false
}) => {
  const { place, time, duration_minutes, distance_km_from_prev, locked } = activity;
  const isLocked = isPaywallLocked || locked;

  if (isLocked) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-white border border-[#E7DFCE] p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[#1B4332] bg-[#EBF3EE] px-2 py-0.5 rounded-md">
            {time}
          </span>
          <span className="text-[11px] text-[#7A6F5D] font-medium flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            Conteúdo exclusivo do roteiro
          </span>
        </div>

        {/* Blurred preview placeholder */}
        <div className="filter blur-sm select-none opacity-40 flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl bg-slate-300" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-400 rounded w-3/4" />
            <div className="h-3 bg-slate-300 rounded w-1/2" />
          </div>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[2px]">
          <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-1 text-amber-700 shadow-sm">
            <Lock className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-[#1E293B]">Atividade Otimizada</span>
          <span className="text-[10px] text-[#64748B]">Disponível após desbloqueio</span>
        </div>
      </div>
    );
  }

  const heroImage = place.media?.[0]?.url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80';

  const weatherBadge = () => {
    if (place.indoor_type === 'indoor') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-150">
          <Umbrella className="w-3 h-3 text-sky-600" />
          100% Coberto (Chuva OK)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-150">
        <Sun className="w-3 h-3 text-amber-500" />
        Ar livre
      </span>
    );
  };

  const handleOpenMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    const query = encodeURIComponent(`${place.name}, ${place.city} - RS`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  // 9.8 Rule: Only show Divulga badge if own verified content is attached
  const hasDivulgaContent = Boolean(
    place.has_divulga_content || 
    place.divulga_content_url || 
    place.divulga_lugares_tip?.video_url
  );

  // 9.10 Rule: Coupon badge
  const hasCoupon = Boolean(place.coupon?.active);

  // 9.4 Rating formatting
  const ratingInfo = formatRating(place.rating, place.rating_count, place.rating_source);

  // 9.5 Duration
  const durationLabel = formatDuration(duration_minutes || place.average_duration_minutes);

  return (
    <div 
      className="bg-white rounded-2xl border border-[#E7DFCE] overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
      id={`card-place-${place.id}`}
      onClick={() => onOpenDetails(activity)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetails(activity);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalhes de ${place.name}`}
    >
      {/* Time and City Header Banner */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#FAF9F6] border-b border-[#F1EBE0]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-[#1B4332] bg-[#EBF3EE] px-2 py-0.5 rounded-md">
            {time}
          </span>
          <span className="text-[11px] font-semibold text-[#64748B]">
            {place.city}
          </span>
        </div>

        {weatherBadge()}
      </div>

      <div className="p-3.5">
        <div className="flex gap-3">
          {/* Place Photo (Clickable) */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-slate-100 group-hover:opacity-95 transition-opacity">
            <img 
              src={heroImage} 
              alt={place.name} 
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            {place.price_info.is_free ? (
              <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-emerald-700 text-white px-1.5 py-0.5 rounded shadow">
                GRÁTIS
              </span>
            ) : (
              <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-[#1B4332]/90 text-white px-1.5 py-0.5 rounded shadow">
                R$ {place.price_info.adult_price}
              </span>
            )}
          </div>

          {/* Place Main Info (Clickable) */}
          <div className="flex-1 flex flex-col justify-between min-w-0">
            <div>
              <div className="flex flex-wrap items-center gap-1 mb-1">
                {/* 9.8 Divulga Badge */}
                {hasDivulgaContent && (
                  <span className="inline-block text-[10px] font-bold text-[#1B4332] bg-[#EFE9DE] px-1.5 py-0.5 rounded">
                    ⭐ Dica Divulga Lugares
                  </span>
                )}
                {/* 9.10 Coupon Badge */}
                {hasCoupon && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
                    <Ticket className="w-3 h-3 text-amber-700" />
                    Tem desconto
                  </span>
                )}
              </div>

              <h4 className="font-bold text-sm text-[#0F172A] leading-snug line-clamp-2 group-hover:text-[#1B4332] transition-colors">
                {place.name}
              </h4>
              {/* 9.1 Formatted Category */}
              <p className="text-[11px] text-[#64748B] line-clamp-1 mt-0.5">
                {formatPlaceCategory(place.category)} • {place.address}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3 text-[11px] text-[#475569] mt-2 font-medium">
              <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                {ratingInfo.formattedRating}
              </span>
              {durationLabel && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#7A6F5D]" />
                  {durationLabel}
                </span>
              )}
              {distance_km_from_prev > 0 && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#7A6F5D]" />
                  {distance_km_from_prev} km
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Row (6/60 rule: clear labels, touch targets) */}
        <div className="mt-3.5 pt-3 border-t border-[#F1EBE0] grid grid-cols-4 gap-1.5">
          <button
            id={`btn-details-${place.id}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(activity);
            }}
            className="col-span-2 py-2 px-2.5 bg-[#EBF3EE] hover:bg-[#D7E8DD] text-[#1B4332] font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1"
          >
            Ver detalhes
          </button>

          <button
            id={`btn-maps-${place.id}`}
            type="button"
            onClick={handleOpenMaps}
            className="py-2 px-2 bg-[#FAF9F6] hover:bg-[#F3EFE6] text-[#475569] font-semibold text-[11px] rounded-xl border border-[#E7DFCE] transition-colors flex items-center justify-center gap-1"
            title="Como chegar no Google Maps"
          >
            <Navigation className="w-3.5 h-3.5 text-[#1B4332]" />
            <span>Ir</span>
          </button>

          {onSwapActivity && (
            <button
              id={`btn-swap-${place.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSwapActivity(activity);
              }}
              className="py-2 px-2 bg-[#FAF9F6] hover:bg-[#F3EFE6] text-[#475569] font-semibold text-[11px] rounded-xl border border-[#E7DFCE] transition-colors flex items-center justify-center gap-1"
              title="Trocar este passeio por outro"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#7A6F5D]" />
              <span>Trocar</span>
            </button>
          )}

          {onFindNearby && (
            <button
              id={`btn-nearby-${place.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFindNearby(activity);
              }}
              className="col-span-4 mt-1 py-1.5 px-2 bg-[#FAF9F6] hover:bg-[#F3EFE6] text-[#7A6F5D] text-[11px] font-medium rounded-lg border border-dashed border-[#D8D2C2] flex items-center justify-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-[#1B4332]" />
              <span>Ver o que fazer perto daqui</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
