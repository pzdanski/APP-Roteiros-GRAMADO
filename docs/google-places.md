# Arquitetura Google Places API (New) — DUO21

## 1. Princípio de Arquitetura

O Google Places **NÃO É O BANCO PRINCIPAL** do aplicativo. O **SUPABASE CONTINUA SENDO A SOURCE OF TRUTH**.

```
CACHE (external_data_cache)
   ↓ (se miss)
SUPABASE (places, categories, tags)
   ↓ (se não resolvido ou candidatos < 5)
GOOGLE PLACES API (New) [Server-Side com FieldMask mínimo]
   ↓
NORMALIZAÇÃO (GooglePlaceNormalizer -> ResolvedPlace)
   ↓
SUPABASE / CACHE
```

---

## 2. Casos de Uso: Quando Places é Chamado e Quando NÃO é Chamado

### A. Hospedagem Informada pelo Turista
- **NÃO É CHAMADO:**
  - Se o turista responder *"Ainda não reservei"* ou *"Sem hotel"*: o sistema ancora no Centro de Gramado (`provisionalLogisticsBase`) com **zero chamadas externas**.
  - Se a hospedagem já estiver catalogada no Supabase (ex: *"Hotel Sky Gramado"* já com latitude/longitude).
  - Se a resolução estiver gravada no `external_data_cache`.
- **É CHAMADO:**
  - Apenas se a hospedagem não existir no Supabase nem no cache. Realiza busca com `locationBias` na Serra Gaúcha e tipo `lodging`.

### B. Locais Obrigatórios (Must-Have)
- **NÃO É CHAMADO:**
  - Se o local estiver no catálogo oficial (ex: *"Lago Negro"*, *"Mini Mundo"*).
- **É CHAMADO:**
  - Se o turista informar um ponto específico não catalogado previamente. O Google resolve o nome real e coordenadas para cálculo de proximidade.
  - O LLM (Gemini) **nunca** inventa nomes nem entidades.

### C. Descoberta de Restaurantes e Atrações (Discovery)
- **Regra dos Candidatos Mínimos (`MIN_LOCAL_CANDIDATES = 5`):**
  - Exemplo: Turista pede *"fondue"*.
  - Se o Supabase já possuir 5 ou mais opções de fondue: **GOOGLE DISCOVERY NÃO É DISPARADO**.
  - Somente se o banco local possuir menos de 5 opções, uma busca externa controlada é autorizada.
  - Resultados passam por normalização, exclusão de estabelecimentos fechados permanentemente e scoring editorial.

---

## 3. Máscaras de Campo Mínimas (Field Masks)

Para minimizar o custo de cada requisição no Google Cloud, **nenhuma chamada solicita todos os campos**.

| Caso de Uso | Máscara Utilizada | Campos Solicitados |
| :--- | :--- | :--- |
| **Resolução de Local / Hotel** | `PLACE_RESOLUTION` | `places.id,places.displayName,places.formattedAddress,places.location` |
| **Horários e Funcionamento** | `HOURS` | `id,displayName,businessStatus,regularOpeningHours` |
| **Detalhes Essenciais** | `DETAIL` | `id,displayName,formattedAddress,location,businessStatus,regularOpeningHours` |
| **Descoberta Controlada** | `DISCOVERY` | `places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.rating,places.userRatingCount` |

*Campos caros como `photos`, `reviews` e `editorialSummary` são estritamente excluídos.*

---

## 4. Política de Cache e TTLs (`external_data_cache`)

| Dado | TTL Padrão | Justificativa |
| :--- | :--- | :--- |
| **Place ID & Coordenadas** | 30 dias | Coordenadas geográficas e IDs são altamente estáveis |
| **Endereço Formatado** | 30 dias | Endereços municipais sofrem poucas alterações |
| **Status de Funcionamento** | 24 horas | Verificação de estabelecimentos operacionais |
| **Horários de Abertura** | 24 horas | Mudanças sazonais ou operacionais |
| **Resultados de Busca** | 7 dias | Evita reconsultas idênticas para a mesma query |

---

## 5. Integração com o CostGuard

- Cada consulta ao Google Places é registrada em `api_usage`:
  - `provider: 'GOOGLE_PLACES'`
  - `operation: 'searchText' | 'getPlaceDetails' | 'searchNearby'`
  - `estimated_cost_brl: R$ 0,09` (por chamada externa real)
  - `cached: true` (com custo R$ 0,00 se atendida pelo cache)
- Teto de segurança: R$ 1,00 por geração de roteiro.
