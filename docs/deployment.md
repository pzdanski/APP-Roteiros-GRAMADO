# Guia de Deploy & Infraestrutura de Produção — Roteiro IA (DUO21)

Este documento orienta o deploy do aplicativo **Roteiro Serra Gaúcha (DUO21)** no domínio canônico definitivo:

```
https://roteiro.duo21.com.br
```

---

## 1. Requisitos do Runtime de Produção

A arquitetura do Roteiro IA é **Full-Stack**, exigindo um container ou servidor Node.js ativo:

1. **Frontend:** React SPA compilado via Vite (`dist/index.html` e `dist/assets/*`).
2. **Backend:** Node.js/Express (`server.ts` compilado para `dist/server.cjs` ou executado via `tsx server.ts`).
3. **APIs Privadas:** Rotas `/api/*` executando regras de negócio e checagem de concorrência com mutex `SingleFlight`.
4. **Webhook Financeiro Público:** Endpoint `POST /api/payments/webhook` acessível publicamente pela internet, autenticado exclusivamente via header `asaas-access-token` (sem exigência de cookies, login ou sessões).
5. **Secrets Server-Side:** Variáveis de ambiente sensíveis que **nunca** podem ser expostas no bundle do cliente:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `GOOGLE_MAPS_API_KEY`
   - `ASAAS_API_KEY`
   - `ASAAS_WEBHOOK_TOKEN`
6. **Processamento Server-Side:** Motores de geração de roteiro (`FinalItineraryEngine`), curadoria, cálculo de matrizes de trânsito e sanitização de logs.

> ⚠️ **Atenção:** Hospedagens estáticas puras (como GitHub Pages, Cloudflare Pages estático ou S3) **NÃO são suficientes**, pois não suportam o servidor Node.js, os segredos de API nem o recebimento de webhooks do Asaas.

---

## 2. Avaliação do Ambiente Google AI Studio

- **Deploy Atual:** Preview Sandbox no Google AI Studio (Cloud Run efêmero).
- **URLs Atuais:**
  - Dev: `https://ais-dev-2lsxlsjuxmaxhkcxiz3wqq-319847534393.us-east1.run.app`
  - Shared: `https://ais-pre-2lsxlsjuxmaxhkcxiz3wqq-319847534393.us-east1.run.app`
- **O AI Studio é adequado como produção definitiva?**
  **NÃO.**

### Justificativas Técnicas:
1. **Ciclo de Vida Efêmero do Sandbox:** As instâncias de sandbox do AI Studio entram em suspensão (cold sleep) e encerramento de sessão quando o desenvolvedor fica inativo, o que provocaria perda de requisições de turistas e de webhooks do Asaas.
2. **Restrições de Domínio e DNS:** Os domínios `*.run.app` internos do AI Studio pertencem ao projeto GCP do ambiente de desenvolvimento. Não é possível mapear diretamente o CNAME `roteiro.duo21.com.br` para uma URL de sandbox do AI Studio sem verificação de propriedade no projeto GCP do cliente.
3. **SLA e Alta Disponibilidade:** Operações financeiras em produção exigem disponibilidade contínua 24/7, monitoramento de saúde e isolamento de recursos corporativos.

---

## 3. Plataforma de Deploy Recomendada: Google Cloud Run (ou VPS Docker)

A plataforma recomendada para hospedar o runtime de produção é o **Google Cloud Run** (no projeto GCP do cliente) ou uma **VPS Docker gerenciada** (ex.: Render, Railway, AWS ECS, Fly.io, Hetzner):

### Vantagens do Cloud Run em Produção:
- Suporta containers Docker com Node.js LTS (v20+).
- Escalonamento automático sob demanda (Scale-to-Zero ou Min Instances = 1 para evitar cold starts).
- Suporte nativo a variáveis de ambiente e Google Secret Manager.
- Compatibilidade total com terminação SSL e proxy reverso Cloudflare (`trust proxy: true`).
- Mapeamento direto de domínio customizado (`roteiro.duo21.com.br`).

---

## 4. Status do Origin Host & Configuração de DNS

- **Status do Host:** `DEPLOY HOST NOT CREATED`
- **Motivo:** O container ou serviço de produção ainda precisa ser provisionado na conta Cloud Run / infraestrutura definitiva antes de realizar o apontamento final no Cloudflare.

### Registro CNAME a ser configurado no Cloudflare (após criação do host):
```
Tipo: CNAME
Nome: roteiro
Destino: [HOSTNAME_REAL_DO_SERVIÇO_DE_PRODUÇÃO]
Proxy status: Proxied (Nuvem Laranja ativada)
TTL: Auto
```

---

## 5. Endpoints Canônicos de Produção

Após a publicação no host de produção:
- **Aplicação Pública (PWA / Turista):** `https://roteiro.duo21.com.br`
- **APIs de Backend:** `https://roteiro.duo21.com.br/api/*`
- **Webhook Definitivo Asaas:** `https://roteiro.duo21.com.br/api/payments/webhook`
- **Painel Control Plane / CMS:** `https://roteiro.duo21.com.br/duo-control`

---

## 6. Procedimento de Build & Container Docker

Para gerar o container de produção:

```dockerfile
# Dockerfile para Produção
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

### Comandos de Validação Local:
```bash
# 1. Compilação completa (Frontend Vite + Backend esbuild)
npm run build

# 2. Execução em modo de produção
NODE_ENV=production node dist/server.cjs
```
