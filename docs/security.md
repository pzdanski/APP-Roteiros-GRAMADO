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
