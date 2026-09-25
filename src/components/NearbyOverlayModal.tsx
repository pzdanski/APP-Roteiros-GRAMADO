import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  Navigation, 
  Search, 
  Utensils, 
  Compass, 
  Tag, 
  Percent, 
  Star, 
  AlertCircle,
  Clock,
  Check
} from 'lucide-react';
import { Place, City, Offer } from '../types';
import { SEED_PLACES } from '../data/seedData';
import { SEED_OFFERS } from '../services/offers/OfferProvider';

interface NearbyOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlace: (place: Place) => void;
  referenceCity?: City;
}

export const DEV_LOCATION = {
  name: 'Centro de Gramado (Rua Coberta)',
  latitude: -29.3789,
  longitude: -50.8739,
  is_simulation: true
};

export const NearbyOverlayModal: React.FC<NearbyOverlayModalProps> = ({
  isOpen,
  onClose,
  onSelectPlace,
  referenceCity = 'Gramado'
}) => {
  const [filter, setFilter] = useState<'todos' | 'comer' | 'passeios' | 'gratis' | 'ofertas'>('todos');
  const [intentInput, setIntentInput] = useState('');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number; isSimulated: boolean }>({
    lat: DEV_LOCATION.latitude,
    lng: DEV_LOCATION.longitude,
    isSimulated: true
  });
  const [geoStatus, setGeoStatus] = useState<'simulated' | 'requesting' | 'granted' | 'denied'>('simulated');

  if (!isOpen) return null;

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
          lng: pos.coords.longitude,
          isSimulated: false
        });
        setGeoStatus('granted');
      },
      () => {
        // Fallback to simulated location safely
        setGeoStatus('simulated');
      },
      { timeout: 5000 }
    );
  };

  // Filter nearby places
  let nearbyPlaces = SEED_PLACES.filter(p => p.active);

  if (filter === 'comer') {
    nearbyPlaces = nearbyPlaces.filter(p => p.category === 'restaurante' || p.category === 'cafe' || p.category === 'chocolate');
  } else if (filter === 'passeios') {
    nearbyPlaces = nearbyPlaces.filter(p => p.category === 'parque' || p.category === 'museu' || p.category === 'mirante' || p.category === 'vinicola');
  } else if (filter === 'gratis') {
    nearbyPlaces = nearbyPlaces.filter(p => p.price_info.is_free);
  }

  // Text / Intent search
  if (intentInput.trim()) {
    const term = intentInput.toLowerCase();
    nearbyPlaces = nearbyPlaces.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term) ||
      p.description.toLowerCase().includes(term)
    );
  }

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
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#1B4332]">
                Perto de Mim
              </h3>
              <span className="text-[10px] text-[#64748B]">
                Recomendações por proximidade e momento
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

        {/* Location Notice */}
        <div className="px-4 py-2 bg-amber-50/70 border-b border-amber-200/60 flex items-center justify-between text-[11px] text-amber-900 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Navigation className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="truncate">
              {userCoords.isSimulated ? (
                <>Simulação: <strong>{DEV_LOCATION.name}</strong></>
              ) : (
                <>Sua localização via GPS</>
              )}
            </span>
          </div>

          {userCoords.isSimulated && (
            <button
              type="button"
              onClick={handleRequestGeo}
              className="text-[10px] font-bold text-[#1B4332] underline ml-2 whitespace-nowrap"
            >
              Usar GPS Real
            </button>
          )}
        </div>

        {/* Intent input */}
        <div className="p-3 border-b border-[#F1EBE0] bg-white shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#7A6F5D]" />
            <input
              type="text"
              value={intentInput}
              onChange={(e) => setIntentInput(e.target.value)}
              placeholder="Ex: Quero almoçar até R$ 50 ou café artesanal..."
              className="w-full pl-8 pr-3 py-2 bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl text-xs outline-none focus:border-[#1B4332] text-[#1E293B]"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 no-scrollbar text-xs font-semibold">
            {[
              { id: 'todos', label: 'Tudo' },
              { id: 'comer', label: '🍽️ Comer' },
              { id: 'passeios', label: '🎡 Passeios' },
              { id: 'gratis', label: '🌿 Grátis' },
              { id: 'ofertas', label: '🏷️ Ofertas Hoje' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id as any)}
                className={`px-3 py-1 rounded-xl whitespace-nowrap text-xs transition-colors border ${
                  filter === f.id
                    ? 'bg-[#1B4332] text-white border-[#1B4332] font-bold'
                    : 'bg-[#FAF9F6] text-[#64748B] border-[#E7DFCE] hover:bg-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Places / Offers List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {filter === 'ofertas' ? (
            <div className="space-y-2">
              {SEED_OFFERS.map(offer => (
                <div 
                  key={offer.id} 
                  className="bg-white border border-[#E7DFCE] p-3 rounded-2xl shadow-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                      {offer.discountPercent}% OFF • {offer.city}
                    </span>
                    <span className="text-[10px] text-[#7A6F5D]">
                      {offer.source}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-[#1E293B]">
                    {offer.title}
                  </h4>
                  <p className="text-[11px] text-[#64748B]">
                    {offer.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-[#F1EBE0]">
                    <div>
                      <span className="line-through text-[10px] text-slate-400 mr-1.5">
                        R$ {offer.originalPrice.toFixed(2)}
                      </span>
                      <strong className="text-sm text-[#1B4332] font-extrabold">
                        R$ {offer.offerPrice.toFixed(2)}
                      </strong>
                    </div>

                    <span className="text-[10px] text-emerald-800 font-semibold">
                      Disponível hoje
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {nearbyPlaces.slice(0, 10).map((place, idx) => (
                <div
                  key={place.id}
                  onClick={() => {
                    onSelectPlace(place);
                    onClose();
                  }}
                  className="bg-white hover:bg-[#FAF9F6] border border-[#E7DFCE] p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 shadow-xs hover:border-[#1B4332] active:scale-[0.99]"
                >
                  <img
                    src={place.media?.[0]?.url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80'}
                    alt={place.name}
                    className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100"
                    referrerPolicy="no-referrer"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#1B4332] bg-[#EBF3EE] px-1.5 py-0.5 rounded">
                        {place.city}
                      </span>
                      <span className="text-[11px] font-bold text-amber-600 flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        {place.rating.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ~{(0.4 + idx * 0.3).toFixed(1)} km
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-[#1E293B] truncate mt-0.5">
                      {place.name}
                    </h4>

                    <p className="text-[11px] text-[#64748B] truncate">
                      {place.price_info.is_free ? 'Grátis' : `R$ ${place.price_info.adult_price}`} • {place.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
