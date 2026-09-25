# Segurança e LGPD - DUO21 Serra Gaúcha

## 1. Princípios de Segurança

1. **Secrets Somente no Servidor**:
   - `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `ASAAS_API_KEY` jamais são expostas ao browser ou incluídas no bundle cliente.
   - Chamadas que consomem provedores de IA ou gateway de pagamentos ocorrem exclusivamente através de endpoints `/api/*`.

2. **Acesso por Token Seguro**:
   - Não há exigência de senha no MVP para reduzir atrito mobile.
   - O acesso é autenticado via link seguro (`/v/{secure_token}`). O token possui entropia criptográfica elevada (não sequencial).
   - O usuário pode recuperar seu link a qualquer momento informando o e-mail cadastrado na compra.

3. **Webhook Idempotente**:
   - O endpoint `/api/payment/webhook` registra o identificador único do evento para evitar duplo processamento de pagamentos ou desbloqueios duplicados.

4. **LGPD (Lei Geral de Proteção de Dados)**:
   - Coleta mínima de dados (nome, e-mail, datas, composição de grupo e preferências).
   - Localização GPS é estritamente opcional e acionada apenas mediante consentimento explícito no botão "Ver o que fazer perto daqui".
   - Após a viagem, os dados do assistente interativo são arquivados para consulta histórica.
