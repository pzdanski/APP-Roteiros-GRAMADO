import React, { useState, useMemo } from 'react';
import { 
  X, 
  MapPin, 
  Navigation, 
  Search, 
  Utensils, 
  Compass, 
  Star, 
  Clock, 
  Ticket,
  Footprints
} from 'lucide-react';
import { Place, City, TripPreferences } from '../types';
import { SEED_PLACES } from '../data/seedData';
import { formatPlaceCategory, formatRating, formatDuration } from '../utils/formatters';

interface NearbyOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlace: (place: Place) => void;
  referencePlace?: Place | null;
  referenceCity?: City;
  tripPreferences?: TripPreferences;
}

export const DEV_LOCATION = {
  name: 'Centro de Gramado (Rua Coberta)',
  latitude: -29.3789,
  longitude: -50.8739
};

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 10) / 10;
}

export const NearbyOverlayModal: React.FC<NearbyOverlayModalProps> = ({
  isOpen,
  onClose,
  onSelectPlace,
  referencePlace,
  referenceCity = 'Gramado',
  tripPreferences
}) => {
  const [filter, setFilter] = useState<'todos' | 'comer' | 'passeios' | 'cafes' | 'gratis'>('todos');
  const [intentInput, setIntentInput] = useState('');
  
  // 9.15 GPS Real do Celular (Requires explicit user action)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  if (!isOpen) return null;

  // Reference coordinates
  const refLat = userCoords ? userCoords.lat : (referencePlace ? referencePlace.latitude : DEV_LOCATION.latitude);
  const refLng = userCoords ? userCoords.lng : (referencePlace ? referencePlace.longitude : DEV_LOCATION.longitude);
  const refName = userCoords 
    ? 'Sua Localização GPS' 
    : (referencePlace ? referencePlace.name : DEV_LOCATION.name);

  // 9.15 User-triggered Geolocation (Never asks automatically)
  const handleRequestGeo = () => {
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setGeoStatus('granted');
      },
      () => {
        setGeoStatus('denied');
      },
      { timeout: 7000 }
    );
  };

  // 9.7 Filter and Sort nearby places (Sprint 9.1 Section 4)
  const nearbyPlaces = useMemo(() => {
    let list = SEED_PLACES.filter(p => p.active);

    // Exclude reference place itself so it doesn't show to itself
    if (referencePlace) {
      list = list.filter(p => p.id !== referencePlace.id);
    }

    // Category filter: 🍴 Onde comer, 🎡 O que fazer, ☕ Cafés, 🆓 Gratuitos
    if (filter === 'comer') {
      list = list.filter(p => p.category === 'restaurante');
    } else if (filter === 'passeios') {
      list = list.filter(p => p.category === 'parque' || p.category === 'museu' || p.category === 'mirante' || p.category === 'vinicola');
    } else if (filter === 'cafes') {
      list = list.filter(p => p.category === 'cafe' || p.category === 'chocolate');
    } else if (filter === 'gratis') {
      list = list.filter(p => p.price_info.is_free);
    }

    // Search input
    if (intentInput.trim()) {
      const term = intentInput.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term)
      );
    }

    // Calculate distance and sort by proximity + compatibility
    return list.map(p => {
      const distance = calculateDistanceKm(refLat, refLng, p.latitude, p.longitude);
      let matchScore = 100 - (distance * 10);
      
      // Match trip preferences if available
      if (tripPreferences) {
        if (tripPreferences.children_count > 0 && p.children_friendly) matchScore += 15;
        if (tripPreferences.pace === 'tranquilo' && p.indoor_type !== 'outdoor') matchScore += 5;
        if (p.is_divulga_lugares_partner && p.has_divulga_content) matchScore += 10;
        if (p.coupon?.active) matchScore += 10;
      }

      return {
        place: p,
        distance,
        matchScore
      };
    }).sort((a, b) => {
      // Prioritize proximity first, with match score weighting
      return a.distance - b.distance;
    });
  }, [refLat, refLng, referencePlace, filter, intentInput, tripPreferences]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div 
        id="modal-nearby-overlay"
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[88vh] flex flex-col animate-in fade-in slide-in-from-bottom duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#FAF9F6] border-b border-[#E7DFCE] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center">
              <Compass className="w-4 h-4 text-[#1B4332]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#1B4332]">
                {referencePlace ? `Perto de ${referencePlace.name}` : 'Perto Daqui'}
              </h3>
              <span className="text-[10px] text-[#64748B]">
                {referencePlace ? `Usando ${referencePlace.name} como referência` : 'Opções ordenadas por proximidade e perfil'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Location & GPS Action Banner (Section 9.15) */}
        <div className="px-4 py-2.5 bg-amber-50/70 border-b border-amber-200/60 flex items-center justify-between text-[11px] text-amber-900 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Navigation className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="truncate">
              Ponto de partida: <strong>{refName}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={handleRequestGeo}
            disabled={geoStatus === 'requesting'}
            className="text-[11px] font-bold text-[#1B4332] bg-white border border-[#1B4332]/20 hover:bg-[#EBF3EE] px-2 py-1 rounded-lg shrink-0 transition-colors"
          >
            {geoStatus === 'requesting' ? 'Obtendo GPS...' : geoStatus === 'granted' ? 'Localização ativa' : 'Usar minha localização atual'}
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 border-b border-[#F1EBE0] space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A6F5D]" />
            <input 
              type="text"
              value={intentInput}
              onChange={(e) => setIntentInput(e.target.value)}
              placeholder="O que procura perto daqui? Ex: café, parque, fondue..."
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl outline-none focus:border-[#1B4332]"
            />
          </div>

          {/* Filter Pills (Sprint 9.1 Section 4) */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'comer', label: '🍴 Onde comer' },
              { id: 'passeios', label: '🎡 O que fazer' },
              { id: 'cafes', label: '☕ Cafés' },
              { id: 'gratis', label: '🆓 Gratuitos' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as any)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 transition-colors ${
                  filter === tab.id 
                    ? 'bg-[#1B4332] text-white shadow-xs' 
                    : 'bg-[#FAF9F6] text-[#475569] border border-[#E7DFCE] hover:bg-[#F3EFE6]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Places List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {nearbyPlaces.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#64748B]">
              Nenhum local encontrado com esses filtros perto daqui.
            </div>
          ) : (
            nearbyPlaces.map(({ place: p, distance }) => {
              const ratingInfo = formatRating(p.rating, p.rating_count, p.rating_source);
              const durationLabel = formatDuration(p.average_duration_minutes);
              const hasCoupon = Boolean(p.coupon?.active);

              return (
                <div
                  key={p.id}
                  onClick={() => onSelectPlace(p)}
                  className="p-3 bg-[#FAF9F6] hover:bg-[#F3EFE6] rounded-2xl border border-[#E7DFCE] flex items-center justify-between gap-3 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img 
                      src={p.media?.[0]?.url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=200&q=80'} 
                      alt={p.name}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-200"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-[#1B4332] bg-[#EBF3EE] px-1.5 py-0.2 rounded">
                          {formatPlaceCategory(p.category)}
                        </span>
                        {hasCoupon && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-900 bg-amber-100 px-1 rounded">
                            <Ticket className="w-2.5 h-2.5 text-amber-700" />
                            Cupom
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs text-[#0F172A] truncate mt-0.5">
                        {p.name}
                      </h4>
                      <p className="text-[10px] text-[#64748B] truncate">
                        {p.address}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[#475569] mt-0.5">
                        <span className="flex items-center gap-0.5 font-bold text-amber-600">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                          {ratingInfo.formattedRating}
                        </span>
                        {durationLabel && (
                          <span>• {durationLabel}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-[#1B4332] block">
                      {distance} km
                    </span>
                    <span className="text-[10px] text-[#7A6F5D]">
                      {p.price_info.is_free ? 'Grátis' : `R$ ${p.price_info.adult_price}`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
