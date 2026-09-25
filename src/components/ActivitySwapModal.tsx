import React, { useState } from 'react';
import { X, RefreshCw, Star, MapPin, Check, Sparkles, AlertCircle } from 'lucide-react';
import { TripActivity, Place } from '../types';
import { SEED_PLACES } from '../data/seedData';

interface ActivitySwapModalProps {
  activity: TripActivity | null;
  onClose: () => void;
  onSelectNewPlace: (newPlace: Place) => void;
  remainingChangesToday?: number;
}

type SwapCategory = 'todos' | 'natureza' | 'diversao' | 'gastronomia' | 'gratuito' | 'surpreenda';

export const ActivitySwapModal: React.FC<ActivitySwapModalProps> = ({
  activity,
  onClose,
  onSelectNewPlace,
  remainingChangesToday = 3
}) => {
  const [selectedCategory, setSelectedCategory] = useState<SwapCategory>('todos');

  if (!activity) return null;

  const isMeal = activity.place.category === 'restaurante' || activity.place.category === 'cafe';

  // Filter seed alternatives based on category filter
  let alternatives = SEED_PLACES.filter(p => p.id !== activity.place.id);

  if (selectedCategory === 'natureza') {
    alternatives = alternatives.filter(p => p.category === 'mirante' || p.category === 'parque');
  } else if (selectedCategory === 'diversao') {
    alternatives = alternatives.filter(p => p.category === 'parque' || p.category === 'museu' || p.category === 'show');
  } else if (selectedCategory === 'gastronomia') {
    alternatives = alternatives.filter(p => p.category === 'restaurante' || p.category === 'cafe' || p.category === 'chocolate' || p.category === 'vinicola');
  } else if (selectedCategory === 'gratuito') {
    alternatives = alternatives.filter(p => p.price_info.is_free || p.price_level === 1);
  } else if (selectedCategory === 'surpreenda') {
    // Curated high rating or partner gems
    alternatives = alternatives.filter(p => p.rating >= 4.7 || p.is_divulga_lugares_partner);
  } else {
    // 'todos': prioritize same city and compatible type
    alternatives = alternatives.filter(p => 
      p.city === activity.place.city || (isMeal ? (p.category === 'restaurante' || p.category === 'cafe') : true)
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div 
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[88vh] flex flex-col animate-in fade-in slide-in-from-bottom duration-200"
        id="modal-swap-activity"
      >
        {/* Header with Counter */}
        <div className="px-5 py-3.5 bg-[#FAF9F6] border-b border-[#E7DFCE] flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase text-[#7A6F5D] tracking-wider block">
                Alteração Inteligente
              </span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Alterações restantes hoje: {remainingChangesToday}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-[#1B4332]">
              Trocar Atividade das {activity.time}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categories Selector Ribbon (Requirement 7) */}
        <div className="px-4 pt-3 pb-1 border-b border-[#F1EBE0] bg-white shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar text-xs font-semibold">
            {[
              { id: 'todos', label: 'Compatíveis' },
              { id: 'natureza', label: '🌲 Natureza' },
              { id: 'diversao', label: '🎡 Diversão' },
              { id: 'gastronomia', label: '🍽️ Gastronomia' },
              { id: 'gratuito', label: '🏷️ Gratuito' },
              { id: 'surpreenda', label: '✨ Surpreenda-me' }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as SwapCategory)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap text-xs transition-colors border ${
                  selectedCategory === cat.id
                    ? 'bg-[#1B4332] text-white border-[#1B4332] font-bold'
                    : 'bg-[#FAF9F6] text-[#64748B] border-[#E7DFCE] hover:bg-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-[#E7DFCE] text-[11px] text-[#64748B]">
            Substituindo <strong className="text-[#1E293B]">{activity.place.name}</strong>. Os deslocamentos antes e depois permanecem otimizados para seu conforto logístico.
          </div>

          <div className="space-y-2">
            {alternatives.slice(0, 8).map((alt) => (
              <div
                key={alt.id}
                onClick={() => {
                  onSelectNewPlace(alt);
                  onClose();
                }}
                className="bg-white hover:bg-[#FAF9F6] border border-[#E7DFCE] p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 shadow-xs hover:border-[#1B4332] active:scale-[0.99]"
              >
                <img
                  src={alt.media?.[0]?.url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80'}
                  alt={alt.name}
                  className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100"
                  referrerPolicy="no-referrer"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#1B4332] bg-[#EBF3EE] px-1.5 py-0.5 rounded">
                      {alt.city}
                    </span>
                    <span className="text-[11px] font-bold text-amber-600 flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                      {alt.rating.toFixed(1)}
                    </span>
                    {alt.is_divulga_lugares_partner && (
                      <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded">
                        Dica DUO21
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-xs text-[#1E293B] truncate mt-0.5">
                    {alt.name}
                  </h4>

                  <p className="text-[11px] text-[#64748B]">
                    {alt.price_info.is_free ? 'Grátis' : `R$ ${alt.price_info.adult_price}`} • {alt.average_duration_minutes} min
                  </p>
                </div>

                <div className="w-8 h-8 rounded-full bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
