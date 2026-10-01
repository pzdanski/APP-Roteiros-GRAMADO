import React, { useState, useEffect } from 'react';
import { Sparkles, Compass, CheckCircle2 } from 'lucide-react';

interface BriefingProcessingIndicatorProps {
  isVisible: boolean;
  delayMs?: number; // threshold to trigger feedback (Sprint 9: 700-1000ms)
}

const ROTATING_MESSAGES = [
  'Entendendo sua viagem...',
  'Identificando preferências e datas...',
  'Avaliando perfil dos viajantes e orçamento...',
  'Organizando a melhor rota pela Serra...',
  'Personalizando a curadoria para Gramado e Canela...'
];

export const BriefingProcessingIndicator: React.FC<BriefingProcessingIndicatorProps> = ({
  isVisible,
  delayMs = 750
}) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  // Trigger delayed display: only show if processing takes longer than delayMs (700-1000ms)
  useEffect(() => {
    let delayTimer: any = null;
    let rotationTimer: any = null;

    if (isVisible) {
      delayTimer = setTimeout(() => {
        setShouldShow(true);
      }, delayMs);

      rotationTimer = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % ROTATING_MESSAGES.length);
      }, 1800);
    } else {
      setShouldShow(false);
      setMessageIndex(0);
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (rotationTimer) clearInterval(rotationTimer);
    };
  }, [isVisible, delayMs]);

  if (!shouldShow) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 bg-[#0F241C]/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300"
    >
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-[#E7DFCE] text-center space-y-4 animate-in zoom-in-95 duration-200">
        {/* Pulsing Visual Centerpiece */}
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#1B4332]/10 animate-ping" />
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#1B4332]/40 animate-spin duration-1000" />
          <div className="w-12 h-12 rounded-2xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center shadow-sm">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF3EE] text-[#1B4332] text-xs font-bold tracking-wide">
          <Compass className="w-3.5 h-3.5 animate-spin duration-1000" />
          <span>IA DUO21 em ação</span>
        </div>

        {/* Rotating Message */}
        <div className="min-h-[52px] flex items-center justify-center">
          <h3 className="text-base sm:text-lg font-extrabold text-[#1B4332] leading-snug transition-all duration-300">
            {ROTATING_MESSAGES[messageIndex]}
          </h3>
        </div>

        <p className="text-xs text-[#64748B] leading-relaxed">
          Estruturando seus dias, atrações e gastronomia de acordo com seu briefing.
        </p>

        {/* Progress Bar Pulse */}
        <div className="w-full bg-[#F1EBE0] h-1.5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#1B4332] via-[#2D6A4F] to-[#52B788] animate-pulse rounded-full w-full" />
        </div>
      </div>
    </div>
  );
};
