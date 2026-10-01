/**
 * Voice Recording & Transcription Service (Sprint 9.1 Section 1).
 * Supports browser Web Speech API (real-time streaming) and MediaRecorder fallback
 * sending audio to server-side Gemini endpoint (/api/audio/transcribe).
 * Fully handles permission states, unsupported browsers, empty recordings, and errors.
 */

export interface VoiceRecorderState {
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string;
  errorMessage: string | null;
  durationSeconds: number;
}

export class VoiceRecorderController {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recognition: any = null;
  private timerId: any = null;
  private startTime: number = 0;

  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasSpeech = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    return hasMedia || hasSpeech;
  }

  async start(callbacks: {
    onInterimTranscript?: (text: string) => void;
    onTick?: (seconds: number) => void;
    onError?: (msg: string) => void;
  }): Promise<boolean> {
    this.audioChunks = [];
    this.startTime = Date.now();

    // 1. Request microphone permission via getUserMedia
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (err: any) {
      console.warn('Microphone permission/access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        callbacks.onError?.('Permissão de microfone negada. Permita o acesso ao microfone nas configurações do navegador.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        callbacks.onError?.('Nenhum microfone encontrado neste dispositivo.');
      } else {
        callbacks.onError?.('Não foi possível acessar o microfone.');
      }
      return false;
    }

    // 2. Set up MediaRecorder if stream exists
    if (this.mediaStream && typeof MediaRecorder !== 'undefined') {
      try {
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }

        this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.audioChunks.push(e.data);
          }
        };
        this.mediaRecorder.start(250);
      } catch (e) {
        console.warn('MediaRecorder setup error:', e);
      }
    }

    // 3. Set up Web Speech Recognition for real-time live typing
    const SpeechRecognition = 
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'pt-BR';

        this.recognition.onresult = (event: any) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
          }
          if (text) {
            callbacks.onInterimTranscript?.(text);
          }
        };

        this.recognition.onerror = (e: any) => {
          console.warn('SpeechRecognition error:', e.error);
        };

        this.recognition.start();
      } catch (err) {
        console.warn('SpeechRecognition start error:', err);
      }
    }

    // 4. Start duration counter
    this.timerId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      callbacks.onTick?.(elapsed);
    }, 1000);

    return true;
  }

  async stop(accumulatedSpeechText?: string): Promise<string> {
    clearInterval(this.timerId);

    // Stop speech recognition
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }

    // Stop media recorder
    let recordedBlob: Blob | null = null;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        if (!this.mediaRecorder) return resolve();
        this.mediaRecorder.onstop = () => {
          recordedBlob = new Blob(this.audioChunks, { 
            type: this.mediaRecorder?.mimeType || 'audio/webm' 
          });
          resolve();
        };
        try {
          this.mediaRecorder.stop();
        } catch {
          resolve();
        }
      });
    }

    // Release microphone tracks
    this.cleanupTracks();

    // 1. If Web Speech produced valid text, prefer it
    const trimmedSpeech = (accumulatedSpeechText || '').trim();
    if (trimmedSpeech.length >= 2) {
      return trimmedSpeech;
    }

    // 2. If recorded audio chunks exist, send to server for Gemini transcription
    if (recordedBlob && recordedBlob.size > 2000) {
      try {
        const base64 = await this.blobToBase64(recordedBlob);
        const res = await fetch('/api/audio/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64,
            mimeType: recordedBlob.type
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.transcript && data.transcript.trim()) {
            return data.transcript.trim();
          }
        }
      } catch (err) {
        console.warn('Server audio transcription error:', err);
      }
    }

    if (trimmedSpeech) return trimmedSpeech;
    throw new Error('Nenhum áudio identificado. Fale um pouco mais alto ou perto do microfone.');
  }

  cancel() {
    clearInterval(this.timerId);
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
      this.recognition = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }
    this.cleanupTracks();
    this.audioChunks = [];
  }

  private cleanupTracks() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
