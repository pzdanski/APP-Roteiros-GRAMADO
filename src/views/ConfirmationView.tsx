import React, { useState } from 'react';
import { 
  Calendar, 
  Users, 
  Building2, 
  Car, 
  Wallet, 
  Compass, 
  Heart, 
  Edit3, 
  Check, 
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { TripPreferences, TravelPace, TransportType } from '../types';

interface ConfirmationViewProps {
  preferences: TripPreferences;
  onConfirm: (updated: TripPreferences) => void;
  onBack: (currentPrefs?: TripPreferences) => void;
}

export const ConfirmationView: React.FC<ConfirmationViewProps> = ({
  preferences: initialPrefs,
  onConfirm,
  onBack
}) => {
  const [prefs, setPrefs] = useState<TripPreferences>(initialPrefs);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Synchronize when initialPrefs change
  React.useEffect(() => {
    setPrefs(initialPrefs);
  }, [initialPrefs]);

  const calculateDays = () => {
    try {
      const s = new Date(prefs.start_date);
      const e = new Date(prefs.end_date);
      const diff = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return isNaN(diff) ? 4 : diff;
    } catch {
      return 4;
    }
  };

  const daysTotal = calculateDays();

  const handlePaceChange = (pace: TravelPace) => {
    setPrefs(p => ({ ...p, pace }));
    setEditingKey(null);
  };

  const handleTransportChange = (transport: TransportType) => {
    setPrefs(p => ({ ...p, transport }));
    setEditingKey(null);
  };

  return (
    <div className="w-full max-w-md mx-auto py-2 pb-16">
      <button
        type="button"
        id="btn-back-confirm"
        onClick={() => onBack(prefs)}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#7A6F5D] hover:text-[#1B4332] min-h-[44px] px-2 -ml-2 rounded-xl transition-colors hover:bg-black/5"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para o briefing</span>
      </button>

      <div className="text-center space-y-1.5 mb-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B4332] bg-[#EBF3EE] px-2.5 py-0.5 rounded-full inline-block">
          Passo 2 de 3
        </span>
        <h2 className="text-2xl font-extrabold text-[#1B4332]">
          Entendi sua viagem assim!
        </h2>
        <p className="text-xs text-[#475569]">
          Revise os detalhes abaixo. Você pode editar qualquer informação com um toque.
        </p>
      </div>

      {/* Editable Cards Grid */}
      <div className="space-y-3">
        {/* 1. Datas */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7DFCE] shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[#7A6F5D] tracking-wider block">
                  Datas ({daysTotal} {daysTotal === 1 ? 'dia' : 'dias'})
                </span>
                <span className="text-xs font-bold text-[#1E293B]">
                  {prefs.start_date} até {prefs.end_date}
                </span>
              </div>
            </div>
            <button
              id="btn-edit-dates"
              onClick={() => setEditingKey(editingKey === 'dates' ? null : 'dates')}
              className="text-xs font-bold text-[#1B4332] flex items-center gap-1 hover:underline"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          </div>

          {editingKey === 'dates' && (
            <div className="mt-3 pt-3 border-t border-[#F1EBE0] grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[#64748B] block mb-1">Início</label>
                <input
                  type="date"
                  value={prefs.start_date}
                  onChange={(e) => setPrefs(p => ({ ...p, start_date: e.target.value }))}
                  className="w-full p-2 rounded-lg border border-[#E7DFCE] text-xs outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#64748B] block mb-1">Término</label>
                <input
                  type="date"
                  value={prefs.end_date}
                  onChange={(e) => setPrefs(p => ({ ...p, end_date: e.target.value }))}
                  className="w-full p-2 rounded-lg border border-[#E7DFCE] text-xs outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. Pessoas */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7DFCE] shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[#7A6F5D] tracking-wider block">
                  Viajantes
                </span>
                <span className="text-xs font-bold text-[#1E293B]">
                  {prefs.adults_count} {prefs.adults_count === 1 ? 'adulto' : 'adultos'}
                  {prefs.children_count > 0 ? `, ${prefs.children_count} ${prefs.children_count === 1 ? 'criança' : 'crianças'}` : ' (sem crianças)'}
                </span>
              </div>
            </div>
            <button
              id="btn-edit-people"
              onClick={() => setEditingKey(editingKey === 'people' ? null : 'people')}
              className="text-xs font-bold text-[#1B4332] flex items-center gap-1 hover:underline"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          </div>

          {editingKey === 'people' && (
            <div className="mt-3 pt-3 border-t border-[#F1EBE0] flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span>Adultos:</span>
                <button
                  type="button"
                  onClick={() => setPrefs(p => ({ ...p, adults_count: Math.max(1, p.adults_count - 1) }))}
                  className="w-6 h-6 rounded bg-slate-100 font-bold"
                >-</button>
                <span className="font-bold">{prefs.adults_count}</span>
                <button
                  type="button"
                  onClick={() => setPrefs(p => ({ ...p, adults_count: p.adults_count + 1 }))}
                  className="w-6 h-6 rounded bg-slate-100 font-bold"
                >+</button>
              </div>

              <div className="flex items-center gap-2">
                <span>Crianças:</span>
                <button
                  type="button"
                  onClick={() => setPrefs(p => ({ ...p, children_count: Math.max(0, p.children_count - 1) }))}
                  className="w-6 h-6 rounded bg-slate-100 font-bold"
                >-</button>
                <span className="font-bold">{prefs.children_count}</span>
                <button
                  type="button"
                  onClick={() => setPrefs(p => ({ ...p, children_count: p.children_count + 1 }))}
                  className="w-6 h-6 rounded bg-slate-100 font-bold"
                >+</button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Hospedagem */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7DFCE] shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[#7A6F5D] tracking-wider block">
                  Hospedagem
                </span>
                <span className="text-xs font-bold text-[#1E293B]">
                  {prefs.accommodation_status === 'booked' && prefs.hotel_name
                    ? `${prefs.hotel_name} — ${prefs.hotel_city || 'Gramado'}`
                    : prefs.accommodation_status === 'undecided'
                    ? 'Ainda não definida'
                    : prefs.accommodation_status === 'not_booked'
                    ? 'Ainda não reservada'
                    : (prefs.hotel_name ? `${prefs.hotel_name} — ${prefs.hotel_city || 'Gramado'}` : 'Ainda não reservada')}
                </span>
                {prefs.accommodation_status !== 'booked' && (
                  <span className="text-[10px] text-[#64748B] block mt-0.5">
                    Base provisória: Centro de {prefs.hotel_city || 'Gramado'}
                  </span>
                )}
              </div>
            </div>
            <button
              id="btn-edit-hotel"
              onClick={() => setEditingKey(editingKey === 'hotel' ? null : 'hotel')}
              className="text-xs font-bold text-[#1B4332] flex items-center gap-1 hover:underline min-h-[44px] px-2"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          </div>

          {editingKey === 'hotel' && (
            <div className="mt-3 pt-3 border-t border-[#F1EBE0] space-y-2.5">
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'booked', label: 'Já reservei' },
                  { id: 'not_booked', label: 'Ainda não reservei' },
                  { id: 'undecided', label: 'Ainda não sei' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setPrefs(p => ({
                        ...p,
                        accommodation_status: opt.id as any,
                        hotel_name: opt.id === 'booked' ? (p.hotel_name || '') : undefined
                      }));
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors ${
                      (prefs.accommodation_status || (prefs.hotel_name ? 'booked' : 'not_booked')) === opt.id
                        ? 'bg-[#1B4332] text-white border-[#1B4332]'
                        : 'bg-[#FAF9F6] text-[#475569] border-[#E7DFCE]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {prefs.accommodation_status === 'booked' && (
                <input
                  type="text"
                  value={prefs.hotel_name || ''}
                  onChange={(e) => setPrefs(p => ({ ...p, hotel_name: e.target.value }))}
                  placeholder="Nome do hotel ou pousada"
                  className="w-full p-2 rounded-lg border border-[#E7DFCE] text-xs outline-none bg-white"
                />
              )}

              <div>
                <span className="text-[10px] text-[#64748B] block mb-1">
                  {prefs.accommodation_status === 'booked' ? 'Cidade do hotel:' : 'Cidade base de referência:'}
                </span>
                <div className="flex gap-2 text-xs">
                  {(['Gramado', 'Canela', 'Nova Petrópolis'] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPrefs(p => ({ ...p, hotel_city: c }))}
                      className={`px-3 py-1 rounded-lg border text-xs ${
                        prefs.hotel_city === c ? 'bg-[#1B4332] text-white' : 'bg-slate-50'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Transporte */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7DFCE] shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center">
                <Car className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[#7A6F5D] tracking-wider block">
                  Locomoção
                </span>
                <span className="text-xs font-bold text-[#1E293B]">
                  {prefs.transport === 'carro_alugado' ? 'Carro Alugado' : prefs.transport === 'carro_proprio' ? 'Carro Próprio' : prefs.transport === 'transfer_uber' ? 'Uber / Transfer' : 'A pé / Sem Carro'}
                </span>
              </div>
            </div>
            <button
              id="btn-edit-transport"
              onClick={() => setEditingKey(editingKey === 'transport' ? null : 'transport')}
              className="text-xs font-bold text-[#1B4332] flex items-center gap-1 hover:underline"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          </div>

          {editingKey === 'transport' && (
            <div className="mt-3 pt-3 border-t border-[#F1EBE0] grid grid-cols-2 gap-1.5 text-xs">
              <button 
                type="button" 
                onClick={() => handleTransportChange('carro_alugado')}
                className={`p-2 rounded-lg border ${prefs.transport === 'carro_alugado' ? 'bg-[#1B4332] text-white' : 'bg-slate-50'}`}
              >Carro Alugado</button>
              <button 
                type="button" 
                onClick={() => handleTransportChange('carro_proprio')}
                className={`p-2 rounded-lg border ${prefs.transport === 'carro_proprio' ? 'bg-[#1B4332] text-white' : 'bg-slate-50'}`}
              >Carro Próprio</button>
              <button 
                type="button" 
                onClick={() => handleTransportChange('transfer_uber')}
                className={`p-2 rounded-lg border ${prefs.transport === 'transfer_uber' ? 'bg-[#1B4332] text-white' : 'bg-slate-50'}`}
              >Uber/Transfer</button>
              <button 
                type="button" 
                onClick={() => handleTransportChange('sem_carro')}
                className={`p-2 rounded-lg border ${prefs.transport === 'sem_carro' ? 'bg-[#1B4332] text-white' : 'bg-slate-50'}`}
              >Sem Carro</button>
            </div>
          )}
        </div>

        {/* 5. Orçamento */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7DFCE] shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[#7A6F5D] tracking-wider block">
                  Orçamento Total Estimado
                </span>
                <span className="text-xs font-bold text-[#1E293B]">
                  R$ {prefs.budget_total ? prefs.budget_total.toLocaleString('pt-BR') : '3.000'}
                </span>
              </div>
            </div>
            <button
              id="btn-edit-budget"
              onClick={() => setEditingKey(editingKey === 'budget' ? null : 'budget')}
              className="text-xs font-bold text-[#1B4332] flex items-center gap-1 hover:underline"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          </div>

          {editingKey === 'budget' && (
            <div className="mt-3 pt-3 border-t border-[#F1EBE0]">
              <input
                type="number"
                value={prefs.budget_total || 3000}
                onChange={(e) => setPrefs(p => ({ ...p, budget_total: parseInt(e.target.value, 10) || 3000 }))}
                className="w-full p-2 rounded-lg border border-[#E7DFCE] text-xs outline-none"
              />
            </div>
          )}
        </div>

        {/* 6. Ritmo */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7DFCE] shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[#7A6F5D] tracking-wider block">
                  Ritmo da Viagem
                </span>
                <span className="text-xs font-bold text-[#1E293B] capitalize">
                  {prefs.pace === 'tranquilo' ? 'Tranquilo (menos atividades)' : prefs.pace === 'aproveitar_bastante' ? 'Aproveitar Bastante' : 'Equilibrado'}
                </span>
              </div>
            </div>
            <button
              id="btn-edit-pace"
              onClick={() => setEditingKey(editingKey === 'pace' ? null : 'pace')}
              className="text-xs font-bold text-[#1B4332] flex items-center gap-1 hover:underline"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          </div>

          {editingKey === 'pace' && (
            <div className="mt-3 pt-3 border-t border-[#F1EBE0] grid grid-cols-3 gap-1.5 text-xs">
              <button 
                type="button" 
                onClick={() => handlePaceChange('tranquilo')}
                className={`p-2 rounded-lg border ${prefs.pace === 'tranquilo' ? 'bg-[#1B4332] text-white' : 'bg-slate-50'}`}
              >Tranquilo</button>
              <button 
                type="button" 
                onClick={() => handlePaceChange('equilibrado')}
                className={`p-2 rounded-lg border ${prefs.pace === 'equilibrado' ? 'bg-[#1B4332] text-white' : 'bg-slate-50'}`}
              >Equilibrado</button>
              <button 
                type="button" 
                onClick={() => handlePaceChange('aproveitar_bastante')}
                className={`p-2 rounded-lg border ${prefs.pace === 'aproveitar_bastante' ? 'bg-[#1B4332] text-white' : 'bg-slate-50'}`}
              >Aproveitar</button>
            </div>
          )}
        </div>

        {/* 7. Interesses */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7DFCE] shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" />
              <span className="text-[10px] font-bold uppercase text-[#7A6F5D] tracking-wider">
                Interesses Principais
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {prefs.interests.map(int => (
              <span key={int} className="text-[11px] font-semibold text-[#1B4332] bg-[#EBF3EE] px-2.5 py-0.5 rounded-full">
                {int}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Confirm Button */}
      <div className="mt-6">
        <button
          id="btn-confirm-trip"
          onClick={() => onConfirm(prefs)}
          className="w-full py-4 px-6 bg-[#1B4332] hover:bg-[#2D6A4F] active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <span>Está certo, pode montar!</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
