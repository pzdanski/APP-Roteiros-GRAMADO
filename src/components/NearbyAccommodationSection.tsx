import React from 'react';
import { 
  Building2, 
  MapPin, 
  Coffee, 
  Utensils, 
  Compass, 
  Trees, 
  Sparkles,
  Info,
  Clock
} from 'lucide-react';
import { Trip, TripPreferences, City } from '../types';

interface NearbyAccommodationSectionProps {
  trip?: Trip | null;
  preferences?: TripPreferences | null;
  onSelectPlaceName?: (placeName: string) => void;
}

interface NearbyItem {
  id: string;
  name: string;
  category: 'cafe' | 'restaurante' | 'passeio' | 'parque';
  label: string;
  timeMinutes: number;
  distanceKm: number;
  highlight: string;
  city: City;
}

export const NearbyAccommodationSection: React.FC<NearbyAccommodationSectionProps> = ({
  trip,
  preferences: directPrefs,
  onSelectPlaceName
}) => {
  const prefs = directPrefs || trip?.preferences;
  if (!prefs) return null;

  const hasAccommodation = 
    prefs.accommodation_status === 'booked' || 
    (!!prefs.hotel_name && prefs.accommodation_status !== 'not_booked' && prefs.accommodation_status !== 'undecided');

  // If no hotel confirmed yet, render subtle helper box
  if (!hasAccommodation) {
    return (
      <div className="bg-[#FAF9F6] border border-dashed border-[#D5C9B3] p-4 rounded-2xl text-center space-y-1.5 my-3">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#7A6F5D]">
          <Building2 className="w-4 h-4 text-[#7A6F5D]" />
          <span>Perto da sua Hospedagem</span>
        </div>
        <p className="text-[11px] text-[#64748B] max-w-xs mx-auto">
          Você ainda não informou onde vai ficar. Quando definir sua hospedagem, mostraremos cafés, restaurantes e passeios a poucos minutos a pé ou de carro!
        </p>
      </div>
    );
  }

  const hotelName = prefs.hotel_name || prefs.accommodation?.name || 'Sua Hospedagem';
  const hotelCity = prefs.hotel_city || prefs.accommodation?.city || 'Gramado';

  // Demo structured nearby items clearly marked for the Sprint
  const nearbyItems: NearbyItem[] = [
    {
      id: 'nb-1',
      name: 'Café & Chocolataria Artesanal',
      category: 'cafe',
      label: 'Café & Chocolate',
      timeMinutes: 6,
      distanceKm: 0.4,
      highlight: 'Ótimo para começar a manhã a pé',
      city: hotelCity
    },
    {
      id: 'nb-2',
      name: 'Cantina Típica Italiana / Fondue',
      category: 'restaurante',
      label: 'Restaurante',
      timeMinutes: 8,
      distanceKm: 0.7,
      highlight: 'Jantar sem preocupação com trânsito',
      city: hotelCity
    },
    {
      id: 'nb-3',
      name: 'Mirante & Praça Histórica',
      category: 'passeio',
      label: 'Passeio Rápido',
      timeMinutes: 10,
      distanceKm: 1.1,
      highlight: 'Ponto perfeito para fotos ao entardecer',
      city: hotelCity
    },
    {
      id: 'nb-4',
      name: 'Parque Natural das Araucárias',
      category: 'parque',
      label: 'Parque & Natureza',
      timeMinutes: 12,
      distanceKm: 1.8,
      highlight: 'Caminhada tranquila ao ar livre',
      city: hotelCity
    }
  ];

  const getCategoryIcon = (cat: NearbyItem['category']) => {
    switch (cat) {
      case 'cafe': return <Coffee className="w-3.5 h-3.5 text-amber-800" />;
      case 'restaurante': return <Utensils className="w-3.5 h-3.5 text-rose-700" />;
      case 'passeio': return <Compass className="w-3.5 h-3.5 text-emerald-700" />;
      case 'parque': return <Trees className="w-3.5 h-3.5 text-green-700" />;
    }
  };

  return (
    <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] shadow-xs space-y-3 my-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#1B4332]">Perto da sua Hospedagem</h4>
            <p className="text-[11px] text-[#7A6F5D] truncate max-w-[200px]">
              {hotelName} • {hotelCity}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" />
          Base Logística
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {nearbyItems.map((item) => (
          <div 
            key={item.id}
            onClick={() => onSelectPlaceName?.(item.name)}
            className="p-2.5 rounded-xl border border-[#F1EBE0] bg-[#FAF9F6] hover:bg-[#F3EFE6] transition-colors cursor-pointer text-left flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#7A6F5D] uppercase tracking-wider mb-1">
                {getCategoryIcon(item.category)}
                <span>{item.label}</span>
              </div>
              <p className="text-xs font-bold text-[#1E293B] line-clamp-1 leading-snug">
                {item.name}
              </p>
              <p className="text-[10px] text-[#64748B] line-clamp-1 mt-0.5">
                {item.highlight}
              </p>
            </div>

            <div className="mt-2 pt-1 border-t border-[#EAE2D2] flex items-center justify-between text-[10px] font-semibold text-[#1B4332]">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#7A6F5D]" />
                {item.timeMinutes} min
              </span>
              <span className="text-[#7A6F5D] font-normal">
                {item.distanceKm} km
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-[#7A6F5D] bg-[#F7F4EC] p-2 rounded-xl">
        <Info className="w-3 h-3 shrink-0 text-[#7A6F5D]" />
        <span>Distâncias estimadas a partir de {hotelName}. Dados demo de referência.</span>
      </div>
    </div>
  );
};
