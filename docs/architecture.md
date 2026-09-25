# Arquitetura Técnica - DUO21 Serra Gaúcha

## 1. Visão Geral

O produto é um Web App / PWA comercial projetado para planejamento e assistência de viagem em Gramado, Canela e Nova Petrópolis.
Diferencia-se fundamentalmente de geradores genéricos de IA:

> **Regra Central:** DADOS E REGRAS DECIDEM. A IA ORGANIZA, PERSONALIZA E CONVERSA.
> Nunca permitir que a IA invente preços, horários, funcionamento, promoções, eventos ou distâncias.

## 2. Camadas do Sistema

```
[ Frontend (Mobile-First / PWA) ]
      │
      ├── React 19 + TypeScript
      ├── Tailwind CSS (Paleta DUO21)
      ├── Lucide Icons + Motion
      └── Local & Offline Resilience
            │
            ▼ (HTTP / JSON / Server-Side APIs)
[ Backend Node.js / Express ]
      │
      ├── POST /api/trip/parse (Gemini 2.5 Flash / Heuristic fallback)
      ├── POST /api/trip/guide (Contextual Assistant)
      ├── POST /api/payment/checkout (Asaas Gateway / Sandbox)
      ├── POST /api/payment/webhook (Idempotent Webhook)
      └── POST /api/reports (Turistas / Curadoria)
            │
            ├── AIProvider Abstraction (GeminiProvider, OpenAIProvider)
            ├── Itinerary Engine (Deterministic rule-based pipeline)
            └── Supabase Client (PostgreSQL + RLS)
```

## 3. Fluxo Completo de Negócio

1. **Aquisição / Landing**: Apresentação da proposta de valor, cidades e preço dinâmico ("A partir de R$ 19,90").
2. **Coleta**: Entrada por áudio (familiar WhatsApp) ou texto livre.
3. **Parsing Estruturado**: Reconhecimento de datas, passageiros, crianças, hotel, orçamento e ritmo.
4. **Perguntas Faltantes**: Intervenção cirúrgica apenas nos dados faltantes.
5. **Confirmação**: Cards editáveis com toque único.
6. **Geração**: Pipeline logístico multietapas com contadores reais de atrações e eventos compatíveis.
7. **Preview Paywall**: HTML real com Dia 1 demonstrativo e próximos dias bloqueados.
8. **Pagamento Asaas**: PIX ou Cartão com confirmação server-side/webhook.
9. **Desbloqueio**: Geração de link seguro `/v/{token-seguro}` sem necessidade de criação de senha.
10. **Uso Durante a Viagem**: Abas HOJE, ROTEIRO, MAPA e GUIA IA.
