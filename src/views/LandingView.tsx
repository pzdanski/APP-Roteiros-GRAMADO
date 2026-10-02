import React from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Calendar, 
  MapPin, 
  CloudSun, 
  Wallet, 
  Compass, 
  CheckCircle2, 
  KeyRound, 
  Heart,
  Trees,
  Coffee,
  Camera
} from 'lucide-react';
import { trackEvent } from '../services/analytics';

interface LandingViewProps {
  onStartTrip: () => void;
  onOpenRecovery: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onStartTrip,
  onOpenRecovery
}) => {
  const [imgError, setImgError] = React.useState(false);
  const [campaignStatus, setCampaignStatus] = React.useState<{
    active: boolean;
    campaign_price: number;
    official_starting_price: number;
    max_redemptions: number;
    remaining_redemptions: number;
    is_available: boolean;
  }>({
    active: true,
    campaign_price: 19.90,
    official_starting_price: 29.90,
    max_redemptions: 300,
    remaining_redemptions: 300,
    is_available: true
  });

  React.useEffect(() => {
    fetch('/api/campaigns/launch-status')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && typeof data.is_available === 'boolean') {
          setCampaignStatus(data);
        }
      })
      .catch(() => {
        // Safe graceful fallback
      });
  }, []);

  const handleStart = () => {
    trackEvent('start_trip');
    onStartTrip();
  };

  return (
    <div className="w-full max-w-md mx-auto pb-12">
      {/* Top Tag */}
      <div className="pt-2 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF3EE] text-[#1B4332] text-xs font-bold tracking-wide border border-[#D9EADB]">
          <Sparkles className="w-3.5 h-3.5 text-[#2D6A4F]" />
          DUO21 • Divulga Lugares
        </span>
      </div>

      {/* Hero Section */}
      <div className="mt-5 text-center px-2 space-y-3">
        <h1 className="text-3xl font-extrabold text-[#1B4332] tracking-tight leading-[1.15]">
          Sua viagem pela Serra, planejada em minutos.
        </h1>
        <p className="text-sm text-[#475569] leading-relaxed max-w-sm mx-auto">
          Conte quando você vem, quanto quer gastar e o que gosta. A gente organiza o resto.
        </p>
      </div>

      {/* Cities Badges */}
      <div className="mt-5 flex items-center justify-center gap-2">
        <span className="text-xs font-bold text-[#1B4332] bg-white border border-[#E7DFCE] px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-emerald-700" />
          Gramado
        </span>
        <span className="text-xs font-bold text-[#1B4332] bg-white border border-[#E7DFCE] px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-emerald-700" />
          Canela
        </span>
        <span className="text-xs font-bold text-[#1B4332] bg-white border border-[#E7DFCE] px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-emerald-700" />
          Nova Petrópolis
        </span>
      </div>

      {/* Main Action Card (CTA) */}
      <div className="mt-6 bg-white p-5 rounded-3xl border border-[#E7DFCE] shadow-md text-center space-y-4">
        <div className="space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full inline-block">
            Sem cadastro ou senha
          </span>
          <h2 className="text-lg font-bold text-[#0F172A]">
            Pronto para montar sua viagem ideal?
          </h2>
          <p className="text-xs text-[#64748B]">
            Você pode apenas falar pelo microfone ou digitar como preferir.
          </p>
        </div>

        <button
          id="btn-landing-cta"
          onClick={handleStart}
          className="w-full py-4 px-6 bg-[#1B4332] hover:bg-[#2D6A4F] active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 min-h-[44px]"
        >
          <span>Criar meu roteiro</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Section 5 & 6: Launch Offer or Official Starting Price */}
        {campaignStatus.is_available ? (
          <div className="bg-[#FAF9F6] border border-[#E7DFCE] rounded-2xl p-3 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-amber-700" />
              Oferta de Lançamento
            </div>
            <p className="text-xs font-bold text-[#1B4332]">
              Primeiros 300 roteiros por R$ 19,90
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-[#7A6F5D]">
              <span className="line-through text-slate-400">
                A partir de R$ 29,90
              </span>
              <span>•</span>
              <span className="font-semibold text-emerald-800">
                Oferta válida para os primeiros 300 roteiros.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-[#7A6F5D] font-medium leading-tight">
            <span className="whitespace-nowrap">
              A partir de <strong className="font-extrabold text-sm text-[#1B4332]">R$ 29,90</strong>
            </span>
            <span>•</span>
            <span className="whitespace-nowrap font-semibold text-[#1B4332]">
              Acesso imediato
            </span>
          </div>
        )}
      </div>

      {/* Featured Photo Preview */}
      <div className="mt-6 relative rounded-3xl overflow-hidden border border-[#E7DFCE] shadow-sm aspect-video bg-[#EBF3EE]">
        {!imgError ? (
          <img 
            src="https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=1000&q=80" 
            alt="" 
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-white p-6 text-center">
            <Trees className="w-10 h-10 text-emerald-300 mb-2" />
            <p className="font-extrabold text-base">Serra Gaúcha</p>
            <p className="text-xs text-emerald-100">Gramado • Canela • Nova Petrópolis</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex flex-col justify-end p-4 text-white pointer-events-none">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300">
            Curadoria Local DUO21
          </p>
          <p className="text-sm font-bold">
            Lugares testados por quem vive e respira a Serra Gaúcha
          </p>
        </div>
      </div>

      {/* Key Benefits List */}
      <div className="mt-8 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A6F5D] px-1">
          Por que usar o nosso assistente?
        </h3>

        <div className="grid grid-cols-1 gap-2.5">
          <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE] flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-[#1E293B]">Roteiro 100% Personalizado</h4>
              <p className="text-[11px] text-[#64748B] mt-0.5">Adaptado para casais, famílias com crianças ou viajantes solo.</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE] flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-[#1E293B]">Orçamento Sob Controle</h4>
              <p className="text-[11px] text-[#64748B] mt-0.5">Estimativas reais com margem de segurança para não estourar seu bolso.</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE] flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center shrink-0">
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-[#1E293B]">Clima e Chuva Considerados</h4>
              <p className="text-[11px] text-[#64748B] mt-0.5">Alternativas cobertas automáticas para dias chuvosos ou frios.</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE] flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-[#1E293B]">Eventos e Âncoras Reais</h4>
              <p className="text-[11px] text-[#64748B] mt-0.5">Integração com Natal Luz, Sonho de Natal, Festival de Cinema e Paradas.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recovery Link Card */}
      <div className="mt-8 pt-4 border-t border-[#E7DFCE] text-center">
        <p className="text-xs text-[#64748B] mb-2">Já possui um roteiro criado ou comprou anteriormente?</p>
        <button
          id="btn-landing-recover"
          onClick={onOpenRecovery}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#1B4332] bg-[#FAF9F6] hover:bg-[#EBF3EE] border border-[#D9EADB] rounded-xl transition-colors"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Recuperar acesso ao meu roteiro</span>
        </button>
      </div>
    </div>
  );
};
