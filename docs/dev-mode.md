# Guia do Modo de Desenvolvimento (DEV / TEST MODE)

O **DEV Mode** foi projetado para permitir testes exaustivos de ponta a ponta sem gerar cobranças reais, sem chamar a API do Asaas e sem corromper métricas financeiras de produção.

---

## 1. Segurança & Restrição de Ambiente
- O botão "Desbloquear roteiro para teste" e o painel flutuante `DevToolbar` são renderizados **apenas** quando o ambiente for desenvolvimento (`import.meta.env.DEV` ou `process.env.NODE_ENV !== 'production'`).
- Em produção, nenhuma chamada a desbloqueio interno é permitida.
- O campo `unlock_source` na viagem registra explicitamente `dev_test` (diferente de `payment` ou `admin`).

---

## 2. Como Desbloquear em Desenvolvimento
Existem duas maneiras simples de desbloquear o roteiro no ambiente do AI Studio:

1. **Na tela de Preview / Paywall:**
   - Role até o bloco em destaque amarelo: **MODO DE DESENVOLVIMENTO**.
   - Clique em **"Desbloquear roteiro para teste"**.
   - O aplicativo transita instantaneamente para o roteiro desbloqueado com todas as telas disponíveis.

2. **Pela DEV Toolbar (canto superior direito):**
   - Clique no botão flutuante **🛠️ DEV**.
   - Clique em **"Desbloquear DEV"**.

---

## 3. Ações da DEV Toolbar
- **Desbloquear DEV:** Desbloqueia o roteiro atual (ou instancia um roteiro de teste padrão caso ainda não tenha gerado um).
- **Reiniciar Teste:** Limpa a viagem atual do `localStorage`, zera o estado em memória e retorna à tela inicial de Landing mantendo as configurações salvas do sistema.
- **Atalhos Rápidos:** Salta diretamente entre as abas do app desbloqueado:
  - `Hoje`
  - `Roteiro`
  - `Mapa`
  - `Guia`
- **Ver Estado da Viagem:** Inspeciona o JSON completo do objeto `Trip` em tempo real (dias, custos, `usage_stats`, `unlock_source`, preferências).

---

## 4. Regras de Integridade de Dados
- Viagens geradas em DEV mode recebem a flag `is_demo: true`.
- Relatórios e métricas de conversão no `AdminDashboard` filtram ou distinguem pagamentos reais daqueles originados de `dev_test`.
