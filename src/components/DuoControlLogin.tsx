import React, { useState } from 'react';
import { 
  Compass, 
  Lock, 
  Mail, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  KeyRound, 
  Eye, 
  EyeOff, 
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { AdminUserRecord, AdminSessionProfile } from '../types';

interface DuoControlLoginProps {
  onLoginSuccess: (user: AdminUserRecord, permissions: AdminSessionProfile['permissions'], token?: string) => void;
  onNavigateHome: () => void;
}

export const DuoControlLogin: React.FC<DuoControlLoginProps> = ({
  onLoginSuccess,
  onNavigateHome
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState<string | null>(null);
  const [isMfaStep, setIsMfaStep] = useState(false);
  const [pendingUser, setPendingUser] = useState<AdminUserRecord | null>(null);
  const [pendingPermissions, setPendingPermissions] = useState<AdminSessionProfile['permissions'] | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Por favor, informe seu email e senha institucional.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(), 
          password,
          mfaCode: mfaCode.trim() || undefined
        }),
        credentials: 'include'
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.mfaRequired) {
          setIsMfaStep(true);
          setPendingUser(data.user);
          setPendingPermissions(data.permissions);
          setErrorMessage(null);
          return;
        }
        throw new Error(data.error || 'Credenciais administrativas inválidas.');
      }

      // Login bem-sucedido
      onLoginSuccess(data.user, data.permissions, data.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao autenticar. Verifique seus dados.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim()) {
      setErrorMessage('Informe o código de 6 dígitos gerado pelo seu aplicativo autenticador.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(), 
          password,
          mfaCode: mfaCode.trim()
        }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Código de autenticação em duas etapas inválido.');
      }

      onLoginSuccess(data.user, data.permissions, data.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Código MFA inválido ou expirado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Informe seu email cadastrado para redefinição de senha.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setForgotSuccessMessage(null);

    try {
      const res = await fetch('/api/admin/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível enviar a solicitação.');
      }

      setForgotSuccessMessage(
        data.message || 'Se o email pertencer a um administrador ativo, as instruções foram enviadas.'
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao processar solicitação de recuperação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-between text-[#1E293B]">
      {/* Top Bar com Identidade e Navegação de Retorno */}
      <header className="w-full max-w-5xl mx-auto p-4 sm:p-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#1B4332] flex items-center justify-center text-white shadow-xs">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-[#1B4332]">DUO21</span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#1B4332] bg-[#EBF3EE] px-2 py-0.5 rounded-md border border-[#D9EADB]">
                Control
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] font-medium leading-tight">Painel de Gestão e Operações</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1B4332] bg-white hover:bg-[#EBF3EE] border border-[#E7DFCE] rounded-xl transition-all shadow-2xs hover:shadow-xs active:scale-98"
        >
          <ArrowLeft className="w-4 h-4 text-[#1B4332]" />
          <span>Voltar ao App</span>
        </button>
      </header>

      {/* Main Container / Card Central */}
      <main className="w-full max-w-md mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        <div className="bg-white border border-[#E7DFCE] rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
          {/* Subtle Top Accent */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1B4332] via-[#2D6A4F] to-[#52B788]" />

          {/* Header do Formulário */}
          <div className="text-center mb-6 pt-1">
            <div className="w-12 h-12 rounded-2xl bg-[#EBF3EE] text-[#1B4332] mx-auto flex items-center justify-center mb-3 border border-[#D9EADB]">
              {isMfaStep ? (
                <ShieldCheck className="w-6 h-6 text-[#1B4332]" />
              ) : isForgotPassword ? (
                <KeyRound className="w-6 h-6 text-[#1B4332]" />
              ) : (
                <Lock className="w-6 h-6 text-[#1B4332]" />
              )}
            </div>

            <h1 className="text-xl font-extrabold text-[#1E293B] tracking-tight">
              {isMfaStep 
                ? 'Autenticação em Duas Etapas' 
                : isForgotPassword 
                ? 'Recuperar Senha' 
                : 'Acesso Administrativo'}
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              {isMfaStep
                ? 'Digite o código de 6 dígitos gerado pelo seu app autenticador.'
                : isForgotPassword
                ? 'Informe seu email corporativo para receber instruções seguras.'
                : 'Entre com suas credenciais do DUO Control.'}
            </p>
          </div>

          {/* Feedback de Erro */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Feedback de Sucesso (Recuperação) */}
          {forgotSuccessMessage && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{forgotSuccessMessage}</div>
            </div>
          )}

          {/* Formulário: MFA Step */}
          {isMfaStep ? (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1.5">
                  Código de Autenticação (TOTP)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full py-3 text-center tracking-widest font-mono text-lg font-extrabold bg-[#FAF9F6] border border-[#CBD5E1] rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent transition-all"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-[#64748B] mt-1 text-center">
                  Super Admin exige verificação em duas etapas para operações críticas.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || mfaCode.length < 6}
                className="w-full py-3 px-4 bg-[#1B4332] hover:bg-[#2D6A4F] disabled:bg-[#94A3B8] text-white font-bold text-sm rounded-2xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-98"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verificando...</span>
                  </span>
                ) : (
                  <span>Confirmar e Acessar</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMfaStep(false);
                  setMfaCode('');
                  setErrorMessage(null);
                }}
                className="w-full py-2 text-xs font-bold text-[#64748B] hover:text-[#1E293B] text-center transition-colors"
              >
                Voltar e alterar credenciais
              </button>
            </form>
          ) : isForgotPassword ? (
            /* Formulário: Esqueci a Senha */
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1.5">
                  Email Institucional
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@duo21.com.br"
                    className="w-full pl-10 pr-4 py-2.5 text-xs font-medium bg-[#FAF9F6] border border-[#CBD5E1] rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent transition-all"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="w-full py-3 px-4 bg-[#1B4332] hover:bg-[#2D6A4F] disabled:bg-[#94A3B8] text-white font-bold text-xs rounded-2xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-98"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Enviando...</span>
                  </span>
                ) : (
                  <span>Enviar Link de Recuperação</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setErrorMessage(null);
                  setForgotSuccessMessage(null);
                }}
                className="w-full py-2 text-xs font-bold text-[#64748B] hover:text-[#1E293B] text-center transition-colors"
              >
                Lembrou sua senha? Voltar ao login
              </button>
            </form>
          ) : (
            /* Formulário: Login Padrão (Email + Senha) */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@duo21.com.br"
                    className="w-full pl-10 pr-4 py-2.5 text-xs font-medium bg-[#FAF9F6] border border-[#CBD5E1] rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent transition-all"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#334155]">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setErrorMessage(null);
                    }}
                    className="text-[11px] font-semibold text-[#1B4332] hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 text-xs font-medium bg-[#FAF9F6] border border-[#CBD5E1] rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:border-transparent transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#94A3B8] hover:text-[#475569] p-0.5"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email.trim() || !password}
                className="w-full py-3 px-4 bg-[#1B4332] hover:bg-[#2D6A4F] disabled:bg-[#94A3B8] text-white font-bold text-xs rounded-2xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-98 mt-2"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Autenticando...</span>
                  </span>
                ) : (
                  <>
                    <span>Entrar no DUO Control</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Rodapé de Governança e Segurança */}
          <div className="mt-6 pt-5 border-t border-[#F1EBE0] text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#64748B]">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-700" />
              <span>Ambiente Protegido por RBAC e Auditoria Imutável</span>
            </div>
            <p className="text-[10px] text-[#94A3B8] mt-1">
              Acesso exclusivo para administradores e editores credenciados pela DUO21.
            </p>
          </div>
        </div>
      </main>

      {/* Footer Discreto */}
      <footer className="w-full max-w-5xl mx-auto p-4 text-center text-[11px] text-[#94A3B8]">
        © 2026 DUO21 Serra Gaúcha • Todos os direitos reservados.
      </footer>
    </div>
  );
};
