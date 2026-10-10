import React, { useState } from 'react';
import { 
  X, 
  BarChart3, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Flag, 
  Settings, 
  Plus, 
  Check, 
  ShieldAlert, 
  ArrowLeft,
  Percent,
  Sliders,
  CheckCircle2,
  Trash2,
  EyeOff,
  Server,
  Activity,
  Wifi,
  Zap,
  RefreshCw,
  Compass,
  Car,
  CloudRain,
  Layers,
  Radio,
  Globe,
  ExternalLink,
  ShieldCheck,
  Edit3,
  Camera,
  Sparkles,
  Clock,
  Search,
  Filter,
  AlertCircle,
  Eye,
  Star,
  Lock,
  Shield,
  Download,
  Rocket,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  LogOut,
  KeyRound
} from 'lucide-react';
import { Place, SerraEvent, UserReport, AdminMetrics, AdminUserRecord, AdminRole, AdminAuditLogRecord } from '../types';
import { SEED_PLACES, SEED_EVENTS } from '../data/seedData';
import { EngineWeights, DEFAULT_WEIGHTS } from '../services/itineraryEngine';
import { providerRegistry, RegisteredProviderStatus } from '../services/providers';
import { PlaceEditorModal } from './PlaceEditorModal';
import { CatalogAcceleratorModal } from './CatalogAcceleratorModal';
import { 
  calculatePlaceDataQuality, 
  hasRealPhotos, 
  hasRealGooglePlaceId, 
  isDemoPlaceId, 
  auditPlaceRecord, 
  isPlaceEligibleForItinerary 
} from '../utils/dataQuality';
import { hasDivulgaContent } from '../utils/formatters';

interface AdminDashboardProps {
  onClose: () => void;
  reports: UserReport[];
  onApproveReport: (id: string) => void;
  onRejectReport: (id: string) => void;
  currentUser?: AdminUserRecord | null;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onClose,
  reports,
  onApproveReport,
  onRejectReport,
  currentUser = null,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'apps' | 'apis' | 'webhooks' | 'metrics' | 'places' | 'events' | 'reports' | 'weights' | 'integrations' | 'trip_audit' | 'campaign' | 'users'>('apps');
  const [places, setPlaces] = useState<Place[]>(SEED_PLACES);
  const [events, setEvents] = useState<SerraEvent[]>(SEED_EVENTS);
  const [weights, setWeights] = useState<EngineWeights>(DEFAULT_WEIGHTS);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<RegisteredProviderStatus[]>(providerRegistry.getStatuses());
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [liveUsage, setLiveUsage] = useState<any>(null);

  // Sprint 11: User Management State (Super Admin)
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminRole>('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRecord[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);

  // Sprint 9.2 & Hotfix 10A.2: Administrative Session & Key State
  const [adminApiKey, setAdminApiKey] = useState<string>(() => {
    // Audit Release Gate P0: ADMIN_API_KEY não deve persistir em localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('duo21_admin_key');
      }
    } catch {}
    return (typeof window !== 'undefined' && sessionStorage.getItem('duo21_admin_key')) || '';
  });
  const [adminSessionToken, setAdminSessionToken] = useState<string | null>(() => {
    return (typeof window !== 'undefined' && sessionStorage.getItem('duo21_admin_session')) || null;
  });

  // Establish Admin Session for Control Plane with authentication
  React.useEffect(() => {
    const key = adminApiKey || (typeof window !== 'undefined' && sessionStorage.getItem('duo21_admin_key')) || '';
    const existingToken = adminSessionToken || (typeof window !== 'undefined' && sessionStorage.getItem('duo21_admin_session'));

    if (!key && !existingToken) return;

    fetch('/api/admin/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-admin-key': key } : {}),
        ...(existingToken ? { 'x-admin-session': existingToken } : {})
      },
      body: JSON.stringify({ adminApiKey: key }),
      credentials: 'include'
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.sessionToken) {
          setAdminSessionToken(data.sessionToken);
          sessionStorage.setItem('duo21_admin_session', data.sessionToken);
        }
      })
      .catch(() => {});
  }, [adminApiKey]);

  const getAdminHeaders = React.useCallback((extraHeaders: Record<string, string> = {}) => {
    const headers: Record<string, string> = { 
      'x-admin-control-plane': 'duo21',
      ...extraHeaders 
    };
    if (adminApiKey) {
      headers['x-admin-key'] = adminApiKey;
    }
    const token = adminSessionToken || sessionStorage.getItem('duo21_admin_session');
    if (token) {
      headers['x-admin-session'] = token;
    }
    return headers;
  }, [adminApiKey, adminSessionToken]);

  const [campaignData, setCampaignData] = useState<any>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(19.90);
  const [editLimit, setEditLimit] = useState<number>(300);
  const [campaignUpdating, setCampaignUpdating] = useState(false);
  const [campaignSuccessMsg, setCampaignSuccessMsg] = useState<string | null>(null);

  // Sprint 10A Catálogo Central State
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCity, setCatalogCity] = useState('ALL');
  const [catalogCategory, setCatalogCategory] = useState('ALL');
  const [catalogActive, setCatalogActive] = useState('ALL');
  const [catalogPartner, setCatalogPartner] = useState('ALL');
  const [catalogPhoto, setCatalogPhoto] = useState('ALL');
  const [catalogHours, setCatalogHours] = useState('ALL');
  const [catalogGooglePlaceId, setCatalogGooglePlaceId] = useState('ALL');
  const [catalogDivulga, setCatalogDivulga] = useState('ALL');
  const [catalogQuality, setCatalogQuality] = useState('ALL');
  const [catalogMetrics, setCatalogMetrics] = useState<any>(null);
  const [costGuardMetrics, setCostGuardMetrics] = useState<any>(null);
  const [costGuardUpdating, setCostGuardUpdating] = useState(false);
  const [costGuardAuditRecords, setCostGuardAuditRecords] = useState<any[]>([]);
  const [showMiniMundoModal, setShowMiniMundoModal] = useState(false);
  const [showAcceleratorModal, setShowAcceleratorModal] = useState(false);
  const [miniMundoTestResult, setMiniMundoTestResult] = useState<any>(null);
  const [isTestingMiniMundo, setIsTestingMiniMundo] = useState(false);
  const isSubmittingMiniMundoRef = React.useRef(false);
  const [miniMundoConfirmed, setMiniMundoConfirmed] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);

  // Live operational data for DUO21 CMS modules (Sprint 8C)
  const [healthData, setHealthData] = useState<any>(null);
  const [webhookData, setWebhookData] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  const isGooglePlacesActive = Boolean(
    costGuardMetrics?.enabled ?? (healthData?.places === 'connected')
  );

  const fetchHealthAndWebhook = () => {
    setIsLoadingHealth(true);
    Promise.all([
      fetch('/api/health').then(r => r.ok ? r.json() : null),
      fetch('/api/payments/webhook').then(r => r.ok ? r.json() : null),
      fetch('/api/payments/events').then(r => r.ok ? r.json() : null),
      fetch('/api/db/usage/metrics').then(r => r.ok ? r.json() : null)
    ]).then(([h, w, ev, u]) => {
      if (h) setHealthData(h);
      if (w) setWebhookData(w);
      if (ev) setRecentEvents(ev);
      if (u) setLiveUsage(u);
      setIsLoadingHealth(false);
    }).catch(() => {
      setIsLoadingHealth(false);
    });
  };

  const fetchCampaignMetrics = React.useCallback(async () => {
    setCampaignLoading(true);
    setCampaignError(null);
    try {
      const res = await fetch('/api/admin/campaign', {
        headers: getAdminHeaders(),
        credentials: 'include'
      });
      if (!res.ok) {
        // Fallback to public status if unauthorized
        const pub = await fetch('/api/campaigns/launch-status').then(r => r.json());
        setCampaignData({
          campaign: {
            id: pub.campaign_id,
            name: pub.campaign_name,
            priceBrl: pub.campaign_price,
            maxRedemptions: pub.max_redemptions,
            remaining_redemptions: pub.remaining_redemptions,
            redemptions_count: pub.max_redemptions - pub.remaining_redemptions,
            active: pub.active,
            status: pub.is_available ? 'ACTIVE' : (pub.remaining_redemptions === 0 ? 'EXHAUSTED' : 'INACTIVE'),
            startDate: '2026-10-01T00:00:00.000Z',
            endDate: null,
            officialStartingPrice: pub.official_starting_price
          },
          metrics: {
            total_campaign_orders_paid: pub.max_redemptions - pub.remaining_redemptions,
            total_campaign_revenue_brl: (pub.max_redemptions - pub.remaining_redemptions) * pub.campaign_price,
            average_ticket_brl: pub.campaign_price,
            total_promotional_discount_brl: (pub.max_redemptions - pub.remaining_redemptions) * (pub.official_starting_price - pub.campaign_price)
          }
        });
        if (res.status === 401) {
          setCampaignError('Autenticado em modo restrito. Insira a chave administrativa para editar.');
        }
      } else {
        const data = await res.json();
        setCampaignData(data);
        if (data.campaign) {
          setEditPrice(data.campaign.priceBrl);
          setEditLimit(data.campaign.maxRedemptions);
        }
      }
    } catch (err: any) {
      setCampaignError(err.message || 'Erro ao carregar dados da campanha');
    } finally {
      setCampaignLoading(false);
    }
  }, [adminApiKey]);

  const handleUpdateCampaign = async (updates: { active?: boolean; maxRedemptions?: number; priceBrl?: number; name?: string }) => {
    setCampaignUpdating(true);
    setCampaignSuccessMsg(null);
    setCampaignError(null);
    try {
      const res = await fetch('/api/admin/campaign/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao atualizar campanha');
      }
      const data = await res.json();
      if (data.adminMetrics) {
        setCampaignData(data.adminMetrics);
      }
      setCampaignSuccessMsg('Configurações da campanha atualizadas com sucesso!');
      setTimeout(() => setCampaignSuccessMsg(null), 3000);
    } catch (err: any) {
      setCampaignError(err.message || 'Erro ao atualizar campanha');
    } finally {
      setCampaignUpdating(false);
    }
  };

  React.useEffect(() => {
    fetchHealthAndWebhook();
  }, []);

  React.useEffect(() => {
    if (activeTab === 'campaign') {
      fetchCampaignMetrics();
    }
  }, [activeTab, fetchCampaignMetrics]);

  const fetchPlacesAndMetrics = React.useCallback(async () => {
    setIsLoadingPlaces(true);
    try {
      const res = await fetch('/api/admin/places', {
        headers: getAdminHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.places && Array.isArray(data.places) && data.places.length > 0) {
          setPlaces(data.places);
        }
        if (data.metrics) setCatalogMetrics(data.metrics);
      } else {
        // Fallback to /api/db/places if admin session not yet resolved
        const pubRes = await fetch('/api/db/places');
        if (pubRes.ok) {
          const pubPlaces = await pubRes.json();
          if (Array.isArray(pubPlaces) && pubPlaces.length > 0) {
            setPlaces(pubPlaces);
          }
        }
      }
      const [cgRes, auditRes] = await Promise.all([
        fetch('/api/admin/places/costguard', {
          headers: getAdminHeaders(),
          credentials: 'include'
        }),
        fetch('/api/admin/places/costguard/audit?limit=20', {
          headers: getAdminHeaders(),
          credentials: 'include'
        })
      ]);

      if (cgRes.ok) {
        const cgData = await cgRes.json();
        setCostGuardMetrics(cgData);
      }
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        if (Array.isArray(auditData)) {
          setCostGuardAuditRecords(auditData);
        }
      }
    } catch (err) {
      console.warn('Error fetching places:', err);
      try {
        const pubRes = await fetch('/api/db/places');
        if (pubRes.ok) {
          const pubPlaces = await pubRes.json();
          if (Array.isArray(pubPlaces) && pubPlaces.length > 0) {
            setPlaces(pubPlaces);
          }
        }
      } catch {}
    } finally {
      setIsLoadingPlaces(false);
    }
  }, [getAdminHeaders]);

  React.useEffect(() => {
    fetchPlacesAndMetrics();
  }, [fetchPlacesAndMetrics]);

  React.useEffect(() => {
    if (activeTab === 'places' || activeTab === 'apis') {
      fetchPlacesAndMetrics();
    }
  }, [activeTab, fetchPlacesAndMetrics]);

  // Sprint 11: Carregamento de Administradores e Auditoria (Super Admin)
  const fetchAdminUsers = React.useCallback(async () => {
    setIsLoadingUsers(true);
    setUserError(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: getAdminHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setAdminUsers(data.users);
        }
      } else if (res.status === 403) {
        setUserError('Apenas Super Admins têm permissão para listar e gerenciar administradores.');
      } else {
        const err = await res.json().catch(() => ({}));
        setUserError(err.error || 'Falha ao consultar administradores.');
      }
    } catch {
      setUserError('Erro ao consultar administradores do sistema.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [getAdminHeaders]);

  const fetchAuditLogs = React.useCallback(async () => {
    setIsLoadingAuditLogs(true);
    try {
      const res = await fetch('/api/admin/audit-logs?limit=40', {
        headers: getAdminHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
        }
      }
    } catch {}
    finally {
      setIsLoadingAuditLogs(false);
    }
  }, [getAdminHeaders]);

  React.useEffect(() => {
    if (activeTab === 'users') {
      fetchAdminUsers();
      fetchAuditLogs();
    }
  }, [activeTab, fetchAdminUsers, fetchAuditLogs]);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) {
      setUserError('Preencha o nome completo e o email do novo administrador.');
      return;
    }

    setIsInviting(true);
    setUserError(null);
    setUserSuccess(null);

    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          email: inviteEmail.trim(),
          full_name: inviteName.trim(),
          role: inviteRole
        }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao convidar administrador.');
      }

      setUserSuccess(`Convite enviado com sucesso para ${inviteEmail}.`);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('editor');
      setIsInviteModalOpen(false);
      fetchAdminUsers();
      fetchAuditLogs();
    } catch (err: any) {
      setUserError(err.message || 'Erro ao convidar novo usuário.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateUserRole = async (targetUserId: string, newRole: AdminRole) => {
    setUserError(null);
    setUserSuccess(null);
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/role`, {
        method: 'PUT',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ role: newRole }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao alterar função.');
      }

      setUserSuccess('Função do administrador atualizada com sucesso.');
      fetchAdminUsers();
      fetchAuditLogs();
    } catch (err: any) {
      setUserError(err.message || 'Erro ao alterar função.');
    }
  };

  const handleToggleUserStatus = async (targetUserId: string, currentStatus: boolean) => {
    setUserError(null);
    setUserSuccess(null);
    const newStatus = !currentStatus;
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/status`, {
        method: 'PUT',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ is_active: newStatus }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao atualizar status.');
      }

      setUserSuccess(`Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso.`);
      fetchAdminUsers();
      fetchAuditLogs();
    } catch (err: any) {
      setUserError(err.message || 'Erro ao atualizar status do usuário.');
    }
  };

  const handleRevokeUserSessions = async (targetUserId: string) => {
    setUserError(null);
    setUserSuccess(null);
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/revoke-sessions`, {
        method: 'POST',
        headers: getAdminHeaders(),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao revogar sessões.');
      }

      setUserSuccess('Todas as sessões ativas do administrador foram revogadas.');
      fetchAuditLogs();
    } catch (err: any) {
      setUserError(err.message || 'Erro ao revogar sessões.');
    }
  };

  const handleSavePlace = async (updatedPlace: Place) => {
    const res = await fetch(`/api/admin/places/${updatedPlace.id}`, {
      method: 'PUT',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(updatedPlace)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao atualizar local');
    }
    const saved = await res.json();
    setPlaces(prev => prev.map(p => p.id === saved.id ? saved : p));
    setEditingPlace(null);
    fetchPlacesAndMetrics();
  };

  const handleCreateNewPlace = () => {
    const newPlace: Place = {
      id: `place_${Date.now()}`,
      name: 'Novo Local Turístico',
      slug: `novo-local-${Date.now()}`,
      city: 'Gramado',
      category: 'atrativo',
      description: '',
      latitude: -29.3789,
      longitude: -50.8741,
      address: 'Gramado - RS',
      rating: 4.8,
      rating_count: 50,
      price_level: 2,
      price_info: {
        adult_price: 0,
        child_price: 0,
        is_free: false,
        currency: 'BRL',
        source_name: 'Curadoria DUO21',
        checked_at: new Date().toISOString(),
        confidence: 'high'
      },
      average_duration_minutes: 90,
      reservation_required: false,
      accessible: true,
      pet_friendly: false,
      children_friendly: true,
      indoor_type: 'outdoor',
      opening_hours: { 'seg': '09:00 - 18:00' },
      media: [],
      is_divulga_lugares_partner: false,
      active: true,
      is_demo: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setEditingPlace(newPlace);
  };

  const handleToggleCostGuard = async () => {
    if (!costGuardMetrics) return;
    setCostGuardUpdating(true);
    try {
      const res = await fetch('/api/admin/places/costguard', {
        method: 'POST',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ enabled: !costGuardMetrics.enabled })
      });
      if (res.ok) {
        const json = await res.json();
        setCostGuardMetrics(json.metrics);
      }
    } catch (err) {
      console.warn('CostGuard toggle error:', err);
    } finally {
      setCostGuardUpdating(false);
    }
  };

  const handleRunMiniMundoPreActivation = async () => {
    // Double-click protection via ref and state
    if (isSubmittingMiniMundoRef.current || isTestingMiniMundo) return;
    if (!miniMundoConfirmed) return;
    
    isSubmittingMiniMundoRef.current = true;
    setIsTestingMiniMundo(true);
    setMiniMundoTestResult(null);

    try {
      const res = await fetch('/api/admin/places/test-mini-mundo', {
        method: 'POST',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ confirmed: true })
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        data = { error: `HTTP ${res.status}: Resposta inesperada do servidor` };
      }

      if (!res.ok) {
        setMiniMundoTestResult({
          success: false,
          ready: false,
          executedRealCall: false,
          externalCallsCount: 0,
          costGuardStatus: res.status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR',
          message: data.error || data.message || `Falha na requisição administrativa (HTTP ${res.status})`,
          persistedToDatabase: false,
          estimatedRequests: 0,
          estimatedCostBrl: 0
        });
      } else {
        setMiniMundoTestResult(data);
      }

      // Refresh Cost Guard metrics and audit records after test action
      const [cgRes, auditRes] = await Promise.all([
        fetch('/api/admin/places/costguard', {
          headers: getAdminHeaders(),
          credentials: 'include'
        }),
        fetch('/api/admin/places/costguard/audit?limit=20', {
          headers: getAdminHeaders(),
          credentials: 'include'
        })
      ]);
      if (cgRes.ok) {
        setCostGuardMetrics(await cgRes.json());
      }
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        if (Array.isArray(auditData)) {
          setCostGuardAuditRecords(auditData);
        }
      }
      fetchHealthAndWebhook();
    } catch (err: any) {
      setMiniMundoTestResult({ 
        success: false, 
        ready: false, 
        executedRealCall: false, 
        externalCallsCount: 0,
        costGuardStatus: 'NETWORK_ERROR',
        message: `Erro ao testar Mini Mundo: ${err.message}`,
        persistedToDatabase: false,
        estimatedRequests: 0,
        estimatedCostBrl: 0
      });
    } finally {
      isSubmittingMiniMundoRef.current = false;
      setIsTestingMiniMundo(false);
    }
  };

  // Telemetry metrics for Analytics tab
  const metrics: AdminMetrics = {
    total_trips_created: 142,
    total_trips_paid: 48,
    conversion_rate: 33.8,
    gross_revenue_brl: 1147.20,
    estimated_ai_cost_brl: 9.60,
    estimated_api_cost_brl: 14.40,
    estimated_payment_fees_brl: 47.50,
    net_margin_percent: 93.7
  };

  const handleTogglePlaceActive = async (id: string) => {
    const current = places.find(p => p.id === id);
    if (!current) return;
    const newActive = !current.active;
    setPlaces(prev => prev.map(p => p.id === id ? { ...p, active: newActive } : p));
    try {
      await fetch(`/api/admin/places/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({ active: newActive })
      });
      fetchPlacesAndMetrics();
    } catch (err) {
      console.warn('Error toggling place active:', err);
    }
  };

  const handleUpdatePrice = (id: string, newPrice: number) => {
    setPlaces(prev => prev.map(p => {
      if (p.id !== id) return p;
      return {
        ...p,
        price_info: {
          ...p.price_info,
          adult_price: newPrice,
          is_free: newPrice === 0,
          checked_at: new Date().toISOString().split('T')[0]
        }
      };
    }));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF9F6] overflow-y-auto">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E7DFCE] px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-[#1E293B]">DUO21 Control Plane</h2>
                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">/duo-control</span>
              </div>
              <span className="text-[10px] text-[#64748B]">Painel Administrativo com Governança e RBAC</span>
            </div>
          </div>

          {/* User Profile & Action Buttons */}
          <div className="flex items-center gap-2">
            {currentUser && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-slate-800 truncate max-w-[130px]" title={currentUser.email}>
                  {currentUser.full_name || currentUser.email}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                  currentUser.role === 'super_admin'
                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                    : currentUser.role === 'editor'
                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {currentUser.role === 'super_admin' ? 'Super Admin' : currentUser.role === 'editor' ? 'Editor' : 'Visualizador'}
                </span>
              </div>
            )}

            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#1E293B] text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao App</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                title="Encerrar Sessão"
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-4xl mx-auto mt-3 flex gap-1 overflow-x-auto no-scrollbar text-xs font-semibold">
          {[
            { id: 'apps', label: 'Aplicativos', icon: Layers },
            { id: 'apis', label: 'APIs', icon: Server },
            { id: 'webhooks', label: 'Webhooks', icon: Radio },
            { id: 'metrics', label: 'Analytics', icon: BarChart3 },
            { id: 'campaign', label: 'Campanha 300', icon: DollarSign },
            { id: 'integrations', label: 'Integrações', icon: Wifi },
            { id: 'weights', label: 'Configurações', icon: Sliders },
            { id: 'users', label: 'Usuários & Permissões', icon: Users },
            { id: 'places', label: 'Locais & Preços', icon: MapPin },
            { id: 'events', label: 'Eventos Âncora', icon: Calendar },
            { id: 'reports', label: `Relatos (${reports.length})`, icon: Flag },
            { id: 'trip_audit', label: 'Logística (DEV)', icon: Compass }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isActive 
                    ? 'bg-[#1B4332] text-white' 
                    : 'bg-[#FAF9F6] text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {savedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center gap-2 text-xs text-emerald-900 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Alterações salvas com sucesso no banco de dados!</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODULE 1: APLICATIVOS (DUO21 CMS - App Roteiro IA)             */}
        {/* ============================================================== */}
        {activeTab === 'apps' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full inline-block mb-1">
                  CMS DUO21 • Módulo Aplicativos
                </span>
                <h3 className="text-base font-extrabold text-[#1B4332]">
                  App Roteiro IA
                </h3>
                <p className="text-xs text-[#64748B]">
                  Runtime desacoplado para planejamento inteligente de viagens na Serra Gaúcha (Gramado, Canela e Nova Petrópolis).
                </p>
              </div>
              <button
                type="button"
                onClick={fetchHealthAndWebhook}
                className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>
            </div>

            {/* App Card */}
            <div className="bg-white border border-[#E7DFCE] p-5 rounded-3xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F1EBE0]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-[#1E293B]">
                      Roteiro Serra Gaúcha (DUO21)
                    </h4>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                      OPERACIONAL
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B]">
                    Identificador: <span className="font-mono text-[11px] text-[#1E293B]">roteiro-ia-serra</span> • Versão: <strong>1.0.0 (Sprint 8C)</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-1.5 transition-colors w-fit cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Acessar App Turista</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </button>
              </div>

              {/* Grid with 5 essential fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Status</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-extrabold text-xs text-slate-800">
                      {healthData?.app === 'ok' ? 'Online / Ativo' : 'Verificando...'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Dev Server & APIs respondendo</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Ambiente</span>
                  <span className="font-extrabold text-xs text-slate-800 uppercase">
                    {healthData?.environment || 'development'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Gateway Asaas: <strong>{(healthData?.asaas_env || 'sandbox').toUpperCase()}</strong>
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">URL Pública Canônica</span>
                  <span className="font-mono text-xs font-bold text-emerald-800 break-all block">
                    {healthData?.canonical_domain || 'https://roteiro.duo21.com.br'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">Domínio Canônico de Produção</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Saúde do Backend</span>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Banco:</span>
                      <strong className="text-slate-700">{healthData?.database?.toUpperCase() || 'MOCK'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Clima:</span>
                      <strong className="text-emerald-700">{healthData?.weather?.toUpperCase() || 'CONNECTED'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cloudflare Ready:</span>
                      <strong className="text-emerald-700">{healthData?.cloudflare_ready ? 'SIM' : 'NÃO'}</strong>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 sm:col-span-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Última Publicação & Sincronização</span>
                  <span className="font-mono text-xs font-semibold text-slate-700 block">
                    {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleString('pt-BR') : '2026-09-28'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Release: <strong className="text-slate-700">Sprint 8B & 8C (Performance, Segurança, CMS & Deploy Readiness)</strong>
                  </span>
                </div>
              </div>

              {/* Decoupling architecture notice */}
              <div className="bg-[#EBF3EE] border border-[#D9EADB] p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-[#1B4332]">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Desacoplamento Arquitetural (Control Plane):</strong>
                  <p className="text-[11px] text-[#2D6A4F] mt-0.5 leading-relaxed">
                    O CMS DUO21 opera estritamente como painel administrativo e de controle. O turista executa consultas, geração de roteiro e checkout diretamente contra as APIs de runtime (<code className="font-mono bg-white/70 px-1 py-0.5 rounded">/api/*</code>), sem qualquer dependência síncrona do painel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODULE 2: APIS (DUO21 CMS - 6 Provedores)                      */}
        {/* ============================================================== */}
        {activeTab === 'apis' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full inline-block mb-1">
                  CMS DUO21 • Módulo APIs
                </span>
                <h3 className="text-base font-extrabold text-[#1B4332]">
                  Status das APIs & Provedores
                </h3>
                <p className="text-xs text-[#64748B]">
                  Representação dos 6 provedores oficiais. Todas as credenciais são mantidas estritamente server-side.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchHealthAndWebhook}
                className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin' : ''}`} />
                <span>Verificar Conexões</span>
              </button>
            </div>

            {/* Security Guarantee Banner */}
            <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-start gap-2.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-emerald-300">Isolamento Server-Side Ativo:</strong>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  Nenhum secret (como <code className="font-mono text-emerald-300">SUPABASE_SERVICE_ROLE_KEY</code>, <code className="font-mono text-emerald-300">GEMINI_API_KEY</code>, <code className="font-mono text-emerald-300">ASAAS_API_KEY</code>, <code className="font-mono text-emerald-300">ASAAS_WEBHOOK_TOKEN</code>) é trafegado para o cliente ou renderizado no painel. O CMS exibe apenas diagnósticos operacionais sanitizados.
                </p>
              </div>
            </div>

            {/* List of 6 APIs */}
            <div className="space-y-2.5">
              {[
                {
                  id: 'supabase',
                  name: 'Supabase Database',
                  provider: 'PostgreSQL Relacional / Supabase Client',
                  status: healthData?.database === 'connected' ? 'CONNECTED' : (healthData?.database === 'mock' ? 'MOCK' : 'CONNECTED'),
                  env: healthData?.environment || 'development',
                  lastChecked: healthData?.timestamp,
                  details: healthData?.database_details || 'Banco de dados operacional (Source of Truth).'
                },
                {
                  id: 'gemini',
                  name: 'Google Gemini',
                  provider: 'Gemini 2.5 Flash / Google GenAI SDK',
                  status: healthData?.ai === 'connected' ? 'CONNECTED' : 'CONFIGURATION_REQUIRED',
                  env: healthData?.environment || 'development',
                  lastChecked: healthData?.timestamp,
                  details: healthData?.ai === 'connected' ? 'Modelo configurado para assistência e geração contextual.' : 'Aguardando GEMINI_API_KEY no .env do servidor.'
                },
                {
                  id: 'places',
                  name: 'Google Places',
                  provider: 'Google Places API (New) / Cache-First',
                  status: healthData?.places === 'connected' ? 'CONNECTED' : 'CONFIGURATION_REQUIRED',
                  env: healthData?.environment || 'development',
                  lastChecked: healthData?.timestamp,
                  details: healthData?.places_details || 'Catálogo local com busca de fotos e dados operacionais.'
                },
                {
                  id: 'routes',
                  name: 'Google Routes',
                  provider: healthData?.routes === 'connected' ? 'Google Routes API (New)' : 'Haversine Montanha / OSRM',
                  status: healthData?.routes === 'connected' ? 'CONNECTED' : 'MOCK',
                  env: healthData?.environment || 'development',
                  lastChecked: healthData?.timestamp,
                  details: healthData?.routes_details || 'Cálculo de matriz de distância e tempo com buffer de trânsito.'
                },
                {
                  id: 'weather',
                  name: 'Weather API',
                  provider: 'Open-Meteo & Microclima Serra Gaúcha',
                  status: 'CONNECTED',
                  env: healthData?.environment || 'development',
                  lastChecked: healthData?.timestamp,
                  details: healthData?.weather_details || 'Monitoramento meteorológico e desvio de chuva ativo.'
                },
                {
                  id: 'asaas',
                  name: 'Asaas Gateway',
                  provider: 'Asaas Payment API (PIX & Cartão)',
                  status: webhookData?.status === 'active' ? 'CONNECTED' : 'MOCK',
                  env: (healthData?.asaas_env || 'sandbox'),
                  lastChecked: webhookData?.last_processed_at || healthData?.timestamp,
                  details: `Ambiente ${(healthData?.asaas_env || 'sandbox').toUpperCase()} ativo. Cobrança oficial PIX R$ 19,90.`
                }
              ].map(api => {
                const isConn = api.status === 'CONNECTED';
                const isMock = api.status === 'MOCK';
                const badgeClass = isConn 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : isMock 
                  ? 'bg-amber-100 text-amber-800 border-amber-300' 
                  : 'bg-sky-100 text-sky-800 border-sky-300';

                return (
                  <div key={api.id} className="bg-white border border-[#E7DFCE] p-4 rounded-2xl shadow-xs space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-[#1E293B]">{api.name}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                            {api.status}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                            {api.env}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-0.5">
                          Provedor: <strong className="text-[#1E293B]">{api.provider}</strong>
                        </p>
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {api.lastChecked ? new Date(api.lastChecked).toLocaleTimeString('pt-BR') : 'Hoje'}
                      </span>
                    </div>

                    <div className="bg-[#FAF9F6] border border-[#F1EBE0] p-2.5 rounded-xl text-[11px] text-[#475569] font-mono">
                      <span>Diagnóstico sanitizado: {api.details}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SPRINT 10B: PAINEL DE CUSTOS & COST GUARD — GOOGLE PLACES API (NEW) */}
            <div className="bg-white border border-[#E7DFCE] p-5 rounded-3xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#F1EBE0]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full inline-block">
                      Sprint 10B • Cost Guard
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                      costGuardMetrics?.statusDisplay === 'ATIVO' ? 'bg-emerald-100 text-emerald-800' :
                      costGuardMetrics?.statusDisplay === 'BLOQUEADO PELO COST GUARD' ? 'bg-rose-100 text-rose-800' :
                      costGuardMetrics?.statusDisplay === 'AGUARDANDO CONFIGURAÇÃO' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      STATUS: {costGuardMetrics?.statusDisplay || 'DESATIVADO'}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-[#1B4332] mt-1">
                    Painel de Custos & Governança — Google Places API (New)
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Google Places é base de enriquecimento do catálogo Supabase. Turistas nunca consultam o Google diretamente.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleCostGuard}
                    disabled={costGuardUpdating}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                      costGuardMetrics?.enabled
                        ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{costGuardUpdating ? 'Atualizando...' : costGuardMetrics?.enabled ? 'Desativar Google Places' : 'Ativar Google Places'}</span>
                  </button>
                </div>
              </div>

              {/* Status and Keys Row (Requirement 10 & 14) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Chave Servidor</span>
                  <span className="text-xs font-extrabold text-[#1E293B] flex items-center gap-1 mt-0.5">
                    {costGuardMetrics?.apiKeyConfigured ? (
                      <span className="text-emerald-700 font-bold">Configurada: SIM</span>
                    ) : (
                      <span className="text-amber-700 font-bold">Configurada: NÃO</span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Nunca exposta no frontend</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Flag Ativação</span>
                  <span className="text-xs font-extrabold text-[#1E293B] block mt-0.5">
                    {costGuardMetrics?.enabled ? (
                      <span className="text-emerald-700">Ativada: SIM</span>
                    ) : (
                      <span className="text-slate-600">Ativada: NÃO (Padrão)</span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">GOOGLE_PLACES_ENABLED</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Fotos Google</span>
                  <span className="text-xs font-extrabold text-slate-700 block mt-0.5">
                    {costGuardMetrics?.photosEnabled ? 'Ativadas' : 'DESATIVADAS (Padrão)'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">DUO21/Manual é prioridade</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Importação Automática</span>
                  <span className="text-xs font-extrabold text-slate-700 block mt-0.5">
                    {costGuardMetrics?.importEnabled ? 'Ativada' : 'DESATIVADA (Padrão)'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Requer aprovação manual</span>
                </div>
              </div>

              {/* Usage & Cost Metrics Grid (Requirement 10) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Chamadas Hoje</span>
                  <span className="text-base font-black text-[#1E293B] mt-0.5 block">
                    {costGuardMetrics?.callsToday ?? 0} <span className="text-[10px] text-[#64748B] font-normal">/ {costGuardMetrics?.dailyLimit ?? 20} máx</span>
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Chamadas no Mês</span>
                  <span className="text-base font-black text-[#1E293B] mt-0.5 block">
                    {costGuardMetrics?.callsMonth ?? 0} <span className="text-[10px] text-[#64748B] font-normal">/ {costGuardMetrics?.monthlyLimit ?? 500} máx</span>
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Custo Estimado Hoje</span>
                  <span className="text-base font-black text-[#1B4332] mt-0.5 block">
                    {costGuardMetrics?.estimatedCostTodayBrl !== null && costGuardMetrics?.estimatedCostTodayBrl !== undefined
                      ? `R$ ${costGuardMetrics.estimatedCostTodayBrl.toFixed(2)}`
                      : 'Custo não configurado'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Custo Estimado Mês</span>
                  <span className="text-base font-black text-[#1B4332] mt-0.5 block">
                    {costGuardMetrics?.estimatedCostMonthBrl !== null && costGuardMetrics?.estimatedCostMonthBrl !== undefined
                      ? `R$ ${costGuardMetrics.estimatedCostMonthBrl.toFixed(2)}`
                      : 'Custo não configurado'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Budget Restante Hoje</span>
                  <span className="text-base font-black text-emerald-700 mt-0.5 block">
                    R$ {costGuardMetrics?.remainingDailyBudgetBrl?.toFixed(2) ?? '5.00'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Budget Restante Mês</span>
                  <span className="text-base font-black text-emerald-700 mt-0.5 block">
                    R$ {costGuardMetrics?.remainingMonthlyBudgetBrl?.toFixed(2) ?? '50.00'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Cache Hits</span>
                  <span className="text-base font-black text-blue-700 mt-0.5 block">
                    {costGuardMetrics?.cacheHits ?? 0} <span className="text-[10px] text-[#64748B] font-normal">({costGuardMetrics?.cacheHitRate ?? '0%'})</span>
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Chamadas Evitadas</span>
                  <span className="text-base font-black text-emerald-600 mt-0.5 block">
                    {costGuardMetrics?.callsAvoidedByCache ?? 0}
                  </span>
                </div>
              </div>

              {/* Operational Audit Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block">Última Chamada</span>
                  <span className="font-mono text-slate-800">
                    {costGuardMetrics?.lastCallAt ? new Date(costGuardMetrics.lastCallAt).toLocaleString('pt-BR') : 'Nenhuma chamada realizada'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block">Último Local Consultado</span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {costGuardMetrics?.lastPlaceConsulted || 'Nenhum local consultado'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-bold block">Último Erro</span>
                  <span className="text-slate-600 truncate block">
                    {costGuardMetrics?.lastErrorSanitized || 'Nenhum erro registrado'}
                  </span>
                </div>
              </div>

              {/* Requirement 11: Pricing Table & Credit Audit */}
              <div className="pt-2 border-t border-[#F1EBE0] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1E293B]">
                    Tabela de SKUs e Custos Estimados (Google Places New)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAuditHistory(prev => !prev)}
                    className="text-xs text-[#1B4332] font-bold hover:underline cursor-pointer"
                  >
                    {showAuditHistory ? 'Ocultar Auditoria' : 'Ver Auditoria de Créditos (api_usage)'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  {costGuardMetrics?.pricingTable && Object.values(costGuardMetrics.pricingTable).map((p: any) => (
                    <div key={p.sku} className="p-2.5 bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl space-y-1">
                      <span className="text-[11px] font-bold text-[#1B4332] block truncate">{p.name}</span>
                      <span className="text-xs font-black text-emerald-800 block">
                        {p.costBrl !== null ? `R$ ${p.costBrl.toFixed(2)}` : 'Custo não configurado'}
                      </span>
                      <span className="text-[10px] text-[#64748B] block leading-tight">{p.description}</span>
                    </div>
                  ))}
                </div>

                {/* Audit Records Table */}
                {showAuditHistory && (
                  <div className="space-y-2 mt-2 pt-2 border-t border-[#E7DFCE]">
                    <span className="text-xs font-bold text-[#1E293B] block">
                      Registros de Auditoria de Créditos ({costGuardAuditRecords.length}):
                    </span>
                    {costGuardAuditRecords.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {costGuardAuditRecords.map((rec, idx) => (
                          <div key={rec.id || idx} className="p-2 bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl text-[11px] font-mono flex items-center justify-between">
                            <div>
                              <span className="font-bold text-[#1B4332]">{rec.endpoint}</span>
                              <span className="text-slate-500 ml-2">SKU: {rec.sku}</span>
                              {rec.place_name && <span className="text-slate-700 ml-2">({rec.place_name})</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={rec.cache_hit ? 'text-blue-700 font-bold' : 'text-emerald-700'}>
                                {rec.cache_hit ? 'CACHE HIT' : (rec.cost_label || 'R$ 0,00')}
                              </span>
                              <span className="text-slate-400">{new Date(rec.timestamp).toLocaleTimeString('pt-BR')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#64748B] italic">Nenhuma chamada externa realizada até o momento.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* SPRINT 10B REQUIREMENT 13: TESTE CONTROLADO MINI MUNDO */}
            <div className="bg-white border border-[#E7DFCE] p-5 rounded-3xl shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full inline-block mb-1">
                    Sprint 10B • Pré-Ativação Controlada
                  </span>
                  <h4 className="text-sm font-extrabold text-[#1B4332]">
                    Teste Controlado — Mini Mundo (Gramado - RS)
                  </h4>
                  <p className="text-xs text-[#64748B]">
                    Ação administrativa preparada para validar resolução inicial cirúrgica (1 chamada máx, sem fotos, sem alteração de BD).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMiniMundoModal(true)}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Preparar Teste Mini Mundo</span>
                </button>
              </div>

              <div className={`p-3 rounded-2xl text-xs leading-relaxed border ${
                isGooglePlacesActive
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/70 border-amber-200 text-amber-900'
              }`}>
                {isGooglePlacesActive ? (
                  <span>
                    🟢 <strong>Protocolo de Ativação Autorizado:</strong> <code>GOOGLE_PLACES_ENABLED=true</code> no servidor. O teste de 1 chamada controlada está autorizado, sujeito às cotas do Cost Guard e à confirmação explícita do administrador.
                  </span>
                ) : (
                  <span>
                    🔒 <strong>Protocolo de Bloqueio Ativo:</strong> Chamadas externas ao Google Places estão bloqueadas (<code>GOOGLE_PLACES_ENABLED=false</code>). Nenhuma chamada externa será realizada até que a flag seja ativada no servidor.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODULE 3: WEBHOOKS (DUO21 CMS - Asaas)                         */}
        {/* ============================================================== */}
        {activeTab === 'webhooks' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full inline-block mb-1">
                  CMS DUO21 • Módulo Webhooks
                </span>
                <h3 className="text-base font-extrabold text-[#1B4332]">
                  Webhooks de Pagamento (Asaas)
                </h3>
                <p className="text-xs text-[#64748B]">
                  Ponto de entrada público para confirmação financeira, idempotência e geração de roteiros.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchHealthAndWebhook}
                className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>
            </div>

            {/* Webhook Endpoint Card */}
            <div className="bg-white border border-[#E7DFCE] p-5 rounded-3xl shadow-xs space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Endpoint Definitivo de Produção</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-emerald-800 text-white font-mono text-[10px] font-bold rounded">POST</span>
                  <span className="font-mono text-xs font-bold text-[#1B4332] bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 break-all select-all">
                    https://roteiro.duo21.com.br/api/payments/webhook
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Público, sem autenticação por cookies/sessão, protegido por <code className="font-mono font-bold text-slate-700">asaas-access-token</code> header.
                </p>
              </div>

              {/* 4 Essential Fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Status</span>
                  <span className="text-xs font-extrabold text-emerald-800 flex items-center gap-1 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {webhookData?.status === 'active' ? 'ATIVO (Pronto)' : 'ATIVO'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Último Evento</span>
                  <span className="text-xs font-black text-slate-800 font-mono mt-0.5 block truncate">
                    {webhookData?.last_event || 'PAYMENT_RECEIVED'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Último HTTP Status</span>
                  <span className="text-xs font-extrabold text-emerald-700 font-mono mt-0.5 block">
                    HTTP {webhookData?.last_http_status || 200} OK
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Último Processamento</span>
                  <span className="text-xs font-bold text-slate-700 font-mono mt-0.5 block truncate">
                    {webhookData?.last_processed_at ? new Date(webhookData.last_processed_at).toLocaleTimeString('pt-BR') : 'Hoje'}
                  </span>
                </div>
              </div>

              {/* Audit trail summary */}
              <div className="pt-2 border-t border-[#F1EBE0] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1E293B]">Auditoria de Eventos Financeiros:</span>
                  <span className="font-mono text-slate-500">
                    {webhookData?.events_count || recentEvents.length} eventos registrados
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {recentEvents.length > 0 ? (
                    recentEvents.slice(0, 5).map((ev, idx) => (
                      <div key={idx} className="p-2 bg-[#FAF9F6] border border-[#F1EBE0] rounded-xl text-[11px] font-mono flex items-center justify-between">
                        <span className="text-emerald-800 font-bold">{ev.event || ev.type}</span>
                        <span className="text-slate-500 truncate mx-2">ID: {ev.id || ev.paymentId}</span>
                        <span className="text-slate-400">{new Date(ev.timestamp || ev.createdAt).toLocaleTimeString('pt-BR')}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 bg-[#FAF9F6] border border-[#F1EBE0] rounded-xl text-[11px] text-slate-500 text-center">
                      Nenhum evento recente pendente. Sandbox e Webhook sincronizados com sucesso.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODULE 4: ANALYTICS (DASHBOARD & CUSTOS)                       */}
        {/* ============================================================== */}
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE]">
                <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Roteiros Criados</span>
                <span className="text-xl font-black text-[#1E293B]">{metrics.total_trips_created}</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE]">
                <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Roteiros Pagos</span>
                <span className="text-xl font-black text-[#1B4332]">{metrics.total_trips_paid}</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE]">
                <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Taxa Conversão</span>
                <span className="text-xl font-black text-emerald-600">{metrics.conversion_rate}%</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-[#E7DFCE]">
                <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">Receita Bruta</span>
                <span className="text-xl font-black text-[#1B4332]">R$ {metrics.gross_revenue_brl.toFixed(2)}</span>
              </div>
            </div>

            {/* Cost Breakdown Card (Requirement 43) */}
            <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-[#1E293B]">
                  Custos Variáveis Operacionais (CostGuard: Teto &lt; R$ 1,00 / roteiro)
                </h3>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Média: R$ {liveUsage?.avgCostPerTripBrl !== undefined ? liveUsage.avgCostPerTripBrl.toFixed(2) : '0.15'} / viagem
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Google Gemini</span>
                    <span className="font-bold text-xs text-slate-800">
                      R$ {liveUsage?.byProvider?.GEMINI?.costBrl?.toFixed(2) || '0.00'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{liveUsage?.byProvider?.GEMINI?.requests || 0} reqs</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Google Places</span>
                    <span className="font-bold text-xs text-slate-800">
                      R$ {liveUsage?.byProvider?.GOOGLE_PLACES?.costBrl?.toFixed(2) || '0.00'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{liveUsage?.byProvider?.GOOGLE_PLACES?.requests || 0} reqs</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Routes API</span>
                    <span className="font-bold text-xs text-slate-800">
                      R$ {liveUsage?.byProvider?.ROUTES?.costBrl?.toFixed(2) || '0.00'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{liveUsage?.byProvider?.ROUTES?.requests || 0} reqs</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Weather API</span>
                    <span className="font-bold text-xs text-slate-800">
                      R$ {liveUsage?.byProvider?.WEATHER?.costBrl?.toFixed(2) || '0.00'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{liveUsage?.byProvider?.WEATHER?.requests || 0} reqs</span>
                  </div>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#F1EBE0]">
                  <span className="text-[#64748B]">Total Requisições Registradas:</span>
                  <span className="font-bold text-[#1E293B]">{liveUsage?.totalRequests || 0} chamadas</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F1EBE0]">
                  <span className="text-[#64748B]">Economia com Cache (`external_data_cache`):</span>
                  <span className="font-bold text-emerald-700">Cache-First ativo (TTL 24h a 30 dias)</span>
                </div>
                <div className="flex justify-between py-1.5 bg-[#EBF3EE] p-2.5 rounded-xl text-[#1B4332] font-bold">
                  <span>Custo Variável Total Médio por Roteiro:</span>
                  <span>R$ {(liveUsage?.avgCostPerTripBrl || 0.15).toFixed(2)} (Abaixo do teto de R$ 1,00 ✅)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODULE: CATÁLOGO CENTRAL DUO21 & PREÇOS (Sprint 10A Section 2) */}
        {/* ============================================================== */}
        {activeTab === 'places' && (() => {
          const filteredPlaces = places.filter(p => {
            if (catalogSearch.trim()) {
              const q = catalogSearch.toLowerCase();
              const matchName = p.name.toLowerCase().includes(q);
              const matchAddress = (p.address || '').toLowerCase().includes(q);
              const matchDesc = (p.description || '').toLowerCase().includes(q);
              if (!matchName && !matchAddress && !matchDesc) return false;
            }
            if (catalogCity !== 'ALL' && p.city !== catalogCity) return false;
            if (catalogCategory !== 'ALL' && p.category !== catalogCategory) return false;
            if (catalogActive === 'ACTIVE' && !p.active) return false;
            if (catalogActive === 'INACTIVE' && p.active) return false;
            if (catalogPartner === 'PARTNER' && !p.is_divulga_lugares_partner && !(p as any).partner) return false;
            if (catalogPartner === 'NON_PARTNER' && (p.is_divulga_lugares_partner || (p as any).partner)) return false;

            const hasPhoto = Boolean((Array.isArray(p.media) && p.media.some(m => m.active !== false && m.url)) || (p as any).media_url);
            if (catalogPhoto === 'WITH_PHOTO' && !hasPhoto) return false;
            if (catalogPhoto === 'WITHOUT_PHOTO' && hasPhoto) return false;

            const hasHoursConfirmed = Boolean(
              p.always_open || 
              (p.opening_hours && Object.keys(p.opening_hours).length > 0 && 
               Object.values(p.opening_hours).some((v: any) => v && v !== 'Horário não confirmado' && v !== 'Fechado'))
            );
            if (catalogHours === 'WITH_HOURS' && !hasHoursConfirmed) return false;
            if (catalogHours === 'UNCONFIRMED' && hasHoursConfirmed) return false;

            const hasGoogleId = Boolean(p.google_place_id && p.google_place_id.trim().length > 0);
            if (catalogGooglePlaceId === 'WITH_PLACE_ID' && !hasGoogleId) return false;
            if (catalogGooglePlaceId === 'WITHOUT_PLACE_ID' && hasGoogleId) return false;

            const hasDivulga = hasDivulgaContent(p);
            if (catalogDivulga === 'WITH_DIVULGA' && !hasDivulga) return false;
            if (catalogDivulga === 'WITHOUT_DIVULGA' && hasDivulga) return false;

            if (catalogQuality !== 'ALL') {
              const dq = calculatePlaceDataQuality(p);
              if (dq.label !== catalogQuality) return false;
            }

            return true;
          });

          return (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#E7DFCE] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      Sprint 10A • Catálogo Inteligente
                    </span>
                    <span className="text-xs text-[#7A6F5D]">
                      {filteredPlaces.length} de {places.length} locais exibidos
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-[#1B4332] mt-0.5">
                    Catálogo Central de Locais & Preços
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchPlacesAndMetrics}
                    disabled={isLoadingPlaces}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-[#1E293B] text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    title="Recarregar locais do banco"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPlaces ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Recarregar</span>
                  </button>

                  {currentUser?.role === 'super_admin' && (
                    <button
                      type="button"
                      onClick={() => setShowAcceleratorModal(true)}
                      className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Rocket className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Acelerador (Meta 150)</span>
                    </button>
                  )}

                  {currentUser?.role !== 'viewer' ? (
                    <button
                      onClick={handleCreateNewPlace}
                      className="px-3.5 py-2 bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Novo Local</span>
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200">
                      Modo Leitura
                    </span>
                  )}
                </div>
              </div>

              {/* Cost Guard & Google Places Status Card */}
              {costGuardMetrics && (
                <div className="bg-[#FAF6EE] p-4 rounded-3xl border border-[#E2D5BE] space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                        costGuardMetrics.status === 'CONNECTED' ? 'bg-emerald-100 text-emerald-800' :
                        costGuardMetrics.status === 'CONFIGURATION_REQUIRED' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {costGuardMetrics.status === 'CONNECTED' ? '🟢 GOOGLE PLACES CONECTADO' :
                         costGuardMetrics.status === 'CONFIGURATION_REQUIRED' ? '🟡 PLACES READY (AGUARDANDO CHAVE)' :
                         '⚪ GOOGLE PLACES DESATIVADO (COST GUARD)'}
                      </span>
                      <span className="text-xs font-bold text-[#1B4332]">
                        Provedor Externo: {costGuardMetrics.provider}
                      </span>
                    </div>

                    <button
                      onClick={handleToggleCostGuard}
                      disabled={costGuardUpdating}
                      className={`px-3 py-1 text-xs font-bold rounded-xl transition-colors ${
                        costGuardMetrics.enabled
                          ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                    >
                      {costGuardUpdating ? 'Atualizando...' : costGuardMetrics.enabled ? 'Desativar Consumo' : 'Ativar Consumo'}
                    </button>
                  </div>

                  <p className="text-xs text-[#64748B]">
                    Arquitetura <strong>Cache-First e Supabase-First</strong>. Chamadas externas ocorrem estritamente sob demanda na curadoria administrativa. Limite diário: {costGuardMetrics.callsToday}/{costGuardMetrics.dailyLimit} reqs (Orçamento R$ {costGuardMetrics.dailyBudgetBrl.toFixed(2)}/dia).
                  </p>

                  {/* Detalhamento por SKU & Franquia Mensal Gratuita (Sprint 10D Requisito 4) */}
                  {costGuardMetrics.skuBreakdown && (
                    <div className="pt-2 border-t border-[#E2D5BE]/60 space-y-1.5">
                      <span className="text-[10px] font-extrabold text-[#1B4332] uppercase tracking-wider block">
                        Auditoria de SKUs & Franquia Mensal Oficial (Google Maps Platform)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {Object.values(costGuardMetrics.skuBreakdown as Record<string, any>).map((skuItem: any) => (
                          <div key={skuItem.sku} className="p-2 bg-white/80 rounded-xl border border-[#E2D5BE] text-[11px] space-y-0.5">
                            <div className="flex items-center justify-between">
                              <strong className="text-[#1E293B] font-bold truncate">{skuItem.name}</strong>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                                skuItem.status === 'WITHIN_FREE_TIER' 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {skuItem.status === 'WITHIN_FREE_TIER' ? 'GRÁTIS' : 'PAGO'}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#64748B] flex justify-between">
                              <span>Mês: {skuItem.callsMonth} reqs</span>
                              <span>Franquia: {skuItem.officialMonthlyFreeTier.toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="text-[10px] text-[#64748B] flex justify-between">
                              <span>Restante: {skuItem.remainingFreeTier.toLocaleString('pt-BR')}</span>
                              <span className="font-bold text-[#1B4332]">
                                {skuItem.costBrl ? `R$ ${(skuItem.costBrl * skuItem.callsMonth).toFixed(2)}` : 'R$ 0,00'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Catalog Metrics Summary Grid (Sprint 10D Hotfix P0 - Indicadores Reais Auditados) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] text-[#7A6F5D] uppercase font-bold block">Cadastrados</span>
                  <span className="font-extrabold text-base text-[#1E293B] mt-0.5 block">
                    {places.length} <span className="text-[10px] text-[#64748B] font-normal">total</span>
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] text-[#7A6F5D] uppercase font-bold block">Verificados</span>
                  <span className="font-extrabold text-base text-emerald-800 mt-0.5 block">
                    {places.filter(p => (p.audit_status || auditPlaceRecord(p)) === 'VERIFIED').length}
                    <span className="text-[10px] text-emerald-600 font-normal"> / {places.length}</span>
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] text-[#7A6F5D] uppercase font-bold block">Fotos Reais</span>
                  <span className="font-extrabold text-base text-[#1B4332] mt-0.5 block">
                    {places.filter(p => hasRealPhotos(p)).length}
                    <span className="text-[10px] text-amber-600 font-normal"> ({places.filter(p => !hasRealPhotos(p)).length} placeh.)</span>
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] text-[#7A6F5D] uppercase font-bold block">Place ID Real</span>
                  <span className="font-extrabold text-base text-blue-700 mt-0.5 block">
                    {places.filter(p => hasRealGooglePlaceId(p)).length}
                    <span className="text-[10px] text-[#64748B] font-normal"> homolog.</span>
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] text-[#7A6F5D] uppercase font-bold block">IDs Demo / Pend.</span>
                  <span className="font-extrabold text-base text-amber-700 mt-0.5 block">
                    {places.filter(p => isDemoPlaceId(p.google_place_id) || (p.audit_status || auditPlaceRecord(p)) === 'PENDING_VERIFICATION').length}
                    <span className="text-[10px] text-[#64748B] font-normal"> a resolver</span>
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] text-[#7A6F5D] uppercase font-bold block">Elegíveis Roteiro</span>
                  <span className="font-extrabold text-base text-indigo-700 mt-0.5 block">
                    {places.filter(p => isPlaceEligibleForItinerary(p)).length}
                    <span className="text-[10px] text-[#64748B] font-normal"> ativos</span>
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#E7DFCE]">
                  <span className="text-[10px] text-[#7A6F5D] uppercase font-bold block">Parceiros Reais</span>
                  <span className="font-extrabold text-base text-purple-700 mt-0.5 block">
                    {places.filter(p => p.is_divulga_lugares_partner && !isDemoPlaceId(p.google_place_id)).length}
                    <span className="text-[10px] text-[#64748B] font-normal"> comprov.</span>
                  </span>
                </div>
              </div>

              {/* Search & Filters Section */}
              <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-[#7A6F5D] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Pesquisar por nome do local, endereço ou palavra-chave..."
                    className="w-full pl-9 pr-4 py-2.5 bg-[#FAF9F6] border border-[#E7DFCE] rounded-2xl text-xs text-[#1E293B] outline-none focus:border-[#1B4332]"
                  />
                  {catalogSearch && (
                    <button
                      onClick={() => setCatalogSearch('')}
                      className="absolute right-3 top-2.5 text-xs text-[#64748B] hover:text-[#1E293B]"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Filters Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-[#64748B] block mb-0.5">Cidade</label>
                    <select
                      value={catalogCity}
                      onChange={(e) => setCatalogCity(e.target.value)}
                      className="w-full p-1.5 bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl text-xs font-semibold text-[#1E293B] outline-none"
                    >
                      <option value="ALL">Todas as Cidades</option>
                      <option value="Gramado">Gramado</option>
                      <option value="Canela">Canela</option>
                      <option value="Nova Petrópolis">Nova Petrópolis</option>
                      <option value="Bento Gonçalves">Bento Gonçalves</option>
                      <option value="Cambará do Sul">Cambará do Sul</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#64748B] block mb-0.5">Categoria</label>
                    <select
                      value={catalogCategory}
                      onChange={(e) => setCatalogCategory(e.target.value)}
                      className="w-full p-1.5 bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl text-xs font-semibold text-[#1E293B] outline-none"
                    >
                      <option value="ALL">Todas as Categorias</option>
                      <option value="atrativo">Atrativo</option>
                      <option value="restaurante">Restaurante</option>
                      <option value="cafe">Café</option>
                      <option value="museu">Museu</option>
                      <option value="vinicola">Vinícola</option>
                      <option value="chocolate">Chocolate</option>
                      <option value="mirante">Mirante</option>
                      <option value="compras">Compras</option>
                      <option value="noturno">Noturno</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#64748B] block mb-0.5">Status</label>
                    <select
                      value={catalogActive}
                      onChange={(e) => setCatalogActive(e.target.value)}
                      className="w-full p-1.5 bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl text-xs font-semibold text-[#1E293B] outline-none"
                    >
                      <option value="ALL">Todos os Status</option>
                      <option value="ACTIVE">Apenas Ativos</option>
                      <option value="INACTIVE">Apenas Inativos</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#64748B] block mb-0.5">Parceiro</label>
                    <select
                      value={catalogPartner}
                      onChange={(e) => setCatalogPartner(e.target.value)}
                      className="w-full p-1.5 bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl text-xs font-semibold text-[#1E293B] outline-none"
                    >
                      <option value="ALL">Todos</option>
                      <option value="PARTNER">Apenas Parceiros</option>
                      <option value="NON_PARTNER">Não Parceiros</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#64748B] block mb-0.5">Qualidade</label>
                    <select
                      value={catalogQuality}
                      onChange={(e) => setCatalogQuality(e.target.value)}
                      className="w-full p-1.5 bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl text-xs font-semibold text-[#1E293B] outline-none"
                    >
                      <option value="ALL">Todas as Faixas</option>
                      <option value="Completo">Completo (80-100%)</option>
                      <option value="Bom">Bom (60-79%)</option>
                      <option value="Incompleto">Incompleto (&lt;60%)</option>
                      <option value="Precisa atualização">Precisa Atualização</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#64748B] block mb-0.5">Fotos</label>
                    <select
                      value={catalogPhoto}
                      onChange={(e) => setCatalogPhoto(e.target.value)}
                      className="w-full p-1.5 bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl text-xs font-semibold text-[#1E293B] outline-none"
                    >
                      <option value="ALL">Todas</option>
                      <option value="WITH_PHOTO">Com Foto</option>
                      <option value="WITHOUT_PHOTO">Sem Foto</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#64748B] block mb-0.5">Horários</label>
                    <select
                      value={catalogHours}
                      onChange={(e) => setCatalogHours(e.target.value)}
                      className="w-full p-1.5 bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl text-xs font-semibold text-[#1E293B] outline-none"
                    >
                      <option value="ALL">Todos</option>
                      <option value="WITH_HOURS">Confirmados / 24h</option>
                      <option value="UNCONFIRMED">Não Confirmados</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#64748B] block mb-0.5">Google Place ID</label>
                    <select
                      value={catalogGooglePlaceId}
                      onChange={(e) => setCatalogGooglePlaceId(e.target.value)}
                      className="w-full p-1.5 bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl text-xs font-semibold text-[#1E293B] outline-none"
                    >
                      <option value="ALL">Todos</option>
                      <option value="WITH_PLACE_ID">Com Place ID</option>
                      <option value="WITHOUT_PLACE_ID">Sem Place ID</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#64748B] block mb-0.5">Conteúdo Divulga</label>
                    <select
                      value={catalogDivulga}
                      onChange={(e) => setCatalogDivulga(e.target.value)}
                      className="w-full p-1.5 bg-[#FAF9F6] border border-[#E7DFCE] rounded-xl text-xs font-semibold text-[#1E293B] outline-none"
                    >
                      <option value="ALL">Todos</option>
                      <option value="WITH_DIVULGA">⭐ Com Conteúdo</option>
                      <option value="WITHOUT_DIVULGA">Sem Conteúdo</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setCatalogSearch('');
                        setCatalogCity('ALL');
                        setCatalogCategory('ALL');
                        setCatalogActive('ALL');
                        setCatalogPartner('ALL');
                        setCatalogPhoto('ALL');
                        setCatalogHours('ALL');
                        setCatalogGooglePlaceId('ALL');
                        setCatalogDivulga('ALL');
                        setCatalogQuality('ALL');
                      }}
                      className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-[#475569] font-bold text-xs rounded-xl transition-colors"
                    >
                      Limpar Filtros
                    </button>
                  </div>
                </div>
              </div>

              {/* Places List (Clickable & Editable) */}
              <div className="space-y-2">
                {filteredPlaces.length === 0 ? (
                  <div className="bg-white p-8 text-center rounded-3xl border border-[#E7DFCE] text-xs text-[#64748B] space-y-2">
                    <p className="font-bold text-[#1E293B]">Nenhum local encontrado com os filtros selecionados.</p>
                    <button
                      onClick={() => {
                        setCatalogSearch('');
                        setCatalogCity('ALL');
                        setCatalogCategory('ALL');
                        setCatalogActive('ALL');
                        setCatalogPartner('ALL');
                        setCatalogPhoto('ALL');
                        setCatalogHours('ALL');
                        setCatalogGooglePlaceId('ALL');
                        setCatalogDivulga('ALL');
                        setCatalogQuality('ALL');
                      }}
                      className="px-3 py-1.5 bg-[#1B4332] text-white text-xs font-bold rounded-xl"
                    >
                      Resetar Filtros
                    </button>
                  </div>
                ) : (
                  filteredPlaces.map(p => {
                    const dq = calculatePlaceDataQuality(p);
                    const isDivulga = hasDivulgaContent(p);
                    const heroUrl = p.media?.[0]?.url || (p as any).media_url;

                    return (
                      <div
                        key={p.id}
                        className={`bg-white p-3.5 rounded-2xl border transition-all hover:shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          p.active ? 'border-[#E7DFCE]' : 'border-rose-200 bg-rose-50/20 opacity-80'
                        }`}
                      >
                        {/* Left: Thumbnail & Info */}
                        <div 
                          onClick={() => setEditingPlace(p)}
                          className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                        >
                          {heroUrl ? (
                            <img
                              src={heroUrl}
                              alt={p.name}
                              className="w-14 h-14 object-cover rounded-xl shrink-0 border border-[#E7DFCE]"
                            />
                          ) : (
                            <div className="w-14 h-14 bg-slate-100 rounded-xl shrink-0 border border-dashed border-slate-300 flex items-center justify-center text-[#7A6F5D]">
                              <Camera className="w-5 h-5 text-slate-400" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            {/* Badges row */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-[#1B4332] bg-[#EBF3EE] px-1.5 py-0.5 rounded">
                                {p.city}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6F5D] bg-[#FAF9F6] border border-[#E7DFCE] px-1.5 py-0.5 rounded">
                                {p.category}
                              </span>
                              {!p.active && (
                                <span className="text-[9px] font-extrabold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded">
                                  Desativado
                                </span>
                              )}
                              {isDivulga && (
                                <span className="text-[9px] font-extrabold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                  ⭐ Dica Divulga
                                </span>
                              )}
                              {/* Audit Status Badge */}
                              {(p.audit_status || auditPlaceRecord(p)) === 'VERIFIED' ? (
                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-300">
                                  ✓ Auditado
                                </span>
                              ) : (p.audit_status || auditPlaceRecord(p)) === 'PENDING_VERIFICATION' ? (
                                <span className="text-[9px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">
                                  Pendente Resolução
                                </span>
                              ) : (p.audit_status || auditPlaceRecord(p)) === 'DEMO' ? (
                                <span className="text-[9px] font-bold bg-rose-50 text-rose-800 px-1.5 py-0.2 rounded border border-rose-200">
                                  Demo
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold bg-red-100 text-red-800 px-1.5 py-0.2 rounded border border-red-300">
                                  Conflito
                                </span>
                              )}

                              {/* Parceria Comercial (Apenas se comprovada) */}
                              {p.is_divulga_lugares_partner && !isDemoPlaceId(p.google_place_id) && (
                                <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                                  🤝 Parceiro
                                </span>
                              )}

                              {/* Google Place ID Real vs Demonstrativo */}
                              {isDemoPlaceId(p.google_place_id) ? (
                                <span className="text-[9px] font-bold bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded" title="Google Place ID demonstrativo pendente de Smart Resolver">
                                  ID Demo
                                </span>
                              ) : hasRealGooglePlaceId(p) ? (
                                <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded" title="Google Place ID real verificado">
                                  Place ID Real
                                </span>
                              ) : null}

                              {/* Fotos: Real vs Placeholder */}
                              {hasRealPhotos(p) ? (
                                <span className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded">
                                  Foto Real
                                </span>
                              ) : (
                                <span className="text-[9px] font-normal bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded">
                                  Placeholder
                                </span>
                              )}

                              {/* Data Quality Score (com cap anti-placeholder) */}
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                dq.label === 'Completo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                dq.label === 'Bom' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {dq.score}% ({dq.label})
                              </span>
                            </div>

                            <h4 className="font-extrabold text-sm text-[#1E293B] truncate mt-1 hover:text-[#1B4332] transition-colors">
                              {p.name}
                            </h4>
                            <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                              {p.address || `${p.city} - RS`} • Duração {p.average_duration_minutes} min • {p.price_info?.source_name || 'Curadoria'}
                            </p>
                          </div>
                        </div>

                        {/* Right: Price & Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <div className="text-right">
                            <span className="text-[10px] text-[#64748B] block">Adulto:</span>
                            <span className="text-xs font-black text-[#1E293B]">
                              {p.price_info?.is_free ? 'Grátis' : `R$ ${p.price_info?.adult_price?.toFixed(2) || '0.00'}`}
                            </span>
                          </div>

                          {currentUser?.role !== 'viewer' && (
                            <>
                              <button
                                onClick={() => setEditingPlace(p)}
                                className="px-3 py-1.5 bg-[#FAF6EE] hover:bg-[#EFE7D8] text-[#1B4332] border border-[#D8C9AE] rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                title="Editar todas as seções do local"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Editar</span>
                              </button>

                              <button
                                onClick={() => handleTogglePlaceActive(p.id)}
                                title={p.active ? 'Desativar temporariamente do catálogo' : 'Ativar no catálogo'}
                                className={`p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                  p.active ? 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {p.active ? <EyeOff className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB 3: EVENTS */}
        {activeTab === 'events' && (
          <div className="space-y-3">
            <h3 className="font-extrabold text-sm text-[#1E293B]">Eventos Âncora Cadastrados</h3>
            <div className="space-y-2">
              {events.map(evt => (
                <div key={evt.id} className="bg-white p-4 rounded-2xl border border-[#E7DFCE] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1B4332]">{evt.name}</span>
                    <span className="text-[10px] font-bold bg-[#EBF3EE] text-[#1B4332] px-2 py-0.5 rounded">
                      {evt.city}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B]">{evt.description}</p>
                  <p className="text-[11px] text-[#7A6F5D] font-medium">
                    Período: {evt.start_date} até {evt.end_date} • {evt.price_info}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: USER REPORTS (Requirement 40) */}
        {activeTab === 'reports' && (
          <div className="space-y-3">
            <h3 className="font-extrabold text-sm text-[#1E293B]">Relatos de Turistas para Curadoria</h3>
            {reports.length === 0 ? (
              <div className="bg-white p-8 text-center rounded-3xl border border-[#E7DFCE] text-xs text-[#64748B]">
                Nenhum relato pendente de análise no momento.
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map(r => (
                  <div key={r.id} className="bg-white p-4 rounded-2xl border border-[#E7DFCE] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1E293B]">{r.place_name}</span>
                      <span className="text-[10px] uppercase font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded">
                        {r.report_type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569]">{r.description}</p>
                    <div className="flex justify-end gap-2 pt-1 border-t border-[#F1EBE0]">
                      <button
                        onClick={() => onRejectReport(r.id)}
                        className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg"
                      >
                        Rejeitar
                      </button>
                      <button
                        onClick={() => onApproveReport(r.id)}
                        className="px-3 py-1 bg-[#1B4332] text-white text-xs font-bold rounded-lg"
                      >
                        Aprovar e Ajustar Banco
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: WEIGHTS (Requirement 26) */}
        {activeTab === 'weights' && (
          <div className="bg-white p-5 rounded-3xl border border-[#E7DFCE] space-y-4">
            <div>
              <h3 className="font-extrabold text-sm text-[#1E293B]">Configuração de Pesos do Motor</h3>
              <p className="text-xs text-[#64748B]">Ajuste a pontuação de ranqueamento das atrações:</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span>Compatibilidade / Interesses:</span>
                  <span className="font-bold">{weights.compatibilityInterests}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={weights.compatibilityInterests}
                  onChange={(e) => setWeights(w => ({ ...w, compatibilityInterests: parseInt(e.target.value, 10) }))}
                  className="w-full accent-[#1B4332]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>Logística / Distância / Clusters:</span>
                  <span className="font-bold">{weights.logisticsDistance}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={weights.logisticsDistance}
                  onChange={(e) => setWeights(w => ({ ...w, logisticsDistance: parseInt(e.target.value, 10) }))}
                  className="w-full accent-[#1B4332]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>Orçamento:</span>
                  <span className="font-bold">{weights.budget}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={weights.budget}
                  onChange={(e) => setWeights(w => ({ ...w, budget: parseInt(e.target.value, 10) }))}
                  className="w-full accent-[#1B4332]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>Clima / Proteção de Chuva:</span>
                  <span className="font-bold">{weights.weather}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={weights.weather}
                  onChange={(e) => setWeights(w => ({ ...w, weather: parseInt(e.target.value, 10) }))}
                  className="w-full accent-[#1B4332]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>Curadoria Divulga Lugares (Bônus):</span>
                  <span className="font-bold">{weights.curatorshipDivulgaLugares}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={weights.curatorshipDivulgaLugares}
                  onChange={(e) => setWeights(w => ({ ...w, curatorshipDivulgaLugares: parseInt(e.target.value, 10) }))}
                  className="w-full accent-[#1B4332]"
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (currentUser && currentUser.role === 'viewer') {
                  setUserError('Modo Visualizador: Apenas leitura. Alterações não são permitidas.');
                  return;
                }
                setSavedSuccess(true);
                setTimeout(() => setSavedSuccess(false), 2000);
              }}
              disabled={currentUser?.role === 'viewer'}
              className="w-full py-2.5 bg-[#1B4332] disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow cursor-pointer disabled:cursor-not-allowed"
            >
              {currentUser?.role === 'viewer' ? 'Modo Visualizador (Leitura Apenas)' : 'Salvar Parâmetros do Motor'}
            </button>

            {/* Sub-Aba: Atalho para Usuários e Permissões */}
            <div className="pt-4 mt-4 border-t border-[#F1EBE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF9F6] p-4 rounded-2xl border">
              <div>
                <h4 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Configurações → Usuários e Permissões</span>
                </h4>
                <p className="text-[11px] text-[#64748B]">
                  Gerencie funções (Super Admin, Editor, Visualizador), convites e auditoria de acessos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className="px-3.5 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
              >
                Gerenciar Usuários
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SPRINT 11: ABA USUÁRIOS E PERMISSÕES (RBAC & AUDITORIA)       */}
        {/* ============================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Header Card */}
            <div className="bg-white p-5 rounded-3xl border border-[#E7DFCE] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full inline-block mb-1">
                  DUO Control • Governança & RBAC
                </span>
                <h3 className="text-base font-extrabold text-[#1B4332]">
                  Usuários e Permissões
                </h3>
                <p className="text-xs text-[#64748B]">
                  Administração de contas com níveis de acesso Super Admin, Editor e Visualizador vinculados ao Supabase Auth.
                </p>
              </div>

              {currentUser?.role === 'super_admin' && (
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer self-start sm:self-center"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Convidar Administrador</span>
                </button>
              )}
            </div>

            {/* Feedback Messages */}
            {userError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{userError}</div>
                <button onClick={() => setUserError(null)} className="text-rose-500 hover:text-rose-700">✕</button>
              </div>
            )}

            {userSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{userSuccess}</div>
                <button onClick={() => setUserSuccess(null)} className="text-emerald-600 hover:text-emerald-800">✕</button>
              </div>
            )}

            {/* Role Permissions Matrix Explanation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-purple-50/60 border border-purple-200/80 p-3.5 rounded-2xl">
                <div className="flex items-center gap-1.5 mb-1 text-purple-900 font-extrabold text-xs">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  <span>Super Admin</span>
                </div>
                <p className="text-[11px] text-purple-950 font-medium leading-relaxed">
                  Acesso irrestrito: gestão de usuários, autorizações do Catalog Accelerator, Cost Guard, exclusão de dados e auditoria.
                </p>
              </div>

              <div className="bg-blue-50/60 border border-blue-200/80 p-3.5 rounded-2xl">
                <div className="flex items-center gap-1.5 mb-1 text-blue-900 font-extrabold text-xs">
                  <Edit3 className="w-4 h-4 text-blue-700" />
                  <span>Editor</span>
                </div>
                <p className="text-[11px] text-blue-950 font-medium leading-relaxed">
                  Curadoria editorial: cadastro e edição de locais, fotos, descrições e campanha. Sem permissão para importações externas ou custos.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
                <div className="flex items-center gap-1.5 mb-1 text-slate-800 font-extrabold text-xs">
                  <Eye className="w-4 h-4 text-slate-600" />
                  <span>Visualizador</span>
                </div>
                <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                  Somente leitura: visualização de catálogos, métricas e relatórios operacionais. Proibida qualquer modificação.
                </p>
              </div>
            </div>

            {/* Modal de Convidar Novo Administrador */}
            {isInviteModalOpen && (
              <div className="bg-white p-5 rounded-3xl border-2 border-emerald-600 shadow-md animate-in fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <h4 className="text-sm font-extrabold text-[#1E293B] flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-700" />
                    <span>Convidar Novo Administrador</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleInviteUser} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Ex: Maria Silveira"
                        className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Institucional
                      </label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="maria@duo21.com.br"
                        className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Função de Acesso (RBAC)
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as AdminRole)}
                      className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                    >
                      <option value="editor">Editor — Edição de catálogo, fotos e descrições</option>
                      <option value="viewer">Visualizador — Acesso de leitura e consulta de métricas</option>
                      <option value="super_admin">Super Admin — Acesso irrestrito a todas as operações</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsInviteModalOpen(false)}
                      className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isInviting || !inviteEmail.trim() || !inviteName.trim()}
                      className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isInviting ? 'Enviando Convite...' : 'Enviar Convite'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tabela de Administradores */}
            <div className="bg-white border border-[#E7DFCE] rounded-3xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#F1EBE0]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B4332] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#1B4332]" />
                  <span>Administradores Cadastrados ({adminUsers.length})</span>
                </h4>
                <button
                  type="button"
                  onClick={fetchAdminUsers}
                  className="text-xs text-[#1B4332] font-semibold hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>

              {isLoadingUsers && adminUsers.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  Carregando lista de administradores...
                </div>
              ) : adminUsers.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#64748B]">
                  Nenhum administrador encontrado ou permissão restrita.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Administrador</th>
                        <th className="py-2.5 px-3">Função</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Último Acesso</th>
                        <th className="py-2.5 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminUsers.map(user => {
                        const isSelf = currentUser?.id === user.id;
                        const isSuperAdmin = currentUser?.role === 'super_admin';

                        return (
                          <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span>{user.full_name}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-normal">
                                    Você
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">{user.email}</span>
                            </td>

                            <td className="py-3 px-3">
                              {isSuperAdmin && !isSelf ? (
                                <select
                                  value={user.role}
                                  onChange={(e) => handleUpdateUserRole(user.id, e.target.value as AdminRole)}
                                  className="text-xs font-bold py-1 px-2 rounded-lg border border-slate-200 bg-white"
                                >
                                  <option value="super_admin">Super Admin</option>
                                  <option value="editor">Editor</option>
                                  <option value="viewer">Visualizador</option>
                                </select>
                              ) : (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                  user.role === 'super_admin'
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : user.role === 'editor'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}>
                                  {user.role === 'super_admin' ? 'Super Admin' : user.role === 'editor' ? 'Editor' : 'Visualizador'}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                user.is_active
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                                {user.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-[11px] text-slate-600">
                              {user.last_sign_in_at ? (
                                new Date(user.last_sign_in_at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              ) : (
                                <span className="text-slate-400 italic">Pendente</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right">
                              {isSuperAdmin ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Toggle Status */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                                    disabled={isSelf}
                                    title={isSelf ? 'Você não pode desativar sua própria conta' : (user.is_active ? 'Desativar usuário' : 'Ativar usuário')}
                                    className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                      user.is_active 
                                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    }`}
                                  >
                                    {user.is_active ? 'Desativar' : 'Ativar'}
                                  </button>

                                  {/* Revogar Sessões */}
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeUserSessions(user.id)}
                                    title="Revogar sessões ativas do usuário"
                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Leitura</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Histórico de Auditoria Administrativa */}
            <div className="bg-white border border-[#E7DFCE] rounded-3xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#F1EBE0]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B4332] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#1B4332]" />
                  <span>Trilha de Auditoria Imutável (Últimos Registros)</span>
                </h4>
                <button
                  type="button"
                  onClick={fetchAuditLogs}
                  className="text-xs text-[#1B4332] font-semibold hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingAuditLogs ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#64748B]">
                  Nenhum evento de auditoria registrado no momento.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[360px] overflow-y-auto no-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-2 px-3">Data / Hora</th>
                        <th className="py-2 px-3">Administrador</th>
                        <th className="py-2 px-3">Ação</th>
                        <th className="py-2 px-3">Alvo</th>
                        <th className="py-2 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-700">
                            {log.admin_email}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px] truncate max-w-[140px]" title={log.target_resource || ''}>
                            {log.target_resource || '-'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              log.status === 'SUCCESS' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : log.status === 'BLOCKED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: INTEGRATIONS & APIS (Sprint 0C requirement 13 & 20) */}
        {activeTab === 'integrations' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] shadow-xs flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#1B4332]">
                  Status das Integrações & APIs
                </h3>
                <p className="text-xs text-[#64748B]">
                  Arquitetura desacoplada via Provedores e Repositórios. Preparado para alternar de Mock para Real sem refatoração de telas.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setTestingProviderId('all');
                  const updated: RegisteredProviderStatus[] = [];
                  for (const p of providerStatuses) {
                    const res = await providerRegistry.testProvider(p.id);
                    if (res) updated.push(res);
                  }
                  setProviderStatuses(providerRegistry.getStatuses());
                  setTestingProviderId(null);
                }}
                className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingProviderId === 'all' ? 'animate-spin' : ''}`} />
                <span>Testar Todas</span>
              </button>
            </div>

            <div className="space-y-3">
              {providerStatuses.map(provider => {
                const isTesting = testingProviderId === provider.id || testingProviderId === 'all';
                const statusBadgeColor = 
                  provider.status === 'connected' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                  provider.status === 'mock' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                  provider.status === 'awaiting_key' ? 'bg-sky-100 text-sky-800 border-sky-300' :
                  'bg-rose-100 text-rose-800 border-rose-300';

                return (
                  <div 
                    key={provider.id} 
                    className="bg-white border border-[#E7DFCE] p-4 rounded-2xl shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-extrabold text-[#1E293B]">
                            {provider.name}
                          </h4>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadgeColor}`}>
                            {provider.status.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {provider.environment}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B]">
                          Provedor Ativo: <strong className="text-[#1E293B]">{provider.activeProvider}</strong> • Latência estimada: <strong>{provider.estimatedLatencyMs} ms</strong>
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isTesting}
                        onClick={async () => {
                          setTestingProviderId(provider.id);
                          await providerRegistry.testProvider(provider.id);
                          setProviderStatuses(providerRegistry.getStatuses());
                          setTestingProviderId(null);
                        }}
                        className="px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#F3EFE6] border border-[#E7DFCE] text-[#1B4332] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 min-h-[36px]"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                        <span>{isTesting ? 'Testando...' : 'Testar conexão'}</span>
                      </button>
                    </div>

                    {provider.lastResponseSummary && (
                      <div className="bg-[#FAF9F6] border border-[#F1EBE0] p-2.5 rounded-xl text-[11px] text-[#475569] flex items-center justify-between font-mono">
                        <span className="truncate">Log: {provider.lastResponseSummary}</span>
                        {provider.lastTestedAt && (
                          <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                            {new Date(provider.lastTestedAt).toLocaleTimeString('pt-BR')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 7: TRIP AUDIT (Section 52: TravelProfile, Logistics Anchor, Weather, Routes) */}
        {activeTab === 'trip_audit' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-[#E7DFCE] shadow-xs">
              <h3 className="text-sm font-extrabold text-[#1B4332] mb-1">
                Auditoria de Viagem & Parâmetros Logísticos (DEV/Admin)
              </h3>
              <p className="text-xs text-[#64748B]">
                Inspeção técnica dos parâmetros que alimentam o LogisticsEngine. Oculto para o turista comum.
              </p>
            </div>

            {/* TravelProfile Card */}
            <div className="bg-white p-4 rounded-2xl border border-[#E7DFCE] space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1B4332]">
                <Compass className="w-4 h-4 text-emerald-600" />
                <span>Perfil de Viagem & Âncora Logística</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Hospedagem Âncora</span>
                  <span className="font-bold text-[#1E293B] block">Hotel Sky Gramado</span>
                  <span className="text-[10px] text-slate-400 font-mono">-29.3878, -50.8752</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Grupo & Ritmo</span>
                  <span className="font-bold text-[#1E293B] block">2 Adultos + 2 Crianças (7 e 11)</span>
                  <span className="text-[10px] text-emerald-700 font-bold">Ritmo Tranquilo (2-3 stops/dia)</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Must-Have & Orçamento</span>
                  <span className="font-bold text-rose-700 block">Fondue Tradicional Suíço</span>
                  <span className="text-[10px] text-slate-600 block">Almoço até R$ 80/pessoa</span>
                </div>
              </div>
            </div>

            {/* City Clustering & Route Feasibility */}
            <div className="bg-white p-4 rounded-2xl border border-[#E7DFCE] space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1B4332]">
                <Car className="w-4 h-4 text-emerald-600" />
                <span>Clusterização por Cidade & Margem Logística (Buffer 20%)</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-950 block">Dia 1: Cluster Gramado (Âncora Hotel Sky)</span>
                    <span className="text-[11px] text-emerald-800">Hotel Sky → Lago Negro (1.8km, ~6 min) → Almoço Centro (~8 min) → Mini Mundo</span>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">Zero Zigue-Zague</span>
                </div>
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-blue-950 block">Dia 2: Cluster Canela (Natureza & Mirantes)</span>
                    <span className="text-[11px] text-blue-800">Hotel Sky → Alpen Park (8.4km, ~16 min) → Almoço Canela → Catedral de Pedra</span>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-200 text-blue-900 px-2 py-0.5 rounded">Transição Única</span>
                </div>
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-amber-950 block">Dia 3: Cluster Gramado Temático + Jantar Fondue</span>
                    <span className="text-[11px] text-amber-800">Parque Florybal / Snowland → Almoço → Chocolaterias → Jantar Fondue (19:30)</span>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">Must-Have Atendido</span>
                </div>
                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-purple-950 block">Dia 4: Despedida & Nova Petrópolis / Compras</span>
                    <span className="text-[11px] text-purple-800">Rua Torta & Centro → Praça das Flores / Labirinto Verde → Retorno</span>
                  </div>
                  <span className="text-[10px] font-bold bg-purple-200 text-purple-900 px-2 py-0.5 rounded">Horário Livre</span>
                </div>
              </div>
            </div>

            {/* Weather Protection Policy */}
            <div className="bg-white p-4 rounded-2xl border border-[#E7DFCE] space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1B4332]">
                <CloudRain className="w-4 h-4 text-blue-600" />
                <span>Política de Adaptação Climática (WeatherReplanService)</span>
              </div>
              <p className="text-xs text-[#64748B]">
                Caso a previsão meteorológica aponte chuva forte (HEAVY_RAIN ou tempestade), o motor substitui automaticamente passeios abertos por atrações cobertas (Snowland, Mundo de Chocolate, museus temáticos), registrando <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">consumed_quota: false</code>.
              </p>
            </div>
          </div>
        )}

        {/* Sprint 9.2 Section 9 & 10: CAMPAIGN TAB */}
        {activeTab === 'campaign' && (
          <div className="space-y-4">
            {/* Header Card */}
            <div className="bg-white p-5 rounded-2xl border border-[#E7DFCE] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E7DFCE]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
                      <DollarSign className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold text-[#1B4332]">
                        Lançamento — Primeiros 300 Roteiros
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        Campanha comercial automática (launch_300) • Expira automaticamente ao atingir 300 pagamentos
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase ${
                      campaignData?.campaign?.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : campaignData?.campaign?.status === 'EXHAUSTED'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {campaignData?.campaign?.status === 'ACTIVE'
                      ? '● Ativa'
                      : campaignData?.campaign?.status === 'EXHAUSTED'
                      ? '● Esgotada'
                      : '● Inativa'}
                  </span>
                  <button
                    onClick={fetchCampaignMetrics}
                    disabled={campaignLoading}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                    title="Atualizar dados"
                  >
                    <RefreshCw className={`w-4 h-4 ${campaignLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Success / Error alerts */}
              {campaignSuccessMsg && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{campaignSuccessMsg}</span>
                </div>
              )}
              {campaignError && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{campaignError}</span>
                </div>
              )}

              {/* Key Indicators Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E7DFCE]">
                  <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">
                    Preço Promocional
                  </span>
                  <span className="text-xl font-extrabold text-[#1B4332] block mt-0.5">
                    R$ {Number(campaignData?.campaign?.priceBrl || 19.90).toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-[10px] text-[#64748B]">Tabela: a partir de R$ 29,90</span>
                </div>

                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E7DFCE]">
                  <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">
                    Limite da Campanha
                  </span>
                  <span className="text-xl font-extrabold text-[#1B4332] block mt-0.5">
                    {campaignData?.campaign?.maxRedemptions || 300}
                  </span>
                  <span className="text-[10px] text-[#64748B]">vagas elegíveis</span>
                </div>

                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E7DFCE]">
                  <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">
                    Vagas Utilizadas
                  </span>
                  <span className="text-xl font-extrabold text-blue-700 block mt-0.5">
                    {campaignData?.campaign?.redemptions_count ?? 0}
                  </span>
                  <span className="text-[10px] text-[#64748B]">pagamentos confirmados</span>
                </div>

                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E7DFCE]">
                  <span className="text-[10px] uppercase font-bold text-[#7A6F5D] block">
                    Vagas Restantes
                  </span>
                  <span className="text-xl font-extrabold text-emerald-700 block mt-0.5">
                    {campaignData?.campaign?.remaining_redemptions ?? 300}
                  </span>
                  <span className="text-[10px] text-[#64748B]">disponíveis</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-[#64748B]">
                  <span>Progresso do Lançamento</span>
                  <span className="font-bold text-[#1B4332]">
                    {Math.round(
                      ((campaignData?.campaign?.redemptions_count || 0) /
                        (campaignData?.campaign?.maxRedemptions || 300)) *
                        100
                    )}
                    % preenchido
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-[#1B4332] rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        ((campaignData?.campaign?.redemptions_count || 0) /
                          (campaignData?.campaign?.maxRedemptions || 300)) *
                          100
                      )}%`
                    }}
                  />
                </div>
              </div>

              {/* Details & Dates */}
              <div className="mt-4 pt-3 border-t border-[#E7DFCE] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#64748B]">
                <div>
                  <span className="font-semibold text-[#1E293B]">Data de Início:</span>{' '}
                  {campaignData?.campaign?.startDate
                    ? new Date(campaignData.campaign.startDate).toLocaleDateString('pt-BR')
                    : '01/10/2026'}
                </div>
                <div>
                  <span className="font-semibold text-[#1E293B]">Data de Término:</span>{' '}
                  {campaignData?.campaign?.endDate
                    ? new Date(campaignData.campaign.endDate).toLocaleDateString('pt-BR')
                    : 'Automático após 300 pagamentos confirmados'}
                </div>
              </div>
            </div>

            {/* Section 10: Commercial Analytics Card */}
            <div className="bg-white p-5 rounded-2xl border border-[#E7DFCE] shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-700" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B4332]">
                  Analytics Comercial da Campanha
                </h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-emerald-900 font-bold block uppercase">
                    Roteiros Vendidos
                  </span>
                  <span className="text-lg font-black text-emerald-950 mt-1 block">
                    {campaignData?.metrics?.total_campaign_orders_paid ?? 0}
                  </span>
                  <span className="text-[10px] text-emerald-800">pedidos pagos</span>
                </div>

                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-emerald-900 font-bold block uppercase">
                    Receita da Campanha
                  </span>
                  <span className="text-lg font-black text-emerald-950 mt-1 block">
                    R$ {Number(campaignData?.metrics?.total_campaign_revenue_brl ?? 0).toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-[10px] text-emerald-800">faturamento bruto</span>
                </div>

                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-emerald-900 font-bold block uppercase">
                    Ticket Médio
                  </span>
                  <span className="text-lg font-black text-emerald-950 mt-1 block">
                    R$ {Number(campaignData?.metrics?.average_ticket_brl ?? 19.90).toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-[10px] text-emerald-800">por roteiro pago</span>
                </div>

                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-emerald-900 font-bold block uppercase">
                    Economia Concedida
                  </span>
                  <span className="text-lg font-black text-emerald-950 mt-1 block">
                    R$ {Number(campaignData?.metrics?.total_promotional_discount_brl ?? 0).toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-[10px] text-emerald-800">desconto promocional</span>
                </div>
              </div>
            </div>

            {/* Admin Management Controls (Sprint 9.2 Section 9: Protected by admin auth) */}
            <div className="bg-white p-5 rounded-2xl border border-[#E7DFCE] shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7DFCE]">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-700" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B4332]">
                    Gerenciamento Administrativo (Control Plane)
                  </h4>
                </div>
                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Protegido via API Key
                </span>
              </div>

              {/* Admin Key Configuration */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Chave Administrativa (x-admin-key)
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={adminApiKey}
                    onChange={(e) => {
                      setAdminApiKey(e.target.value);
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('duo21_admin_key', e.target.value);
                        localStorage.removeItem('duo21_admin_key');
                      }
                    }}
                    placeholder="Insira a chave admin"
                    className="flex-1 px-3 py-2 text-xs bg-white rounded-xl border border-slate-300 font-mono outline-none focus:border-emerald-600"
                  />
                  <button
                    onClick={fetchCampaignMetrics}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Validar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Toggle Active/Inactive */}
                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E7DFCE] flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-xs font-bold text-[#1E293B] block">Status da Campanha</span>
                    <span className="text-[11px] text-[#64748B]">
                      {campaignData?.campaign?.active ? 'Campanha está ativa' : 'Campanha está pausada'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUpdateCampaign({ active: !campaignData?.campaign?.active })}
                    disabled={campaignUpdating}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer ${
                      campaignData?.campaign?.active
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-emerald-700 hover:bg-emerald-800'
                    }`}
                  >
                    {campaignData?.campaign?.active ? 'Desativar Campanha' : 'Ativar Campanha'}
                  </button>
                </div>

                {/* Change Promotional Price */}
                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E7DFCE] flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-xs font-bold text-[#1E293B] block">Preço Promocional (R$)</span>
                    <span className="text-[11px] text-[#64748B]">Valor cobrado na campanha</span>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step="0.10"
                      min="1"
                      value={editPrice}
                      onChange={(e) => setEditPrice(parseFloat(e.target.value) || 19.90)}
                      className="w-24 px-2 py-1.5 text-xs bg-white rounded-lg border border-slate-300 font-bold"
                    />
                    <button
                      onClick={() => handleUpdateCampaign({ priceBrl: editPrice })}
                      disabled={campaignUpdating}
                      className="flex-1 py-1.5 px-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Salvar
                    </button>
                  </div>
                </div>

                {/* Change Limit */}
                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E7DFCE] flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-xs font-bold text-[#1E293B] block">Limite de Vagas</span>
                    <span className="text-[11px] text-[#64748B]">Máximo de pedidos elegíveis</span>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={editLimit}
                      onChange={(e) => setEditLimit(parseInt(e.target.value, 10) || 300)}
                      className="w-24 px-2 py-1.5 text-xs bg-white rounded-lg border border-slate-300 font-bold"
                    />
                    <button
                      onClick={() => handleUpdateCampaign({ maxRedemptions: editLimit })}
                      disabled={campaignUpdating}
                      className="flex-1 py-1.5 px-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MINI MUNDO PRE-ACTIVATION TEST MODAL (Sprint 10B Requirement 13) */}
      {showMiniMundoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-[#E7DFCE] shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1EBE0]">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full inline-block mb-1">
                  Sprint 10B • Requisito 13
                </span>
                <h3 className="text-base font-extrabold text-[#1B4332]">
                  TESTAR GOOGLE PLACES — MINI MUNDO
                </h3>
              </div>
              <button
                onClick={() => setShowMiniMundoModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Protocol Status Banner (Hotfix 10B.1) */}
            <div className={`p-3 rounded-2xl text-xs leading-relaxed border ${
              isGooglePlacesActive
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
            }`}>
              {isGooglePlacesActive ? (
                <span>
                  🟢 <strong>Protocolo de Ativação Autorizado:</strong> <code>GOOGLE_PLACES_ENABLED=true</code> no servidor. O teste de 1 chamada controlada está autorizado, sujeito às cotas do Cost Guard e à confirmação explícita do administrador.
                </span>
              ) : (
                <span>
                  🔒 <strong>Protocolo de Bloqueio Ativo:</strong> Chamadas externas ao Google Places estão bloqueadas (<code>GOOGLE_PLACES_ENABLED=false</code>). Nenhuma chamada externa será realizada até que a flag seja ativada no servidor.
                </span>
              )}
            </div>

            {/* 9 Requirements of Mini Mundo test */}
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-[#FAF9F6] rounded-2xl border border-[#E7DFCE] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Local Alvo:</span>
                  <strong className="text-[#1E293B]">Mini Mundo</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cidade:</span>
                  <strong className="text-[#1E293B]">Gramado - RS</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tipo de Ação:</span>
                  <strong className="text-[#1E293B]">Resolução Inicial de Candidatos</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requisições Máximas:</span>
                  <strong className="text-emerald-700">1 (Uma)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Download de Fotos:</span>
                  <strong className="text-rose-700">NÃO (Desativado)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Importação Automática:</span>
                  <strong className="text-rose-700">NÃO (Apenas apresentação)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Alterar Registro no BD:</span>
                  <strong className="text-rose-700">NÃO (Até confirmação manual)</strong>
                </div>
                <div className="flex flex-col pt-1 border-t border-[#E7DFCE]">
                  <span className="text-slate-500">FieldMask Cirúrgico Obrigatório:</span>
                  <code className="font-mono text-[10px] text-[#1B4332] bg-white p-1.5 rounded-lg border border-[#E7DFCE] mt-0.5 break-all">
                    places.id,places.displayName,places.formattedAddress,places.location,places.types
                  </code>
                </div>
              </div>

              {/* Explicit confirmation checkbox (Requirement 13.1) */}
              <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={miniMundoConfirmed}
                  onChange={(e) => setMiniMundoConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-[#1B4332] focus:ring-[#1B4332]"
                />
                <span className="text-xs text-[#1E293B] leading-relaxed">
                  <strong>Confirmação Explícita Obrigatória:</strong> Confirmo que este teste avalia o Cost Guard e o fluxo defensivo sem persistir dados no catálogo e sem consumir chamadas pagas desnecessárias.
                </span>
              </label>

              {miniMundoTestResult && (
                <div className={`p-4 rounded-2xl border text-xs space-y-3 ${
                  miniMundoTestResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <div className="flex items-center gap-1.5">
                      {miniMundoTestResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          <span className="text-emerald-900 font-extrabold">SUCESSO: Chamada Controlada Executada</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-700" />
                          <span className="text-rose-900 font-extrabold">BLOQUEIO / ERRO</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-[10px] bg-white/80 px-2 py-0.5 rounded border border-current">
                      Cost Guard: {miniMundoTestResult.costGuardStatus}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed">{miniMundoTestResult.message}</p>

                  {/* Operational Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-current/20 font-mono text-[11px]">
                    <div className="bg-white/70 p-2 rounded-xl border border-current/20">
                      <span className="text-[10px] text-slate-500 block uppercase">Chamadas Reais</span>
                      <strong className="text-emerald-800 text-xs">{miniMundoTestResult.externalCallsCount ?? 0} chamada(s)</strong>
                    </div>
                    <div className="bg-white/70 p-2 rounded-xl border border-current/20">
                      <span className="text-[10px] text-slate-500 block uppercase">Custo Estimado</span>
                      <strong className="text-emerald-800 text-xs">R$ {(miniMundoTestResult.estimatedCostBrl ?? 0.18).toFixed(2)}</strong>
                    </div>
                    <div className="bg-white/70 p-2 rounded-xl border border-current/20">
                      <span className="text-[10px] text-slate-500 block uppercase">Salvo no Catálogo</span>
                      <strong className="text-slate-800 text-xs">{miniMundoTestResult.persistedToDatabase ? 'SIM' : 'NÃO (Intacto)'}</strong>
                    </div>
                    <div className="bg-white/70 p-2 rounded-xl border border-current/20">
                      <span className="text-[10px] text-slate-500 block uppercase">Download Fotos</span>
                      <strong className="text-slate-800 text-xs">NÃO (Desativado)</strong>
                    </div>
                  </div>

                  {/* Candidates List Display */}
                  {miniMundoTestResult.candidates && miniMundoTestResult.candidates.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-current/20">
                      <span className="font-bold text-[11px] block">
                        Candidato(s) Retornado(s) pelo Google Places (Apenas Apresentação):
                      </span>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {miniMundoTestResult.candidates.map((c: any, idx: number) => (
                          <div key={c.google_place_id || idx} className="p-2.5 bg-white rounded-xl border border-emerald-200 text-[11px] space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#1B4332]">{c.name}</span>
                              <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                ID: {c.google_place_id}
                              </span>
                            </div>
                            <p className="text-slate-600">{c.address}</p>
                            {c.types && c.types.length > 0 && (
                              <p className="text-[10px] text-slate-400">Tipos: {c.types.slice(0, 3).join(', ')}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-500 italic mt-1">
                        * Confirmação de segurança: Nenhum candidato foi salvo, importado ou vinculado automaticamente ao catálogo do Supabase.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F1EBE0]">
              <button
                type="button"
                onClick={() => setShowMiniMundoModal(false)}
                className="px-4 py-2 border border-[#E7DFCE] text-[#64748B] hover:text-[#1E293B] text-xs font-bold rounded-xl"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={handleRunMiniMundoPreActivation}
                disabled={!miniMundoConfirmed || isTestingMiniMundo}
                className="px-4 py-2 bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isTestingMiniMundo ? 'Executando Chamada...' : 'Executar Teste de Pré-Ativação'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Place Editor Modal (Sprint 10A Section 3 & Hotfix 10A.2) */}
      <PlaceEditorModal
        place={editingPlace}
        isOpen={Boolean(editingPlace)}
        onClose={() => setEditingPlace(null)}
        onSave={handleSavePlace}
        adminApiKey={adminApiKey}
        adminSessionToken={adminSessionToken}
      />

      {/* Catalog Accelerator Modal (Sprint 10D: Meta 150 Locais & Descoberta em Lote) */}
      <CatalogAcceleratorModal
        isOpen={showAcceleratorModal}
        onClose={() => setShowAcceleratorModal(false)}
        onRefreshCatalog={fetchPlacesAndMetrics}
        adminApiKey={adminApiKey}
        adminSessionToken={adminSessionToken}
      />
    </div>
  );
};
