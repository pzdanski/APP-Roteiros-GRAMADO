# Guia de Configuração e Proteção de Custos — Google Places API (New)

## 1. Princípio Fundamental de Segurança

- **A chave `GOOGLE_MAPS_API_KEY` NUNCA é enviada ao navegador do cliente.**
- Toda comunicação com o Google Places ocorre estritamente **server-side** no backend Node/Express (`/api/places/*`).
- O frontend nunca deve possuir `VITE_GOOGLE_MAPS_API_KEY`.

---

## 2. Passo a Passo no Google Cloud Console

### Passo 1: Criar Projeto e Ativar a API Correta
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie ou selecione o projeto do aplicativo DUO21.
3. No menu **APIs e Serviços > Biblioteca**, pesquise por **Places API (New)**.
4. Clique em **Ativar**.
   > **Atenção:** Certifique-se de ativar a **Places API (New)** e **NÃO** a Places API Legacy.

### Passo 2: Criar e Restringir a Chave de API
1. Acesse **APIs e Serviços > Credenciais**.
2. Clique em **Criar Credenciais > Chave de API**.
3. Imediatamente clique em **Restringir Chave**:
   - **Restrições de Aplicativo:** Selecione **Endereços IP** e insira os IPs do seu servidor de produção / Cloud Run (ou deixe em desenvolvimento restrito).
   - **Restrições de API:** Marque **Restringir chave** e selecione **EXCLUSIVAMENTE** a `Places API (New)`.
4. Salve a configuração.

### Passo 3: Configurar Alertas de Orçamento (Budget Alerts)
1. No menu lateral, acesse **Faturamento > Orçamentos e alertas**.
2. Crie um novo orçamento para o projeto (ex: R$ 50,00 ou US$ 10,00/mês).
3. Configure notificações para:
   - 50% do orçamento
   - 80% do orçamento
   - 100% do orçamento
4. Insira o e-mail administrativo dos fundadores do DUO21 para receber alertas imediatos.

### Passo 4: Configurar Limites de Cota Diária (Quota Limits)
1. Acesse **APIs e Serviços > Places API (New) > Cotas**.
2. Defina um teto máximo de requisições por dia (ex: 2.000 requisições/dia) para evitar cobranças não autorizadas em caso de pico acidental.

---

## 3. Configuração no Ambiente DUO21

No arquivo `.env` do servidor (nunca comitado no Git):

```bash
GOOGLE_MAPS_API_KEY=AIzaSy...sua_chave_aqui...
```

Ao reiniciar o servidor, o endpoint `/api/health` e o `ProviderRegistry` no painel administrativo identificarão automaticamente:

```json
{
  "places": "connected",
  "places_details": "Google Places API (New) operacional."
}
```
