import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Sparkles, 
  MapPin, 
  Utensils, 
  CloudSun, 
  Wallet, 
  CheckCircle2, 
  Compass,
  ArrowLeft,
  Building2
} from 'lucide-react';
import { TripPreferences, Trip, TripPreview } from '../types';
import { previewEngine } from '../services/previewEngine';
import { SEED_PLACES, SEED_EVENTS } from '../data/seedData';
import { isValidCount, safeText } from '../utils/safeDisplay';

interface TripGenerationScreenProps {
  preferences: TripPreferences;
  eventsFoundCount?: number;
  placesFoundCount?: number;
  onPreviewComplete?: (preview: TripPreview) => void;
  onGenerationComplete?: (generatedTrip: Trip) => void;
  onComplete?: (generated: any) => void;
  onBack?: () => void;
}

interface StepItem {
  id: string;
  label: string;
  icon: React.ElementType;
  detailMessage?: string;
}

export const TripGenerationScreen: React.FC<TripGenerationScreenProps> = ({
  preferences,
  eventsFoundCount,
  placesFoundCount,
  onPreviewComplete,
  onGenerationComplete,
  onComplete,
  onBack
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Compute matched counts safely
  const activeEventsCount = eventsFoundCount ?? SEED_EVENTS.filter(evt => {
    if (!preferences.start_date || !preferences.end_date) return true;
    return evt.start_date <= preferences.end_date && evt.end_date >= preferences.start_date;
  }).length;

  const activePlacesCount = placesFoundCount ?? SEED_PLACES.length;

  const hasConfirmedHotel = 
    preferences.accommodation_status === 'booked' || 
    (!!preferences.hotel_name && preferences.accommodation_status !== 'not_booked' && preferences.accommodation_status !== 'undecided');

  const hotelCity = preferences.hotel_city || 'Gramado';

  const logisticsLabel = hasConfirmedHotel
    ? `Otimizando deslocamentos a partir de ${preferences.hotel_name || 'sua hospedagem'}...`
    : `Organizando seus dias usando uma base provisória em ${hotelCity}...`;

  const steps: StepItem[] = [
    { id: '1', label: 'Analisando suas datas e cidades...', icon: Calendar },
    { 
      id: '2', 
      label: 'Procurando eventos nas suas datas...', 
      icon: Sparkles,
      detailMessage: isValidCount(activeEventsCount) && activeEventsCount > 0 
        ? `Encontramos ${activeEventsCount} eventos nas suas datas!` 
        : undefined
    },
    { 
      id: '3', 
      label: 'Conferindo atrações e parques compatíveis...', 
      icon: MapPin,
      detailMessage: isValidCount(activePlacesCount) && activePlacesCount > 0 
        ? `Encontramos ${activePlacesCount} lugares compatíveis com seu perfil.` 
        : undefined
    },
    { id: '4', label: 'Analisando opções gastronômicas e fondues...', icon: Utensils },
    { id: '5', label: logisticsLabel, icon: hasConfirmedHotel ? Building2 : Compass },
    { id: '6', label: 'Verificando previsão do tempo e locais cobertos...', icon: CloudSun },
    { id: '7', label: 'Adequando despesas e margem do orçamento...', icon: Wallet },
    { id: '8', label: 'Montando o roteiro detalhado...', icon: CheckCircle2 }
  ];

  useEffect(() => {
    let isCancelled = false;

    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(timer);
          setTimeout(() => {
            if (isCancelled) return;
            try {
              const preview = previewEngine.generatePreview(preferences);
              if (typeof onPreviewComplete === 'function') {
                onPreviewComplete(preview);
              } else if (typeof onComplete === 'function') {
                onComplete(preview);
              } else if (typeof onGenerationComplete === 'function') {
                // Backward compatibility
                onGenerationComplete(preview as any);
              }
            } catch (err) {
              console.error('Error generating preview in TripGenerationScreen:', err);
            }
          }, 600);
          return prev;
        }
      });
    }, 600);

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [steps.length, onComplete, onGenerationComplete, preferences]);

  const firstName = preferences.name ? safeText(preferences.name.split(' ')[0], 'Viajante') : 'Viajante';

  // Contextual personalized line
  let lightGreetingLine = "Já limpou a galeria do celular? Vai faltar espaço pra tanta foto na Serra! 📸✨";
  if (preferences.is_couple) {
    lightGreetingLine = "Roteiro preparado para momentos inesquecíveis a dois nos melhores cantinhos da Serra. 🍷❤️";
  } else if (preferences.children_count > 0) {
    lightGreetingLine = "Selecionamos atrações lúdicas e confortáveis para encantar as crianças e os adultos! 🎠🌲";
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 py-6 flex flex-col items-center justify-center min-h-[75vh]">
      {onBack && (
        <div className="w-full flex justify-start mb-2">
          <button
            type="button"
            id="btn-cancel-generation"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7A6F5D] hover:text-[#1B4332] min-h-[44px] px-2 -ml-2 rounded-xl transition-colors hover:bg-black/5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para confirmação</span>
          </button>
        </div>
      )}

      {/* Animated Icon Ring */}
      <div className="relative mb-5">
        <div className="w-20 h-20 rounded-full bg-[#1B4332]/10 flex items-center justify-center border-2 border-[#1B4332]/20 animate-pulse">
          <Sparkles className="w-10 h-10 text-[#1B4332] animate-spin" />
        </div>
      </div>

      <h2 className="text-xl font-extrabold text-[#1B4332] text-center mb-1">
        {firstName}, sua viagem está sendo montada!
      </h2>

      <p className="text-xs text-[#475569] text-center max-w-xs mb-5 leading-relaxed">
        {lightGreetingLine}
      </p>

      {/* Real Progress Steps Card */}
      <div className="w-full bg-white rounded-3xl border border-[#E7DFCE] p-4 shadow-xs space-y-3">
        {steps.map((step, idx) => {
          const isDone = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          const StepIcon = step.icon;

          return (
            <div 
              key={step.id} 
              className={`flex items-start gap-3 transition-opacity ${
                isDone ? 'opacity-90' : isCurrent ? 'opacity-100 font-semibold' : 'opacity-35'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                isDone 
                  ? 'bg-[#1B4332] text-white' 
                  : isCurrent 
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse' 
                  : 'bg-slate-100 text-slate-400'
              }`}>
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <StepIcon className="w-3.5 h-3.5" />
                )}
              </div>

              <div className="flex-1 text-left">
                <p className={`text-xs ${isCurrent ? 'text-[#1B4332] font-bold' : isDone ? 'text-[#1E293B]' : 'text-slate-500'}`}>
                  {step.label}
                </p>
                {step.detailMessage && (isDone || isCurrent) && (
                  <span className="inline-block mt-0.5 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                    {step.detailMessage}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
