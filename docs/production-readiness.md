# Checklist de Prontidão para Produção (Production Readiness) — DUO21

## 1. Princípios Inegociáveis

1. **SUPABASE = SOURCE OF TRUTH**
   - O Supabase hospeda os dados de viagens, catálogos, preços, horários e segurança.
   - Qualquer falha na conexão é tratada com erro controlado `DATABASE_UNAVAILABLE`.
2. **MOCK IS NEVER A PRODUCTION FALLBACK**
   - Se o Supabase falhar, o sistema **NUNCA** recorre a mocks em memória ou arquivos locais.
   - O servidor recusa inicialização se `NODE_ENV=production` e `DATA_MODE=mock`.
3. **CACHE → SUPABASE → EXTERNAL API**
   - Antes de consultar qualquer API paga externa, o sistema verifica o cache persistido (`external_data_cache`) e a base curada (`places`).

## 2. Checklist de Hardening Concluído

- [x] Eliminação completa do fallback silencioso `.data/duo21_supabase_store.json`.
- [x] Separação estrita de `DATA_MODE=supabase` e `DATA_MODE=mock`.
- [x] `RepositoryFactory` centralizada para todas as entidades.
- [x] Migrations versionadas 01 a 04 com RLS, índices e RPC Candidate.
- [x] Middleware `requireAdmin` para rotas administrativas (`/api/admin/*`, mutações em `/api/db/*`).
- [x] `SUPABASE_SERVICE_ROLE_KEY` estritamente restrita ao servidor backend.
- [x] `TripAccessService` com tokens aleatórios longos e bloqueio de acesso cruzado.
- [x] Bloqueio incondicional de `DEV_TEST` em ambiente de produção.
- [x] CostGuard com monitoramento de teto (R$ 1,00) e registro em `api_usage`.
- [x] Endpoint de saúde `/api/health` auditado e livre de segredos ou connection strings.
- [x] Provider Registry com status reais: `CONNECTED`, `CONFIGURATION_REQUIRED`, `MOCK`, `ERROR`.

## 3. Próximo Passo: Sprint 2.2
Com a camada de dados e segurança completamente endurecida, o sistema está pronto para a conexão controlada com a Google Places API.
