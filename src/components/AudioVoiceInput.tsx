import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, Edit3, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { trackEvent } from '../services/analytics';
import { VoiceRecorderController } from '../services/audio/voiceRecorder';

interface AudioVoiceInputProps {
  onSubmitPrompt: (text: string) => void;
  isLoading?: boolean;
  initialText?: string;
}

export const AudioVoiceInput: React.FC<AudioVoiceInputProps> = ({
  onSubmitPrompt,
  isLoading = false,
  initialText = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState(initialText);
  const [isTextMode, setIsTextMode] = useState(!!initialText);
  const [seconds, setSeconds] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isAudioSupported, setIsAudioSupported] = useState(true);

  const recorderRef = useRef<VoiceRecorderController | null>(null);

  useEffect(() => {
    setIsAudioSupported(VoiceRecorderController.isSupported());
  }, []);

  useEffect(() => {
    if (initialText && !textInput) {
      setTextInput(initialText);
      setIsTextMode(true);
    }
  }, [initialText]);

  const handleStartRecording = async () => {
    setAudioError(null);
    setTranscript('');
    setSeconds(0);

    if (!recorderRef.current) {
      recorderRef.current = new VoiceRecorderController();
    }

    const started = await recorderRef.current.start({
      onInterimTranscript: (text) => {
        setTranscript(text);
        setTextInput(text);
      },
      onTick: (sec) => {
        setSeconds(sec);
      },
      onError: (msg) => {
        setAudioError(msg);
        setIsRecording(false);
      }
    });

    if (started) {
      setIsRecording(true);
      trackEvent('audio_started');
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      const finalText = await recorderRef.current.stop(transcript);
      if (finalText && finalText.trim().length > 3) {
        setTranscript(finalText.trim());
        setTextInput(finalText.trim());
        trackEvent('audio_completed');
      } else {
        setAudioError('Áudio muito curto ou vazio. Fale sobre sua viagem.');
      }
    } catch (err: any) {
      setAudioError(err.message || 'Falha ao transcrever o áudio.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCancelRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.cancel();
    }
    setIsRecording(false);
    setIsTranscribing(false);
    setTranscript('');
    setSeconds(0);
  };

  const handleSendPrompt = () => {
    const finalText = (textInput || transcript).trim();
    if (finalText.length > 5) {
      if (isRecording) {
        handleStopRecording();
      }
      onSubmitPrompt(finalText);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const samplePrompt = "Vou pra Gramado dia 20 com minha esposa e dois filhos. Ficamos 5 dias. Quero gastar no máximo uns 10 mil reais e as crianças gostam de parques.";

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      {/* Error Alert Banner */}
      {audioError && (
        <div className="w-full mb-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-xs text-rose-800 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Atenção</span>
            <span>{audioError}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setAudioError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {!isTextMode ? (
        <div className="w-full flex flex-col items-center">
          {/* Visual Voice Record Area */}
          <div className="relative my-4 flex items-center justify-center">
            {isRecording && (
              <>
                <div className="absolute w-36 h-36 rounded-full bg-rose-500/15 animate-ping" />
                <div className="absolute w-30 h-30 rounded-full bg-rose-500/25 animate-pulse" />
              </>
            )}

            <button
              id="btn-voice-mic"
              type="button"
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={isLoading || isTranscribing || !isAudioSupported}
              className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all active:scale-95 ${
                isRecording 
                  ? 'bg-rose-600 ring-4 ring-rose-300 animate-pulse' 
                  : isTranscribing
                  ? 'bg-amber-600 ring-4 ring-amber-300'
                  : 'bg-[#1B4332] hover:bg-[#2D6A4F] ring-4 ring-[#1B4332]/20'
              } disabled:opacity-50`}
              aria-label={isRecording ? 'Parar gravação' : 'Iniciar gravação de voz'}
            >
              {isTranscribing ? (
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-10 h-10 text-white" />
              ) : (
                <Mic className="w-10 h-10 text-white" />
              )}
            </button>
          </div>

          {/* Recording Timer and Status */}
          {isRecording ? (
            <div className="flex flex-col items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                Ouvindo... ({formatSeconds(seconds)})
              </span>
              <p className="text-xs text-[#64748B] text-center max-w-xs">
                Pode falar datas, quantas pessoas, ritmo e o que você gosta.
              </p>

              {/* Stop / Cancel Action Buttons */}
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Concluir</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelRecording}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar</span>
                </button>
              </div>
            </div>
          ) : isTranscribing ? (
            <div className="flex flex-col items-center gap-1 mb-2">
              <span className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
                Processando áudio...
              </span>
            </div>
          ) : (
            <div className="text-center mb-2">
              <p className="font-semibold text-lg text-[#1B4332] mb-0.5">
                Toque e fale sobre sua viagem
              </p>
              <p className="text-xs text-[#64748B] max-w-xs">
                Como em uma mensagem de áudio no WhatsApp.
              </p>
            </div>
          )}

          {/* Transcript Box */}
          {transcript && !isRecording && !isTranscribing && (
            <div className="w-full bg-white p-3.5 rounded-2xl border border-[#E7DFCE] shadow-sm mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1B4332]">Você disse:</span>
                <button 
                  onClick={() => setIsTextMode(true)}
                  className="text-xs text-[#7A6F5D] hover:text-[#1B4332] flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  Editar
                </button>
              </div>
              <p className="text-sm text-[#1E293B] leading-relaxed italic">
                "{transcript}"
              </p>
              <button
                id="btn-submit-audio-transcript"
                onClick={handleSendPrompt}
                disabled={isLoading}
                className="mt-3 w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-semibold text-sm rounded-xl shadow transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Continuar com este áudio</span>
              </button>
            </div>
          )}

          {/* Fallback button "Prefiro escrever" */}
          <button
            id="btn-switch-to-text"
            onClick={() => setIsTextMode(true)}
            className="mt-2 text-sm font-semibold text-[#1B4332] hover:text-[#2D6A4F] underline decoration-[#1B4332]/30 underline-offset-4 py-2 px-4 transition-colors"
          >
            Prefiro escrever
          </button>
        </div>
      ) : (
        <div className="w-full bg-white p-4 rounded-3xl border border-[#E7DFCE] shadow-sm">
          <label className="block text-xs font-semibold text-[#1B4332] uppercase tracking-wider mb-2">
            Descreva sua viagem com suas palavras:
          </label>
          <textarea
            id="input-trip-text"
            rows={4}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Ex: Vou para Gramado dia 20 com minha esposa e 2 filhos. Ficamos 5 dias, queremos parques e fondue, gastando até 10 mil reais..."
            className="w-full p-3 rounded-xl border border-[#E7DFCE] focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/15 text-sm text-[#1E293B] outline-none transition-all placeholder:text-[#94A3B8]"
          />

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              id="btn-back-to-voice"
              type="button"
              onClick={() => {
                setIsTextMode(false);
                setAudioError(null);
              }}
              className="text-xs font-semibold text-[#1B4332] hover:bg-[#EBF3EE] px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Mic className="w-4 h-4" />
              <span>Usar áudio</span>
            </button>

            <button
              id="btn-submit-text-prompt"
              type="button"
              onClick={handleSendPrompt}
              disabled={textInput.trim().length < 5 || isLoading}
              className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow transition-colors flex items-center gap-2"
            >
              <span>Continuar</span>
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Quick example chip */}
          <div className="mt-3 pt-3 border-t border-[#F1EBE0]">
            <p className="text-[11px] text-[#7A6F5D] mb-1 font-medium">Exemplo rápido:</p>
            <button
              type="button"
              onClick={() => setTextInput(samplePrompt)}
              className="text-[11px] text-left text-[#475569] bg-[#FAF9F6] hover:bg-[#F3EFE6] p-2 rounded-lg border border-[#E7DFCE] transition-colors"
            >
              "{samplePrompt}"
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
