import React, { useState } from 'react';
import { X, Flag, CheckCircle2, AlertTriangle } from 'lucide-react';
import { UserReport } from '../types';

interface ReportErrorModalProps {
  placeName: string;
  placeId: string;
  onClose: () => void;
  onSubmitReport: (report: Partial<UserReport>) => void;
}

export const ReportErrorModal: React.FC<ReportErrorModalProps> = ({
  placeName,
  placeId,
  onClose,
  onSubmitReport
}) => {
  const [reportType, setReportType] = useState<UserReport['report_type']>('preco_diferente');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    onSubmitReport({
      place_id: placeId,
      place_name: placeName,
      report_type: reportType,
      description,
      contact_email: contactEmail || undefined,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-5 border border-[#E7DFCE] animate-in fade-in zoom-in-95 duration-150"
        id="modal-report-error"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#1E293B]">
                Colaborar com Informação
              </h3>
              <p className="text-[11px] text-[#64748B]">{placeName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-sm text-emerald-900">Obrigado pela colaboração!</h4>
            <p className="text-xs text-[#64748B]">
              Nossa equipe da curadoria irá validar a informação para manter os roteiros atualizados.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-[#1B4332] uppercase mb-1">
                Qual é a divergência encontrada?
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-[#E7DFCE] text-xs outline-none bg-[#FAF9F6]"
              >
                <option value="preco_diferente">Preço diferente do informado</option>
                <option value="horario_diferente">Horário de funcionamento alterado</option>
                <option value="fechado">Estabelecimento temporariamente fechado</option>
                <option value="outro">Outra informação desatualizada</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1B4332] uppercase mb-1">
                Detalhes (ex: novo valor cobrado)
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: O ingresso no local custa R$ 80 e não abre nas segundas..."
                className="w-full p-2.5 rounded-xl border border-[#E7DFCE] text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1B4332] uppercase mb-1">
                Seu e-mail (opcional)
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Para agradecermos ou tirarmos dúvidas"
                className="w-full p-2.5 rounded-xl border border-[#E7DFCE] text-xs outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold text-xs rounded-xl shadow transition-colors"
            >
              Enviar Relato para Curadoria
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
