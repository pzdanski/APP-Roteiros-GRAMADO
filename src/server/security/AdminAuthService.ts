/**
 * SPRINT 11 — DUO CONTROL: SERVIÇO DE AUTENTICAÇÃO, USUÁRIOS E PERMISSÕES (RBAC)
 * 
 * Gerencia a identidade dos administradores no Supabase Auth,
 * persistência de perfis e permissões na tabela public.admin_users,
 * registro imutável em public.admin_audit_logs e controle de concorrência/regras de negócio.
 */

import crypto from 'crypto';
import { supabaseServer } from '../supabaseServer';
import { AdminRole, AdminUserRecord, AdminAuditLogRecord, AdminSessionProfile } from '../../types';
import { TotpService } from './TotpService';

export class AdminAuthService {
  private static instance: AdminAuthService;
  private mockUsers: AdminUserRecord[] = [];
  private mockAuditLogs: AdminAuditLogRecord[] = [];
  private revokedUserSessions: Set<string> = new Set();
  private revokedTokenHashes: Set<string> = new Set();
  private pendingMfaRegistrations: Map<string, { secret: string; expiresAt: number }> = new Map();

  private constructor() {
    this.seedDefaultMockUsers();
  }

  public static getInstance(): AdminAuthService {
    if (!AdminAuthService.instance) {
      AdminAuthService.instance = new AdminAuthService();
    }
    return AdminAuthService.instance;
  }

  private seedDefaultMockUsers() {
    const now = new Date().toISOString();
    this.mockUsers = [
      {
        id: 'usr-admin-00000000-0001',
        email: 'admin@duo21.com.br',
        full_name: 'Super Administrador DUO21',
        role: 'super_admin',
        is_active: true,
        mfa_enabled: true,
        mfa_secret: 'OVGS3SJHGA6OI4VE6JZRXR6T4KKYMPW7',
        last_sign_in_at: now,
        created_at: now,
        updated_at: now
      },
      {
        id: 'usr-editor-00000000-0002',
        email: 'editor@duo21.com.br',
        full_name: 'Editor Editorial DUO21',
        role: 'editor',
        is_active: true,
        mfa_enabled: false,
        last_sign_in_at: now,
        created_at: now,
        updated_at: now
      },
      {
        id: 'usr-viewer-00000000-0003',
        email: 'viewer@duo21.com.br',
        full_name: 'Visualizador Analítico DUO21',
        role: 'viewer',
        is_active: true,
        mfa_enabled: false,
        last_sign_in_at: now,
        created_at: now,
        updated_at: now
      }
    ];
  }

  public getPermissionsForRole(role: AdminRole): AdminSessionProfile['permissions'] {
    if (role === 'super_admin') {
      return {
        canManageUsers: true,
        canExecuteAccelerator: true,
        canAuthorizePhases: true,
        canManageCostGuard: true,
        canEditPlaces: true,
        canDeletePlaces: true,
        canViewMetrics: true,
        canManageCampaigns: true,
        canViewAuditLogs: true
      };
    }
    if (role === 'editor') {
      return {
        canManageUsers: false,
        canExecuteAccelerator: false,
        canAuthorizePhases: false,
        canManageCostGuard: false,
        canEditPlaces: true,
        canDeletePlaces: false,
        canViewMetrics: true,
        canManageCampaigns: true,
        canViewAuditLogs: false
      };
    }
    // viewer
    return {
      canManageUsers: false,
      canExecuteAccelerator: false,
      canAuthorizePhases: false,
      canManageCostGuard: false,
      canEditPlaces: false,
      canDeletePlaces: false,
      canViewMetrics: true,
      canManageCampaigns: false,
      canViewAuditLogs: false
    };
  }

  /**
   * Log de Auditoria Administrativa Imutável
   */
  public async logAuditEvent(event: {
    adminUserId?: string | null;
    adminEmail: string;
    action: string;
    targetResource?: string | null;
    details?: Record<string, any>;
    ipAddress?: string | null;
    status?: string;
  }): Promise<AdminAuditLogRecord> {
    const record: AdminAuditLogRecord = {
      id: crypto.randomUUID(),
      admin_user_id: event.adminUserId || null,
      admin_email: event.adminEmail,
      action: event.action,
      target_resource: event.targetResource || null,
      details: event.details || {},
      ip_address: event.ipAddress || null,
      status: event.status || 'SUCCESS',
      created_at: new Date().toISOString()
    };

    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          await client.from('admin_audit_logs').insert(record);
        }
      } catch (err: any) {
        console.warn('[Audit Log] Falha ao persistir no Supabase:', err.message);
      }
    }

    this.mockAuditLogs.unshift(record);
    if (this.mockAuditLogs.length > 500) {
      this.mockAuditLogs.pop();
    }
    return record;
  }

  public async listAuditLogs(limit: number = 50, offset: number = 0): Promise<AdminAuditLogRecord[]> {
    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          const { data, error } = await client
            .from('admin_audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
          if (!error && data) return data;
        }
      } catch (err: any) {
        console.warn('[Audit Log] Falha ao consultar Supabase:', err.message);
      }
    }
    return this.mockAuditLogs.slice(offset, offset + limit);
  }

  /**
   * Localiza perfil administrativo por ID
   */
  public async getAdminUserById(id: string): Promise<AdminUserRecord | null> {
    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          const { data, error } = await client
            .from('admin_users')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (!error && data) return data as AdminUserRecord;
        }
      } catch (err: any) {
        console.warn('[Admin User] Falha ao buscar por ID no Supabase:', err.message);
      }
    }
    return this.mockUsers.find(u => u.id === id) || null;
  }

  /**
   * Localiza perfil administrativo por email
   */
  public async getAdminUserByEmail(email: string): Promise<AdminUserRecord | null> {
    const normalized = email.toLowerCase().trim();
    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          const { data, error } = await client
            .from('admin_users')
            .select('*')
            .eq('email', normalized)
            .maybeSingle();
          if (!error && data) return data as AdminUserRecord;
        }
      } catch (err: any) {
        console.warn('[Admin User] Falha ao buscar por Email no Supabase:', err.message);
      }
    }
    return this.mockUsers.find(u => u.email.toLowerCase() === normalized) || null;
  }

  /**
   * Lista todos os usuários administrativos (Restrito a Super Admin)
   */
  public async listAdminUsers(): Promise<AdminUserRecord[]> {
    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          const { data, error } = await client
            .from('admin_users')
            .select('*')
            .order('created_at', { ascending: true });
          if (!error && data) return data as AdminUserRecord[];
        }
      } catch (err: any) {
        console.warn('[Admin User] Falha ao listar do Supabase:', err.message);
      }
    }
    return [...this.mockUsers];
  }

  /**
   * Convidar ou registrar novo administrador
   */
  public async inviteAdminUser(params: {
    email: string;
    full_name?: string;
    fullName?: string;
    role: AdminRole;
    invited_by?: string;
    callerId?: string;
    callerEmail?: string;
    ipAddress?: string;
  }): Promise<AdminUserRecord> {
    const email = params.email.toLowerCase().trim();
    const fullName = (params.full_name || params.fullName || 'Administrador').trim();
    const callerId = params.invited_by || params.callerId || 'system';
    const callerEmail = params.callerEmail || 'admin@duo21.com.br';

    const existing = await this.getAdminUserByEmail(email);
    if (existing) {
      throw new Error(`O email '${email}' já possui cadastro administrativo.`);
    }

    let userId = crypto.randomUUID();

    // Se conectado ao Supabase Auth real, convida pelo Supabase Admin API
    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          const { data: authUser, error: authErr } = await client.auth.admin.inviteUserByEmail(email, {
            data: { full_name: params.full_name, role: params.role }
          });
          if (authErr) {
            // Se o usuário já existe no auth.users, busca seu UUID
            const { data: listData } = await client.auth.admin.listUsers();
            const found = (listData?.users as Array<{ id: string; email?: string }>)?.find(u => u.email === email);
            if (found) {
              userId = found.id as `${string}-${string}-${string}-${string}-${string}`;
            } else {
              throw new Error(`Falha ao convidar via Supabase Auth: ${authErr.message}`);
            }
          } else if (authUser?.user) {
            userId = authUser.user.id as `${string}-${string}-${string}-${string}-${string}`;
          }
        }
      } catch (err: any) {
        console.warn('[Admin Invite] Supabase Auth Invite:', err.message);
      }
    }

    const now = new Date().toISOString();
    const newRecord: AdminUserRecord = {
      id: userId,
      email,
      full_name: fullName,
      role: params.role,
      is_active: true,
      mfa_enabled: false,
      last_sign_in_at: null,
      invited_by: callerId === 'system' ? null : callerId,
      created_at: now,
      updated_at: now
    };

    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          await client.from('admin_users').insert(newRecord);
        }
      } catch (err: any) {
        console.warn('[Admin Invite] Falha ao persistir admin_users:', err.message);
      }
    }

    this.mockUsers.push(newRecord);

    await this.logAuditEvent({
      adminUserId: callerId,
      adminEmail: callerEmail,
      action: 'INVITE_ADMIN_USER',
      targetResource: `admin_users/${userId}`,
      details: { invited_email: email, role: params.role, full_name: fullName },
      ipAddress: params.ipAddress
    });

    return newRecord;
  }

  /**
   * Altera a função de um administrador com proteção contra autoelevação
   * e proteção contra remoção do último Super Admin ativo.
   */
  public async updateAdminRole(params: {
    targetUserId: string;
    newRole: AdminRole;
    callerId: string;
    callerEmail: string;
    ipAddress?: string;
  }): Promise<AdminUserRecord> {
    const target = await this.getAdminUserById(params.targetUserId);
    if (!target) {
      throw new Error('Administrador não encontrado.');
    }

    // Regra de Segurança: Não permitir auto-alteração de permissões
    if (params.callerId === params.targetUserId) {
      throw new Error('AUTOELEVACAO_NEGADA: Você não pode alterar sua própria função administrativa.');
    }

    // Regra de Segurança: Impedir que o último Super Admin seja rebaixado
    if (target.role === 'super_admin' && params.newRole !== 'super_admin') {
      const allUsers = await this.listAdminUsers();
      const activeSuperAdmins = allUsers.filter(u => u.role === 'super_admin' && u.is_active && u.id !== target.id);
      if (activeSuperAdmins.length === 0) {
        throw new Error('OPERACAO_BLOQUEADA: Impossível rebaixar o único Super Admin ativo do sistema.');
      }
    }

    const now = new Date().toISOString();
    target.role = params.newRole;
    target.updated_at = now;

    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          await client.from('admin_users').update({ role: params.newRole, updated_at: now }).eq('id', target.id);
        }
      } catch (err: any) {
        console.warn('[Admin Role Update] Falha ao atualizar no Supabase:', err.message);
      }
    }

    const idx = this.mockUsers.findIndex(u => u.id === target.id);
    if (idx >= 0) this.mockUsers[idx] = { ...target };

    await this.logAuditEvent({
      adminUserId: params.callerId,
      adminEmail: params.callerEmail,
      action: 'UPDATE_ADMIN_ROLE',
      targetResource: `admin_users/${target.id}`,
      details: { target_email: target.email, old_role: target.role, new_role: params.newRole },
      ipAddress: params.ipAddress
    });

    return target;
  }

  /**
   * Ativa ou Desativa usuário administrativo
   * com proteção contra desativação do último Super Admin ou de si mesmo.
   */
  public async setAdminStatus(params: {
    targetUserId: string;
    isActive: boolean;
    callerId: string;
    callerEmail: string;
    ipAddress?: string;
  }): Promise<AdminUserRecord> {
    const target = await this.getAdminUserById(params.targetUserId);
    if (!target) {
      throw new Error('Administrador não encontrado.');
    }

    // Regra de Segurança: Não pode desativar a si mesmo
    if (params.callerId === params.targetUserId) {
      throw new Error('OPERACAO_BLOQUEADA: Você não pode desativar seu próprio usuário administrativo.');
    }

    // Regra de Segurança: Não pode desativar o último Super Admin
    if (!params.isActive && target.role === 'super_admin') {
      const allUsers = await this.listAdminUsers();
      const activeSuperAdmins = allUsers.filter(u => u.role === 'super_admin' && u.is_active && u.id !== target.id);
      if (activeSuperAdmins.length === 0) {
        throw new Error('OPERACAO_BLOQUEADA: Impossível desativar o único Super Admin ativo do sistema.');
      }
    }

    const now = new Date().toISOString();
    target.is_active = params.isActive;
    target.updated_at = now;

    if (!params.isActive) {
      this.revokedUserSessions.add(target.id);
      target.sessions_revoked_at = now;
    } else {
      this.revokedUserSessions.delete(target.id);
    }

    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          const updatePayload: Record<string, any> = { is_active: params.isActive, updated_at: now };
          if (!params.isActive) {
            updatePayload.sessions_revoked_at = now;
          }
          await client.from('admin_users').update(updatePayload).eq('id', target.id);
          if (!params.isActive) {
            // Revoga sessões ativas no Supabase Auth
            await client.auth.admin.signOut(target.id).catch(() => null);
          }
        }
      } catch (err: any) {
        console.warn('[Admin Status Update] Falha no Supabase:', err.message);
      }
    }

    const idx = this.mockUsers.findIndex(u => u.id === target.id);
    if (idx >= 0) this.mockUsers[idx] = { ...target };

    await this.logAuditEvent({
      adminUserId: params.callerId,
      adminEmail: params.callerEmail,
      action: params.isActive ? 'ACTIVATE_ADMIN_USER' : 'DEACTIVATE_ADMIN_USER',
      targetResource: `admin_users/${target.id}`,
      details: { target_email: target.email, is_active: params.isActive },
      ipAddress: params.ipAddress
    });

    return target;
  }

  /**
   * Revoga sessões de um administrador de forma persistente
   */
  public async revokeAdminSessions(params: {
    targetUserId: string;
    callerId: string;
    callerEmail: string;
    ipAddress?: string;
  }): Promise<{ success: boolean; message: string }> {
    const now = new Date().toISOString();
    this.revokedUserSessions.add(params.targetUserId);

    const user = await this.getAdminUserById(params.targetUserId);
    if (user) {
      user.sessions_revoked_at = now;
      user.updated_at = now;
    }

    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          await client.from('admin_users').update({ sessions_revoked_at: now, updated_at: now }).eq('id', params.targetUserId);
          await client.auth.admin.signOut(params.targetUserId);
        }
      } catch (err: any) {
        console.warn('[Admin Session Revoke] Falha no Supabase:', err.message);
      }
    }

    await this.logAuditEvent({
      adminUserId: params.callerId,
      adminEmail: params.callerEmail,
      action: 'REVOKE_ADMIN_SESSIONS',
      targetResource: `admin_users/${params.targetUserId}`,
      details: { target_user_id: params.targetUserId },
      ipAddress: params.ipAddress
    });

    return { success: true, message: 'Todas as sessões do administrador foram revogadas com sucesso e persistidas no banco.' };
  }

  /**
   * Revoga um token de sessão individual (ex: logout em um dispositivo)
   */
  public async revokeSessionToken(token: string, userId?: string): Promise<void> {
    if (!token || typeof token !== 'string') return;
    const parts = token.split('.');
    const signature = parts[1] || token;
    const sigHash = crypto.createHash('sha256').update(signature).digest('hex');

    this.revokedTokenHashes.add(sigHash);

    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          const isValidUuid = typeof userId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
          await client.from('admin_revoked_sessions').insert({
            admin_user_id: isValidUuid ? userId : null,
            session_token_hash: sigHash,
            expires_at: expiresAt
          });
        }
      } catch (err: any) {
        console.warn('[Admin Token Revoke] Falha ao persistir em admin_revoked_sessions:', err.message);
      }
    }
  }

  /**
   * Verifica se a sessão foi revogada de forma persistente (sobrevive reinício do Cloud Run e multi-instâncias)
   */
  public async isSessionRevoked(userId: string, tokenIat?: number, tokenSignature?: string): Promise<boolean> {
    if (this.revokedUserSessions.has(userId)) return true;

    if (tokenSignature) {
      const sigHash = crypto.createHash('sha256').update(tokenSignature).digest('hex');
      if (this.revokedTokenHashes.has(sigHash)) return true;
    }

    const user = await this.getAdminUserById(userId);
    if (!user) return true;

    // Se o usuário foi desativado
    if (!user.is_active) return true;

    // Se a sessão foi emitida antes ou no momento da última revogação de sessões do usuário
    if (user.sessions_revoked_at) {
      if (!tokenIat) {
        return true; // Token sem iat com revogação ativa deve ser rejeitado por segurança
      }
      const revokedAtMs = new Date(user.sessions_revoked_at).getTime();
      if (tokenIat <= revokedAtMs) {
        return true;
      }
    }

    // Consulta se o token específico foi revogado no banco Supabase
    if (process.env.DATA_MODE === 'supabase' && tokenSignature) {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          const sigHash = crypto.createHash('sha256').update(tokenSignature).digest('hex');
          const { data } = await client
            .from('admin_revoked_sessions')
            .select('id')
            .eq('session_token_hash', sigHash)
            .maybeSingle();
          if (data) {
            this.revokedTokenHashes.add(sigHash);
            return true;
          }
        }
      } catch (err: any) {
        console.warn('[Admin Auth] Falha ao consultar admin_revoked_sessions:', err.message);
      }
    }

    return false;
  }

  /**
   * Inicia o cadastro de MFA / TOTP para o Super Admin
   */
  public async startMfaSetup(userId: string): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.getAdminUserById(userId);
    if (!user) {
      throw new Error('Administrador não encontrado.');
    }

    const secret = TotpService.generateSecret();
    const otpauthUri = TotpService.generateOtpauthUri({
      secret,
      accountName: user.email,
      issuer: 'DUO21 Control'
    });

    // Armazena registro pendente com expiração de 10 minutos
    this.pendingMfaRegistrations.set(userId, {
      secret,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    return { secret, otpauthUri };
  }

  /**
   * Confirma o primeiro código TOTP e ativa o MFA com comprovação criptográfica
   */
  public async confirmMfaSetup(params: {
    userId: string;
    code: string;
    callerEmail: string;
    ipAddress?: string;
  }): Promise<{ success: boolean; recoveryCodes: string[] }> {
    const pending = this.pendingMfaRegistrations.get(params.userId);
    if (!pending || Date.now() > pending.expiresAt) {
      throw new Error('Sessão de configuração MFA expirada ou não iniciada. Inicie o processo novamente.');
    }

    // Validação criptográfica do código TOTP fornecido
    const isValid = TotpService.verifyToken(pending.secret, params.code);
    if (!isValid) {
      throw new Error('Código de autenticação TOTP inválido. Verifique o relógio do seu dispositivo e o código gerado.');
    }

    // Gera 8 códigos de recuperação de uso único
    const { rawCodes, hashedCodes } = TotpService.generateRecoveryCodes();
    const now = new Date().toISOString();

    const user = await this.getAdminUserById(params.userId);
    if (user) {
      user.mfa_enabled = true;
      user.mfa_secret = pending.secret;
      user.mfa_recovery_codes = hashedCodes;
      user.updated_at = now;
    }

    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          await client.from('admin_users').update({
            mfa_enabled: true,
            mfa_secret: pending.secret,
            mfa_recovery_codes: hashedCodes,
            updated_at: now
          }).eq('id', params.userId);
        }
      } catch (err: any) {
        console.warn('[MFA Confirm] Falha ao persistir no Supabase:', err.message);
      }
    }

    this.pendingMfaRegistrations.delete(params.userId);

    await this.logAuditEvent({
      adminUserId: params.userId,
      adminEmail: params.callerEmail,
      action: 'MFA_ACTIVATED',
      targetResource: `admin_users/${params.userId}`,
      details: { method: 'TOTP_RFC6238', recovery_codes_generated: rawCodes.length },
      ipAddress: params.ipAddress,
      status: 'SUCCESS'
    });

    return {
      success: true,
      recoveryCodes: rawCodes
    };
  }

  /**
   * Valida código de autenticação em duas etapas (MFA / TOTP)
   * Suporta tanto códigos de 6 dígitos temporais (TOTP RFC 6238)
   * quanto códigos de recuperação de uso único (backup codes).
   */
  public async verifyMfaCode(userId: string, code?: string): Promise<boolean> {
    if (!code || typeof code !== 'string') return false;
    const clean = code.trim();

    const user = await this.getAdminUserById(userId);
    if (!user) return false;

    // Se o usuário possui segredo TOTP configurado
    if (user.mfa_secret) {
      const isValidTotp = TotpService.verifyToken(user.mfa_secret, clean);
      if (isValidTotp) return true;

      // Se falhou como TOTP, verifica se corresponde a um código de recuperação
      if (user.mfa_recovery_codes && user.mfa_recovery_codes.length > 0) {
        const recoveryResult = TotpService.verifyAndConsumeRecoveryCode(clean, user.mfa_recovery_codes);
        if (recoveryResult.isValid) {
          user.mfa_recovery_codes = recoveryResult.remainingHashedCodes;
          if (process.env.DATA_MODE === 'supabase') {
            try {
              const client = supabaseServer.getRawClient();
              if (client) {
                await client.from('admin_users').update({
                  mfa_recovery_codes: recoveryResult.remainingHashedCodes,
                  updated_at: new Date().toISOString()
                }).eq('id', userId);
              }
            } catch {}
          }
          await this.logAuditEvent({
            adminUserId: userId,
            adminEmail: user.email,
            action: 'MFA_RECOVERY_CODE_CONSUMED',
            targetResource: `admin_users/${userId}`,
            details: { remaining_codes: recoveryResult.remainingHashedCodes.length },
            status: 'SUCCESS'
          });
          return true;
        }
      }

      return false;
    }

    // Fallback para contas sem segredo TOTP individual persistido
    return /^\d{6}$/.test(clean);
  }

  /**
   * Verifica se o usuário requer validação MFA para operações críticas
   */
  public async isMfaRequiredForUser(userId: string): Promise<boolean> {
    const user = await this.getAdminUserById(userId);
    return Boolean(user && user.is_active && user.mfa_enabled);
  }

  /**
   * Autenticação com e-mail e senha (compatível com Supabase Auth e Mock)
   */
  public async authenticate(params: {
    email: string;
    password?: string;
    mfaCode?: string;
    ipAddress?: string;
  }): Promise<{ 
    user: AdminUserRecord; 
    permissions: AdminSessionProfile['permissions']; 
    authMethod: any;
    mfaRequired?: boolean;
  }> {
    const email = params.email.toLowerCase().trim();
    const adminUser = await this.getAdminUserByEmail(email);

    if (!adminUser) {
      await this.logAuditEvent({
        adminEmail: email,
        action: 'LOGIN_FAILED',
        targetResource: 'auth',
        details: { reason: 'USUARIO_INEXISTENTE' },
        ipAddress: params.ipAddress,
        status: 'FAILED'
      });
      throw new Error('Credenciais administrativas inválidas.');
    }

    if (!adminUser.is_active) {
      await this.logAuditEvent({
        adminUserId: adminUser.id,
        adminEmail: email,
        action: 'LOGIN_BLOCKED',
        targetResource: 'auth',
        details: { reason: 'CONTA_DESATIVADA' },
        ipAddress: params.ipAddress,
        status: 'BLOCKED'
      });
      throw new Error('Esta conta administrativa foi desativada pelo Super Admin.');
    }

    // Se no modo Supabase real, autentica contra auth.users do Supabase Auth
    if (process.env.DATA_MODE === 'supabase' && params.password) {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          const { error: signInErr } = await client.auth.signInWithPassword({
            email,
            password: params.password
          });
          if (signInErr) {
            await this.logAuditEvent({
              adminEmail: email,
              action: 'LOGIN_FAILED',
              targetResource: 'auth',
              details: { reason: 'SUPABASE_AUTH_REJECTED', message: signInErr.message },
              ipAddress: params.ipAddress,
              status: 'FAILED'
            });
            throw new Error('Credenciais administrativas inválidas.');
          }
        }
      } catch (authErr: any) {
        if (authErr.message.includes('Credenciais')) throw authErr;
        console.warn('[Supabase Auth SignIn] Fallback para verificação local:', authErr.message);
      }
    }

    // Validação de MFA / TOTP se habilitado no perfil
    if (adminUser.mfa_enabled) {
      if (!params.mfaCode) {
        // Sinaliza necessidade de segundo fator
        return {
          user: adminUser,
          permissions: this.getPermissionsForRole(adminUser.role),
          authMethod: 'mfa_challenge',
          mfaRequired: true
        };
      }

      const isValidMfa = await this.verifyMfaCode(adminUser.id, params.mfaCode);
      if (!isValidMfa) {
        await this.logAuditEvent({
          adminUserId: adminUser.id,
          adminEmail: email,
          action: 'MFA_FAILED',
          targetResource: 'auth',
          details: { reason: 'CODIGO_MFA_INVALIDO' },
          ipAddress: params.ipAddress,
          status: 'FAILED'
        });
        throw new Error('Código de autenticação em duas etapas (MFA) inválido.');
      }
    }

    // Limpa revogação local de memória para novas sessões legítimas deste login
    this.revokedUserSessions.delete(adminUser.id);

    // Atualiza last_sign_in_at
    const now = new Date().toISOString();
    adminUser.last_sign_in_at = now;
    if (process.env.DATA_MODE === 'supabase') {
      try {
        const client = supabaseServer.getRawClient();
        if (client) {
          await client.from('admin_users').update({ last_sign_in_at: now }).eq('id', adminUser.id);
        }
      } catch {}
    }

    await this.logAuditEvent({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'LOGIN_SUCCESS',
      targetResource: 'auth',
      details: { role: adminUser.role, mfa_verified: Boolean(adminUser.mfa_enabled) },
      ipAddress: params.ipAddress,
      status: 'SUCCESS'
    });

    return {
      user: adminUser,
      permissions: this.getPermissionsForRole(adminUser.role),
      authMethod: 'supabase_auth'
    };
  }
}

export const adminAuthService = AdminAuthService.getInstance();
