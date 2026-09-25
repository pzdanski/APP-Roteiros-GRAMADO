# DUO21 • Roteiro Inteligente Serra Gaúcha
### Gramado • Canela • Nova Petrópolis

Assistente e planejador de viagem comercial mobile-first para a Serra Gaúcha, operando sob o princípio:
> **DADOS E REGRAS DECIDEM. A IA ORGANIZA, PERSONALIZA E CONVERSA.**
> A IA nunca inventa preços, horários, funcionamento, distâncias ou promoções.

---

## 🌟 Funcionalidades Principais

1. **Entrada de Voz Familiar (WhatsApp Style)**:
   - Botão grande de áudio ("Toque e fale") para o turista contar planos naturalmente.
   - Alternativa de digitação rápida em texto livre.
   - Parsing híbrido: LLM Gemini 2.5 Flash no backend via `@google/genai` com fallback heurístico local e offline (`heuristicParser.ts`).

2. **Perguntas Faltantes Cirúrgicas**:
   - Se o usuário não mencionar datas ou seu nome, o sistema pergunta **apenas** o dado faltante em vez de forçar um formulário extenso.

3. **Confirmação Visual "Entendi sua viagem assim!"**:
   - Cards modulares e editáveis: Datas, Passageiros, Hospedagem, Locomoção, Orçamento, Ritmo e Interesses.

4. **Motor de Roteiro Determinístico (`itineraryEngine.ts`)**:
   - **Agrupamento por Clusters**: Gramado, Canela e Nova Petrópolis sem cruzamentos desnecessários da Av. das Hortênsias.
   - **Clima Integrado**: Contingências cobertas automáticas para dias chuvosos.
   - **Eventos Âncora Reais**: Natal Luz, Sonho de Natal, Festival de Cinema e Paradas.
   - **Telas de Progresso**: Feedback visual com contadores reais de locais avaliados.

5. **Paywall & Monetização Transparente**:
   - Dia 1 demonstrativo 100% legível com detalhes e dicas da curadoria Divulga Lugares.
   - Dias seguintes bloqueados com visual de alto valor percebido.
   - Comunicação clara: **A partir de R$ 19,90** com licença por viagem.

6. **Checkout Asaas (PIX / Cartão)**:
   - Integração com Asaas Gateway para PIX (QR Code + Copia e Cola) e Cartão de Crédito.
   - Modo Sandbox automático para desenvolvimento e testes de homologação.
   - Webhook idempotente no backend (`/api/payment/webhook`).

7. **Acesso por Link Seguro (`/v/{token}`)**:
   - Sem atrito de cadastro tradicional ou senhas no mobile.
   - Tela de recuperação de acesso via e-mail ou código único.

8. **Navegação do Roteiro Desbloqueado**:
   - **HOJE**: Contexto temporal ("Faltam X dias" ou "Hoje"), clima, próxima atividade, atalhos (Comer, Passeios, Grátis, Ofertas, Perto).
   - **ROTEIRO**: Visualização detalhada de cada dia, orçamento diário e dicas locais.
   - **MAPA**: Clusters territoriais e tempos de deslocamento entre Gramado, Canela e Nova Petrópolis.
   - **GUIA IA**: Assistente conversacional contextualizado (datas, hotel, grupo, orçamento e clima) com teto seguro de 30 mensagens por dia.

9. **Painel Administrativo DUO21**:
   - Telemetria de receita, conversão e monitoramento de custo variável operacional (< R$ 1,00 por viagem).
   - Gestão de locais, preços e eventos âncora.
   - Moderação de relatos colaborativos de turistas.
   - Ajuste dos pesos do motor de ranqueamento.

---

## 🛠️ Stack Tecnológica

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion.
- **Backend**: Express.js, TypeScript (`tsx`), Vite Middleware.
- **IA / LLM**: `@google/genai` (Gemini 2.5 Flash) server-side com fallback heurístico.
- **Banco de Dados**: Supabase PostgreSQL (`/database/schema.sql`) com Row Level Security (RLS).
- **Pagamentos**: Gateway Asaas com webhook e modo sandbox.
- **PWA**: Manifesto (`/public/manifest.json`), service worker ready, mobile-first design.

---

## 🚀 Como Executar

```bash
# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento (Express + Vite)
npm run dev

# Compilar para produção
npm run build

# Iniciar versão de produção
npm start
```

Acesse no navegador: `http://localhost:3000`
Acesse o Painel Administrativo: `http://localhost:3000?admin=true` ou clicando no ícone do cadeado no rodapé do app.
