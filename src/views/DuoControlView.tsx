import React, { useState, useEffect } from 'react';
import { DuoControlLogin } from '../components/DuoControlLogin';
import { AdminDashboard } from '../components/AdminDashboard';
import { AdminUserRecord, AdminSessionProfile, UserReport } from '../types';
import { Compass } from 'lucide-react';

interface DuoControlViewProps {
  onNavigateHome: () => void;
  reports?: UserReport[];
  onApproveReport?: (id: string) => void;
  onRejectReport?: (id: string) => void;
}

export const DuoControlView: React.FC<DuoControlViewProps> = ({
  onNavigateHome,
  reports = [],
  onApproveReport = () => {},
  onRejectReport = () => {}
}) => {
  const [authStatus, setAuthStatus] = useState<'checking' | 'unauthenticated' | 'authenticated'>('checking');
  const [currentUser, setCurrentUser] = useState<AdminUserRecord | null>(null);
  const [permissions, setPermissions] = useState<AdminSessionProfile['permissions'] | null>(null);

  // Verificação inicial de sessão via backend (/api/admin/auth/me)
  useEffect(() => {
    let isMounted = true;

    async function checkCurrentSession() {
      try {
        const res = await fetch('/api/admin/auth/me', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });

        if (!isMounted) return;

        if (res.ok) {
          const data = await res.json();
          if (data?.user && data.user.is_active) {
            setCurrentUser(data.user);
            setPermissions(data.permissions || null);
            setAuthStatus('authenticated');
            return;
          }
        }
        // Se 401, 403 ou resposta inválida
        setCurrentUser(null);
        setPermissions(null);
        setAuthStatus('unauthenticated');
      } catch {
        if (isMounted) {
          setCurrentUser(null);
          setPermissions(null);
          setAuthStatus('unauthenticated');
        }
      }
    }

    checkCurrentSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLoginSuccess = (
    user: AdminUserRecord,
    userPermissions: AdminSessionProfile['permissions'],
    token?: string
  ) => {
    setCurrentUser(user);
    setPermissions(userPermissions);
    setAuthStatus('authenticated');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    } catch {
      // Ignora erro no logout e encerra sessão local
    } finally {
      setCurrentUser(null);
      setPermissions(null);
      setAuthStatus('unauthenticated');
      sessionStorage.removeItem('duo21_admin_session');
      sessionStorage.removeItem('duo21_admin_key');
    }
  };

  // 1. Tela de Carregamento Neutra e Elegante
  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#1B4332] flex items-center justify-center text-white mb-4 animate-pulse shadow-xs">
          <Compass className="w-6 h-6 text-white" />
        </div>
        <p className="text-sm font-extrabold text-[#1B4332] tracking-tight">DUO Control</p>
        <p className="text-xs text-[#64748B] mt-1">Verificando credenciais seguras...</p>
      </div>
    );
  }

  // 2. Tela de Login (Visitante Não Autenticado)
  if (authStatus === 'unauthenticated' || !currentUser) {
    return (
      <DuoControlLogin
        onLoginSuccess={handleLoginSuccess}
        onNavigateHome={onNavigateHome}
      />
    );
  }

  // 3. Painel Administrativo Completo (Usuário Autenticado)
  return (
    <AdminDashboard
      onClose={onNavigateHome}
      reports={reports}
      onApproveReport={onApproveReport}
      onRejectReport={onRejectReport}
      currentUser={currentUser}
      onLogout={handleLogout}
    />
  );
};
