import React, { useState, useEffect, useCallback } from 'react';
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
  ArrowDown,
  Lock,
  Download
} from 'lucide-react';
import { Place, PlaceMedia, MediaSource } from '../types';
import { calculatePlaceDataQuality } from '../utils/dataQuality';
import { hasDivulgaContent } from '../utils/formatters';
import {
  buildPlaceResolutionQuery,
  PlaceCandidateDTO
} from '../services/places/SmartPlaceResolver';

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

  // Google Places Cost Guard & Candidate Search state (Sprint 10B & 10C + Hotfix P1 Smart Resolver)
  const [costGuardMetrics, setCostGuardMetrics] = useState<any>(null);
  const [candidateList, setCandidateList] = useState<PlaceCandidateDTO[]>([]);
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [isLinkingPlaceId, setIsLinkingPlaceId] = useState(false);
  const [candidateToLink, setCandidateToLink] = useState<PlaceCandidateDTO | null>(null);
  const [lowCompatibilityConfirmed, setLowCompatibilityConfirmed] = useState(false);

  // Google Places Details & Controlled Enrichment state (Sprint 10C)
  const [googleSearchQuery, setGoogleSearchQuery] = useState(() => buildPlaceResolutionQuery(place));
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPreCallModal, setShowPreCallModal] = useState(false);
  const [isPreCallForceRefresh, setIsPreCallForceRefresh] = useState(false);
  const [googleDetailsResult, setGoogleDetailsResult] = useState<any | null>(null);
  const [fieldSelections, setFieldSelections] = useState<Record<string, boolean>>({
    name: false,
    address: false,
    latitude: false,
    longitude: false,
    hours: true,
    rating: true,
    ratingCount: true,
    website: false,
    mapsUrl: true,
    phone: false
  });
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isApplyingEnrichment, setIsApplyingEnrichment] = useState(false);

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

  const getAuthHeaders = useCallback((extraHeaders: Record<string, string> = {}) => {
    const headers: Record<string, string> = { ...extraHeaders };
    if (adminApiKey) {
      headers['x-admin-key'] = adminApiKey;
    }
    if (adminSessionToken) {
      headers['x-admin-session'] = adminSessionToken;
    }
    return headers;
  }, [adminApiKey, adminSessionToken]);

  useEffect(() => {
    setFormData({ ...place });
    setGoogleSearchQuery(buildPlaceResolutionQuery(place));
    setError(null);
    setSuccessMessage(null);

    // Fetch live Cost Guard metrics for feature flag status (Sprint 10B)
    fetch('/api/admin/places/costguard', {
      headers: getAuthHeaders(),
      credentials: 'include'
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setCostGuardMetrics(data);
      })
      .catch(() => {});
  }, [place, getAuthHeaders]);

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

  // Sprint 10B & 10C Requirement 2: Search candidates without automatic linking
  const handleSearchCandidates = async () => {
    if (!costGuardMetrics?.enabled) {
      setError('Google Places desativado pelo Cost Guard (GOOGLE_PLACES_ENABLED=false). Nenhuma chamada externa é permitida.');
      return;
    }
    setIsSearchingCandidates(true);
    setCandidateList([]);
    setError(null);

    try {
      const res = await fetch(`/api/admin/places/${place.id}/google-candidates`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ query: googleSearchQuery })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao buscar candidatos');
      if (data.status === 'DISABLED') {
        setError(data.message || 'Google Places desativado.');
      } else if (data.candidates && data.candidates.length > 0) {
        setCandidateList(data.candidates);
      } else {
        setError(`Nenhum candidato encontrado no Google Places para "${googleSearchQuery}".`);
      }
    } catch (err: any) {
      setError(`Erro na busca de candidatos: ${err.message}`);
    } finally {
      setIsSearchingCandidates(false);
    }
  };

  // Sprint 10C Requirement 2 & Hotfix P1: Initiates candidate linking with explicit confirmation modal
  const handleInitiateLinkCandidate = (candidate: PlaceCandidateDTO) => {
    setCandidateToLink(candidate);
    setLowCompatibilityConfirmed(false);
  };

  // Sprint 10C Requirement 2: Confirms linking Google Place ID (saves ONLY google_place_id, preserves UUID & all content)
  const handleConfirmLinkCandidate = async () => {
    if (!candidateToLink) return;
    setIsLinkingPlaceId(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/places/${place.id}/google-link`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ google_place_id: candidateToLink.google_place_id })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Falha ao vincular Place ID');
      }

      setFormData(prev => ({
        ...prev,
        google_place_id: candidateToLink.google_place_id,
        google_sync_status: 'LINKED'
      }));
      setCandidateList([]);
      setCandidateToLink(null);
      setSuccessMessage(
        `Google Place ID "${candidateToLink.google_place_id}" vinculado com sucesso! O UUID interno (${place.id}) e o acervo manual foram 100% preservados.`
      );
    } catch (err: any) {
      setError(`Erro ao vincular Place ID: ${err.message}`);
    } finally {
      setIsLinkingPlaceId(false);
    }
  };

  // Sprint 10C Requirement 3 & 13: Initiates Place Details query (shows Pre-Call Disclosure Modal)
  const handleInitiateGoogleDetails = (forceRefresh = false) => {
    setIsPreCallForceRefresh(forceRefresh);
    setShowPreCallModal(true);
  };

  // Sprint 10C Requirement 3: Executes server-side Place Details (New) fetch
  const handleExecuteFetchGoogleDetails = async () => {
    setShowPreCallModal(false);
    setGoogleLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/places/${place.id}/google-details`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ forceRefresh: isPreCallForceRefresh })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao consultar detalhes no Google Places.');
      if (data.status === 'DISABLED' || data.status === 'BLOCKED_BY_COST_GUARD') {
        setError(data.message || 'Consulta bloqueada pelo Cost Guard.');
        return;
      }

      setGoogleDetailsResult(data);

      if (data.diff) {
        // Intelligently initialize field choices:
        // By default, select fields that have new/different data in Google
        const initialSelections: Record<string, boolean> = {};
        for (const [key, item] of Object.entries(data.diff as Record<string, any>)) {
          const hasGoogleVal = item.google !== undefined && item.google !== null && item.google !== 'Não informado';
          initialSelections[key] = Boolean(item.different && hasGoogleVal);
        }
        setFieldSelections(initialSelections);
      }
    } catch (err: any) {
      setError(`Erro ao consultar Google Places: ${err.message}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Sprint 10C Requirement 9: Toggle decision for a specific field in the DIFF table
  const handleToggleFieldSelection = (fieldKey: string) => {
    setFieldSelections(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  // Sprint 10C Requirement 10: Opens the mandatory preview modal before persisting
  const handleOpenPreviewModal = () => {
    setShowPreviewModal(true);
  };

  // Sprint 10C Requirement 10 & 11: Confirms and persists ONLY the selected fields
  const handleConfirmApplyEnrichment = async () => {
    if (!googleDetailsResult?.googleData) return;
    setIsApplyingEnrichment(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/places/${place.id}/google-apply`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          selectedFields: fieldSelections,
          googleData: googleDetailsResult.googleData
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Falha ao aplicar alterações selecionadas.');
      }

      const json = await res.json();
      if (json.place) {
        setFormData(json.place);
        setShowPreviewModal(false);
        setSuccessMessage('Alterações selecionadas gravadas com sucesso no Supabase! Mídias manuais e campos editoriais DUO21 foram 100% preservados.');
      }
    } catch (err: any) {
      setError(`Erro ao gravar alterações: ${err.message}`);
    } finally {
      setIsApplyingEnrichment(false);
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
          {/* TAB G: GOOGLE PLACES (NEW) — SPRINT 10B */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border border-[#E7DFCE] space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1E293B] block">Identidade Externa & Google Places API (New)</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                      costGuardMetrics?.enabled 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {costGuardMetrics?.enabled ? '🟢 ATIVO NO SERVIDOR' : '⚪ DESATIVADO (COST GUARD)'}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#7A6F5D]">
                    Sprint 10B: Enriquecimento administrativo controlado. Google Places nunca é consultado diretamente pelo turista.
                  </span>
                </div>

                {/* Identity / Link Row */}
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
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={formData.google_sync_status || 'NOT_SYNCED'}
                        className="flex-1 p-2.5 bg-slate-50 border border-[#E7DFCE] rounded-xl text-xs font-bold text-[#64748B]"
                      />
                      {formData.google_place_id && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-2 rounded-xl border border-emerald-200 shrink-0 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Vinculado
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Requirement 8: Candidate Resolution & Explicit Administrator Linking */}
                <div className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#E7DFCE] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1B4332] block">
                      1. Pesquisar Candidatos no Google Places
                    </span>
                    <span className="text-[10px] text-[#7A6F5D]">
                      Resolução por candidato (FieldMask cirúrgico)
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={googleSearchQuery}
                      onChange={(e) => setGoogleSearchQuery(e.target.value)}
                      placeholder="Termo de busca (ex: Lago Negro Gramado)"
                      className="flex-1 p-2 bg-white border border-[#E7DFCE] rounded-xl text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSearchCandidates}
                      disabled={isSearchingCandidates || !costGuardMetrics?.enabled}
                      className="px-4 py-2 bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>{isSearchingCandidates ? 'Buscando...' : 'Buscar Candidatos'}</span>
                    </button>
                  </div>

                  {!costGuardMetrics?.enabled && (
                    <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs flex items-center gap-2 border border-slate-200">
                      <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>
                        <strong>GOOGLE_PLACES_ENABLED=false:</strong> A busca de candidatos está bloqueada pelo Cost Guard até a ativação manual pelo administrador.
                      </span>
                    </div>
                  )}

                  {/* Candidate List (Requirement 8 & Hotfix P1 Smart Place Resolver) */}
                  {candidateList.length > 0 && (
                    <div className="space-y-3 mt-2 pt-2 border-t border-[#E7DFCE]">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#1E293B] block">
                          Candidatos Encontrados ({candidateList.length}) — Ordenados por compatibilidade:
                        </span>
                        <span className="text-[10px] text-[#64748B]">
                          Âncora: Coordenadas & Curadoria DUO21
                        </span>
                      </div>
                      
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {candidateList.map((c, idx) => {
                          const isHigh = c.match_level === 'HIGH';
                          const isMed = c.match_level === 'MEDIUM';
                          const isLow = c.match_level === 'LOW';

                          return (
                            <div
                              key={c.google_place_id || idx}
                              className={`p-3.5 rounded-2xl border transition-all text-xs ${
                                isHigh
                                  ? 'bg-white border-emerald-300 shadow-xs hover:border-emerald-500'
                                  : isMed
                                    ? 'bg-amber-50/30 border-amber-300 hover:border-amber-500'
                                    : 'bg-rose-50/20 border-rose-300 hover:border-rose-400'
                              }`}
                            >
                              {/* Header do Card: Nome e Badge de Compatibilidade */}
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-[#1B4332] text-sm">{c.name}</span>
                                    {idx === 0 && isHigh && (
                                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                                        Mais compatível
                                      </span>
                                    )}
                                  </div>

                                  {/* ⭐ Rating & Quantidade de avaliações */}
                                  <div className="flex items-center gap-1.5 text-xs text-amber-800 font-medium">
                                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                                    <span className="font-bold">
                                      {c.rating ? c.rating.toFixed(1).replace('.', ',') : '—'}
                                    </span>
                                    <span className="text-slate-400">·</span>
                                    <span className="text-slate-600">
                                      {c.userRatingCount ? `${c.userRatingCount.toLocaleString('pt-BR')} avaliações` : 'Sem avaliações'}
                                    </span>
                                  </div>
                                </div>

                                {/* Badge de Compatibilidade 0-100% */}
                                <div className="shrink-0">
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${
                                      isHigh
                                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                        : isMed
                                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                                          : 'bg-rose-100 text-rose-900 border-rose-300'
                                    }`}
                                  >
                                    COMPATIBILIDADE: {c.match_score}% — {isHigh ? 'ALTA' : isMed ? 'MÉDIA' : 'BAIXA'}
                                  </span>
                                </div>
                              </div>

                              {/* Dados Descritivos: Tipos, Endereço, Distância, Place ID */}
                              <div className="mt-2 space-y-1 text-[#475569]">
                                {/* Tipos principais formatados */}
                                <div className="text-[11px] text-[#1B4332] font-semibold bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                                  {c.types_formatted || 'Ponto de interesse'}
                                </div>

                                {/* Endereço formatado */}
                                <span className="text-[11px] text-[#475569] block leading-relaxed">
                                  {c.address}
                                </span>

                                {/* Distância geográfica calculada via Haversine */}
                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 pt-0.5">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                  <span>{c.distance_formatted}</span>
                                </div>

                                {/* Place ID cirúrgico */}
                                <div className="pt-1">
                                  <code className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                    ID: {c.google_place_id}
                                  </code>
                                </div>
                              </div>

                              {/* Ações e Regras de Vínculo (Seção 14) */}
                              <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                                {isHigh && (
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-emerald-800 font-medium">
                                      Alta correspondência com o ponto cadastrado.
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleInitiateLinkCandidate(c)}
                                      disabled={isLinkingPlaceId}
                                      className="px-3.5 py-1.5 bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Selecionar este local</span>
                                    </button>
                                  </div>
                                )}

                                {isMed && (
                                  <div className="space-y-2">
                                    <div className="p-2 bg-amber-100/70 rounded-xl text-[11px] text-amber-900 flex items-center gap-1.5">
                                      <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                      <span>Este candidato precisa de revisão antes de ser vinculado.</span>
                                    </div>
                                    <div className="flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => handleInitiateLinkCandidate(c)}
                                        disabled={isLinkingPlaceId}
                                        className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Revisar e Selecionar</span>
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {isLow && (
                                  <div className="space-y-2">
                                    <div className="p-2 bg-rose-100/80 rounded-xl text-[11px] text-rose-900 flex items-center gap-1.5">
                                      <AlertCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                                      <span>Baixa compatibilidade com o local cadastrado (distância ou atributos divergentes).</span>
                                    </div>
                                    <div className="flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => handleInitiateLinkCandidate(c)}
                                        disabled={isLinkingPlaceId}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer border border-rose-300"
                                      >
                                        <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                                        <span>Ação Extraordinária: Vincular</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Requirement 3: Place Details (New) & Consulta Controlada */}
                <div className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#E7DFCE] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1B4332] block">
                      2. Consulta de Place Details (New) Server-Side
                    </span>
                    <span className="text-[10px] text-[#7A6F5D]">
                      Cost Guard & FieldMask Cirúrgico Obrigatórios
                    </span>
                  </div>

                  {formData.google_place_id ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-white rounded-xl border border-[#E7DFCE] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-[#1E293B] block">Place ID Vinculado</span>
                          <code className="font-mono text-xs text-emerald-800 font-bold block">{formData.google_place_id}</code>
                          {(googleDetailsResult?.cachedAt || formData.google_last_sync_at) && (
                            <span className="text-[11px] text-[#64748B] block mt-0.5">
                              Dados Google consultados em {new Date(googleDetailsResult?.cachedAt || formData.google_last_sync_at!).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {(googleDetailsResult?.cachedAt || formData.google_last_sync_at) && (
                            <button
                              type="button"
                              onClick={() => handleExecuteFetchGoogleDetails()}
                              disabled={googleLoading}
                              className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              {googleLoading ? 'Carregando...' : 'Usar dados em cache'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleInitiateGoogleDetails(Boolean(googleDetailsResult?.cachedAt || formData.google_last_sync_at))}
                            disabled={googleLoading || !costGuardMetrics?.enabled}
                            className="px-4 py-2 bg-[#1B4332] hover:bg-[#143326] text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>
                              {googleLoading 
                                ? 'Consultando Google...' 
                                : (googleDetailsResult?.cachedAt || formData.google_last_sync_at)
                                  ? 'Consultar novamente — pode gerar custo'
                                  : 'Consultar dados Google'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {!costGuardMetrics?.enabled && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs leading-relaxed">
                          🔒 <strong>Proteção Cost Guard Ativa:</strong> O consumo externo do Google Places está desativado (<code>GOOGLE_PLACES_ENABLED=false</code>). Nenhuma chamada externa é permitida até a ativação controlada no painel administrativo.
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[#64748B] italic">
                      Pesquise e vincule um Google Place ID no passo 1 acima para habilitar a consulta de detalhes.
                    </p>
                  )}

                  {/* Requirement 7, 8, 9: DIFF TABLE LOCAL × GOOGLE & Curatorial Protection */}
                  {googleDetailsResult && googleDetailsResult.diff && (
                    <div className="mt-4 p-4 bg-white rounded-2xl border border-[#E7DFCE] space-y-4">
                      {/* Curatorial & Media Protection Banner (Requirement 11 & 12) */}
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                        <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                          <Shield className="w-4 h-4 text-emerald-700" />
                          Proteção Curatorial DUO21 Ativa (Piloto Real: Lago Negro):
                        </span>
                        <p className="text-[11px] text-emerald-800 leading-relaxed">
                          Foto atual, foto de capa manual, acervo de mídia (<code>place_media_items</code> / Supabase Storage), descrição editorial DUO21, preços, observações de preço, duração estimada, tags, parceiros, Dica Divulga Lugares, Instagram e WhatsApp são <strong>100% preservados</strong> e nunca sobrescritos pelo Google.
                        </p>
                      </div>

                      {/* Photos Disabled Notice (Requirement 12) */}
                      <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center gap-2">
                        <Camera className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>
                          <strong>Fotos Google Desativadas (GOOGLE_PLACES_PHOTOS_ENABLED=false):</strong> Nenhuma foto externa é consultada ou baixada. O acervo manual DUO21 é prioridade absoluta.
                        </span>
                      </div>

                      {/* DIFF TABLE (Requirement 9: CAMPO | LOCAL | GOOGLE | DECISÃO) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#1E293B] block">
                            Comparativo de Dados (DIFF Local × Google) — Escolha a decisão campo a campo:
                          </span>
                          <span className="text-[11px] font-semibold text-[#64748B]">
                            {Object.values(fieldSelections).filter(Boolean).length} de 10 campos selecionados para alteração
                          </span>
                        </div>

                        <div className="border border-[#E7DFCE] rounded-xl overflow-hidden text-xs">
                          <table className="w-full text-left">
                            <thead className="bg-[#FAF9F6] text-[10px] font-bold text-[#64748B] uppercase border-b border-[#E7DFCE]">
                              <tr>
                                <th className="p-2.5 w-1/4">Campo</th>
                                <th className="p-2.5 w-1/3">Local (DUO21)</th>
                                <th className="p-2.5 w-1/3">Google Places (New)</th>
                                <th className="p-2.5 text-center">Decisão</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E7DFCE]">
                              {Object.entries(googleDetailsResult.diff as Record<string, any>).map(([key, item]) => {
                                const isGoogleSelected = fieldSelections[key] === true;

                                // Formatting values for hours and display
                                const renderValue = (val: any) => {
                                  if (val === null || val === undefined || val === '') {
                                    return <span className="text-slate-400 italic">Não informado</span>;
                                  }
                                  if (typeof val === 'object') {
                                    return (
                                      <div className="space-y-0.5 font-mono text-[10px] max-h-24 overflow-y-auto">
                                        {Object.entries(val).map(([day, hrs]) => (
                                          <div key={day} className="flex justify-between gap-2">
                                            <span className="font-bold text-slate-600">{day.toUpperCase()}:</span>
                                            <span>{String(hrs)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return <span>{String(val)}</span>;
                                };

                                return (
                                  <tr key={key} className={`hover:bg-slate-50 ${item.different ? 'bg-amber-50/20' : ''}`}>
                                    <td className="p-2.5 font-bold text-[#1E293B]">
                                      <div className="flex items-center gap-1">
                                        <span>{item.label}</span>
                                        {item.different && (
                                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded">
                                            Divergente
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-[#64748B]">
                                      {renderValue(item.local)}
                                    </td>
                                    <td className="p-2.5 text-emerald-900 font-medium">
                                      {renderValue(item.google)}
                                    </td>
                                    <td className="p-2.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleFieldSelection(key)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer ${
                                          isGoogleSelected
                                            ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                                            : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                        }`}
                                      >
                                        {isGoogleSelected ? (
                                          <>
                                            <Check className="w-3 h-3" />
                                            <span>[Usar Google]</span>
                                          </>
                                        ) : (
                                          <>
                                            <Shield className="w-3 h-3" />
                                            <span>[Manter Local]</span>
                                          </>
                                        )}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Action Button: Requirement 9 prohibits "Substituir tudo", strictly enforces [Aplicar selecionados] */}
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handleOpenPreviewModal}
                          className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Revisar e Aplicar Selecionados ({Object.values(fieldSelections).filter(Boolean).length} campos)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SPRINT 10C MODAL 1 & Hotfix P1: Confirmação de Vinculação de Google Place ID com Smart Resolver */}
          {candidateToLink && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="bg-white w-full max-w-lg rounded-3xl border border-[#E7DFCE] shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <LinkIcon className="w-5 h-5 text-emerald-700" />
                    <h3 className="text-base font-bold text-[#1B4332]">Vincular Google Place ID</h3>
                  </div>

                  {/* Badge de Compatibilidade */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      candidateToLink.match_level === 'HIGH'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : candidateToLink.match_level === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                    }`}
                  >
                    COMPATIBILIDADE: {candidateToLink.match_score}% — {candidateToLink.match_level === 'HIGH' ? 'ALTA' : candidateToLink.match_level === 'MEDIUM' ? 'MÉDIA' : 'BAIXA'}
                  </span>
                </div>

                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1.5 leading-relaxed">
                  <p className="font-bold text-amber-900">
                    Você está vinculando este local do catálogo DUO21 ao registro correspondente do Google Places.
                  </p>
                  <p>
                    O UUID interno do Supabase (<code>{place.id}</code>) <strong>NÃO será alterado</strong>. Chaves estrangeiras, mídias manuais e todos os dados editoriais continuam integralmente preservados.
                  </p>
                </div>

                <div className="space-y-2 text-xs border border-[#E7DFCE] rounded-xl p-3 bg-slate-50">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Local DUO21 (Âncora):</span>
                    <strong className="text-[#1E293B]">{place.name} ({place.city})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">UUID Supabase:</span>
                    <code className="text-slate-600 font-mono text-[10px]">{place.id}</code>
                  </div>
                  <div className="border-t border-[#E7DFCE] pt-2 flex justify-between">
                    <span className="text-[#64748B]">Candidato Google:</span>
                    <strong className="text-emerald-900">{candidateToLink.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Google Place ID:</span>
                    <code className="text-emerald-800 font-mono text-[10px] font-bold">{candidateToLink.google_place_id}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Endereço:</span>
                    <span className="text-[#1E293B] text-right truncate max-w-[260px]">{candidateToLink.address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Distância Geográfica:</span>
                    <strong className="text-slate-800">{candidateToLink.distance_formatted}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Avaliações Google:</span>
                    <span className="text-amber-800 font-medium">
                      ⭐ {candidateToLink.rating ? candidateToLink.rating.toFixed(1).replace('.', ',') : '—'} · {candidateToLink.userRatingCount ? candidateToLink.userRatingCount.toLocaleString('pt-BR') : '0'} avaliações
                    </span>
                  </div>
                </div>

                {/* Trava de Segurança para Candidatos de Baixa Compatibilidade (LOW) */}
                {candidateToLink.match_level === 'LOW' && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-950 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-rose-800">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Alerta de Segurança: Baixa Compatibilidade Detectada</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-rose-900">
                      Este candidato possui score de compatibilidade baixo ({candidateToLink.match_score}%) e está a {candidateToLink.distance_formatted}. Certifique-se de que não se trata de uma duplicata ou entidade secundária.
                    </p>
                    <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={lowCompatibilityConfirmed}
                        onChange={(e) => setLowCompatibilityConfirmed(e.target.checked)}
                        className="mt-0.5 rounded text-rose-700 focus:ring-rose-500"
                      />
                      <span className="text-[11px] font-bold text-rose-950">
                        Confirmo conscientemente que este candidato é o local pretendido, apesar da baixa compatibilidade calculada.
                      </span>
                    </label>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7DFCE]">
                  <button
                    type="button"
                    onClick={() => {
                      setCandidateToLink(null);
                      setLowCompatibilityConfirmed(false);
                    }}
                    disabled={isLinkingPlaceId}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmLinkCandidate}
                    disabled={
                      isLinkingPlaceId ||
                      (candidateToLink.match_level === 'LOW' && !lowCompatibilityConfirmed)
                    }
                    className={`px-5 py-2 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      candidateToLink.match_level === 'LOW' && !lowCompatibilityConfirmed
                        ? 'bg-slate-400 cursor-not-allowed opacity-60'
                        : 'bg-[#1B4332] hover:bg-[#143326]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isLinkingPlaceId ? 'Vinculando...' : 'Confirmar Vinculação'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SPRINT 10C MODAL 2: Informação Obrigatória Pré-Chamada Place Details (Requirement 3 & 4) */}
          {showPreCallModal && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="bg-white w-full max-w-lg rounded-3xl border border-[#E7DFCE] shadow-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-[#1B4332]">
                  <AlertCircle className="w-5 h-5 text-emerald-700" />
                  <h3 className="text-base font-bold text-[#1B4332]">Autorização de Consulta — Place Details (New)</h3>
                </div>

                <p className="text-xs text-[#64748B] leading-relaxed">
                  O CMS DUO21 exige transparência total antes de qualquer chamada externa. Confira o FieldMask e o SKU auditado:
                </p>

                <div className="space-y-2.5 text-xs bg-slate-50 border border-[#E7DFCE] rounded-2xl p-4">
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase block">Operação</span>
                    <strong className="text-xs text-[#1E293B]">Place Details (New)</strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase block">FieldMask Cirúrgico (Nunca "*")</span>
                    <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-emerald-900 bg-white p-2.5 rounded-xl border border-slate-200 mt-1">
                      <span>• id</span>
                      <span>• displayName</span>
                      <span>• formattedAddress</span>
                      <span>• location</span>
                      <span>• types</span>
                      <span>• regularOpeningHours</span>
                      <span>• rating</span>
                      <span>• userRatingCount</span>
                      <span>• websiteUri</span>
                      <span>• googleMapsUri</span>
                      <span>• nationalPhoneNumber</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold text-[#64748B] uppercase block">SKU Estimado</span>
                      <strong className="text-xs text-[#1B4332]">PlaceDetails_Atmosphere_Contact</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#64748B] uppercase block">Custo Estimado (Cost Guard)</span>
                      <strong className="text-xs text-emerald-800">R$ 0,12</strong>
                    </div>
                  </div>
                </div>

                {/* Transparency Disclaimer (Requirement 4) */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed space-y-1">
                  <span className="font-bold block">⚠️ Distinção Obrigatória de Custos:</span>
                  <p>
                    O valor acima é o <strong>"Custo estimado pelo Cost Guard"</strong> interno. A <strong>"Cobrança efetiva Google Cloud"</strong> depende do plano consolidado, créditos gratuitos e faturamento da conta no Google Cloud Console.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7DFCE]">
                  <button
                    type="button"
                    onClick={() => setShowPreCallModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteFetchGoogleDetails}
                    disabled={!costGuardMetrics?.enabled}
                    className="px-5 py-2 bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Consultar Google</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SPRINT 10C MODAL 3: Preview Obrigatório Antes de Persistir (Requirement 10 & 11) */}
          {showPreviewModal && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="bg-white w-full max-w-2xl rounded-3xl border border-[#E7DFCE] shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-[#E7DFCE]">
                  <div>
                    <h3 className="text-base font-bold text-[#1B4332]">ALTERAÇÕES QUE SERÃO APLICADAS</h3>
                    <p className="text-xs text-[#64748B]">Revise atentamente as alterações selecionadas antes de confirmar a gravação no Supabase.</p>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md">
                    Pré-visualização Oficial
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {Object.entries(fieldSelections).filter(([_, isSelected]) => isSelected).length === 0 ? (
                    <div className="p-4 bg-slate-100 text-slate-700 rounded-2xl text-xs text-center">
                      Nenhum campo foi selecionado para alteração. O catálogo DUO21 será mantido 100% inalterado.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(fieldSelections)
                        .filter(([_, isSelected]) => isSelected)
                        .map(([fieldKey]) => {
                          const diffItem = googleDetailsResult?.diff?.[fieldKey];
                          if (!diffItem) return null;

                          return (
                            <div key={fieldKey} className="p-3.5 bg-slate-50 border border-[#E7DFCE] rounded-2xl space-y-2 text-xs">
                              <span className="font-bold text-[#1B4332] block uppercase tracking-wider text-[10px]">
                                {diffItem.label}
                              </span>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Local (Atual)</span>
                                  <div className="text-slate-700">
                                    {typeof diffItem.local === 'object' && diffItem.local !== null ? (
                                      <div className="space-y-0.5 font-mono text-[10px]">
                                        {Object.entries(diffItem.local).map(([d, h]) => (
                                          <div key={d} className="flex justify-between">
                                            <span>{d.toUpperCase()}:</span>
                                            <span>{String(h)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      String(diffItem.local ?? 'Não informado')
                                    )}
                                  </div>
                                </div>

                                <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
                                  <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">Google Places (Novo)</span>
                                  <div className="text-emerald-950 font-medium">
                                    {typeof diffItem.google === 'object' && diffItem.google !== null ? (
                                      <div className="space-y-0.5 font-mono text-[10px]">
                                        {Object.entries(diffItem.google).map(([d, h]) => (
                                          <div key={d} className="flex justify-between">
                                            <span>{d.toUpperCase()}:</span>
                                            <span>{String(h)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      String(diffItem.google ?? 'Não informado')
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Curatorial Immuntability Guarantee (Requirement 11) */}
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 space-y-1.5">
                    <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <Shield className="w-4 h-4 text-emerald-700" />
                      Garantia de Preservação Curatorial DUO21:
                    </span>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Mídia manual existente, foto de capa, descrição editorial DUO21, tabela de preços, observações de preço, duração estimada, tags, parcerias, Dica Divulga Lugares, Instagram e WhatsApp <strong>permanecem 100% inalterados</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E7DFCE]">
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    disabled={isApplyingEnrichment}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmApplyEnrichment}
                    disabled={isApplyingEnrichment || Object.values(fieldSelections).filter(Boolean).length === 0}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isApplyingEnrichment ? 'Gravando no Supabase...' : 'Confirmar alterações'}</span>
                  </button>
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
