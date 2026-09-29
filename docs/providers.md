# Provider Registry & Integrações Externas — DUO21

## 1. Status Padronizados

Para evitar diagnósticos falsos ou conexões simuladas que pareçam ativas, o `ProviderRegistry` adota exclusivamente:

- `CONNECTED`: O serviço foi verificado operacionalmente via health check real com sucesso.
- `CONFIGURATION_REQUIRED`: Chave de API obrigatória não configurada nas variáveis de ambiente.
- `MOCK`: Provider executando em modo simulado/mock explícito (apenas desenvolvimento/teste).
- `ERROR`: Falha operacional ao tentar comunicar com o serviço.
- `DISABLED`: Provider desativado pelo sistema.

## 2. Matriz de Provedores

| Provedor | Categoria | Status Real | Requisito para CONNECTED |
| :--- | :--- | :--- | :--- |
| **Supabase** | `database` | `CONNECTED` / `MOCK` | Consulta real SELECT/health responder com sucesso |
| **Google Gemini** | `ai` | `CONNECTED` / `CONFIGURATION_REQUIRED` | `GEMINI_API_KEY` válida e geração de teste operacional |
| **Google Places** | `places` | `CONNECTED` / `CONFIGURATION_REQUIRED` / `MOCK` | `GOOGLE_MAPS_API_KEY` válida no servidor e health check operacional |
| **Routes** | `routes` | `CONNECTED` / `CONFIGURATION_REQUIRED` / `MOCK` | Google Routes API (New) / Haversine Montanha com cache de 24h a 7d |
| **Weather** | `weather` | `CONNECTED` / `MOCK` | Open-Meteo & Microclima da Serra com cache de 24h e replan sem cota |
| **Asaas** | `payment` | `MOCK` | Sandbox de pagamentos com webhook idempotente |

## 3. Diretriz Anti-Alucinação

- **NUNCA** exibir `CONNECTED` se a API não estiver autenticada e respondendo.
- **NUNCA** perguntar ao Gemini "quais atrações existem em Gramado?".
- Locais, horários, preços e rotas são decididos por **DADOS E REGRAS** do banco de dados relacional.
