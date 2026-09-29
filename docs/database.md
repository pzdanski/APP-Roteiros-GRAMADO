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

1. `20260925000001_create_core_schema.sql`:
   - Tabelas estruturais: `places`, `place_categories`, `place_tags`, `place_tag_relations`, `place_hours`, `price_observations`, `data_sources`, `events`, `trips`, `trip_profiles`, `trip_days`, `trip_activities`, `trip_previews`, `payments`, `api_usage`, `external_data_cache`, `user_reports`.
2. `20260925000002_enable_rls_policies.sql`:
   - Row Level Security (RLS) em 100% das tabelas.
   - Catálogo com leitura pública para ativos.
   - Viagens protegidas por `secure_token`.
3. `20260925000003_seed_catalog_and_sources.sql`:
   - Carga inicial curada para Gramado, Canela e Nova Petrópolis (27 locais, horários, preços por temporada).
4. `20260925000004_hardening_indexes_and_rpc.sql`:
   - Índices de performance para cidades, categorias, tags, horários, tokens e cache.
   - RPC Postgres `get_candidate_places(...)` para pré-filtragem estruturada sem IA.

## 5. Rastreabilidade
Todo dado no catálogo informa:
- `source_id`: Identificador da fonte (`duo21_curatorship`, `official_gramado`, etc.).
- `checked_at`: Data da última auditoria.
- `confidence`: Nível de confiança (`high`, `medium`, `low`).
