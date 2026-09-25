import React, { useState } from 'react';
import { X, Mail, KeyRound, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface RecoveryModalProps {
  onClose: () => void;
  onRecoverTrip: (tokenOrEmail: string) => void;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({
  onClose,
  onRecoverTrip
}) => {
  const [emailOrToken, setEmailOrToken] = useState('');
  const [sentMessage, setSentMessage] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrToken.trim()) return;

    if (emailOrToken.includes('@')) {
      setSentMessage(true);
      setTimeout(() => {
        onRecoverTrip(emailOrToken.trim());
      }, 1200);
    } else {
      onRecoverTrip(emailOrToken.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-5 border border-[#E7DFCE] animate-in fade-in zoom-in-95 duration-150"
        id="modal-recovery"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#EBF3EE] text-[#1B4332] flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-sm text-[#1B4332]">
              Recuperar Acesso ao Roteiro
            </h3>
          </div>

          <button
            id="btn-close-recovery"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-[#64748B] mb-4 leading-relaxed">
          Já comprou seu roteiro? Digite seu e-mail cadastrado ou o código de acesso exclusivo para abrir sua viagem.
        </p>

        {sentMessage ? (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center space-y-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="font-bold text-xs text-emerald-900">Acesso Localizado!</p>
            <p className="text-[11px] text-emerald-700">Abrindo seu roteiro personalizado...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-[#1B4332] uppercase tracking-wider mb-1">
                E-mail ou Código do Roteiro
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="input-recovery-email"
                  type="text"
                  required
                  placeholder="ex: seuemail@exemplo.com ou v_..."
                  value={emailOrToken}
                  onChange={(e) => setEmailOrToken(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E7DFCE] focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/15 text-xs text-[#1E293B] outline-none"
                />
              </div>
            </div>

            <button
              id="btn-submit-recovery"
              type="submit"
              className="w-full py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Acessar Meu Roteiro</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
