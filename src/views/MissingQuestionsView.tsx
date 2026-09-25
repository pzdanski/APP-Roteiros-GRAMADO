import React, { useState } from 'react';
import { TripPreferences, AccommodationStatus, City, AccommodationType } from '../types';
import { ArrowRight, ArrowLeft, Building2, Check, Sparkles, HelpCircle } from 'lucide-react';
import { safeText } from '../utils/safeDisplay';

interface MissingQuestionsViewProps {
  initialPreferences: Partial<TripPreferences>;
  missingFields: string[];
  onBack: () => void;
  onComplete: (updated: Partial<TripPreferences>) => void;
}

export const MissingQuestionsView: React.FC<MissingQuestionsViewProps> = ({
  initialPreferences,
  missingFields,
  onBack,
  onComplete
}) => {
  const [name, setName] = useState(safeText(initialPreferences.name, ''));
  const [startDate, setStartDate] = useState(safeText(initialPreferences.start_date, ''));
  const [endDate, setEndDate] = useState(safeText(initialPreferences.end_date, ''));

  // Accommodation initial state
  const initialAccStatus: AccommodationStatus = initialPreferences.accommodation_status || 
    (initialPreferences.hotel_name ? 'booked' : 'not_booked');
  
  const [accStatus, setAccStatus] = useState<AccommodationStatus>(initialAccStatus);
  const [hotelName, setHotelName] = useState(safeText(initialPreferences.hotel_name || initialPreferences.accommodation?.name, ''));
  const [hotelCity, setHotelCity] = useState<City>(initialPreferences.hotel_city || initialPreferences.accommodation?.city || 'Gramado');
  const [hotelAddress, setHotelAddress] = useState(safeText(initialPreferences.hotel_address || initialPreferences.accommodation?.address, ''));

  // If not booked helper flow
  const [wantsHelp, setWantsHelp] = useState<boolean>(initialPreferences.accommodation?.wants_help_finding || false);
  const [accType, setAccType] = useState<AccommodationType>(initialPreferences.accommodation?.type_preference || 'tanto_faz');
  const [priceRange, setPriceRange] = useState(safeText(initialPreferences.accommodation?.price_range_text, ''));
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(initialPreferences.accommodation?.amenities_preference || []);

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updated: Partial<TripPreferences> = {
      ...initialPreferences,
      name: name.trim() || 'Viajante',
      start_date: startDate || initialPreferences.start_date,
      end_date: endDate || initialPreferences.end_date,
      accommodation_status: accStatus,
      hotel_city: hotelCity
    };

    if (accStatus === 'booked') {
      updated.hotel_name = hotelName.trim() || 'Hospedagem Confirmada';
      updated.hotel_address = hotelAddress.trim() || undefined;
      updated.accommodation = {
        name: hotelName.trim() || 'Hospedagem Confirmada',
        city: hotelCity,
        address: hotelAddress.trim() || undefined,
        wants_help_finding: false
      };
    } else if (accStatus === 'not_booked') {
      updated.hotel_name = undefined;
      updated.hotel_address = undefined;
      updated.accommodation = {
        city: hotelCity,
        wants_help_finding: wantsHelp,
        type_preference: wantsHelp ? accType : undefined,
        price_range_text: wantsHelp ? priceRange : undefined,
        amenities_preference: wantsHelp ? selectedAmenities : undefined
      };
    } else {
      // undecided
      updated.hotel_name = undefined;
      updated.hotel_address = undefined;
      updated.accommodation = {
        city: hotelCity,
        wants_help_finding: false
      };
    }

    onComplete(updated);
  };

  const needsName = missingFields.includes('name') || !name;
  const needsDates = missingFields.includes('dates_confirmation') || !startDate;

  return (
    <div className="w-full max-w-md mx-auto py-2">
      <button
        type="button"
        id="btn-back-missing-questions"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#7A6F5D] hover:text-[#1B4332] min-h-[44px] px-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para o briefing</span>
      </button>

      <div className="text-center space-y-1.5 mb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B4332] bg-[#EBF3EE] px-2.5 py-0.5 rounded-full inline-block">
          Personalização do Roteiro
        </span>
        <h2 className="text-xl font-extrabold text-[#1B4332]">
          Confirmando detalhes essenciais
        </h2>
        <p className="text-xs text-[#475569]">
          Configuramos seus dias para que cada trajeto seja rápido e eficiente.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-3xl border border-[#E7DFCE] shadow-xs space-y-4">
        {needsName && (
          <div>
            <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-1">
              Como podemos te chamar?
            </label>
            <input
              id="input-missing-name"
              type="text"
              required
              placeholder="Seu primeiro nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#E7DFCE] focus:border-[#1B4332] text-sm outline-none"
            />
          </div>
        )}

        {needsDates && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider">
              Confirme as datas da viagem:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-[#64748B] block mb-1">Data de Chegada</span>
                <input
                  id="input-missing-start-date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#E7DFCE] text-xs outline-none"
                />
              </div>

              <div>
                <span className="text-[10px] text-[#64748B] block mb-1">Data de Partida</span>
                <input
                  id="input-missing-end-date"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#E7DFCE] text-xs outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Hospedagem — Exibir confirmação se já informado, ou perguntar apenas se necessário */}
        {initialPreferences.hotel_name ? (
          <div className="pt-2 border-t border-[#F1EBE0]">
            <div className="bg-[#EBF3EE] p-3 rounded-xl border border-[#D9EADB] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1B4332]" />
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#1B4332] block">Hospedagem informada no briefing</span>
                  <span className="text-xs font-bold text-[#1E293B]">{initialPreferences.hotel_name} • {hotelCity}</span>
                </div>
              </div>
              <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">OK</span>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-[#F1EBE0]">
            <label className="block text-xs font-bold text-[#1B4332] uppercase tracking-wider mb-2">
              Você já tem hospedagem na Serra?
            </label>
          
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <button
              type="button"
              id="opt-hotel-booked"
              onClick={() => setAccStatus('booked')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                accStatus === 'booked'
                  ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-xs'
                  : 'bg-[#FAF9F6] text-[#1E293B] border-[#E7DFCE] hover:border-[#1B4332]'
              }`}
            >
              Sim, já reservei
            </button>

            <button
              type="button"
              id="opt-hotel-not-booked"
              onClick={() => setAccStatus('not_booked')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                accStatus === 'not_booked'
                  ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-xs'
                  : 'bg-[#FAF9F6] text-[#1E293B] border-[#E7DFCE] hover:border-[#1B4332]'
              }`}
            >
              Ainda não reservei
            </button>

            <button
              type="button"
              id="opt-hotel-undecided"
              onClick={() => setAccStatus('undecided')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                accStatus === 'undecided'
                  ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-xs'
                  : 'bg-[#FAF9F6] text-[#1E293B] border-[#E7DFCE] hover:border-[#1B4332]'
              }`}
            >
              Ainda não sei
            </button>
          </div>

          {/* Estado: BOOKED */}
          {accStatus === 'booked' && (
            <div className="bg-[#FAF9F6] p-3.5 rounded-2xl border border-[#E7DFCE] space-y-2.5 text-left">
              <div>
                <label className="text-[11px] font-bold text-[#1B4332] block mb-1">
                  Nome do hotel, pousada ou condomínio:
                </label>
                <input
                  id="input-hotel-name-booked"
                  type="text"
                  placeholder="Ex: Hotel Casa da Montanha ou Airbnb perto da Borges"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#E7DFCE] text-xs bg-white outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#1B4332] block mb-1">
                  Em qual cidade fica?
                </label>
                <div className="flex gap-2">
                  {(['Gramado', 'Canela', 'Nova Petrópolis'] as const).map(city => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setHotelCity(city)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                        hotelCity === city 
                          ? 'bg-[#1B4332] text-white border-[#1B4332]' 
                          : 'bg-white text-[#475569] border-[#E7DFCE]'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#64748B] block mb-0.5">
                  Endereço ou ponto de referência (opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Av. Borges de Medeiros, perto da Praça"
                  value={hotelAddress}
                  onChange={(e) => setHotelAddress(e.target.value)}
                  className="w-full p-2 rounded-lg border border-[#E7DFCE] text-xs bg-white outline-none"
                />
              </div>
            </div>
          )}

          {/* Estado: NOT BOOKED */}
          {accStatus === 'not_booked' && (
            <div className="bg-[#F6F8F6] p-3.5 rounded-2xl border border-[#D5E5D8] space-y-3 text-left">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />
                <div className="text-xs text-[#2D4A3E]">
                  <p className="font-bold">Hospedagem não bloqueia seu roteiro!</p>
                  <p className="text-[11px] text-[#4F6D60] mt-0.5">
                    Usaremos o centro de Gramado/Canela como base provisória para estimar deslocamentos.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#D5E5D8]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1B4332]">
                    Quer ajuda para encontrar opções?
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setWantsHelp(true)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        wantsHelp ? 'bg-[#1B4332] text-white' : 'bg-white text-[#475569] border border-[#D5E5D8]'
                      }`}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setWantsHelp(false)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        !wantsHelp ? 'bg-[#1B4332] text-white' : 'bg-white text-[#475569] border border-[#D5E5D8]'
                      }`}
                    >
                      Não agora
                    </button>
                  </div>
                </div>

                {wantsHelp && (
                  <div className="mt-3 space-y-2.5 pt-2 border-t border-[#E1EDE4]">
                    <div>
                      <label className="text-[11px] font-bold text-[#1B4332] block mb-1">
                        Tipo de acomodação preferido:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: 'hotel', label: 'Hotel' },
                          { id: 'pousada', label: 'Pousada' },
                          { id: 'apartamento', label: 'Apartamento' },
                          { id: 'cabana', label: 'Cabana' },
                          { id: 'tanto_faz', label: 'Tanto faz' }
                        ].map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setAccType(t.id as AccommodationType)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                              accType === t.id ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white border-[#D5E5D8] text-[#475569]'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#1B4332] block mb-1">
                        Faixa de diária estimada (opcional):
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: até R$ 500 por noite"
                        value={priceRange}
                        onChange={(e) => setPriceRange(e.target.value)}
                        className="w-full p-2 rounded-lg border border-[#D5E5D8] bg-white text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#1B4332] block mb-1">
                        Preferências rápidas:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {['Café da manhã', 'Estacionamento', 'Piscina', 'Centro', 'Natureza'].map(amenity => {
                          const isSelected = selectedAmenities.includes(amenity);
                          return (
                            <button
                              key={amenity}
                              type="button"
                              onClick={() => toggleAmenity(amenity)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                isSelected ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-white text-slate-700 border-slate-200'
                              }`}
                            >
                              {isSelected ? `✓ ${amenity}` : `+ ${amenity}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Estado: UNDECIDED */}
          {accStatus === 'undecided' && (
            <div className="bg-[#FAF9F6] p-3.5 rounded-2xl border border-[#E7DFCE] text-left space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#1B4332]">
                <HelpCircle className="w-4 h-4 text-[#7A6F5D]" />
                <span>Sem problema!</span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Usaremos uma referência regional provisória no centro de Gramado. Quando você definir onde vai ficar, ajustamos os deslocamentos para você com um toque.
              </p>
            </div>
          )}
        </div>
        )}

        <button
          id="btn-complete-missing-questions"
          type="submit"
          className="w-full mt-2 py-3.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-extrabold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 min-h-[44px]"
        >
          <span>Avançar para confirmação</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
