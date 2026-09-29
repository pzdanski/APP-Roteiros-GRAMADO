# Arquitetura de Domínio & Produção — DUO21 Roteiro IA

Este documento descreve a topologia e as configurações necessárias para a ativação do domínio canônico em ambiente de produção para o aplicativo **Roteiro Serra Gaúcha (DUO21)**.

---

## 1. Domínio Canônico & Arquitetura

- **Domínio Principal / Canônico:** `https://roteiro.duo21.com.br`
- **Origem da Aplicação:** `https://roteiro.duo21.com.br`
- **Base de APIs:** `https://roteiro.duo21.com.br/api/*`
- **CMS / Painel Administrativo:** `https://duo21.com.br/duo-control` (ou `/duo-control` desacoplado)

### Topologia de Tráfego:
```text
Turista / Usuário Final
        │
        ▼
   Cloudflare Edge (WAF, SSL, Caching Estático)
        │
        ▼ [CNAME: roteiro.duo21.com.br]
Servidor da Aplicação (Node.js Express + SPA Vite em https://roteiro.duo21.com.br)
   ├── Runtime do Turista (PWA, Wizard, Itinerário, Checkout)
   └── APIs Server-Side (/api/*)
            ├── Supabase (Banco de Dados, Source of Truth)
            ├── Google Places / Routes API (Geocoding & Logística)
            ├── Google Gemini API (Guia Inteligente)
            └── Asaas Gateway (Cobranças PIX & Cartão)
```

O CMS DUO21 opera como **control plane** e não se interpõe no caminho crítico das requisições dos turistas.

---

## 2. DNS Necessário

No painel de gerenciamento DNS do domínio `duo21.com.br` (Cloudflare):

| Tipo  | Nome (Host) | Destino (Target) | Proxy Status | TTL  |
| :---  | :---        | :---             | :---         | :--- |
| CNAME | `roteiro`   | `<TARGET_DEPLOY_HOST>` (ex: Cloud Run / Host de Deploy) | Proxied (Nuvem Laranja) | Auto |

> **Nota:** Não alterar o DNS até a aprovação formal da janela de publicação (Sprint 8B).

---

## 3. Configuração Cloudflare

1. **Proxy Status:** Ativado (Proxied / Nuvem Laranja) para proteção DDoS, terminação SSL e cache de assets.
2. **SSL/TLS Encryption Mode:** **Full (Strict)** — a comunicação entre o Cloudflare e a origem é 100% criptografada via HTTPS com certificado válido.
3. **Always Use HTTPS:** Ativado (redireciona requisições HTTP para HTTPS automaticamente).
4. **Minimum TLS Version:** TLS 1.2 ou superior.
5. **WebSockets:** Habilitado (para suporte a conexões em tempo real se necessário).
6. **Bypass de Cache para APIs:** Criar Cache Rule no Cloudflare:
   - URI Path começa com `/api/` ➔ Cache Level: **Bypass** (nunca cachear chamadas de API, checkout ou webhooks).
7. **Cache de Assets Estáticos:**
   - URI Path começa com `/assets/` ➔ Cache Level: **Cache Everything**, Edge Cache TTL: 7 dias.

---

## 4. SSL & Terminação Segura

- **Certificado Edge (Cloudflare):** Universal SSL gerido pelo Cloudflare para `*.duo21.com.br` e `duo21.com.br`.
- **Certificado Origin:** Certificado emitido pela autoridade do host ou Cloudflare Origin CA instalado no servidor.
- **Trust Proxy:** O servidor Express está configurado com `app.set('trust proxy', true)`, identificando corretamente os cabeçalhos `CF-Connecting-IP` e `X-Forwarded-Proto`.

---

## 5. Origem & Deploy

- **Porta:** 3000 (ou porta definida pela variável `PORT` do container).
- **Process Manager:** `node dist/server.cjs` (modo produção, gerado via `npm run build`).
- **Health Check Endpoint:** `GET https://roteiro.duo21.com.br/api/health`
  - Responde com status HTTP 200, integridade dos serviços (Supabase, Places, Routes, Gemini, Asaas) e zero exposição de segredos.

---

## 6. Variáveis de Ambiente Necessárias (Produção)

| Variável | Valor Esperado | Escopo |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Servidor |
| `DATA_MODE` | `supabase` | Servidor |
| `APP_PUBLIC_URL` | `https://roteiro.duo21.com.br` | Servidor |
| `PUBLIC_APP_ORIGIN` | `https://roteiro.duo21.com.br` | Servidor |
| `ADMIN_API_KEY` | *(Chave segura e exclusiva de produção)* | Servidor |
| `SUPABASE_URL` | `https://<project-id>.supabase.co` | Servidor & Build |
| `SUPABASE_ANON_KEY` | *(Chave anônima pública do Supabase)* | Servidor & Build |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Chave de serviço restrita — nunca expor)* | Servidor |
| `GEMINI_API_KEY` | *(Chave do Google AI Studio / GCP)* | Servidor |
| `GOOGLE_MAPS_API_KEY` | *(Chave da Google Cloud Platform)* | Servidor |
| `ASAAS_ENV` | `sandbox` *(manter sandbox até homologação 8B)* | Servidor |
| `ASAAS_API_KEY` | *(Chave do Asaas correspondente ao ambiente)* | Servidor |
| `ASAAS_WEBHOOK_TOKEN` | *(Token de validação configurado no Asaas)* | Servidor |
| `ASAAS_WEBHOOK_URL` | `https://roteiro.duo21.com.br/api/payments/webhook` | Servidor |
| `MAX_GENERATION_API_COST_BRL` | `1.00` | Servidor |

---

## 7. Webhook Definitivo do Asaas

- **URL Pública Definitiva:**
  ```text
  https://roteiro.duo21.com.br/api/payments/webhook
  ```
- **Método HTTP:** `POST`
- **Autenticação:** Header `asaas-access-token` (ou `access_token`) comparado com o valor de `ASAAS_WEBHOOK_TOKEN`.
- **Acesso Público:** Totalmente livre de cookies, sessões ou telas intermediárias de autenticação.
- **Eventos Recomendados no Asaas:**
  - `PAYMENT_CONFIRMED`
  - `PAYMENT_RECEIVED`
  - `PAYMENT_REFUNDED`
  - `PAYMENT_OVERDUE`
  - `PAYMENT_DELETED`
- **Idempotência:** Garantida por verificação de `asaas-event-id` e pelo identificador de pagamento antes de acionar a geração do roteiro.
