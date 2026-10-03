import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Check,
  AlertCircle,
  Camera,
  Clock,
  DollarSign,
  Link as LinkIcon,
  Sparkles,
  MapPin,
  Search,
  ExternalLink,
  Trash2,
  Star,
  CheckCircle2,
  HelpCircle,
  Shield,
  Layers,
  Phone,
  MessageCircle,
  Globe,
  Instagram,
  Ticket,
  Upload,
  Image as ImageIcon,
  BookOpen,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Place, PlaceMedia, MediaSource } from '../types';
import { calculatePlaceDataQuality } from '../utils/dataQuality';
import { hasDivulgaContent } from '../utils/formatters';

interface PlaceEditorModalProps {
  place: Place | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPlace: Place) => Promise<void>;
  adminApiKey?: string;
  adminSessionToken?: string | null;
}

type EditorTab = 'info' | 'price' | 'hours' | 'links' | 'divulga' | 'media' | 'google';

const DAYS_OF_WEEK = [
  { key: 'seg', label: 'Segunda-feira' },
  { key: 'ter', label: 'Terça-feira' },
  { key: 'qua', label: 'Quarta-feira' },
  { key: 'qui', label: 'Quinta-feira' },
  { key: 'sex', label: 'Sexta-feira' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' }
];

export const PlaceEditorModal: React.FC<PlaceEditorModalProps> = ({
  place,
  isOpen,
  onClose,
  onSave,
  adminApiKey,
  adminSessionToken
}) => {
  if (!isOpen || !place) return null;

  const [activeTab, setActiveTab] = useState<EditorTab>('info');
  const [formData, setFormData] = useState<Place>({ ...place });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Media Form state
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaCaption, setNewMediaCaption] = useState('');
  const [newMediaSource, setNewMediaSource] = useState<MediaSource>('duo21');
  const [newMediaIsHero, setNewMediaIsHero] = useState(false);

  // Google Places Preview state
  const [googleSearchQuery, setGoogleSearchQuery] = useState(`${place.name} ${place.city}`);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleCandidateResult, setGoogleCandidateResult] = useState<any>(null);
  const [googleImportOptions, setGoogleImportOptions] = useState({
    importHours: true,
    importRating: true,
    importAddress: true,
    importPhone: true,
    importWebsite: true,
    importCoordinates: true
  });

  // Schedule parse state for Mon-Sun
  const [scheduleState, setScheduleState] = useState<Record<string, { isOpen: boolean; openTime: string; closeTime: string }>>(() => {
    const state: Record<string, { isOpen: boolean; openTime: string; closeTime: string }> = {};
    const hours = place.opening_hours || {};

    DAYS_OF_WEEK.forEach(day => {
      const val = hours[day.key] || '';
      if (!val || val.toLowerCase().includes('fechado') || val.toLowerCase().includes('não abre')) {
        state[day.key] = { isOpen: false, openTime: '09:00', closeTime: '18:00' };
      } else {
        const timeMatch = val.match(/(\d{1,2}:\d{2})\s*[-–a]\s*(\d{1,2}:\d{2})/);
        if (timeMatch) {
          state[day.key] = { isOpen: true, openTime: timeMatch[1], closeTime: timeMatch[2] };
        } else {
          state[day.key] = { isOpen: true, openTime: '09:00', closeTime: '18:00' };
        }
      }
    });
    return state;
  });

  useEffect(() => {
    setFormData({ ...place });
    setGoogleSearchQuery(`${place.name} ${place.city}`);
    setError(null);
    setSuccessMessage(null);
  }, [place]);

  // Live quality report
  const qualityReport = calculatePlaceDataQuality(formData);
  const isDivulgaActive = hasDivulgaContent(formData);

  const handleFieldChange = (field: keyof Place, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePriceInfoChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      price_info: {
        ...prev.price_info,
        [field]: value
      }
    }));
  };

  const handleScheduleToggle = (dayKey: string, isOpen: boolean) => {
    setScheduleState(prev => {
      const updated = {
        ...prev,
        [dayKey]: { ...prev[dayKey], isOpen }
      };
      syncScheduleToFormData(updated, formData.always_open);
      return updated;
    });
  };

  const handleScheduleTimeChange = (dayKey: string, field: 'openTime' | 'closeTime', time: string) => {
    setScheduleState(prev => {
      const updated = {
        ...prev,
        [dayKey]: { ...prev[dayKey], [field]: time }
      };
      syncScheduleToFormData(updated, formData.always_open);
      return updated;
    });
  };

  const syncScheduleToFormData = (
    sched: Record<string, { isOpen: boolean; openTime: string; closeTime: string }>,
    alwaysOpen?: boolean
  ) => {
    if (alwaysOpen) {
      const fullOpen: Record<string, string> = {};
      DAYS_OF_WEEK.forEach(d => { fullOpen[d.key] = 'Aberto 24h'; });
      setFormData(prev => ({ ...prev, opening_hours: fullOpen, always_open: true }));
      return;
    }

    const newOpeningHours: Record<string, string> = {};
    DAYS_OF_WEEK.forEach(d => {
      const item = sched[d.key];
      if (item && item.isOpen) {
        newOpeningHours[d.key] = `${item.openTime} - ${item.closeTime}`;
      } else {
        newOpeningHours[d.key] = 'Fechado';
      }
    });

    setFormData(prev => ({
      ...prev,
      opening_hours: newOpeningHours,
      always_open: false
    }));
  };

  // Hotfix 10A.2 Section 2: Client-side Image Optimization Pipeline
  const optimizeImageForUpload = async (file: File): Promise<{
    imageData: string;
    thumbnailData: string;
    mimeType: string;
    width: number;
    height: number;
  }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Erro ao ler arquivo da imagem'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Formato de imagem inválido ou corrompido'));
        img.onload = () => {
          const origWidth = img.width;
          const origHeight = img.height;

          // 1. Scaled Hero/Detail canvas (max 1600px)
          const maxDimension = 1600;
          let targetWidth = origWidth;
          let targetHeight = origHeight;
          if (targetWidth > maxDimension || targetHeight > maxDimension) {
            if (targetWidth > targetHeight) {
              targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
              targetWidth = maxDimension;
            } else {
              targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
              targetHeight = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve({
              imageData: e.target?.result as string,
              thumbnailData: e.target?.result as string,
              mimeType: file.type || 'image/jpeg',
              width: origWidth,
              height: origHeight
            });
          }

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          let dataUrl = canvas.toDataURL('image/webp', 0.85);
          let mimeType = 'image/webp';
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            mimeType = 'image/jpeg';
          }

          // 2. Thumbnail canvas (max 300px)
          const thumbCanvas = document.createElement('canvas');
          const thumbMax = 300;
          let thumbW = targetWidth;
          let thumbH = targetHeight;
          if (thumbW > thumbMax || thumbH > thumbMax) {
            if (thumbW > thumbH) {
              thumbH = Math.round((thumbH * thumbMax) / thumbW);
              thumbW = thumbMax;
            } else {
              thumbW = Math.round((thumbW * thumbMax) / thumbH);
              thumbH = thumbMax;
            }
          }
          thumbCanvas.width = thumbW;
          thumbCanvas.height = thumbH;
          const thumbCtx = thumbCanvas.getContext('2d');
          let thumbUrl = dataUrl;
          if (thumbCtx) {
            thumbCtx.drawImage(canvas, 0, 0, thumbW, thumbH);
            thumbUrl = thumbCanvas.toDataURL('image/webp', 0.80);
          }

          resolve({
            imageData: dataUrl,
            thumbnailData: thumbUrl,
            mimeType,
            width: targetWidth,
            height: targetHeight
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
    const headers: Record<string, string> = { ...extraHeaders };
    if (adminApiKey) {
      headers['x-admin-key'] = adminApiKey;
    }
    if (adminSessionToken) {
      headers['x-admin-session'] = adminSessionToken;
    }
    return headers;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Extension & MIME validation
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];

    if (!validMimes.includes(file.type.toLowerCase()) && (!ext || !validExts.includes(ext))) {
      setError('Formato inválido. Apenas imagens JPG, JPEG, PNG e WEBP são permitidas.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Size limit (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('O arquivo excede o limite máximo permitido de 10MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const optimized = await optimizeImageForUpload(file);
      const res = await fetch(`/api/admin/places/${formData.id}/media/upload`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          place_id: formData.id,
          slug: formData.slug,
          place_name: formData.name,
          imageData: optimized.imageData,
          thumbnailData: optimized.thumbnailData,
          fileName: file.name,
          mimeType: optimized.mimeType,
          caption: newMediaCaption.trim() || file.name.replace(/\.[^/.]+$/, ''),
          isHero: newMediaIsHero,
          source: newMediaSource || 'duo21'
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha no upload da foto');
      }

      const resData = await res.json();
      if (resData.place?.media) {
        setFormData(prev => ({ ...prev, media: resData.place.media }));
      } else if (resData.media) {
        const current = Array.isArray(formData.media) ? [...formData.media] : [];
        if (resData.media.is_hero) {
          current.forEach(m => { m.is_hero = false; });
        }
        setFormData(prev => ({ ...prev, media: [...current, resData.media] }));
      }

      setSuccessMessage('Foto enviada e otimizada com sucesso!');
      setNewMediaCaption('');
      setNewMediaIsHero(false);
    } catch (err: any) {
      setError(`Erro ao enviar foto: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Add media handler (Secondary option by URL)
  const handleAddMedia = () => {
    if (!newMediaUrl.trim().startsWith('http')) {
      setError('Por favor, informe uma URL de imagem válida (começando com http:// ou https://).');
      return;
    }

    const newMedia: PlaceMedia = {
      id: `media_${Date.now()}`,
      url: newMediaUrl.trim(),
      caption: newMediaCaption.trim() || undefined,
      source: newMediaSource,
      is_hero: newMediaIsHero,
      active: true,
      order: (formData.media?.length || 0) + 1
    };

    const currentMedia = Array.isArray(formData.media) ? [...formData.media] : [];
    if (newMediaIsHero) {
      currentMedia.forEach(m => { m.is_hero = false; });
    }

    setFormData(prev => ({
      ...prev,
      media: [...currentMedia, newMedia]
    }));

    setNewMediaUrl('');
    setNewMediaCaption('');
    setNewMediaIsHero(false);
    setError(null);
  };

  const handleSetHeroMedia = (mediaUrl: string) => {
    const updated = (formData.media || []).map(m => ({
      ...m,
      is_hero: m.url === mediaUrl
    }));
    setFormData(prev => ({ ...prev, media: updated }));
  };

  const handleRemoveMedia = async (mediaItem: PlaceMedia) => {
    const mediaIdOrUrl = mediaItem.id || mediaItem.url;
    try {
      await fetch(`/api/admin/places/${formData.id}/media/${encodeURIComponent(mediaIdOrUrl)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      }).catch(() => {});
    } catch {
      // Local removal proceeds
    }

    const updated = (formData.media || []).filter(m => m.url !== mediaItem.url && m.id !== mediaItem.id);
    if (updated.length > 0 && !updated.some(m => m.is_hero)) {
      updated[0].is_hero = true;
    }
    setFormData(prev => ({ ...prev, media: updated }));
  };

  const handleMoveMedia = async (index: number, direction: 'up' | 'down') => {
    const current = Array.isArray(formData.media) ? [...formData.media] : [];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= current.length) return;

    const [item] = current.splice(index, 1);
    current.splice(targetIdx, 0, item);
    const reordered = current.map((m, idx) => ({ ...m, order: idx + 1 }));
    setFormData(prev => ({ ...prev, media: reordered }));

    try {
      await fetch(`/api/admin/places/${formData.id}/media/reorder`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ media: reordered })
      });
    } catch {
      // Local reordering is preserved and saved on submit
    }
  };

  // Google Places Preview
  const handleSearchGooglePlaces = async () => {
    setGoogleLoading(true);
    setGoogleCandidateResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/admin/places/${place.id}/google-preview`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ query: googleSearchQuery })
      });

      const data = await res.json();
      setGoogleCandidateResult(data);
    } catch (err: any) {
      setError(`Falha ao buscar no Google Places: ${err.message}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Google Places Controlled Import
  const handleApplyGoogleImport = async () => {
    if (!googleCandidateResult?.candidate) return;
    setGoogleLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/places/${place.id}/google-import`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          candidate: googleCandidateResult.candidate,
          options: googleImportOptions
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Falha na importação');
      }

      const json = await res.json();
      if (json.place) {
        setFormData(json.place);
        setSuccessMessage('Dados sincronizados com sucesso a partir do Google Places!');
      }
    } catch (err: any) {
      setError(`Erro na importação: ${err.message}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSaveModal = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(formData);
      setSuccessMessage('Local salvo com sucesso!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar alterações do local.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#FAF9F6] w-full max-w-4xl rounded-3xl border border-[#E7DFCE] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-[#E7DFCE] flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-[#1B4332] bg-[#EBF3EE] px-2 py-0.5 rounded-md">
                {formData.city}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A6F5D] bg-[#FAF9F6] border border-[#E7DFCE] px-2 py-0.5 rounded-md">
                {formData.category}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                formData.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {formData.active ? 'Ativo no Catálogo' : 'Inativo / Oculto'}
              </span>

              {/* Data Quality Badge */}
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                qualityReport.label === 'Completo' ? 'bg-emerald-100 text-emerald-800' :
                qualityReport.label === 'Bom' ? 'bg-blue-100 text-blue-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                <Star className="w-3 h-3 fill-current" />
                Qualidade: {qualityReport.score}% ({qualityReport.label})
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-[#1E293B] truncate mt-1">
              {formData.name}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveModal}
              disabled={isSaving}
              className="px-4 py-2 bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#64748B] hover:text-[#1E293B] hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-[#FAF6EE] px-4 border-b border-[#E7DFCE] flex gap-1 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'info'
                ? 'border-[#1B4332] text-[#1B4332]'
                : 'border-transparent text-[#7A6F5D] hover:text-[#1E293B]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>A) Informações</span>
          </button>
          <button
            onClick={() => setActiveTab('price')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'price'
                ? 'border-[#1B4332] text-[#1B4332]'
                : 'border-transparent text-[#7A6F5D] hover:text-[#1E293B]'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>B) Preço</span>
          </button>
          <button
            onClick={() => setActiveTab('hours')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'hours'
                ? 'border-[#1B4332] text-[#1B4332]'
                : 'border-transparent text-[#7A6F5D] hover:text-[#1E293B]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>C) Horários</span>
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'links'
                ? 'border-[#1B4332] text-[#1B4332]'
                : 'border-transparent text-[#7A6F5D] hover:text-[#1E293B]'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Links Confiáveis</span>
          </button>
          <button
            onClick={() => setActiveTab('divulga')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'divulga'
                ? 'border-[#1B4332] text-[#1B4332]'
                : 'border-transparent text-[#7A6F5D] hover:text-[#1E293B]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Divulga Lugares {isDivulgaActive && '⭐'}</span>
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'media'
                ? 'border-[#1B4332] text-[#1B4332]'
                : 'border-transparent text-[#7A6F5D] hover:text-[#1E293B]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Mídia / Fotos ({formData.media?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('google')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'google'
                ? 'border-[#1B4332] text-[#1B4332]'
                : 'border-transparent text-[#7A6F5D] hover:text-[#1E293B]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Google Places (New)</span>
          </button>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* TAB A: INFORMAÇÕES */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-[#64748B] block mb-1">Nome do Local</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs font-bold text-[#1E293B] outline-none focus:border-[#1B4332]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] block mb-1">Cidade</label>
                  <select
                    value={formData.city}
                    onChange={(e) => handleFieldChange('city', e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs font-bold text-[#1E293B] outline-none focus:border-[#1B4332]"
                  >
                    <option value="Gramado">Gramado</option>
                    <option value="Canela">Canela</option>
                    <option value="Nova Petrópolis">Nova Petrópolis</option>
                    <option value="Bento Gonçalves">Bento Gonçalves</option>
                    <option value="Cambará do Sul">Cambará do Sul</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] block mb-1">Categoria</label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs font-bold text-[#1E293B] outline-none focus:border-[#1B4332]"
                  >
                    <option value="atrativo">Atrativo / Parque</option>
                    <option value="restaurante">Restaurante</option>
                    <option value="cafe">Café</option>
                    <option value="museu">Museu</option>
                    <option value="vinicola">Vinícola</option>
                    <option value="chocolate">Chocolate</option>
                    <option value="mirante">Mirante</option>
                    <option value="compras">Compras</option>
                    <option value="noturno">Noturno / Bar</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#64748B] block mb-1">Duração Estimada (min)</label>
                  <input
                    type="number"
                    value={formData.average_duration_minutes || 90}
                    onChange={(e) => handleFieldChange('average_duration_minutes', parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs font-bold text-[#1E293B] outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#64748B] block mb-1">Ambiente (Clima)</label>
                  <select
                    value={formData.indoor_type || 'outdoor'}
                    onChange={(e) => handleFieldChange('indoor_type', e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs font-bold text-[#1E293B] outline-none focus:border-[#1B4332]"
                  >
                    <option value="indoor">🌧️ Indoor (100% Coberto)</option>
                    <option value="outdoor">☀️ Outdoor (Ar Livre)</option>
                    <option value="mixed">⛅ Misto (Coberto e Ar Livre)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#64748B] block mb-1">Descrição Curatorial</label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Descreva o que torna esse local especial para o viajante..."
                  className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#334155] outline-none focus:border-[#1B4332]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#64748B] block mb-1">Endereço Completo</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none focus:border-[#1B4332]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude || ''}
                    onChange={(e) => handleFieldChange('latitude', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude || ''}
                    onChange={(e) => handleFieldChange('longitude', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="p-4 bg-white rounded-2xl border border-[#E7DFCE] space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A6F5D] block">
                  Atributos Práticos de Experiência
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold text-[#1E293B]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.children_friendly ?? true}
                      onChange={(e) => handleFieldChange('children_friendly', e.target.checked)}
                      className="rounded text-[#1B4332]"
                    />
                    <span>👶 Crianças</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.pet_friendly ?? false}
                      onChange={(e) => handleFieldChange('pet_friendly', e.target.checked)}
                      className="rounded text-[#1B4332]"
                    />
                    <span>🐾 Pets Permitidos</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.accessible ?? true}
                      onChange={(e) => handleFieldChange('accessible', e.target.checked)}
                      className="rounded text-[#1B4332]"
                    />
                    <span>♿ Acessível</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.reservation_required ?? false}
                      onChange={(e) => handleFieldChange('reservation_required', e.target.checked)}
                      className="rounded text-[#1B4332]"
                    />
                    <span>📅 Reserva Necessária</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB B: PREÇO */}
          {activeTab === 'price' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border border-[#E7DFCE] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1E293B]">Tabela de Preços e Acesso</span>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#1B4332] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.price_info?.is_free ?? false}
                      onChange={(e) => {
                        const isFree = e.target.checked;
                        handlePriceInfoChange('is_free', isFree);
                        if (isFree) {
                          handlePriceInfoChange('adult_price', 0);
                          handlePriceInfoChange('child_price', 0);
                        }
                      }}
                      className="rounded text-[#1B4332]"
                    />
                    <span>Entrada Gratuita (Público / Acesso Livre)</span>
                  </label>
                </div>

                {!formData.price_info?.is_free && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-[#64748B] block mb-1">Preço Adulto (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price_info?.adult_price || 0}
                        onChange={(e) => handlePriceInfoChange('adult_price', parseFloat(e.target.value) || 0)}
                        className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs font-bold text-[#1E293B] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#64748B] block mb-1">Preço Criança (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price_info?.child_price || 0}
                        onChange={(e) => handlePriceInfoChange('child_price', parseFloat(e.target.value) || 0)}
                        className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs font-bold text-[#1E293B] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#64748B] block mb-1">Faixa de Preço (1-4)</label>
                      <select
                        value={formData.price_level || 2}
                        onChange={(e) => handleFieldChange('price_level', parseInt(e.target.value) || 2)}
                        className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs font-bold text-[#1E293B] outline-none"
                      >
                        <option value={1}>$ - Econômico / Gratuito</option>
                        <option value={2}>$$ - Moderado</option>
                        <option value={3}>$$$ - Premium</option>
                        <option value={4}>$$$$ - Luxo</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-[#64748B] block mb-1">Observações de Preço</label>
                  <input
                    type="text"
                    value={formData.price_notes || ''}
                    onChange={(e) => handleFieldChange('price_notes', e.target.value)}
                    placeholder="Ex: Meia entrada para estudantes e idosos; crianças até 4 anos não pagam."
                    className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] block mb-1">Fonte do Preço</label>
                    <input
                      type="text"
                      value={formData.price_info?.source_name || 'Curadoria DUO21'}
                      onChange={(e) => handlePriceInfoChange('source_name', e.target.value)}
                      className="w-full p-2 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] block mb-1">Válido Até</label>
                    <input
                      type="date"
                      value={formData.price_valid_until || ''}
                      onChange={(e) => handleFieldChange('price_valid_until', e.target.value)}
                      className="w-full p-2 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] block mb-1">Checado Em</label>
                    <input
                      type="date"
                      value={formData.price_info?.checked_at?.substring(0, 10) || new Date().toISOString().substring(0, 10)}
                      onChange={(e) => handlePriceInfoChange('checked_at', e.target.value)}
                      className="w-full p-2 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB C: HORÁRIOS */}
          {activeTab === 'hours' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border border-[#E7DFCE] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F1EBE0]">
                  <div>
                    <span className="text-xs font-bold text-[#1E293B] block">Programação Semanal</span>
                    <span className="text-[11px] text-[#7A6F5D]">
                      Nunca interpretamos ausência de horário como fechado.
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#1B4332] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.always_open ?? false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        handleFieldChange('always_open', checked);
                        syncScheduleToFormData(scheduleState, checked);
                      }}
                      className="rounded text-[#1B4332]"
                    />
                    <span>Sempre Aberto (24h)</span>
                  </label>
                </div>

                {formData.always_open ? (
                  <div className="p-4 bg-emerald-50 rounded-xl text-emerald-800 text-xs font-bold text-center">
                    ✅ Este local está configurado como &quot;Sempre Aberto 24 Horas&quot; (Parques abertos, praças, mirantes públicos).
                  </div>
                ) : (
                  <div className="space-y-2">
                    {DAYS_OF_WEEK.map(d => {
                      const item = scheduleState[d.key] || { isOpen: true, openTime: '09:00', closeTime: '18:00' };
                      return (
                        <div key={d.key} className="flex items-center justify-between p-2 rounded-xl bg-[#FAF9F6] border border-[#F1EBE0] text-xs">
                          <span className="font-bold text-[#1E293B] w-28 uppercase text-[11px]">
                            {d.label}
                          </span>

                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.isOpen}
                                onChange={(e) => handleScheduleToggle(d.key, e.target.checked)}
                                className="rounded text-[#1B4332]"
                              />
                              <span className={item.isOpen ? 'font-bold text-emerald-700' : 'text-[#64748B]'}>
                                {item.isOpen ? 'Aberto' : 'Fechado'}
                              </span>
                            </label>

                            {item.isOpen && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="time"
                                  value={item.openTime}
                                  onChange={(e) => handleScheduleTimeChange(d.key, 'openTime', e.target.value)}
                                  className="p-1 bg-white border border-[#E7DFCE] rounded font-bold text-xs"
                                />
                                <span className="text-[#7A6F5D]">até</span>
                                <input
                                  type="time"
                                  value={item.closeTime}
                                  onChange={(e) => handleScheduleTimeChange(d.key, 'closeTime', e.target.value)}
                                  className="p-1 bg-white border border-[#E7DFCE] rounded font-bold text-xs"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB D: LINKS CONFIÁVEIS */}
          {activeTab === 'links' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border border-[#E7DFCE] space-y-3">
                <div>
                  <span className="text-xs font-bold text-[#1E293B] block">Links Confiáveis e Validados</span>
                  <span className="text-[11px] text-[#7A6F5D]">
                    Apenas URLs reais e testadas são expostas aos turistas. Gemini jamais inventa links.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] flex items-center gap-1 mb-1">
                      <Globe className="w-3.5 h-3.5 text-[#1B4332]" />
                      Site Oficial (official_url)
                    </label>
                    <input
                      type="url"
                      value={formData.official_url || formData.website || ''}
                      onChange={(e) => {
                        handleFieldChange('official_url', e.target.value);
                        handleFieldChange('website', e.target.value);
                      }}
                      placeholder="https://exemplo.com.br"
                      className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] flex items-center gap-1 mb-1">
                      <Instagram className="w-3.5 h-3.5 text-pink-600" />
                      Instagram Oficial (instagram_url)
                    </label>
                    <input
                      type="url"
                      value={formData.instagram_url || formData.instagram || ''}
                      onChange={(e) => {
                        handleFieldChange('instagram_url', e.target.value);
                        handleFieldChange('instagram', e.target.value);
                      }}
                      placeholder="https://instagram.com/perfil"
                      className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] flex items-center gap-1 mb-1">
                      <Ticket className="w-3.5 h-3.5 text-amber-600" />
                      Ingressos Oficiais (ticket_url)
                    </label>
                    <input
                      type="url"
                      value={formData.ticket_url || ''}
                      onChange={(e) => handleFieldChange('ticket_url', e.target.value)}
                      placeholder="https://loja.exemplo.com.br/ingressos"
                      className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] flex items-center gap-1 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      Google Maps URL (maps_url)
                    </label>
                    <input
                      type="url"
                      value={formData.maps_url || ''}
                      onChange={(e) => handleFieldChange('maps_url', e.target.value)}
                      placeholder="https://maps.google.com/..."
                      className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] flex items-center gap-1 mb-1">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      WhatsApp (apenas números com DDD)
                    </label>
                    <input
                      type="text"
                      value={formData.whatsapp || ''}
                      onChange={(e) => handleFieldChange('whatsapp', e.target.value)}
                      placeholder="54999999999"
                      className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] flex items-center gap-1 mb-1">
                      <Phone className="w-3.5 h-3.5 text-[#1B4332]" />
                      Telefone Fixo / Geral (phone)
                    </label>
                    <input
                      type="text"
                      value={formData.phone || ''}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      placeholder="(54) 3286-0000"
                      className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB E: CONTEÚDO DIVULGA LUGARES */}
          {activeTab === 'divulga' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#FAF6EE] rounded-2xl border border-[#E2D5BE] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#E2D5BE]">
                  <div>
                    <span className="text-xs font-bold text-[#1B4332] block flex items-center gap-1">
                      <Sparkles className="w-4 h-4 fill-amber-500 text-amber-500" />
                      Curadoria & Conteúdo Divulga Lugares
                    </span>
                    <span className="text-[11px] text-[#7A6F5D]">
                      Sprint 10A Section 5: O selo ⭐ Dica Divulga Lugares aparece SOMENTE se o conteúdo estiver ativado E possuir URL válida.
                    </span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-[#E2D5BE]">
                    <input
                      type="checkbox"
                      checked={formData.divulga_content_active ?? false}
                      onChange={(e) => handleFieldChange('divulga_content_active', e.target.checked)}
                      className="rounded text-[#1B4332]"
                    />
                    <span className="text-xs font-bold text-[#1B4332]">Ativar Conteúdo</span>
                  </label>
                </div>

                {/* Badge Status Preview */}
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  isDivulgaActive 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  {isDivulgaActive ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span><strong>Selo Ativo:</strong> ⭐ Dica Divulga Lugares será exibida para os turistas deste local com botão &quot;Veja nossa experiência&quot;.</span>
                    </>
                  ) : (
                    <>
                      <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span><strong>Selo Inativo:</strong> Para exibir o selo, ative o conteúdo acima e informe ao menos um link de Reel, YouTube ou TikTok válido.</span>
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] block mb-1">Título da Dica / Experiência</label>
                    <input
                      type="text"
                      value={formData.divulga_content_title || ''}
                      onChange={(e) => handleFieldChange('divulga_content_title', e.target.value)}
                      placeholder="Ex: Nossa experiência no café colonial"
                      className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-[#64748B] block mb-1">Instagram Reel URL</label>
                      <input
                        type="url"
                        value={formData.divulga_instagram_url || ''}
                        onChange={(e) => handleFieldChange('divulga_instagram_url', e.target.value)}
                        placeholder="https://instagram.com/reel/..."
                        className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#64748B] block mb-1">YouTube Video / Shorts</label>
                      <input
                        type="url"
                        value={formData.divulga_youtube_url || ''}
                        onChange={(e) => handleFieldChange('divulga_youtube_url', e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                        className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#64748B] block mb-1">TikTok Video URL</label>
                      <input
                        type="url"
                        value={formData.divulga_tiktok_url || ''}
                        onChange={(e) => handleFieldChange('divulga_tiktok_url', e.target.value)}
                        placeholder="https://tiktok.com/@.../video/..."
                        className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                      />
                    </div>
                    {/* Hotfix 10A.2 Section 6: DUO21 / Divulga Article URL */}
                    <div>
                      <label className="text-[11px] font-bold text-[#64748B] block mb-1">Artigo / Guia DUO21 ou Divulga Lugares</label>
                      <input
                        type="url"
                        value={formData.divulga_article_url || ''}
                        onChange={(e) => handleFieldChange('divulga_article_url', e.target.value)}
                        placeholder="https://duo21.com.br/artigos/guia-ou-roteiro..."
                        className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs text-[#1E293B] outline-none"
                      />
                      <span className="text-[10px] text-[#7A6F5D] mt-0.5 block">
                        Permite ao turista acessar o guia ou matéria completa sobre o local.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB F: MÍDIA & FOTOS (Hotfix 10A.2: Upload Principal + Otimização) */}
          {activeTab === 'media' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border border-[#E7DFCE] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#F1EBE0]">
                  <div>
                    <span className="text-xs font-bold text-[#1E293B] block">Galeria e Prioridade de Fotos</span>
                    <span className="text-[11px] text-[#7A6F5D]">
                      Prioridade: 1. DUO21/manual &gt; 2. Parceiro &gt; 3. Oficial &gt; 4. Google Places. Fotos manuais nunca são sobrescritas.
                    </span>
                  </div>
                </div>

                {/* 1. OPÇÃO PRINCIPAL: Upload de Arquivo Local com Otimização */}
                <div className="p-4 bg-[#FAF9F6] rounded-xl border-2 border-dashed border-[#D8C9AE] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-[#1B4332] flex items-center gap-1.5">
                        <Upload className="w-4 h-4 text-[#1B4332]" />
                        Upload Direto de Fotos (Opção Principal)
                      </span>
                      <span className="text-[11px] text-[#64748B] block mt-0.5">
                        Formatos permitidos: JPG, JPEG, PNG, WEBP (limite máx. 10MB). Otimização e compressão automática WebP.
                      </span>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      className="hidden"
                      id="place-media-file-input"
                    />

                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Otimizando & Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>[ + Enviar foto ]</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#F1EBE0]">
                    <div>
                      <input
                        type="text"
                        value={newMediaCaption}
                        onChange={(e) => setNewMediaCaption(e.target.value)}
                        placeholder="Legenda da foto (opcional antes de enviar)"
                        className="w-full p-2 bg-white border border-[#E7DFCE] rounded-lg text-xs outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-[#475569] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newMediaIsHero}
                          onChange={(e) => setNewMediaIsHero(e.target.checked)}
                          className="rounded text-[#1B4332]"
                        />
                        <span>Definir próximo upload como Foto de Capa</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 2. OPÇÃO SECUNDÁRIA: Adicionar por URL */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowUrlForm(!showUrlForm)}
                    className="text-xs font-semibold text-[#1B4332] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showUrlForm ? '− Ocultar opção por URL' : '+ Adicionar por URL (Opção secundária)'}</span>
                  </button>

                  {showUrlForm && (
                    <div className="mt-2 p-3 bg-[#FAF9F6] rounded-xl border border-[#E7DFCE] space-y-3">
                      <span className="text-xs font-bold text-[#7A6F5D] block">Vincular Imagem Hospedada</span>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div className="sm:col-span-2">
                          <input
                            type="url"
                            value={newMediaUrl}
                            onChange={(e) => setNewMediaUrl(e.target.value)}
                            placeholder="URL da Imagem (https://...)"
                            className="w-full p-2 bg-white border border-[#E7DFCE] rounded-lg text-xs outline-none"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={newMediaCaption}
                            onChange={(e) => setNewMediaCaption(e.target.value)}
                            placeholder="Legenda da foto"
                            className="w-full p-2 bg-white border border-[#E7DFCE] rounded-lg text-xs outline-none"
                          />
                        </div>
                        <div>
                          <select
                            value={newMediaSource}
                            onChange={(e) => setNewMediaSource(e.target.value as MediaSource)}
                            className="w-full p-2 bg-white border border-[#E7DFCE] rounded-lg text-xs font-bold outline-none"
                          >
                            <option value="duo21">DUO21 / Manual (Prioritária)</option>
                            <option value="partner">Parceiro Oficial</option>
                            <option value="official">Institucional Oficial</option>
                            <option value="google_places">Google Places</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-1.5 text-xs text-[#475569] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newMediaIsHero}
                            onChange={(e) => setNewMediaIsHero(e.target.checked)}
                            className="rounded text-[#1B4332]"
                          />
                          <span>Definir imediatamente como Foto de Capa</span>
                        </label>

                        <button
                          type="button"
                          onClick={handleAddMedia}
                          className="px-3 py-1.5 bg-[#1B4332] text-white text-xs font-bold rounded-lg hover:bg-[#143326] transition-colors"
                        >
                          + Inserir Foto por URL
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Media list */}
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A6F5D] block">
                    Fotos Cadastradas ({formData.media?.length || 0})
                  </span>

                  {(!formData.media || formData.media.length === 0) ? (
                    <div className="p-6 text-center text-xs text-[#64748B] bg-[#FAF9F6] rounded-xl border border-[#F1EBE0]">
                      Nenhuma foto cadastrada ainda. Clique em <strong>[ + Enviar foto ]</strong> acima para cadastrar a primeira foto.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {formData.media.map((m, idx) => (
                        <div key={idx} className="flex gap-3 p-2.5 bg-[#FAF9F6] rounded-xl border border-[#E7DFCE] items-center">
                          <img
                            src={m.thumbnail_url || m.url}
                            alt={m.caption || 'Foto do local'}
                            className="w-16 h-16 object-cover rounded-lg shrink-0 border border-[#E7DFCE]"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {m.is_hero && (
                                <span className="text-[10px] font-extrabold bg-[#1B4332] text-white px-2 py-0.5 rounded">
                                  CAPA
                                </span>
                              )}
                              <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                                {m.source || 'duo21'}
                              </span>
                            </div>
                            <p className="text-xs text-[#1E293B] truncate mt-1">{m.caption || 'Sem legenda'}</p>
                            
                            <div className="flex items-center gap-2 mt-2">
                              {!m.is_hero && (
                                <button
                                  type="button"
                                  onClick={() => handleSetHeroMedia(m.url)}
                                  className="text-[10px] font-bold text-[#1B4332] hover:underline cursor-pointer"
                                >
                                  Tornar Capa
                                </button>
                              )}
                              <div className="flex items-center gap-1">
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveMedia(idx, 'up')}
                                    title="Mover para cima"
                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                )}
                                {formData.media && idx < formData.media.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveMedia(idx, 'down')}
                                    title="Mover para baixo"
                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveMedia(m)}
                                className="text-[10px] font-bold text-rose-600 hover:underline flex items-center gap-0.5 ml-auto cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                Remover
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB G: GOOGLE PLACES (NEW) */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border border-[#E7DFCE] space-y-4">
                <div>
                  <span className="text-xs font-bold text-[#1E293B] block">Identidade Externa & Google Places API (New)</span>
                  <span className="text-[11px] text-[#7A6F5D]">
                    Sprint 10A Section 7 & 8: O Google Place ID permite sincronização controlada sob demanda via FieldMasks cirúrgicos.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] block mb-1">Google Place ID</label>
                    <input
                      type="text"
                      value={formData.google_place_id || ''}
                      onChange={(e) => handleFieldChange('google_place_id', e.target.value)}
                      placeholder="ChIJ..."
                      className="w-full p-2.5 bg-white border border-[#E7DFCE] rounded-xl text-xs font-mono text-[#1E293B] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] block mb-1">Status de Sincronização</label>
                    <input
                      type="text"
                      readOnly
                      value={formData.google_sync_status || 'NOT_SYNCED'}
                      className="w-full p-2.5 bg-slate-50 border border-[#E7DFCE] rounded-xl text-xs font-bold text-[#64748B]"
                    />
                  </div>
                </div>

                {/* Candidate Resolution Box */}
                <div className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#E7DFCE] space-y-3">
                  <span className="text-xs font-bold text-[#1B4332] block">Resolução de Candidato no Google Places</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={googleSearchQuery}
                      onChange={(e) => setGoogleSearchQuery(e.target.value)}
                      placeholder="Termo de busca (ex: Lago Negro Gramado)"
                      className="flex-1 p-2 bg-white border border-[#E7DFCE] rounded-xl text-xs outline-none"
                    />
                    <button
                      onClick={handleSearchGooglePlaces}
                      disabled={googleLoading}
                      className="px-4 py-2 bg-[#1B4332] text-white text-xs font-bold rounded-xl hover:bg-[#143326] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>{googleLoading ? 'Buscando...' : 'Buscar Candidato'}</span>
                    </button>
                  </div>

                  {googleCandidateResult && (
                    <div className="mt-3 p-3 bg-white rounded-xl border border-[#E7DFCE] space-y-3">
                      {googleCandidateResult.status === 'CONFIGURATION_REQUIRED' ? (
                        <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs">
                          ⚠️ {googleCandidateResult.message || 'Google Places ainda não configurado (GOOGLE_MAPS_API_KEY ausente ou GOOGLE_PLACES_ENABLED=false). A aplicação está pronta para receber a chave sem alterar nenhuma arquitetura.'}
                        </div>
                      ) : googleCandidateResult.status === 'NO_MATCH' ? (
                        <div className="p-3 bg-slate-100 text-slate-700 rounded-lg text-xs">
                          Nenhum local correspondente encontrado no Google Places para &quot;{googleSearchQuery}&quot;.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-[#F1EBE0]">
                            <div>
                              <h4 className="text-xs font-bold text-[#1B4332]">
                                Candidato: {googleCandidateResult.candidate?.name}
                              </h4>
                              <p className="text-[11px] text-[#64748B]">
                                Place ID: {googleCandidateResult.candidate?.google_place_id} • Nota: {googleCandidateResult.candidate?.rating} ({googleCandidateResult.candidate?.rating_count})
                              </p>
                            </div>
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                              Correspondência Encontrada
                            </span>
                          </div>

                          {/* Comparison Diff Table */}
                          <div className="text-xs space-y-1.5 bg-[#FAF9F6] p-3 rounded-lg border border-[#F1EBE0]">
                            <div className="flex justify-between">
                              <span className="text-[#64748B]">Endereço local vs Google:</span>
                              <span className="font-bold text-[#1E293B]">{googleCandidateResult.comparison?.addressDiff ? 'Diferente' : 'Idêntico'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#64748B]">Novos Horários disponíveis:</span>
                              <span className="font-bold text-[#1E293B]">{googleCandidateResult.comparison?.hasNewHours ? 'Sim' : 'Não'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#64748B]">Telefone disponível:</span>
                              <span className="font-bold text-[#1E293B]">{googleCandidateResult.candidate?.phone || 'Não informado'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#64748B]">Site disponível:</span>
                              <span className="font-bold text-[#1E293B]">{googleCandidateResult.candidate?.website_url || 'Não informado'}</span>
                            </div>
                          </div>

                          {/* Selective Import Checkboxes */}
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-bold text-[#1B4332] block">
                              Selecione os campos para importar (fotos manuais e conteúdo Divulga ficam protegidos):
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={googleImportOptions.importHours}
                                  onChange={(e) => setGoogleImportOptions(prev => ({ ...prev, importHours: e.target.checked }))}
                                  className="rounded text-[#1B4332]"
                                />
                                <span>Horários</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={googleImportOptions.importRating}
                                  onChange={(e) => setGoogleImportOptions(prev => ({ ...prev, importRating: e.target.checked }))}
                                  className="rounded text-[#1B4332]"
                                />
                                <span>Avaliações</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={googleImportOptions.importAddress}
                                  onChange={(e) => setGoogleImportOptions(prev => ({ ...prev, importAddress: e.target.checked }))}
                                  className="rounded text-[#1B4332]"
                                />
                                <span>Endereço</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={googleImportOptions.importCoordinates}
                                  onChange={(e) => setGoogleImportOptions(prev => ({ ...prev, importCoordinates: e.target.checked }))}
                                  className="rounded text-[#1B4332]"
                                />
                                <span>Coordenadas</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={googleImportOptions.importWebsite}
                                  onChange={(e) => setGoogleImportOptions(prev => ({ ...prev, importWebsite: e.target.checked }))}
                                  className="rounded text-[#1B4332]"
                                />
                                <span>Site Oficial</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={googleImportOptions.importPhone}
                                  onChange={(e) => setGoogleImportOptions(prev => ({ ...prev, importPhone: e.target.checked }))}
                                  className="rounded text-[#1B4332]"
                                />
                                <span>Telefone</span>
                              </label>
                            </div>
                          </div>

                          <button
                            onClick={handleApplyGoogleImport}
                            disabled={googleLoading}
                            className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                          >
                            {googleLoading ? 'Importando...' : 'Confirmar Importação Controlada'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#E7DFCE] flex items-center justify-between">
          <div className="text-xs text-[#7A6F5D]">
            Última atualização: {formData.updated_at ? new Date(formData.updated_at).toLocaleString('pt-BR') : 'Hoje'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#475569] text-xs font-bold rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveModal}
              disabled={isSaving}
              className="px-5 py-2 bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Salvando...' : 'Salvar Local'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
