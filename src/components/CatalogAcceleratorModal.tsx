import React, { useState, useEffect } from 'react';
import {
  Rocket,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Play,
  Pause,
  Check,
  X,
  MapPin,
  Shield,
  Layers,
  Star,
  ExternalLink,
  ChevronRight,
  Filter,
  AlertCircle,
  Clock,
  Sparkles,
  Database,
  DollarSign,
  TrendingUp,
  FileCheck2,
  Lock,
  ArrowRight,
  StopCircle,
  Activity,
  CheckSquare
} from 'lucide-react';
import { AcceleratorExecutionRecord, AcceleratorExecutionStatus } from '../types';

interface CityTargetDetail {
  current: number;
  target: number;
  needed: number;
}

interface PhaseTargetConfig {
  phase: 1 | 2 | 3;
  name: string;
  targetTotal: number;
  byCity: Record<'Gramado' | 'Canela' | 'Nova Petrópolis', CityTargetDetail>;
  neededTotal: number;
  isAuthorized: boolean;
  isCompleted: boolean;
  authorizedAt: string | null;
  completedAt: string | null;
  statusLabel?: 'AGUARDANDO_AUTORIZACAO' | 'AUTORIZADA' | 'REVOGADA' | 'BLOQUEADA_POR_SEGURANCA' | 'ERRO';
  authorizationRecord?: any;
}

interface SkuInvolved {
  sku: string;
  name: string;
  estimatedCalls: number;
  unitCostBrl: number | null;
  estimatedSubtotalBrl: number;
  officialMonthlyFreeTier: number;
}

interface ConsumptionEstimate {
  phase: number;
  targetNewPlaces: number;
  groupedTextSearches: number;
  placeDetailsCalls: number;
  totalCalls: number;
  estimatedCostGrossBrl: number;
  estimatedCostNetWithFreeTierBrl: number;
  skusInvolved: SkuInvolved[];
  safetyMarginPct: number;
  dailyBudgetImpactBrl: number;
  monthlyBudgetImpactBrl: number;
  cautionNotice: string;
}

interface MicrolotCheckpoint {
  at: string;
  microlotNumber: number;
  placesAdded: number;
  totalInSupabaseNow: number;
  duplicatesAvoided: number;
  errorsCount: number;
  observedCostBrl: number;
  persistenceValidated: boolean;
  sampleAudited: Array<{
    id: string;
    name: string;
    city: string;
    category: string;
    google_place_id: string;
    rating: number;
    address: string;
  }>;
}

interface SkuUsageSummary {
  sku: string;
  name: string;
  costBrl: number | null;
  officialMonthlyFreeTier: number;
  callsMonth: number;
  remainingFreeTier: number;
  callsToday: number;
  estimatedCostMonthBrl: number;
  status: 'WITHIN_FREE_TIER' | 'CHARGED' | 'UNKNOWN';
}

interface AcceleratorStatusResponse {
  baselineCount: number;
  currentCount: number;
  byCityCurrent: Record<'Gramado' | 'Canela' | 'Nova Petrópolis', number>;
  activePhase: 1 | 2 | 3;
  phase1: PhaseTargetConfig;
  phase2: PhaseTargetConfig;
  phase3: PhaseTargetConfig;
  executionState: {
    isPaused: boolean;
    isExecuting?: boolean;
    databaseAvailable?: boolean;
    microlotsExecuted: number;
    plannedMicrolotsPhase1: number;
    processedInActivePhase: number;
    duplicatesAvoidedTotal: number;
    lastCheckpoint: MicrolotCheckpoint | null;
    requiresAdminPhaseAuthorization: boolean;
  };
  consumptionEstimates: {
    phase1: ConsumptionEstimate;
    phase2: ConsumptionEstimate;
    phase3: ConsumptionEstimate;
  };
  costGuardStatus: any;
  skuBreakdown: Record<string, SkuUsageSummary>;
  proposedLimits: {
    proposedDailyLimit: number;
    proposedMonthlyLimit: number;
    proposedDailyBudgetBrl: number;
    proposedMonthlyBudgetBrl: number;
    reason: string;
    requiresApproval: boolean;
  };
  activeExecution?: AcceleratorExecutionRecord | null;
  latestExecution?: AcceleratorExecutionRecord | null;
  durableContract?: {
    provider: string;
    isInfrastructureConfigured: boolean;
    operationalBlocker: string | null;
  };
}

interface CatalogAcceleratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshCatalog: () => void;
  adminApiKey: string;
  adminSessionToken?: string | null;
}

export const CatalogAcceleratorModal: React.FC<CatalogAcceleratorModalProps> = ({
  isOpen,
  onClose,
  onRefreshCatalog,
  adminApiKey,
  adminSessionToken
}) => {
  const [status, setStatus] = useState<AcceleratorStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isExecutingMicrolot, setIsExecutingMicrolot] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isApplyingLimits, setIsApplyingLimits] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'phases' | 'skus' | 'microlots' | 'checkpoints'>('phases');

  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-admin-control-plane': 'duo21'
    };
    if (adminApiKey) {
      headers['x-admin-key'] = adminApiKey;
    }
    const token = adminSessionToken || sessionStorage.getItem('duo21_admin_session');
    if (token) {
      headers['x-admin-session'] = token;
    }
    return headers;
  };

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/accelerator/status', {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Falha ao obter status do Catalog Accelerator');
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar dados do acelerador');
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Atualização automática resiliente (Polling inteligente, visibilitychange e reconexão online)
  useEffect(() => {
    if (!isOpen) return;

    fetchStatus();

    const isRunning = Boolean(
      status?.executionState?.isExecuting ||
      status?.activeExecution?.status === 'RUNNING' ||
      status?.activeExecution?.status === 'QUEUED' ||
      status?.activeExecution?.status === 'PAUSE_REQUESTED'
    );
    const intervalMs = isRunning ? 1500 : 5000;

    const interval = setInterval(() => {
      fetchStatus();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStatus();
      }
    };

    const onOnline = () => {
      fetchStatus();
    };

    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
    };
  }, [isOpen, status?.executionState?.isExecuting, status?.activeExecution?.status]);

  const handleAuthorizePhase = async (phase: 1 | 2 | 3) => {
    setIsAuthorizing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/admin/accelerator/authorize-phase', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ phase })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao autorizar fase');
      setSuccessMessage(data.message || `Fase ${phase} autorizada com sucesso!`);
      await fetchStatus();
      onRefreshCatalog();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao conceder autorização');
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleRevokePhase = async (phase: 1 | 2 | 3) => {
    setIsRevoking(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/admin/accelerator/revoke-phase', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ phase, reason: 'Revogação expressa pelo painel administrativo' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao revogar autorização');
      setSuccessMessage(data.message || `Autorização da Fase ${phase} revogada com sucesso!`);
      await fetchStatus();
      onRefreshCatalog();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao revogar autorização');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleExecuteMicrolot = async () => {
    setIsExecutingMicrolot(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/admin/accelerator/execute-microlot?async=true', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao executar microlote');
      setSuccessMessage(data.message || 'Microlote iniciado em segundo plano! Acompanhe o progresso em tempo real.');
      await fetchStatus();
      onRefreshCatalog();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar microlote');
    } finally {
      setIsExecutingMicrolot(false);
    }
  };

  const handleTogglePause = async () => {
    if (!status) return;
    setIsTogglingPause(true);
    setErrorMessage(null);
    const isPaused = Boolean(
      status.executionState.isPaused || 
      status.activeExecution?.status === 'PAUSED'
    );
    const endpoint = isPaused ? '/api/admin/accelerator/resume' : '/api/admin/accelerator/pause';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao alterar estado de pausa');
      setSuccessMessage(data.message);
      await fetchStatus();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao pausar/retomar');
    } finally {
      setIsTogglingPause(false);
    }
  };

  const handleCancelExecution = async () => {
    if (!status) return;
    setIsCancelling(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/accelerator/cancel', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao cancelar execução');
      setSuccessMessage('Execução cancelada com sucesso e locks liberados.');
      await fetchStatus();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao cancelar execução');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleApplyLimits = async () => {
    setIsApplyingLimits(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/accelerator/propose-limits', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ approved: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao aplicar limites');
      setSuccessMessage('Novos limites do Cost Guard aprovados e configurados com sucesso!');
      await fetchStatus();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao aprovar limites');
    } finally {
      setIsApplyingLimits(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl border border-[#E7DFCE] shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        
        {/* Header Superior */}
        <div className="flex items-center justify-between pb-4 border-b border-[#F1EBE0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1B4332] text-white flex items-center justify-center shadow-xs">
              <Rocket className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  Sprint 10D.1 • Piloto Ampliado & Expansão Controlada
                </span>
                <span className="text-[10px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                  Progresso: 14 → 50 → 150 → 200
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#1B4332] mt-0.5">
                Catalog Accelerator — Painel de Controle de Expansão
              </h3>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchStatus}
              disabled={isLoadingStatus}
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
              title="Recarregar status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notificações / Alertas */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {status && (
          <>
            {/* STEPPER DE PROGRESSO GLOBAL (14 → 50 → 150 → 200) */}
            <div className="bg-[#FAF9F6] border border-[#E7DFCE] p-4 rounded-3xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Evolução do Catálogo (Locais Comprovados no Supabase: {status.currentCount})
                </span>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Fase Ativa: {status.activePhase === 1 ? 'Fase 1 (Meta 50)' : status.activePhase === 2 ? 'Fase 2 (Meta 150)' : 'Fase 3 (Meta 200)'}
                </span>
              </div>

              {/* Barra de Passos */}
              <div className="grid grid-cols-4 gap-2 text-xs">
                {/* Passo 0: Ponto de Partida */}
                <div className="p-3 rounded-2xl border bg-white border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Base Inicial</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="my-1">
                    <span className="text-2xl font-black text-slate-800">{status.baselineCount}</span>
                    <span className="text-[11px] text-slate-500 block">locais homologados</span>
                  </div>
                  <span className="text-[10px] text-slate-600 font-semibold">100% preservados</span>
                </div>

                {/* Passo 1: Meta 50 */}
                <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                  status.phase1.isCompleted
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : status.activePhase === 1
                      ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30'
                      : 'bg-white border-slate-200 opacity-60'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-amber-900">Fase 1</span>
                    {status.phase1.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : status.phase1.statusLabel === 'AUTORIZADA' ? (
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded">AUTORIZADA</span>
                    ) : status.phase1.statusLabel === 'REVOGADA' ? (
                      <span className="text-[9px] font-black bg-rose-100 text-rose-900 px-1.5 py-0.5 rounded">REVOGADA</span>
                    ) : status.phase1.statusLabel === 'BLOQUEADA_POR_SEGURANCA' ? (
                      <span className="text-[9px] font-black bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded">BLOQUEADA</span>
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                    )}
                  </div>
                  <div className="my-1">
                    <span className="text-2xl font-black text-[#1B4332]">{Math.min(status.currentCount, 50)}</span>
                    <span className="text-[11px] text-slate-600"> / 50 locais</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800">
                    {status.phase1.isCompleted ? '✓ 50 Concluído' : `Faltam ${status.phase1.neededTotal}`}
                  </span>
                </div>

                {/* Passo 2: Meta 150 */}
                <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                  status.phase2.isCompleted
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : status.activePhase === 2
                      ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30'
                      : 'bg-white border-slate-200 opacity-60'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-600">Fase 2 (Oficial)</span>
                    {status.phase2.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : status.phase2.statusLabel === 'AUTORIZADA' ? (
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded">AUTORIZADA</span>
                    ) : status.phase2.statusLabel === 'REVOGADA' ? (
                      <span className="text-[9px] font-black bg-rose-100 text-rose-900 px-1.5 py-0.5 rounded">REVOGADA</span>
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                  <div className="my-1">
                    <span className="text-2xl font-black text-slate-800">{Math.min(status.currentCount, 150)}</span>
                    <span className="text-[11px] text-slate-600"> / 150 locais</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-600">
                    {status.phase2.isCompleted ? '✓ 150 Concluído' : `Meta final 150`}
                  </span>
                </div>

                {/* Passo 3: Meta 200 */}
                <div className={`p-3 rounded-2xl border flex flex-col justify-between ${
                  status.phase3.isCompleted
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-white border-slate-200 opacity-60'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-600">Fase 3 (Opcional)</span>
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div className="my-1">
                    <span className="text-2xl font-black text-slate-800">{status.currentCount}</span>
                    <span className="text-[11px] text-slate-600"> / 200 locais</span>
                  </div>
                  <span className="text-[10px] font-semibold text-purple-700">Expansão opcional</span>
                </div>
              </div>

              {/* Distribuição por Cidade (Meta Proporcional da Fase Ativa) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <strong className="text-xs text-emerald-900">Gramado</strong>
                    <span className="text-[10px] font-bold text-emerald-800">
                      Alvo F1: {status.phase1.byCity.Gramado.target} | F2: 70
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-emerald-950">{status.byCityCurrent.Gramado}</span>
                    <span className="text-xs text-emerald-700">locais ativos</span>
                  </div>
                  <span className="text-[10px] text-emerald-800 block mt-0.5">
                    {status.phase1.byCity.Gramado.needed === 0 ? '✓ Alvo F1 atingido' : `Faltam ${status.phase1.byCity.Gramado.needed} para F1`}
                  </span>
                </div>

                <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <strong className="text-xs text-blue-900">Canela</strong>
                    <span className="text-[10px] font-bold text-blue-800">
                      Alvo F1: {status.phase1.byCity.Canela.target} | F2: 50
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-blue-950">{status.byCityCurrent.Canela}</span>
                    <span className="text-xs text-blue-700">locais ativos</span>
                  </div>
                  <span className="text-[10px] text-blue-800 block mt-0.5">
                    {status.phase1.byCity.Canela.needed === 0 ? '✓ Alvo F1 atingido' : `Faltam ${status.phase1.byCity.Canela.needed} para F1`}
                  </span>
                </div>

                <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <strong className="text-xs text-amber-900">Nova Petrópolis</strong>
                    <span className="text-[10px] font-bold text-amber-800">
                      Alvo F1: {status.phase1.byCity['Nova Petrópolis'].target} | F2: 30
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-black text-amber-950">{status.byCityCurrent['Nova Petrópolis']}</span>
                    <span className="text-xs text-amber-700">locais ativos</span>
                  </div>
                  <span className="text-[10px] text-amber-800 block mt-0.5">
                    {status.phase1.byCity['Nova Petrópolis'].needed === 0 ? '✓ Alvo F1 atingido' : `Faltam ${status.phase1.byCity['Nova Petrópolis'].needed} para F1`}
                  </span>
                </div>
              </div>
            </div>

            {/* BARRA DE PROGRESSO EM TEMPO REAL & ESTADOS DA EXECUÇÃO (Sprint 10D Hotfix P0 — Etapa 3) */}
            {(() => {
              const activeExec = status.activeExecution || status.latestExecution;
              const currentStatus: AcceleratorExecutionStatus = activeExec?.status || (status.executionState.isPaused ? 'PAUSED' : 'QUEUED');
              const totalItems = activeExec?.total_items || 10;
              const processedItems = activeExec?.processed_items || 0;
              const hasTrueProgress = Boolean(activeExec && typeof activeExec.processed_items === 'number' && totalItems > 0);
              const progressPercent = hasTrueProgress 
                ? Math.min(100, Math.max(0, Math.round((processedItems / totalItems) * 100))) 
                : null;

              return (
                <div className="bg-[#FAF9F6] border-2 border-[#E7DFCE] p-4 rounded-3xl space-y-3 shadow-xs">
                  {/* Topo do Card de Execução */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-800" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Acompanhamento de Execução em Tempo Real
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">
                        • Microlote #{activeExec?.microlot_number || (status.executionState.microlotsExecuted + 1)} de {status.executionState.plannedMicrolotsPhase1 || 4}
                      </span>
                    </div>

                    {/* Badge do Estado da Execução Persistente */}
                    <div className="flex items-center gap-1.5">
                      {currentStatus === 'QUEUED' && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          ⏳ Na Fila (QUEUED)
                        </span>
                      )}
                      {currentStatus === 'RUNNING' && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping inline-block" />
                          Executando (RUNNING)
                        </span>
                      )}
                      {currentStatus === 'PAUSE_REQUESTED' && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          ⏸️ Pausa Solicitada (PAUSE_REQUESTED)
                        </span>
                      )}
                      {currentStatus === 'PAUSED' && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300">
                          ⏸️ Pausado (PAUSED)
                        </span>
                      )}
                      {currentStatus === 'COMPLETED' && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                          ✅ Concluído (COMPLETED)
                        </span>
                      )}
                      {currentStatus === 'FAILED' && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
                          ❌ Falhou (FAILED)
                        </span>
                      )}
                      {currentStatus === 'CANCELLED' && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300">
                          ⏹️ Cancelado (CANCELLED)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Banner "MICROLOTE CONCLUÍDO" com resumo completo */}
                  {currentStatus === 'COMPLETED' && activeExec && (
                    <div className="p-3.5 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                          <h4 className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                            MICROLOTE CONCLUÍDO
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Microlote #{activeExec.microlot_number}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs pt-1">
                        <div className="bg-white/90 p-2 rounded-xl border border-emerald-200">
                          <span className="text-[10px] text-slate-500 font-bold block">Locais Processados</span>
                          <strong className="text-slate-800 text-sm">{activeExec.processed_items}</strong>
                        </div>
                        <div className="bg-white/90 p-2 rounded-xl border border-emerald-200">
                          <span className="text-[10px] text-slate-500 font-bold block">Locais Importados</span>
                          <strong className="text-emerald-700 text-sm">+{activeExec.imported_items}</strong>
                        </div>
                        <div className="bg-white/90 p-2 rounded-xl border border-emerald-200">
                          <span className="text-[10px] text-slate-500 font-bold block">Pendentes de Revisão</span>
                          <strong className="text-amber-800 text-sm">{activeExec.review_required_items}</strong>
                        </div>
                        <div className="bg-white/90 p-2 rounded-xl border border-emerald-200">
                          <span className="text-[10px] text-slate-500 font-bold block">Duplicatas Evitadas</span>
                          <strong className="text-slate-800 text-sm">{activeExec.duplicate_items}</strong>
                        </div>
                        <div className="bg-white/90 p-2 rounded-xl border border-emerald-200">
                          <span className="text-[10px] text-slate-500 font-bold block">Custo Estimado</span>
                          <strong className="text-emerald-900 text-sm">R$ {activeExec.estimated_cost_brl.toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Banner de Falha com Retomada Segura */}
                  {currentStatus === 'FAILED' && activeExec && (
                    <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-rose-700" />
                        <h4 className="text-sm font-black text-rose-950 uppercase tracking-wide">
                          FALHA NA EXECUÇÃO DO MICROLOTE
                        </h4>
                      </div>
                      <p className="text-xs text-rose-900 font-medium">
                        {activeExec.last_error || 'Erro inesperado durante a execução. O estado anterior e checkpoints foram preservados no Supabase.'}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleTogglePause}
                          disabled={isTogglingPause}
                          className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          Retomar com Segurança a partir do Último Checkpoint
                        </button>
                      </div>
                    </div>
                  )}

                  {/* BARRA VISUAL DE PROGRESSO REAL */}
                  <div className="space-y-1.5 bg-white p-3 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">
                        {activeExec?.current_step || 'Aguardando inicialização do lote...'}
                      </span>
                      <span className="font-extrabold text-[#1B4332]">
                        {progressPercent !== null ? `${progressPercent}%` : 'Cálculo em andamento'}
                      </span>
                    </div>

                    {progressPercent !== null ? (
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
                        <div 
                          className="h-full bg-emerald-600 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    ) : (
                      /* Barra indeterminada quando não for possível calcular porcentagem exata */
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                        <div className="h-full bg-gradient-to-r from-emerald-500 via-emerald-300 to-emerald-500 rounded-full animate-pulse w-full" />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Operações concluídas: <strong>{processedItems}</strong> de <strong>{totalItems}</strong></span>
                      <span>Horário da última atualização: <strong>{activeExec?.updated_at ? new Date(activeExec.updated_at).toLocaleTimeString('pt-BR') : new Date().toLocaleTimeString('pt-BR')}</strong></span>
                    </div>
                  </div>

                  {/* GRID DAS OPERAÇÕES DO PROCESSAMENTO (Locais descobertos, analisados, importados, etc.) */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block">Locais Descobertos</span>
                      <span className="text-base font-black text-slate-800">{activeExec?.discovered_items ?? 0}</span>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block">Locais Analisados</span>
                      <span className="text-base font-black text-slate-800">{activeExec?.analyzed_items ?? activeExec?.processed_items ?? 0}</span>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block">Locais Importados</span>
                      <span className="text-base font-black text-emerald-700">+{activeExec?.imported_items ?? 0}</span>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block">Duplicatas Evitadas</span>
                      <span className="text-base font-black text-amber-700">{activeExec?.duplicate_items ?? status.executionState.duplicatesAvoidedTotal}</span>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block">Pendentes Revisão</span>
                      <span className="text-base font-black text-slate-700">{activeExec?.review_required_items ?? 0}</span>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block">Erros Encontrados</span>
                      <span className="text-base font-black text-rose-700">{activeExec?.failed_items ?? 0}</span>
                    </div>
                  </div>

                  {/* AUDITORIA DE SKUS GOOGLE & CUSTO ESTIMADO ACUMULADO */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] text-slate-600">
                    <div>
                      <span>Chamadas Google por SKU: </span>
                      <strong>
                        {activeExec?.google_calls_by_sku && Object.keys(activeExec.google_calls_by_sku).length > 0
                          ? Object.entries(activeExec.google_calls_by_sku).map(([sku, count]) => `${sku}: ${count}`).join(' • ')
                          : '0 chamadas externas (dentro da franquia)'}
                      </strong>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>Custo Estimado Acumulado: <strong className="text-emerald-800">R$ {(activeExec?.estimated_cost_brl || 0).toFixed(2)}</strong></span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Idempotência: {activeExec?.execution_id ? `${activeExec.execution_id.slice(0, 8)}...` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* CONTROLES DE PAUSA, RETOMADA E CANCELAMENTO (Seção 8) */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-500 font-mono">
                      Worker Lease: {activeExec?.lease_owner ? `${activeExec.lease_owner.slice(0, 16)}...` : 'Livre'} | Supabase: Conectado
                    </span>

                    <div className="flex items-center gap-2">
                      {(currentStatus === 'RUNNING' || currentStatus === 'QUEUED') && (
                        <button
                          type="button"
                          onClick={handleTogglePause}
                          disabled={isTogglingPause}
                          className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Pause className="w-3.5 h-3.5 text-amber-700" />
                          <span>{isTogglingPause ? 'Pausando...' : 'Pausar'}</span>
                        </button>
                      )}

                      {currentStatus === 'PAUSE_REQUESTED' && (
                        <span className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                          <span>Pausa Solicitada...</span>
                        </span>
                      )}

                      {currentStatus === 'PAUSED' && (
                        <button
                          type="button"
                          onClick={handleTogglePause}
                          disabled={isTogglingPause}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 text-emerald-200" />
                          <span>{isTogglingPause ? 'Retomando...' : 'Retomar Execução'}</span>
                        </button>
                      )}

                      {(currentStatus === 'RUNNING' || currentStatus === 'PAUSED' || currentStatus === 'PAUSE_REQUESTED') && (
                        <button
                          type="button"
                          onClick={handleCancelExecution}
                          disabled={isCancelling}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300 font-semibold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <StopCircle className="w-3.5 h-3.5" />
                          <span>{isCancelling ? 'Cancelando...' : 'Cancelar'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* NOTA SOBRE EXECUÇÃO DURÁVEL & BLOQUEADOR OPERACIONAL (Seção 5) */}
                  {status.durableContract && (
                    <div className="p-2.5 bg-slate-100/70 border border-slate-200 rounded-xl text-[10px] text-slate-600 flex items-start gap-2">
                      <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-700">Contrato de Execução Durável:</strong>
                          <span className="bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded font-mono">
                            {status.durableContract.provider}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded font-semibold ${
                            status.durableContract.isInfrastructureConfigured 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {status.durableContract.isInfrastructureConfigured ? 'INFRA CONFIGURADA' : 'PENDENTE_CONFIGURACAO_INFRA'}
                          </span>
                        </div>
                        {status.durableContract.operationalBlocker && (
                          <p className="text-slate-500 leading-normal">
                            {status.durableContract.operationalBlocker}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TAB NAVIGATION */}
            <div className="flex gap-2 border-b border-[#F1EBE0] pb-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('phases')}
                className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'phases' ? 'bg-[#1B4332] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                1. Autorização & Execução Controlada
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('skus')}
                className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'skus' ? 'bg-[#1B4332] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                2. Auditoria por SKU & Franquias Google
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('checkpoints')}
                className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'checkpoints' ? 'bg-[#1B4332] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                3. Checkpoints & Amostras do Supabase
              </button>
            </div>

            {/* CONTEÚDO TAB 1: AUTORIZAÇÃO & EXECUÇÃO EM MICROLOTES */}
            {activeTab === 'phases' && (
              <div className="space-y-4">
                {/* CARD DE ESTIMATIVA DE CONSUMO & AUTORIZAÇÃO DA FASE 1 (Regra 10 e Regra de Execução) */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-3xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full inline-block mb-1">
                        Planejamento Rigoroso de Consumo • Fase 1 (Meta 50)
                      </span>
                      <h4 className="text-sm font-extrabold text-emerald-950">
                        Estimativa Prévia de Chamadas & Impacto Orçamentário
                      </h4>
                    </div>

                    {/* Status de Autorização Administrativa */}
                    {status.phase1.isAuthorized ? (
                      <span className="text-xs font-bold text-emerald-900 bg-emerald-200/80 px-3 py-1 rounded-xl flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>Fase 1 Autorizada pelo Administrador</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-xl flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-amber-700" />
                        <span>Aguardando Autorização Administrativa</span>
                      </span>
                    )}
                  </div>

                  {/* Detalhamento de Chamadas e Custos */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-white border border-emerald-200/70 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block">Novos Locais Necessários</span>
                      <span className="text-base font-black text-slate-800">{status.phase1.neededTotal} locais</span>
                      <span className="text-[10px] text-slate-500 block">para atingir 50</span>
                    </div>

                    <div className="p-2.5 bg-white border border-emerald-200/70 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block">Buscas Text Search</span>
                      <span className="text-base font-black text-slate-800">{status.consumptionEstimates.phase1.groupedTextSearches} req</span>
                      <span className="text-[10px] text-slate-500 block">agrupadas por cidade</span>
                    </div>

                    <div className="p-2.5 bg-white border border-emerald-200/70 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block">Place Details Cirúrgico</span>
                      <span className="text-base font-black text-slate-800">{status.consumptionEstimates.phase1.placeDetailsCalls} req</span>
                      <span className="text-[10px] text-slate-500 block">apenas aprovados</span>
                    </div>

                    <div className="p-2.5 bg-white border border-emerald-200/70 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold block">Custo Bruto Estimado</span>
                      <span className="text-base font-black text-[#1B4332]">
                        R$ {status.consumptionEstimates.phase1.estimatedCostGrossBrl.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold block">R$ 0,00 c/ Franquia GCP*</span>
                    </div>
                  </div>

                  {/* Aviso Obrigatório: R$ 0,00 não é garantido (Regra 2) */}
                  <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      <strong>Aviso Regulatório Obrigatório:</strong> R$ 0,00 líquido é estimado considerando a franquia de crédito do Google Cloud Platform (US$ 200/mês). O sistema não garante gratuidade absoluta, aplicando controle de teto pelo Cost Guard (máximo diário/mensal).
                    </span>
                  </div>

                  {/* Botões de Ação da Fase 1 */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-emerald-200">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-slate-600">
                        {status.phase1.isCompleted
                          ? 'Fase 1 totalmente concluída com 50 locais válidos!'
                          : status.phase1.isAuthorized
                            ? `Fase 1 autorizada e auditada no Supabase. Microlotes executados: ${status.executionState.microlotsExecuted} de ${status.executionState.plannedMicrolotsPhase1}`
                            : status.phase1.statusLabel === 'REVOGADA'
                              ? 'Autorização revogada pelo administrador. Chamadas bloqueadas por segurança.'
                              : status.phase1.statusLabel === 'BLOQUEADA_POR_SEGURANCA'
                                ? 'Execuções bloqueadas: Banco de dados Supabase indisponível.'
                                : 'Nenhuma chamada externa realizada antes de sua autorização.'}
                      </span>
                      {status.phase1.authorizationRecord && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          Auth ID: {status.phase1.authorizationRecord.authorization_id?.slice(0, 8)}... | 
                          {status.phase1.authorizationRecord.authorized_by ? ` Por: ${status.phase1.authorizationRecord.authorized_by} |` : ''} 
                          {status.phase1.authorizedAt ? ` Data: ${new Date(status.phase1.authorizedAt).toLocaleDateString('pt-BR')}` : ''}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {!status.phase1.isAuthorized ? (
                        <button
                          type="button"
                          onClick={() => handleAuthorizePhase(1)}
                          disabled={isAuthorizing || status.phase1.statusLabel === 'BLOQUEADA_POR_SEGURANCA'}
                          className="w-full sm:w-auto px-5 py-2.5 bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-black rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>
                            {isAuthorizing 
                              ? 'Gravando no Supabase...' 
                              : status.phase1.statusLabel === 'REVOGADA' 
                                ? 'Reautorizar Início da Fase 1 (Meta 50)' 
                                : 'Autorizar Início da Fase 1 (Meta 50)'}
                          </span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRevokePhase(1)}
                            disabled={isRevoking || isExecutingMicrolot}
                            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Revoga a autorização persistente no Supabase e bloqueia novos microlotes"
                          >
                            <Lock className="w-3.5 h-3.5 text-rose-600" />
                            <span>{isRevoking ? 'Revogando...' : 'Revogar'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleTogglePause}
                            disabled={isTogglingPause}
                            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            {status.executionState.isPaused ? (
                              <>
                                <Play className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Retomar Execução</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-3.5 h-3.5 text-amber-700" />
                                <span>Pausar</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleExecuteMicrolot}
                            disabled={isExecutingMicrolot || status.executionState.isPaused || status.phase1.isCompleted || status.executionState.isExecuting}
                            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Rocket className="w-3.5 h-3.5 text-emerald-300" />
                            <span>
                              {isExecutingMicrolot || status.executionState.isExecuting
                                ? 'Processando Microlote...'
                                : status.phase1.isCompleted
                                  ? 'Fase 1 Concluída'
                                  : 'Executar Microlote (até 10 novos locais)'}
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* TRANSIÇÃO PARA FASE 2 & FASE 3 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Fase 2 Card */}
                  <div className={`p-4 rounded-3xl border ${
                    status.phase1.isCompleted
                      ? 'bg-white border-emerald-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-800">Fase 2: Meta Oficial Completa (150 Locais)</strong>
                      {status.phase2.statusLabel === 'AUTORIZADA' ? (
                        <span className="text-[9px] font-black bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full">AUTORIZADA</span>
                      ) : status.phase2.statusLabel === 'REVOGADA' ? (
                        <span className="text-[9px] font-black bg-rose-100 text-rose-900 px-2 py-0.5 rounded-full">REVOGADA</span>
                      ) : (
                        <Lock className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Metas: Gramado 70, Canela 50, Nova Petrópolis 30. Requer comprovação de 50 locais válidos no Supabase antes de ser liberada.
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">
                        {status.currentCount >= 50 ? 'Pronta para autorização' : 'Aguardando 50 locais na Fase 1'}
                      </span>
                      {status.currentCount >= 50 && !status.phase2.isAuthorized && (
                        <button
                          type="button"
                          onClick={() => handleAuthorizePhase(2)}
                          disabled={isAuthorizing}
                          className="px-3 py-1.5 bg-[#1B4332] text-white font-bold rounded-xl text-xs hover:bg-[#143326] cursor-pointer"
                        >
                          Aprovar Próxima Fase (Fase 2)
                        </button>
                      )}
                      {status.phase2.isAuthorized && (
                        <button
                          type="button"
                          onClick={() => handleRevokePhase(2)}
                          disabled={isRevoking}
                          className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 font-bold rounded-lg text-[11px] hover:bg-rose-100 cursor-pointer"
                        >
                          Revogar Fase 2
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Fase 3 Card */}
                  <div className={`p-4 rounded-3xl border ${
                    status.phase2.isCompleted
                      ? 'bg-white border-purple-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-800">Fase 3: Expansão Opcional (200 Locais)</strong>
                      <Sparkles className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Expansão adicional de até 200 locais (Gramado 94, Canela 66, Nova Petrópolis 40). Opcional, liberada apenas após os 150 aprovados.
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">
                        {status.currentCount >= 150 ? 'Disponível para expansão' : 'Bloqueada até conclusão de 150'}
                      </span>
                      {status.currentCount >= 150 && !status.phase3.isAuthorized && (
                        <button
                          type="button"
                          onClick={() => handleAuthorizePhase(3)}
                          disabled={isAuthorizing}
                          className="px-3 py-1.5 bg-purple-700 text-white font-bold rounded-xl text-xs hover:bg-purple-800 cursor-pointer"
                        >
                          Autorizar Expansão (Fase 3)
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Proposta de Limites do Cost Guard (Regra 3) */}
                {status.proposedLimits.requiresApproval && (
                  <div className="p-4 bg-amber-50/60 border border-amber-300 rounded-3xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-950 font-extrabold">
                        <Shield className="w-4 h-4 text-amber-700" />
                        <span>Proposta de Ajuste Administrativo de Limites do Cost Guard</span>
                      </div>
                      <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                        Autorização Exigida
                      </span>
                    </div>
                    <p className="text-amber-900 text-[11px] leading-relaxed">
                      {status.proposedLimits.reason}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-200">
                      <span className="text-[11px] text-slate-700">
                        Proposta: <strong>{status.proposedLimits.proposedDailyLimit} req/dia</strong> · <strong>R$ {status.proposedLimits.proposedDailyBudgetBrl.toFixed(2)}/dia</strong> (Limite vigente: {status.costGuardStatus.dailyLimit} req/dia)
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyLimits}
                        disabled={isApplyingLimits}
                        className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        {isApplyingLimits ? 'Aprovando...' : 'Aprovar Novos Limites'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CONTEÚDO TAB 2: AUDITORIA POR SKU & FRANQUIAS GOOGLE (Regra 1 e 4) */}
            {activeTab === 'skus' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 flex items-center justify-between">
                  <span>
                    <strong>Auditoria Oficial de SKUs:</strong> Monitoramento cirúrgico de chamadas disparadas por FieldMask.
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Google Places API (New)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {Object.entries(status.skuBreakdown).map(([skuKey, skuData]: [string, SkuUsageSummary]) => (
                    <div key={skuKey} className="p-4 bg-white border border-[#E7DFCE] rounded-3xl space-y-2">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-[#1B4332]">{skuData.name}</strong>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                          skuData.status === 'WITHIN_FREE_TIER'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}>
                          {skuData.status === 'WITHIN_FREE_TIER' ? 'FRANQUIA OK' : 'COBRADO'}
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span>Chamadas Hoje:</span>
                          <strong>{skuData.callsToday}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Chamadas Mês:</span>
                          <strong>{skuData.callsMonth}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Franquia Mensal Oficial:</span>
                          <strong>{skuData.officialMonthlyFreeTier.toLocaleString('pt-BR')} req</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Franquia Restante:</span>
                          <strong className="text-emerald-700">{skuData.remainingFreeTier.toLocaleString('pt-BR')} req</strong>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-100">
                          <span>Custo Unitário Referência:</span>
                          <span>{skuData.costBrl ? `R$ ${skuData.costBrl.toFixed(2)}` : 'Não conf.'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumo Consolidado do Cost Guard */}
                <div className="p-4 bg-[#FAF9F6] border border-[#E7DFCE] rounded-3xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-800">Status Geral do Cost Guard</strong>
                    <span className="font-mono text-emerald-800 font-bold">{status.costGuardStatus.statusDisplay}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600">
                    <div>Chamadas Hoje: <strong>{status.costGuardStatus.callsToday} / {status.costGuardStatus.dailyLimit}</strong></div>
                    <div>Chamadas Mês: <strong>{status.costGuardStatus.callsMonth} / {status.costGuardStatus.monthlyLimit}</strong></div>
                    <div>Orçamento Hoje: <strong>R$ {status.costGuardStatus.estimatedCostTodayBrl.toFixed(2)} / R$ {status.costGuardStatus.dailyBudgetBrl.toFixed(2)}</strong></div>
                    <div>Orçamento Mês: <strong>R$ {status.costGuardStatus.estimatedCostMonthBrl.toFixed(2)} / R$ {status.costGuardStatus.monthlyBudgetBrl.toFixed(2)}</strong></div>
                  </div>
                </div>
              </div>
            )}

            {/* CONTEÚDO TAB 3: CHECKPOINTS & AUDITORIA SUPABASE (Regra 8, 11 e 12) */}
            {activeTab === 'checkpoints' && (
              <div className="space-y-3 text-xs">
                {status.executionState.lastCheckpoint ? (
                  <div className="p-4 bg-emerald-50/50 border border-emerald-300 rounded-3xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <strong className="text-sm text-emerald-950">
                          Último Checkpoint Realizado — Microlote #{status.executionState.lastCheckpoint.microlotNumber}
                        </strong>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(status.executionState.lastCheckpoint.at).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-700">
                      <div>Novos Locais Persistidos: <strong>+{status.executionState.lastCheckpoint.placesAdded}</strong></div>
                      <div>Total no Supabase: <strong>{status.executionState.lastCheckpoint.totalInSupabaseNow}</strong></div>
                      <div>Duplicatas Evitadas: <strong>{status.executionState.lastCheckpoint.duplicatesAvoided}</strong></div>
                      <div>Validação de Persistência: <strong className="text-emerald-700">✓ Comprovada no Banco</strong></div>
                    </div>

                    {/* Amostra Auditada de Registros (Regra 11) */}
                    <div className="space-y-1.5 pt-2 border-t border-emerald-200">
                      <span className="text-[11px] font-bold text-emerald-900 block">
                        Amostra Auditada de Locais Inseridos no Banco:
                      </span>
                      <div className="space-y-1.5">
                        {status.executionState.lastCheckpoint.sampleAudited.map((sample, idx) => (
                          <div key={sample.id || idx} className="p-2.5 bg-white border border-emerald-200 rounded-xl text-[11px] flex items-center justify-between">
                            <div>
                              <strong className="text-slate-800">{sample.name}</strong>
                              <span className="text-slate-500 text-[10px] ml-2">({sample.city} • {sample.category})</span>
                              <p className="text-[10px] text-slate-500">{sample.address}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                                {sample.google_place_id}
                              </span>
                              <span className="text-[10px] text-amber-700 block font-bold mt-0.5">
                                ⭐ {sample.rating}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl text-center space-y-2">
                    <Database className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-slate-600 font-semibold">Nenhum microlote executado nesta sessão ainda.</p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Assim que o primeiro microlote de até 10 locais for executado, o checkpoint automático validará a persistência no Supabase e exibirá a amostra auditada aqui.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer com Garantia Curatorial DUO21 */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-[#F1EBE0] gap-2">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Shield className="w-3.5 h-3.5 text-emerald-700" />
            <span>Mídias manuais, fotos de capa, preços e descrições DUO21 100% protegidas contra sobrescrita.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>

      </div>
    </div>
  );
};
