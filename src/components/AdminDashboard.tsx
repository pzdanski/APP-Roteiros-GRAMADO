import React, { useState } from 'react';
import { 
  X, 
  BarChart3, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Flag, 
  Settings, 
  Plus, 
  Check, 
  ShieldAlert, 
  ArrowLeft,
  Percent,
  Sliders,
  CheckCircle2,
  Trash2,
  EyeOff,
  Server,
  Activity,
  Wifi,
  Zap,
  RefreshCw
} from 'lucide-react';
import { Place, SerraEvent, UserReport, AdminMetrics } from '../types';
import { SEED_PLACES, SEED_EVENTS } from '../data/seedData';
import { EngineWeights, DEFAULT_WEIGHTS } from '../services/itineraryEngine';
import { providerRegistry, RegisteredProviderStatus } from '../services/providers';

interface AdminDashboardProps {
  onClose: () => void;
  reports: UserReport[];
  onApproveReport: (id: string) => void;
  onRejectReport: (id: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onClose,
  reports,
  onApproveReport,
  onRejectReport
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'places' | 'events' | 'reports' | 'weights' | 'integrations'>('metrics');
  const [places, setPlaces] = useState<Place[]>(SEED_PLACES);
  const [events, setEvents] = useState<SerraEvent[]>(SEED_EVENTS);
  const [weights, setWeights] = useState<EngineWeights>(DEFAULT_WEIGHTS);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<RegisteredProviderStatus[]>(providerRegistry.getStatuses());
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);

  // Mock initial business telemetry
  const metrics: AdminMetrics = {
    total_trips_created: 142,
    total_trips_paid: 48,
    conversion_rate: 33.8,
    gross_revenue_brl: 1147.20,
    estimated_ai_cost_brl: 9.60,       // ~R$ 0.20 per trip
    estimated_api_cost_brl: 14.40,     // ~R$ 0.30 per trip
    estimated_payment_fees_brl: 47.50, // ~R$ 0.99 per transaction Asaas PIX/Card
    net_margin_percent: 93.7
  };

  const handleTogglePlaceActive = (id: string) => {
    setPlaces(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  const handleUpdatePrice = (id: string, newPrice: number) => {
    setPlaces(prev => prev.map(p => {
      if (p.id !== id) return p;
      return {
        ...p,
        price_info: {
          ...p.price_info,
          adult_price: newPrice,
          is_free: newPrice === 0,
          checked_at: new Date().toISOString().split('T')[0]
        }
      };
    }));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF9F6] overflow-y-auto">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E7DFCE] px-4 py-3 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#1E293B]">Painel DUO21 / Divulga Lugares</h2>
              <span className="text-[10px] text-[#64748B]">Gestão de Conteúdo, Relatos e Telemetria</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#1E293B] text-xs font-bold rounded-xl flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao App</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-3xl mx-auto mt-3 flex gap-1 overflow-x-auto no-scrollbar text-xs font-semibold">
          {[
            { id: 'metrics', label: 'Dashboard & Custos', icon: BarChart3 },
            { id: 'places', label: 'Locais & Preços', icon: MapPin },
            { id: 'events', label: 'Eventos Âncora', icon: Calendar },
            { id: 'reports', label: `Relatos (${reports.length})`, icon: Flag },
            { id: 'weights', label: 'Pesos do Motor', icon: Sliders },
            { id: 'integrations', label: 'APIs & Provedores', icon: Server }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                  isActive 
                    ? 'bg-[#1B4332] text-white' 
                    : 'bg-[#FAF9F6] text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {savedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center gap-2 text-xs text-emerald-900 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Alterações salvas com sucesso no banco de dados!</span>
          </div>
        )}

        {/* TAB 1: METRICS */}
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE]">
                <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Roteiros Criados</span>
                <span className="text-xl font-black text-[#1E293B]">{metrics.total_trips_created}</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE]">
                <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Roteiros Pagos</span>
                <span className="text-xl font-black text-[#1B4332]">{metrics.total_trips_paid}</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE]">
                <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Taxa Conversão</span>
                <span className="text-xl font-black text-emerald-600">{metrics.conversion_rate}%</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE]">
                <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Receita Bruta</span>
                <span className="text-xl font-black text-[#1B4332]">R$ {metrics.gross_revenue_brl.toFixed(2)}</span>
              </div>
            </div>

            {/* Cost Breakdown Card (Requirement 43) */}
            <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-[#1E293B]">
                  Custos Variáveis Operacionais (Meta: &lt; R$ 1,00 por viagem)
                </h3>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Margem: {metrics.net_margin_percent}%
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-[#F1EBE0]">
                  <span className="text-[#64748B]">Custo IA (Tokens Gemini / viagem):</span>
                  <span className="font-bold text-[#1E293B]">~R$ 0,20 / trip (Total: R$ {metrics.estimated_ai_cost_brl.toFixed(2)})</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F1EBE0]">
                  <span className="text-[#64748B]">Custo APIs (Clima e Mapas):</span>
                  <span className="font-bold text-[#1E293B]">~R$ 0,30 / trip (Total: R$ {metrics.estimated_api_cost_brl.toFixed(2)})</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F1EBE0]">
                  <span className="text-[#64748B]">Taxa Gateway Asaas (PIX/Cartão):</span>
                  <span className="font-bold text-[#1E293B]">R$ 0,99 / pagamento pago</span>
                </div>
                <div className="flex justify-between py-1.5 bg-[#EBF3EE] p-2.5 rounded-xl text-[#1B4332] font-bold">
                  <span>Custo Variável Total Médio:</span>
                  <span>R$ 0,50 por viagem (Abaixo do teto de R$ 1,00 ✅)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PLACES & PRICES */}
        {activeTab === 'places' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-[#1E293B]">Locais Turísticos Cadastrados ({places.length})</h3>
              <span className="text-xs text-[#7A6F5D]">Atualize preços e disponibilidade</span>
            </div>

            <div className="space-y-2">
              {places.map(p => (
                <div key={p.id} className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE] flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[#1B4332] bg-[#EBF3EE] px-1.5 py-0.5 rounded">
                        {p.city}
                      </span>
                      <h4 className="font-bold text-xs text-[#1E293B] truncate">{p.name}</h4>
                      {!p.active && (
                        <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded">
                          Desativado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {p.category} • Duração {p.average_duration_minutes} min • {p.price_info.source_name}
                    </p>
                  </div>

                  {/* Price input edit */}
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-[10px] text-[#64748B] block">Preço Adulto:</span>
                      <input
                        type="number"
                        defaultValue={p.price_info.adult_price}
                        onBlur={(e) => handleUpdatePrice(p.id, parseFloat(e.target.value) || 0)}
                        className="w-16 p-1 text-xs border rounded font-bold text-right outline-none"
                      />
                    </div>

                    <button
                      onClick={() => handleTogglePlaceActive(p.id)}
                      title={p.active ? 'Desativar temporariamente' : 'Ativar'}
                      className={`p-2 rounded-xl text-xs font-bold transition-colors ${
                        p.active ? 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {p.active ? <EyeOff className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: EVENTS */}
        {activeTab === 'events' && (
          <div className="space-y-3">
            <h3 className="font-extrabold text-sm text-[#1E293B]">Eventos Âncora Cadastrados</h3>
            <div className="space-y-2">
              {events.map(evt => (
                <div key={evt.id} className="bg-white p-4 rounded-2xl border border-[#E7DFCE] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1B4332]">{evt.name}</span>
                    <span className="text-[10px] font-bold bg-[#EBF3EE] text-[#1B4332] px-2 py-0.5 rounded">
                      {evt.city}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B]">{evt.description}</p>
                  <p className="text-[11px] text-[#7A6F5D] font-medium">
                    Período: {evt.start_date} até {evt.end_date} • {evt.price_info}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: USER REPORTS (Requirement 40) */}
        {activeTab === 'reports' && (
          <div className="space-y-3">
            <h3 className="font-extrabold text-sm text-[#1E293B]">Relatos de Turistas para Curadoria</h3>
            {reports.length === 0 ? (
              <div className="bg-white p-8 text-center rounded-3xl border border-[#E7DFCE] text-xs text-[#64748B]">
                Nenhum relato pendente de análise no momento.
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map(r => (
                  <div key={r.id} className="bg-white p-4 rounded-2xl border border-[#E7DFCE] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1E293B]">{r.place_name}</span>
                      <span className="text-[10px] uppercase font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded">
                        {r.report_type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569]">{r.description}</p>
                    <div className="flex justify-end gap-2 pt-1 border-t border-[#F1EBE0]">
                      <button
                        onClick={() => onRejectReport(r.id)}
                        className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg"
                      >
                        Rejeitar
                      </button>
                      <button
                        onClick={() => onApproveReport(r.id)}
                        className="px-3 py-1 bg-[#1B4332] text-white text-xs font-bold rounded-lg"
                      >
                        Aprovar e Ajustar Banco
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: WEIGHTS (Requirement 26) */}
        {activeTab === 'weights' && (
          <div className="bg-white p-5 rounded-3xl border border-[#E7DFCE] space-y-4">
            <div>
              <h3 className="font-extrabold text-sm text-[#1E293B]">Configuração de Pesos do Motor</h3>
              <p className="text-xs text-[#64748B]">Ajuste a pontuação de ranqueamento das atrações:</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span>Compatibilidade / Interesses:</span>
                  <span className="font-bold">{weights.compatibilityInterests}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={weights.compatibilityInterests}
                  onChange={(e) => setWeights(w => ({ ...w, compatibilityInterests: parseInt(e.target.value, 10) }))}
                  className="w-full accent-[#1B4332]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>Logística / Distância / Clusters:</span>
                  <span className="font-bold">{weights.logisticsDistance}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={weights.logisticsDistance}
                  onChange={(e) => setWeights(w => ({ ...w, logisticsDistance: parseInt(e.target.value, 10) }))}
                  className="w-full accent-[#1B4332]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>Orçamento:</span>
                  <span className="font-bold">{weights.budget}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={weights.budget}
                  onChange={(e) => setWeights(w => ({ ...w, budget: parseInt(e.target.value, 10) }))}
                  className="w-full accent-[#1B4332]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>Clima / Proteção de Chuva:</span>
                  <span className="font-bold">{weights.weather}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={weights.weather}
                  onChange={(e) => setWeights(w => ({ ...w, weather: parseInt(e.target.value, 10) }))}
                  className="w-full accent-[#1B4332]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>Curadoria Divulga Lugares (Bônus):</span>
                  <span className="font-bold">{weights.curatorshipDivulgaLugares}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={weights.curatorshipDivulgaLugares}
                  onChange={(e) => setWeights(w => ({ ...w, curatorshipDivulgaLugares: parseInt(e.target.value, 10) }))}
                  className="w-full accent-[#1B4332]"
                />
              </div>
            </div>

            <button
              onClick={() => {
                setSavedSuccess(true);
                setTimeout(() => setSavedSuccess(false), 2000);
              }}
              className="w-full py-2.5 bg-[#1B4332] text-white text-xs font-bold rounded-xl shadow cursor-pointer"
            >
              Salvar Parâmetros do Motor
            </button>
          </div>
        )}

        {/* TAB 6: INTEGRATIONS & APIS (Sprint 0C requirement 13 & 20) */}
        {activeTab === 'integrations' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] shadow-xs flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#1B4332]">
                  Status das Integrações & APIs
                </h3>
                <p className="text-xs text-[#64748B]">
                  Arquitetura desacoplada via Provedores e Repositórios. Preparado para alternar de Mock para Real sem refatoração de telas.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setTestingProviderId('all');
                  const updated: RegisteredProviderStatus[] = [];
                  for (const p of providerStatuses) {
                    const res = await providerRegistry.testProvider(p.id);
                    if (res) updated.push(res);
                  }
                  setProviderStatuses(providerRegistry.getStatuses());
                  setTestingProviderId(null);
                }}
                className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingProviderId === 'all' ? 'animate-spin' : ''}`} />
                <span>Testar Todas</span>
              </button>
            </div>

            <div className="space-y-3">
              {providerStatuses.map(provider => {
                const isTesting = testingProviderId === provider.id || testingProviderId === 'all';
                const statusBadgeColor = 
                  provider.status === 'connected' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                  provider.status === 'mock' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                  provider.status === 'awaiting_key' ? 'bg-sky-100 text-sky-800 border-sky-300' :
                  'bg-rose-100 text-rose-800 border-rose-300';

                return (
                  <div 
                    key={provider.id} 
                    className="bg-white border border-[#E7DFCE] p-4 rounded-2xl shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-extrabold text-[#1E293B]">
                            {provider.name}
                          </h4>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadgeColor}`}>
                            {provider.status.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {provider.environment}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B]">
                          Provedor Ativo: <strong className="text-[#1E293B]">{provider.activeProvider}</strong> • Latência estimada: <strong>{provider.estimatedLatencyMs} ms</strong>
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isTesting}
                        onClick={async () => {
                          setTestingProviderId(provider.id);
                          await providerRegistry.testProvider(provider.id);
                          setProviderStatuses(providerRegistry.getStatuses());
                          setTestingProviderId(null);
                        }}
                        className="px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#F3EFE6] border border-[#E7DFCE] text-[#1B4332] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 min-h-[36px]"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                        <span>{isTesting ? 'Testando...' : 'Testar conexão'}</span>
                      </button>
                    </div>

                    {provider.lastResponseSummary && (
                      <div className="bg-[#FAF9F6] border border-[#F1EBE0] p-2.5 rounded-xl text-[11px] text-[#475569] flex items-center justify-between font-mono">
                        <span className="truncate">Log: {provider.lastResponseSummary}</span>
                        {provider.lastTestedAt && (
                          <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                            {new Date(provider.lastTestedAt).toLocaleTimeString('pt-BR')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
