# Arquitetura de Banco de Dados — DUO21 / Divulga Lugares

## 1. Princípio Fundamental: SUPABASE = SOURCE OF TRUTH

No ecossistema DUO21:
- **SUPABASE É A FONTE DA VERDADE ÚNICA.**
- **MOCK IS NEVER A PRODUCTION FALLBACK.**
- Se o Supabase falhar em ambiente de produção ou com `DATA_MODE=supabase`, o sistema retorna erro controlado (`DATABASE_UNAVAILABLE`).
- É estritamente proibido criar arquivos locais ou cair para mocks silenciosos em produção.

## 2. Modos de Dados (`DATA_MODE`)

A seleção da camada de dados é controlada centralizadamente pela `RepositoryFactory`:

1. `DATA_MODE=supabase`:
   - Utilizado em produção e homologação conectada.
   - Comunicação backend via `@supabase/supabase-js` com `SUPABASE_SERVICE_ROLE_KEY` exclusiva no servidor.
   - Frontend consome rotas protegidas em `/api/db/*`.
   - Se a conexão falhar, lança erro `DATABASE_UNAVAILABLE`.

2. `DATA_MODE=mock`:
   - Permitido **apenas** em desenvolvimento e testes automatizados.
   - Bloqueado em produção: se `NODE_ENV=production` e `DATA_MODE=mock`, o servidor recusa a inicialização imediatamente.
   - Exibe claramente no console e nos diagnósticos: `MOCK DATA`.

## 3. Fluxo de Dados e Caching

```
CACHE (external_data_cache)
   ↓ (se miss)
SUPABASE (Postgres & RLS)
   ↓ (se candidato não catalogado)
API EXTERNA (Google Places / Routes - sob demanda com CostGuard)
```

## 4. Migrações Versionadas (`supabase/migrations/`)

1. `20260925000001_create_core_schema.sql` (Schema Principal)
2. `20260925000002_enable_rls_policies.sql` (RLS Inicial)
3. `20260925000003_seed_catalog_and_sources.sql` (Seed Inicial Curado)
4. `20260925000004_hardening_indexes_and_rpc.sql` (Índices & RPCs)
5. `20260925000005_create_payment_orders.sql` (Pedidos de Pagamento)
6. `20261002_sprint10a_smart_catalog.sql` (Catálogo Inteligente)
7. `20261002000001_add_campaign_fields.sql` (Campos de Campanha 300)
8. `20261003_hotfix10a2_media_content.sql` (Mídias e Fotos do Local)
9. `20261003_sprint10b_places_costguard.sql` (Cost Guard & Auditoria)
10. `20261004_sprint10c_controlled_enrichment.sql` (Enriquecimento Controlado)

### 4.1 Migrações P0 e Sprint 11 (Ordem Obrigatória de Execução)
11. `20261008_hotfix_p0_sanitize_catalog.sql` (P0 Etapa 1: Sanitização do Catálogo, proteção de curadoria)
12. `20261008_hotfix_p0_etapa2_authorizations.sql` (P0 Etapa 2: Autorizações explícitas de fases 1, 2 e 3)
13. `20261008_hotfix_p0_etapa3_execution_progress.sql` (P0 Etapa 3: Rastreamento durável de microlotes e checkpoints)
14. `20261009_sprint11_admin_users_and_roles.sql` (Sprint 11: Governança, RBAC, auditoria e `admin_users`)

---

## 5. Procedimento de Bootstrap do Primeiro Super Admin (Seguro e Controlado)

**Importante:** Nunca criar usuários administrativos com senha fixa ou hardcoded no código fonte. O procedimento é executado com controle estrito via Supabase:

1. **Passo 1 (Criação da Conta no Supabase Auth):**
   - Acesse o Dashboard do projeto no Supabase: `Authentication` → `Users` → `Add User` → `Create User`.
   - Informe o email institucional (ex: `admin@duo21.com.br`) e defina uma senha forte ou envie o link de convite por email.
   - O Supabase gerará um UUID único para o usuário em `auth.users(id)`.

2. **Passo 2 (Vinculação e Promoção a Super Admin no SQL Editor):**
   - Acesse o Supabase `SQL Editor`.
   - Execute a função de governança idempotente criada na migração `20261009_sprint11_admin_users_and_roles.sql`:
   ```sql
   SELECT public.bootstrap_initial_super_admin(
     'admin@duo21.com.br',
     'Nome do Administrador'
   );
   ```
   - A função valida a existência do usuário em `auth.users`, insere na tabela `public.admin_users` com a função `super_admin`, define `is_active = true` e registra o evento imutável em `public.admin_audit_logs`.

3. **Passo 3 (Primeiro Acesso ao DUO Control):**
   - Acesse a rota oficial: `https://roteiro.duo21.com.br/duo-control`
   - Realize o login com o email e a senha cadastrados.
   - O painel carregará o perfil com selo `Super Admin` e liberará a gestão de usuários em `Configurações → Usuários e Permissões`.

---

## 6. Rastreabilidade
Todo dado no catálogo informa:
- `source_id`: Identificador da fonte (`duo21_curatorship`, `official_gramado`, etc.).
- `checked_at`: Data da última auditoria.
- `confidence`: Nível de confiança (`high`, `medium`, `low`).
