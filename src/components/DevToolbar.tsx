import React, { useState } from 'react';
import { 
  Wrench, 
  Sparkles, 
  RotateCcw, 
  Calendar, 
  MapPin, 
  MessageSquare, 
  Compass, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertTriangle,
  FileCode2
} from 'lucide-react';
import { Trip, AppTab } from '../types';

interface DevToolbarProps {
  currentScreen: string;
  trip: Trip | null;
  onDevUnlock: () => void;
  onResetTest: () => void;
  onNavigateTab: (tab: 'hoje' | 'roteiro' | 'mapa' | 'guia') => void;
  onNavigateScreen: (screen: 'landing' | 'collect' | 'confirm' | 'generating' | 'preview' | 'unlocked') => void;
}

export const DevToolbar: React.FC<DevToolbarProps> = ({
  currentScreen,
  trip,
  onDevUnlock,
  onResetTest,
  onNavigateTab,
  onNavigateScreen
}) => {
  // Only render in development mode
  const isDev = Boolean((import.meta as any).env?.DEV || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'));
  if (!isDev) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);

  return (
    <>
      {/* Discreet floating trigger pill */}
      <div className="fixed top-16 right-2 z-50">
        {!isOpen ? (
          <button
            id="btn-dev-toolbar-toggle"
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/90 hover:bg-amber-600 text-white rounded-full shadow-lg text-[11px] font-bold backdrop-blur-xs transition-all border border-amber-300 active:scale-95"
            title="Abrir DEV Toolbar (Apenas em ambiente de desenvolvimento)"
          >
            <Wrench className="w-3 h-3" />
            <span>DEV</span>
          </button>
        ) : (
          <div 
            id="dev-toolbar-panel"
            className="w-72 bg-slate-900/95 text-slate-100 rounded-2xl shadow-2xl border border-slate-700 p-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 text-xs"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-extrabold text-[11px] tracking-wide text-amber-400 uppercase">
                  DEV / TEST MODE
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Fechar painel dev"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            {/* Current Context */}
            <div className="mb-2 text-[10px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded">
              <span>Tela: </span>
              <strong className="text-white uppercase">{currentScreen}</strong>
              {trip && (
                <span className="ml-2">
                  | Status: <strong className={trip.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}>{trip.status}</strong>
                  {trip.unlock_source && (
                    <span className="ml-1 text-sky-400">({trip.unlock_source})</span>
                  )}
                </span>
              )}
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <button
                type="button"
                id="btn-dev-quick-unlock"
                onClick={() => {
                  onDevUnlock();
                  setIsOpen(false);
                }}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-colors text-[11px]"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>Desbloquear DEV</span>
              </button>

              <button
                type="button"
                id="btn-dev-quick-reset"
                onClick={() => {
                  onResetTest();
                  setIsOpen(false);
                }}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-rose-700/80 hover:bg-rose-600 text-white font-bold rounded-lg transition-colors text-[11px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar Teste</span>
              </button>
            </div>

            {/* Quick Tab Jumps (when in unlocked view) */}
            <div className="pt-1.5 border-t border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-1 font-semibold uppercase">
                Atalhos Rápidos:
              </span>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('hoje');
                    setIsOpen(false);
                  }}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-center text-slate-200"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('roteiro');
                    setIsOpen(false);
                  }}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-center text-slate-200"
                >
                  Roteiro
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('mapa');
                    setIsOpen(false);
                  }}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-center text-slate-200"
                >
                  Mapa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('guia');
                    setIsOpen(false);
                  }}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-center text-slate-200"
                >
                  Guia
                </button>
              </div>
            </div>

            {/* State Inspector Trigger */}
            <div className="mt-2 pt-1 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
              <button
                type="button"
                onClick={() => setShowStateModal(true)}
                className="hover:text-amber-300 flex items-center gap-1"
              >
                <FileCode2 className="w-3 h-3" />
                Ver Estado da Viagem
              </button>
              <span>DUO21 Dev</span>
            </div>
          </div>
        )}
      </div>

      {/* State Inspector Modal */}
      {showStateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 text-slate-100 w-full max-w-lg rounded-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center">
              <span className="font-bold text-xs text-amber-400">Estado da Viagem (Trip State JSON)</span>
              <button 
                onClick={() => setShowStateModal(false)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded"
              >
                Fechar
              </button>
            </div>
            <pre className="p-3 overflow-auto text-[10px] font-mono leading-relaxed text-emerald-400 flex-1">
              {JSON.stringify(trip, null, 2) || 'Nenhuma viagem instanciada no momento.'}
            </pre>
          </div>
        </div>
      )}
    </>
  );
};
