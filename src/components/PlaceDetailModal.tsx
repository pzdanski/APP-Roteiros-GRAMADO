import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  Clock, 
  Star, 
  Navigation, 
  RefreshCw, 
  Phone, 
  Globe, 
  ShieldCheck, 
  Play, 
  Flag, 
  ArrowLeft,
  Ticket,
  Instagram,
  Compass
} from 'lucide-react';
import { TripActivity } from '../types';
import { formatPlaceCategory, formatRating, formatOpeningHours, formatDuration } from '../utils/formatters';

interface PlaceDetailModalProps {
  activity: TripActivity | null;
  onClose: () => void;
  onSwapActivity?: (activity: TripActivity) => void;
  onReportError?: (placeName: string, placeId: string) => void;
  onFindNearby?: (activity: TripActivity) => void;
}

export const PlaceDetailModal: React.FC<PlaceDetailModalProps> = ({
  activity,
  onClose,
  onSwapActivity,
  onReportError,
  onFindNearby
}) => {
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  if (!activity) return null;
  const { place } = activity;

  const heroImage = place.media?.[0]?.url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80';

  const handleOpenMaps = () => {
    const query = encodeURIComponent(`${place.name}, ${place.city} - RS`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  // 9.8 Rule: Only show Divulga badge if verified own content exists
  const videoUrl = place.divulga_lugares_tip?.video_url || place.divulga_content_url;
  const hasDivulgaContent = Boolean(
    place.has_divulga_content || 
    videoUrl
  );

  // 9.4 Ratings
  const ratingInfo = formatRating(place.rating, place.rating_count, place.rating_source);

  // 9.2 Hours
  const hoursInfo = formatOpeningHours(place.opening_hours, place.always_open, place.hours_source);

  // 9.10 Coupon
  const coupon = place.coupon;
  const hasCoupon = Boolean(coupon && coupon.active);

  // 9.5 Duration
  const durationText = formatDuration(place.average_duration_minutes) || 'Tempo livre';

  // 9.3 Validated links
  const validWebsite = place.website && place.website.startsWith('http') ? place.website : null;
  const validInstagram = place.instagram && place.instagram.startsWith('http') ? place.instagram : null;
  const verifiedLinks = place.verified_links?.filter(l => l.verified && l.url?.startsWith('http')) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div 
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col animate-in fade-in slide-in-from-bottom duration-200"
        id="modal-place-detail"
      >
        {/* Hero Photo & Back/Close Buttons */}
        <div className="relative h-56 sm:h-64 w-full bg-slate-200 shrink-0">
          <img 
            src={heroImage} 
            alt={place.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          {/* Optional Hotel/Place Logo overlay (Section 9.20) */}
          {place.logo_url && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 rounded-xl px-2.5 py-1 shadow-md max-w-[120px] max-h-[36px] flex items-center justify-center">
              <img src={place.logo_url} alt={`${place.name} logo`} className="max-h-7 object-contain" />
            </div>
          )}

          <button
            id="btn-back-place-modal"
            type="button"
            onClick={onClose}
            aria-label="Voltar para o roteiro"
            className="absolute top-3 left-3 h-9 px-3 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center gap-1.5 backdrop-blur-md transition-colors text-xs font-bold min-h-[36px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </button>

          <button
            id="btn-close-place-modal"
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 left-4 right-4 text-white">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              {/* 9.1 Formatted Category */}
              <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full">
                {place.city} • {formatPlaceCategory(place.category)}
              </span>

              {/* 9.4 Rating */}
              <span className="flex items-center gap-1 text-amber-300 text-xs font-bold bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full">
                <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                {ratingInfo.formattedRating} {ratingInfo.formattedCount ? ratingInfo.formattedCount : ''}
              </span>

              {/* 9.10 Coupon indicator */}
              {hasCoupon && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-300 px-2 py-0.5 rounded-full shadow">
                  <Ticket className="w-3 h-3" />
                  Tem desconto
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold leading-tight">
              {place.name}
            </h3>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm text-[#1E293B]">
          
          {/* Price & Confidence Banner */}
          <div className="bg-[#FAF9F6] p-3.5 rounded-2xl border border-[#E7DFCE] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-[#7A6F5D] uppercase tracking-wider block">
                Valor estimado
              </span>
              <span className="text-base font-extrabold text-[#1B4332]">
                {place.price_info.is_free ? 'Acesso Gratuito' : `R$ ${place.price_info.adult_price} por adulto`}
              </span>
              {place.price_info.child_price !== undefined && (
                <span className="text-xs text-[#64748B] block">
                  Crianças: R$ {place.price_info.child_price}
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                Dado Confiável
              </span>
              <span className="text-[10px] text-[#64748B] block mt-0.5">
                Fonte: {place.price_info.source_name || 'Curadoria Oficial'}
              </span>
            </div>
          </div>

          {/* 9.10 Cupom Divulga Lugares Card */}
          {hasCoupon && coupon && (
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs uppercase tracking-wider">
                <Ticket className="w-4 h-4 text-amber-700" />
                <span>Desconto Exclusivo</span>
              </div>
              <p className="text-sm font-bold text-amber-950">
                Use o cupom <span className="bg-amber-200/80 px-2 py-0.5 rounded font-mono text-[#1B4332]">{coupon.coupon_code || 'divulgalugares'}</span>
              </p>
              {coupon.discount_description && (
                <p className="text-xs text-amber-800">
                  {coupon.discount_description}
                </p>
              )}
            </div>
          )}

          {/* 9.8 Divulga Lugares Curator Highlight (ONLY when own content exists) */}
          {hasDivulgaContent && (
            <div className="bg-[#FAF6EE] p-4 rounded-2xl border border-[#E2D5BE] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1B4332] bg-[#EFE9DE] px-2 py-0.5 rounded-md flex items-center gap-1">
                  ⭐ Dica Divulga Lugares
                </span>
                <span className="text-[11px] text-[#7A6F5D] font-medium">
                  Já visitamos este lugar
                </span>
              </div>
              {place.divulga_lugares_tip?.title && (
                <h5 className="font-bold text-[#1B4332]">
                  {place.divulga_lugares_tip.title}
                </h5>
              )}
              {place.divulga_lugares_tip?.text && (
                <p className="text-xs text-[#475569] leading-relaxed">
                  {place.divulga_lugares_tip.text}
                </p>
              )}

              {videoUrl && (
                <button
                  type="button"
                  onClick={() => setIsPlayingVideo(!isPlayingVideo)}
                  className="mt-1 w-full py-2 bg-white hover:bg-[#F3EFE6] text-[#1B4332] font-semibold text-xs rounded-xl border border-[#D8C9AE] transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-[#1B4332]" />
                  <span>{isPlayingVideo ? 'Ocultar vídeo' : 'Assistir nosso vídeo'}</span>
                </button>
              )}

              {isPlayingVideo && videoUrl && (
                <div className="pt-2">
                  <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center text-white text-xs">
                    <iframe 
                      src={videoUrl.includes('embed') ? videoUrl : `https://www.youtube.com/embed/${videoUrl.split('v=')[1] || 'dQw4w9WgXcQ'}?autoplay=1`} 
                      title="Vídeo Divulga Lugares"
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#7A6F5D] mb-1.5">
              Sobre o Local
            </h4>
            <p className="text-sm text-[#334155] leading-relaxed">
              {place.description}
            </p>
          </div>

          {/* Practical Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#F1EBE0]">
              <span className="text-[10px] text-[#7A6F5D] uppercase font-bold block">Tempo Médio</span>
              <span className="font-bold text-[#1E293B] flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-[#1B4332]" />
                {durationText}
              </span>
            </div>

            <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#F1EBE0]">
              <span className="text-[10px] text-[#7A6F5D] uppercase font-bold block">Clima</span>
              <span className="font-bold text-[#1E293B] mt-0.5 block">
                {place.indoor_type === 'indoor' ? '🌧️ 100% Coberto' : place.indoor_type === 'mixed' ? '⛅ Misto Coberto/Ar livre' : '☀️ Ao ar livre'}
              </span>
            </div>

            <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#F1EBE0]">
              <span className="text-[10px] text-[#7A6F5D] uppercase font-bold block">Crianças</span>
              <span className="font-bold text-[#1E293B] mt-0.5 block">
                {place.children_friendly ? '✅ Excelente para crianças' : '⚠️ Mais voltado a adultos'}
              </span>
            </div>

            <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#F1EBE0]">
              <span className="text-[10px] text-[#7A6F5D] uppercase font-bold block">Pets</span>
              <span className="font-bold text-[#1E293B] mt-0.5 block">
                {place.pet_friendly ? '🐾 Aceita pets' : '🚫 Não aceita pets'}
              </span>
            </div>
          </div>

          {/* 9.2 Horários de Funcionamento (grouped & explicit distinction) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#7A6F5D]">
                Horários de Funcionamento
              </h4>
              <span className="text-[10px] text-[#64748B]">
                {hoursInfo.sourceNote}
              </span>
            </div>

            <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#F1EBE0] space-y-1.5 text-xs">
              {hoursInfo.isAlwaysOpen ? (
                <div className="flex items-center justify-between py-1">
                  <span className="font-bold text-[#1B4332] bg-[#EBF3EE] px-2 py-0.5 rounded">
                    SEG–DOM
                  </span>
                  <span className="font-extrabold text-[#1B4332]">
                    Sempre aberto
                  </span>
                </div>
              ) : hoursInfo.groupedDays.length > 0 ? (
                hoursInfo.groupedDays.map((g, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-[#F1EBE0] last:border-0">
                    <span className="font-bold text-[#475569]">{g.days}</span>
                    <span className="text-[#1E293B] font-semibold">{g.hours}</span>
                  </div>
                ))
              ) : (
                <div className="py-1 text-[#64748B] italic">
                  Horário não confirmado no catálogo. Consulte no local.
                </div>
              )}
            </div>
          </div>

          {/* 9.3 Links Oficiais e Contatos (no inferred links, only verified) */}
          <div className="space-y-2 pt-1">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#7A6F5D]">
              Contatos e Links Confiáveis
            </h4>

            <div className="space-y-1.5 text-xs text-[#475569]">
              <p className="flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />
                <span>{place.address}</span>
              </p>
              {place.phone && (
                <p className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#1B4332]" />
                  <span>{place.phone}</span>
                </p>
              )}

              {/* Render verified official links */}
              <div className="flex flex-wrap gap-2 pt-1">
                {validWebsite && (
                  <a
                    href={validWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#EBF3EE] text-[#1B4332] font-bold text-xs hover:bg-[#D7E8DD] transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Site oficial</span>
                  </a>
                )}
                {validInstagram && (
                  <a
                    href={validInstagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pink-50 text-pink-700 font-bold text-xs hover:bg-pink-100 transition-colors border border-pink-200"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                    <span>Instagram oficial</span>
                  </a>
                )}
                {verifiedLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span className="capitalize">{link.type}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Report incorrect info button */}
          <div className="pt-2 border-t border-[#F1EBE0] flex justify-end">
            <button
              type="button"
              onClick={() => onReportError && onReportError(place.name, place.id)}
              className="text-xs text-[#7A6F5D] hover:text-[#1B4332] flex items-center gap-1 underline"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Informar preço ou horário diferente</span>
            </button>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-3.5 bg-[#FAF9F6] border-t border-[#E7DFCE] flex flex-wrap gap-2 shrink-0">
          <button
            id="btn-modal-maps"
            type="button"
            onClick={handleOpenMaps}
            className="flex-1 min-w-[130px] py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow min-h-[44px]"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Como Chegar</span>
          </button>

          {onFindNearby && (
            <button
              id="btn-modal-nearby"
              type="button"
              onClick={() => {
                onClose();
                onFindNearby(activity);
              }}
              className="py-2.5 px-3 bg-[#FAF9F6] hover:bg-[#F3EFE6] text-[#1B4332] font-bold text-xs rounded-xl border border-[#E7DFCE] transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Perto Daqui</span>
            </button>
          )}

          {onSwapActivity && (
            <button
              id="btn-modal-swap"
              type="button"
              onClick={() => onSwapActivity(activity)}
              className="py-2.5 px-3 bg-[#FAF9F6] hover:bg-[#F3EFE6] text-[#475569] font-semibold text-xs rounded-xl border border-[#E7DFCE] transition-colors flex items-center justify-center gap-1 min-h-[44px]"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#7A6F5D]" />
              <span>Trocar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
