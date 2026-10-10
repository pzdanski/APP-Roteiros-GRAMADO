# Política e Diretrizes de Segurança — DUO21

## 1. Segredos e Chaves de Serviço

- `SUPABASE_SERVICE_ROLE_KEY`:
  - **ESTRITAMENTE NO SERVIDOR.**
  - Nunca exposta no frontend, variáveis `VITE_`, bundle client ou repositório Git.
  - Auditada com `grep` e `git grep` em cada build.
- `ADMIN_API_KEY`:
  - Utilizada pelo middleware `requireAdmin` no servidor Express.
  - Exigida em rotas administrativas `/api/admin/*`, mutações no catálogo (`POST/PUT/DELETE /api/db/*`).

## 2. Acesso a Viagens e `secure_trip_token`

- O acesso público do turista a uma viagem **nunca** depende de sequenciais ou apenas do UUID `id`.
- Utiliza `secure_token`:
  - Formato `v_<hex_random_24_bytes>` gerado criptograficamente por `TripAccessService.generateSecureToken()`.
  - Comparação segura contra ataques de timing (`crypto.timingSafeEqual`).
- **Isolamento entre viagens (Cross-Trip Access):**
  - Token A dá acesso exclusivamente à Viagem A.
  - Tentativa de consulta da Viagem B utilizando Token A retorna `TRIP_NOT_FOUND` ou `FORBIDDEN`.

## 3. Bloqueio Estrito de `DEV_TEST` em Produção

- Em ambiente de produção (`NODE_ENV=production`):
  - A autorização `unlock_source: 'dev_test'` é **estritamente rejeitada com HTTP 403 (FORBIDDEN)**.
  - Apenas autorizações via pagamento real (`PAYMENT`) ou administrativo autenticado (`ADMIN`) são permitidas.
  - Não é possível contornar por query params, cookies ou localStorage.

## 4. Row Level Security (RLS)

- Todas as tabelas possuem RLS habilitado:
  - Tabelas públicas de catálogo (`places`, `place_categories`, `place_tags`, `place_hours`, `price_observations`, `events`): leitura pública para registros com `active = true`. Escrita restrita ao backend com `service_role`.
  - Tabelas privadas (`trips`, `trip_profiles`, `trip_days`, `trip_activities`, `payments`, `api_usage`): leitura permitida somente quando o token da requisição corresponde ao `secure_token` da viagem correspondente.

## 5. Auditoria de Segredos no Git

- Arquivos `.env`, `.env.local`, `.data/`, credenciais e logs estão listados no `.gitignore`.
- Auditoria contínua de padrões de chave privada.

## 6. DUO Control — Governança, Supabase Auth e RBAC (Sprint 11)

### 6.1 Rota Administrativa Oficial `/duo-control`
- `/duo-control` é a rota exclusiva do painel de controle.
- Visitantes desautenticados visualizam **estritamente** a tela de login; nenhum painel, métrica ou dado interno é renderizado ou pré-carregado.
- Navegação bidirecional com a aplicação pública via HTML5 History (`pushState` e `popstate`).
- Rota pública `/` não possui atalhos ou backdoors para renderização in-line do painel administrativo.

### 6.2 Segregação entre Turistas e Administradores
- **Turistas:** Identificados via tokens criptográficos aleatórios de viagem (`v_<hex_24_bytes>`). Nunca utilizam contas de usuário do Supabase Auth.
- **Administradores:** Identificados no Supabase Auth (`auth.users`) e vinculados individualmente à tabela `public.admin_users`.
- Sessões administrativas trafegam via cookies seguros `HttpOnly`, `SameSite=Lax` (`duo_admin_token`) ou cabeçalho `Authorization: Bearer <token>`, validados com assinatura HMAC pelo backend.

### 6.3 Matriz de Perfis (RBAC)
1. **SUPER ADMIN:**
   - Acesso irrestrito a todas as operações: gestão de administradores, autorização e revogação de fases do Catalog Accelerator, ajuste de limites e custos no Cost Guard, curadoria e exclusão de catálogo, consulta de logs de auditoria imutáveis.
   - Suporte a MFA/TOTP obrigatório para operações críticas e sensíveis.
2. **EDITOR:**
   - Curadoria e gestão editorial: cadastro e edição de estabelecimentos, upload e ordenação de mídias/fotos, atualização de parâmetros editoriais de campanha.
   - **Proibições Estritas:** Não pode gerenciar usuários, não pode autorizar fases do Catalog Accelerator, não pode executar importações automáticas do Google Places e não pode alterar parâmetros de custo/Cost Guard.
3. **VISUALIZADOR:**
   - Acesso estritamente somente leitura: consulta de catálogos, relatórios analíticos e indicadores operacionais autorizados.
   - **Proibições Estritas:** Não pode executar qualquer mutação, importação ou alteração administrativa.

### 6.4 Regras de Integridade e Proteção de Privilégios
- **Anti-Autoelevação:** Um administrador não pode alterar sua própria função administrativa.
- **Proteção do Último Super Admin:** É terminantemente proibido rebaixar, desativar ou excluir o último Super Admin ativo do sistema.
- **Auto-Desativação Bloqueada:** Nenhum usuário pode desativar seu próprio acesso.
- **Revogação Instantânea de Sessões:** Ao desativar ou revogar sessões de um administrador, qualquer token ativo é imediatamente invalidado (`isSessionRevoked`).
- **Auditoria Imutável:** Todas as operações administrativas relevantes são registradas em `public.admin_audit_logs`.
