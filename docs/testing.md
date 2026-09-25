# Roteiro de Testes e Validação de QA

Este documento descreve os fluxos de teste obrigatórios para homologação do Roteiro Inteligente DUO21.

---

## 1. Teste de Fluxo Completo: Usuário COM Hospedagem
1. Na Landing, clique em **"Criar meu Roteiro Inteligente"**.
2. Na tela de coleta, envie ou grave o áudio:
   > *"Vamos em casal para Gramado do dia 20 ao dia 24 de outubro, ficaremos no Hotel Casa da Montanha, queremos boa gastronomia e passeios românticos sem correria."*
3. Verifique se a tela de confirmação detectou:
   - Hotel: *Hotel Casa da Montanha* (Gramado)
   - Status de hospedagem: Definida
   - Perfil: Casal / Equilibrado
4. Avance para a geração e aguarde os passos do motor.
5. Na tela de Preview / Paywall:
   - Verifique o banner: *"Roteiro otimizado a partir da sua hospedagem"*.
   - Verifique o Dia 1 desbloqueado e Dias 2+ com teaser.
   - Clique em **"Desbloquear roteiro para teste"** (botão DEV).
6. No app desbloqueado:
   - Verifique a aba **Hoje**: saudação, clima com tag MOCK, orçamento e próxima parada.
   - Verifique a seção **"Perto da sua hospedagem"** com opções em torno do Hotel Casa da Montanha.
   - Navegue para **Roteiro**, selecione os dias e verifique a ordenação geográfica.
   - Navegue para **Mapa** e clique em um marcador para abrir o resumo.
   - Navegue para **Guia** e envie *"Começou a chover"* para testar a resposta contextual.

---

## 2. Teste de Fluxo Completo: Usuário SEM Hospedagem
1. Reinicie o teste via botão **"Reiniciar Teste"** na DEV Toolbar.
2. Inicie a criação de um novo roteiro e informe:
   > *"Família com 2 adultos e 1 criança de 6 anos, 3 dias na serra, ainda não reservamos hotel."*
3. Na confirmação:
   - Status de hospedagem: *Ainda não decidi* ou *Sem hospedagem*.
4. Avance para o Preview:
   - Verifique o aviso: *"Base provisória regional: Centro de Gramado"*.
5. Desbloqueie em DEV e verifique a aba **Hoje**:
   - O aplicativo deve exibir a seção **"Encontre onde ficar"** com recomendações reais/demo filtradas para 2 adultos e 1 criança, fotos, notas e links de reserva.

---

## 3. Teste de Troca de Atividade ("Trocar")
1. Em qualquer atividade do roteiro ou da aba Hoje, clique em **"Trocar"** (ou abra os detalhes e clique em "Trocar").
2. Verifique o contador: *"Alterações restantes hoje: 3"*.
3. Filtre por categorias: *Natureza*, *Diversão*, *Gastronomia*, *Gratuito*, *Surpreenda-me*.
4. Selecione uma nova atividade.
5. Verifique se **apenas** aquele slot foi substituído, mantendo os horários e paradas vizinhas intactas.
6. Verifique se o contador atualizou para 2 alterações restantes.

---

## 4. Teste do Painel de Administração e Provedores
1. Abra o painel Admin pelo rodapé ou via `?admin=true`.
2. Acesse a aba **"APIs & Provedores"**.
3. Clique em **"Testar conexão"** para cada serviço (Banco de Dados, Asaas, Mapas, Clima, Rotas, Mídia, Ofertas, IA).
4. Verifique a exibição da latência em milissegundos e log de resposta.
