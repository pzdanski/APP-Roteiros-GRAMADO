# Integração DUO21 CMS & Control Plane — App Roteiro IA

Este documento especifica a arquitetura operacional, o modelo de desacoplamento e os contratos de dados entre o **CMS DUO21** (`/duo-control`) e o runtime autônomo do **App Roteiro IA** (`https://roteiro.duo21.com.br`).

---

## 1. Princípio Fundamental de Arquitetura: Decoupled Control Plane

O ecossistema é estritamente dividido em dois papéis:

1. **CMS DUO21 (`/duo-control`) = Control Plane (Plano de Controle / Administrativo)**
   - Gerencia conteúdo turístico (preços, status de locais, eventos âncora, pesos de recomendação).
   - Audita métricas de conversão, custos de IA/Places e receita de vendas.
   - Monitora a saúde dos provedores de API e o recebimento de webhooks financeiros.
   - **Fora do caminho crítico:** uma queda ou lentidão no CMS **nunca** afeta o turista.

2. **App Roteiro IA = Runtime de Produção Independente**
   - Executa no domínio canônico `https://roteiro.duo21.com.br`.
   - Atende turistas em alta concorrência diretamente contra o backend Node/Express (`/api/*`), cache em memória/SingleFlight e o banco Supabase Postgres.
   - **O App nunca consulta o CMS a cada requisição do turista.** Toda a geração de preview, roteiro final e checkout ocorre sem saltos síncronos ao painel administrativo.

---

## 2. Estrutura dos Módulos do CMS DUO21

O CMS DUO21 opera com 6 módulos principais:

### Módulo 1: Aplicativos → App Roteiro IA
Exibe a visão 360° da aplicação:
- **Status:** Operacional / Online.
- **Ambiente:** `development` / `sandbox` / `production`.
- **URL Pública Canônica:** `https://roteiro.duo21.com.br`.
- **Saúde do Backend:** Health check em tempo real dos subsistemas (`database`, `ai`, `places`, `routes`, `weather`, `cloudflare_ready`).
- **Última Publicação:** Timestamp do deploy e release ativa (`Sprint 8C`).

### Módulo 2: APIs
Monitora os 6 provedores oficiais sem jamais expor secrets:
1. **Supabase Database:** PostgreSQL relacional (Source of Truth).
2. **Google Gemini:** IA gerativa (Gemini 2.5 Flash via `@google/genai`).
3. **Google Places:** Busca contextual e fotos de atrações da Serra Gaúcha.
4. **Google Routes:** Cálculo de rotas, tempos de deslocamento e matriz de trânsito.
5. **Weather API:** Open-Meteo & Microclima da Serra Gaúcha com desvio de chuva.
6. **Asaas Gateway:** Gateway financeiro PIX e Cartão de Crédito.

> **Regra de Ouro de Segurança (Zero Secret Exposure):**  
> Nenhuma chave de API (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`) é trafegada para o frontend ou impressa na tela. O CMS exibe apenas diagnósticos operacionais sanitizados e latências estimadas.

### Módulo 3: Webhooks
Monitora o endpoint de pagamento do Asaas:
- **Endpoint Definitivo de Produção:** `https://roteiro.duo21.com.br/api/payments/webhook`
- **Status:** Ativo e público (sem barreiras de cookies ou login).
- **Autenticação:** Header `asaas-access-token`.
- **Último Evento Recebido:** Identificador do evento (ex.: `PAYMENT_RECEIVED`).
- **Último HTTP Status:** Código retornado ao gateway (ex.: `HTTP 200 OK` ou `HTTP 401 Unauthorized`).
- **Último Processamento:** Timestamp e status normalizado (`PAID`, `already_processed`, `ignored`).
- **Auditoria:** Lista dos últimos eventos financeiros processados com idempotência garantida.

### Módulo 4: Analytics
- Total de roteiros criados vs pagos.
- Taxa de conversão de paywall.
- Receita bruta gerada.
- Decomposição de custos operacionais por provedor (Gemini, Places, Routes, Weather).
- Garantia de margem líquida e conformidade com o teto do CostGuard (< R$ 1,00 de custo variável por roteiro).

### Módulo 5: Integrações
- Status de conectividade com repositórios e provedores locais vs remotos.
- Teste dinâmico de conexões sob demanda via botão "Testar Conexão".

### Módulo 6: Configurações
- Ajuste dos pesos algorítmicos do motor de roteiro (`LogisticsEngine` e `FinalItineraryEngine`):
  - Orçamento, clima/chuva, ritmo, curadoria local Divulga Lugares.

---

## 3. Contrato de API para Integração de CMS Externo

Caso o CMS DUO21 seja hospedado em repositório externo ou em `https://duo21.com.br/duo-control`, o runtime disponibiliza os seguintes endpoints REST seguros:

### 1. `GET /api/health`
Retorna o resumo operacional sanitizado do runtime.
```json
{
  "app": "ok",
  "service": "DUO21 Roteiro Serra Gaúcha Backend",
  "canonical_domain": "https://roteiro.duo21.com.br",
  "public_origin": "https://roteiro.duo21.com.br",
  "api_base": "https://roteiro.duo21.com.br/api",
  "webhook_url": "https://roteiro.duo21.com.br/api/payments/webhook",
  "data_mode": "supabase",
  "database": "connected",
  "database_details": "PostgreSQL conectado com sucesso.",
  "ai": "connected",
  "places": "connected",
  "places_details": "Google Places operacional.",
  "routes": "connected",
  "routes_details": "Google Routes operacional.",
  "weather": "connected",
  "weather_details": "Open-Meteo operacional.",
  "environment": "development",
  "asaas_env": "sandbox",
  "cloudflare_ready": true,
  "timestamp": "2026-09-28T21:20:00.000Z"
}
```

### 2. `GET /api/payments/webhook`
Retorna a saúde e a telemetria do webhook Asaas sem requerer autenticação ou sessão:
```json
{
  "status": "active",
  "public": true,
  "endpoint": "/api/payments/webhook",
  "canonical_url": "https://roteiro.duo21.com.br/api/payments/webhook",
  "method_expected": "POST",
  "auth": "asaas-access-token header",
  "provider": "asaas",
  "environment": "sandbox",
  "last_event": "PAYMENT_RECEIVED",
  "last_http_status": 200,
  "last_processed_at": "2026-09-28T21:17:49.946Z",
  "last_result": "PROCESSED_PAID",
  "events_count": 3
}
```

### 3. `GET /api/db/usage/metrics`
Retorna o acumulado de chamadas a provedores e estimativa de custos em BRL:
```json
{
  "totalRequests": 18,
  "totalCostBrl": 0.42,
  "avgCostPerTripBrl": 0.14,
  "byProvider": {
    "GEMINI": { "requests": 2, "costBrl": 0.04 },
    "GOOGLE_PLACES": { "requests": 8, "costBrl": 0.24 },
    "ROUTES": { "requests": 4, "costBrl": 0.14 },
    "WEATHER": { "requests": 4, "costBrl": 0.00 }
  }
}
```

### 4. `GET /api/payments/events`
Retorna a trilha de auditoria recente de pagamentos para exibição no painel administrativo.

---

## 4. Como Acessar o Control Plane Localmente

No runtime atual, o painel do CMS DUO21 pode ser acessado de duas formas diretas:
1. Navegando para `/duo-control` na URL do app.
2. Adicionando o parâmetro de query `?admin=true` na raiz da aplicação.
