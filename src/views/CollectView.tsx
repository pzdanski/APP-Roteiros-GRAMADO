import React from 'react';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { AudioVoiceInput } from '../components/AudioVoiceInput';

interface CollectViewProps {
  onBack: () => void;
  onSubmitPrompt: (rawPrompt: string) => void;
  isLoading?: boolean;
  initialPrompt?: string;
}

export const CollectView: React.FC<CollectViewProps> = ({
  onBack,
  onSubmitPrompt,
  isLoading = false,
  initialPrompt = ''
}) => {
  return (
    <div className="w-full max-w-md mx-auto py-2">
      <button
        id="btn-back-collect"
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#7A6F5D] hover:text-[#1B4332] min-h-[44px] px-2 -ml-2 rounded-xl transition-colors hover:bg-black/5"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para o início</span>
      </button>

      <div className="text-center space-y-1.5 mb-6">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#1B4332] bg-[#EBF3EE] px-2.5 py-0.5 rounded-full inline-block">
          Passo 1 de 3
        </span>
        <h2 className="text-2xl font-extrabold text-[#1B4332]">
          Como será a sua viagem?
        </h2>
        <p className="text-xs text-[#475569] max-w-xs mx-auto">
          Fale à vontade sobre as datas, quem vai com você, se prefere passeios calmos ou agitados e quanto pretende gastar.
        </p>
      </div>

      <AudioVoiceInput 
        onSubmitPrompt={onSubmitPrompt}
        isLoading={isLoading}
        initialText={initialPrompt}
      />
    </div>
  );
};
