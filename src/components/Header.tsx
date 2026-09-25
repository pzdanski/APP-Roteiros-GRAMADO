import React from 'react';
import { Compass, KeyRound, ShieldAlert, ArrowLeft } from 'lucide-react';

interface HeaderProps {
  onOpenRecovery?: () => void;
  onOpenAdmin?: () => void;
  onGoHome?: () => void;
  onBack?: () => void;
  showBack?: boolean;
  backLabel?: string;
  isPaidView?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenRecovery,
  onOpenAdmin,
  onGoHome,
  onBack,
  showBack = false,
  backLabel = 'Voltar',
  isPaidView = false
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-[#E7DFCE] px-3 sm:px-4 py-2.5">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Left Side: Back button (if internal) + Brand Identity */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {showBack && onBack && (
            <button
              id="btn-header-back"
              type="button"
              onClick={onBack}
              aria-label={`Voltar: ${backLabel}`}
              className="flex items-center gap-1 py-1.5 px-2.5 -ml-1 text-[#1B4332] bg-[#EBF3EE] hover:bg-[#D9EADB] active:scale-95 transition-all rounded-xl font-extrabold text-xs min-h-[44px] min-w-[44px] shadow-xs"
            >
              <ArrowLeft className="w-4 h-4 text-[#1B4332] shrink-0" />
              <span className="text-xs font-bold text-[#1B4332] whitespace-nowrap">
                {backLabel}
              </span>
            </button>
          )}

          <button
            id="btn-header-home"
            type="button"
            onClick={onGoHome}
            className="flex items-center gap-2 text-left focus:outline-none min-h-[44px]"
          >
            <div className="w-8 h-8 rounded-xl bg-[#1B4332] flex items-center justify-center text-white shadow-sm shrink-0">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm text-[#1B4332] tracking-tight">DUO21</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#7A6F5D] bg-[#EFE9DE] px-1.5 py-0.5 rounded">Serra</span>
              </div>
              {!showBack && (
                <p className="text-[11px] text-[#475569] font-medium leading-none">Roteiro Inteligente</p>
              )}
            </div>
          </button>
        </div>

        {/* Right Side: Secondary Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!isPaidView && onOpenRecovery && (
            <button
              id="btn-open-recovery"
              type="button"
              onClick={onOpenRecovery}
              className={`px-2.5 py-1.5 text-xs font-semibold text-[#1B4332] bg-[#EBF3EE] hover:bg-[#D9EADB] rounded-lg transition-colors flex items-center gap-1 min-h-[36px] ${
                showBack ? 'hidden xs:flex sm:flex' : 'flex'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className={showBack ? 'hidden sm:inline' : 'inline'}>Acessar</span>
            </button>
          )}

          {onOpenAdmin && (
            <button
              id="btn-open-admin"
              type="button"
              onClick={onOpenAdmin}
              title="Painel Administrativo"
              className="p-1.5 text-[#7A6F5D] hover:text-[#1B4332] rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
