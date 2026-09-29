# Controle de Custos & CostGuard — DUO21

## 1. Objetivo

Evitar custos descontrolados com APIs externas de IA, Places, Geocoding e Rotas.

## 2. Parâmetro Orçamentário (`MAX_GENERATION_API_COST_BRL`)

- **Teto padrão por geração de roteiro:** `R$ 1,00`
- Configurado via variável de ambiente: `MAX_GENERATION_API_COST_BRL=1.00`.

## 3. Comportamento do CostGuard

1. **Consulta Cache Primeiro (`external_data_cache`):**
   - Sempre que um dado externo já tiver sido consultado para os mesmos parâmetros, utiliza o cache com custo R$ 0,00.
2. **Monitoramento e Alertas:**
   - Ao atingir 85% do teto (R$ 0,85), emite aviso de proximidade (`COST_LIMIT_WARNING`).
   - Se projetado ultrapassar R$ 1,00, **não quebra** a geração do roteiro: o sistema transita automaticamente para os dados já presentes no catálogo Supabase/Cache, garantindo entrega do roteiro final ao cliente.
3. **Persistência na tabela `api_usage`:**
   - Toda chamada (tokens Gemini, chamadas Google Places, etc.) é auditada e persistida com `provider`, `operation`, `tokens`, `estimated_cost_brl` e `cached`.

## 4. Tarifas Estimadas Google Places & Routes API (New)

- **Places Text Search (com FieldMask mínimo):** ~R$ 0,09 por requisição.
- **Places Details (com FieldMask mínimo):** ~R$ 0,09 por requisição.
- **Routes API computeRoutes:** ~R$ 0,03 por requisição externa.
- **Weather API (Open-Meteo):** R$ 0,00 por requisição.
- **Cache Hit (`external_data_cache`):** R$ 0,00 por requisição.
- **Campos Proibidos para Economia:** `photos`, `reviews`, `editorialSummary` (não solicitados automaticamente).
- **Custo Médio Total Estimado por Roteiro:** ~R$ 0,53 (bem abaixo do teto de R$ 1,00).
