import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, Edit3 } from 'lucide-react';
import { trackEvent } from '../services/analytics';

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
  const [transcript, setTranscript] = useState('');
  const [isTextMode, setIsTextMode] = useState(!!initialText);
  const [textInput, setTextInput] = useState(initialText);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (initialText && !textInput) {
      setTextInput(initialText);
      setIsTextMode(true);
    }
  }, [initialText]);

  useEffect(() => {
    const SpeechRecognition = 
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'pt-BR';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
          setTextInput(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
          trackEvent('audio_completed');
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('Speech recognition setup failed:', err);
        setSpeechSupported(false);
      }
    } else {
      setSpeechSupported(false);
    }
  }, []);

  const toggleRecording = () => {
    if (!speechSupported) {
      setIsTextMode(true);
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
        trackEvent('audio_started');
      } catch {
        setIsTextMode(true);
      }
    }
  };

  const handleSendPrompt = () => {
    const finalText = (textInput || transcript).trim();
    if (finalText.length > 5) {
      if (isRecording) {
        recognitionRef.current?.stop();
        setIsRecording(false);
      }
      onSubmitPrompt(finalText);
    }
  };

  const samplePrompt = "Vou pra Gramado dia 20 com minha esposa e dois filhos. Ficamos 5 dias. Quero gastar no máximo uns 3 mil reais e as crianças gostam de parques.";

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      {!isTextMode ? (
        <div className="w-full flex flex-col items-center">
          {/* Visual Voice Record Area */}
          <div className="relative my-4 flex items-center justify-center">
            {isRecording && (
              <>
                <div className="absolute w-32 h-32 rounded-full bg-[#1B4332]/15 animate-ping" />
                <div className="absolute w-28 h-28 rounded-full bg-[#1B4332]/25 animate-pulse" />
              </>
            )}

            <button
              id="btn-voice-mic"
              onClick={toggleRecording}
              disabled={isLoading}
              className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all active:scale-95 ${
                isRecording 
                  ? 'bg-rose-600 ring-4 ring-rose-300 animate-pulse' 
                  : 'bg-[#1B4332] hover:bg-[#2D6A4F] ring-4 ring-[#1B4332]/20'
              }`}
            >
              {isRecording ? (
                <MicOff className="w-10 h-10 text-white" />
              ) : (
                <Mic className="w-10 h-10 text-white" />
              )}
            </button>
          </div>

          <p className="font-semibold text-lg text-[#1B4332] mb-1">
            {isRecording ? 'Gravando... fale agora' : 'Toque e fale'}
          </p>

          <p className="text-xs text-[#64748B] text-center max-w-xs mb-4">
            {isRecording 
              ? 'Pode falar naturalmente datas, pessoas, hotel e o que você gosta.' 
              : 'Como em uma mensagem de áudio no WhatsApp.'}
          </p>

          {transcript && (
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

          {/* Fallback button strictly "Prefiro escrever" */}
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
            placeholder="Ex: Vou para Gramado dia 20 com minha esposa e 2 filhos. Ficamos 5 dias, queremos parques e fondue, gastando até 3 mil reais..."
            className="w-full p-3 rounded-xl border border-[#E7DFCE] focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/15 text-sm text-[#1E293B] outline-none transition-all placeholder:text-[#94A3B8]"
          />

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              id="btn-back-to-voice"
              type="button"
              onClick={() => setIsTextMode(false)}
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
