# Motor Logístico Real & Validador de Roteiros — DUO21

## 1. Princípio Fundamental de Arquitetura

> **REGRAS E DADOS DECIDEM A VIABILIDADE. A IA (GEMINI) ORGANIZA, PERSONALIZA E CONVERSA.**

O roteiro gerado pelo DUO21 não é uma simples lista de nomes gerados por LLM. Ele é montado pelo `LogisticsEngine` e auditado pelo `ItineraryValidator`.

---

## 2. Responsabilidades do `LogisticsEngine`

1. **Hospedagem como Âncora Inevitável:**
   - Se o turista possui hotel confirmado (ex: Hotel Sky Gramado), cada dia de viagem começa logicamente a partir das coordenadas geográficas desse hotel (`logistics_anchor`).
   - Se não tiver hotel ("Ainda não reservei"), o sistema ancora na base central da cidade (`provisionalLogisticsBase`) sem travar a experiência.

2. **Clusterização por Cidade (Anti Zigue-Zague):**
   - Agrupa atividades de forma contígua:
     - Dia 1: Gramado
     - Dia 2: Canela
     - Dia 3: Nova Petrópolis ou Gramado temática
     - Dia 4: Canela / Gramado
   - Evita deslocamentos circulares repetitivos entre cidades no mesmo dia.

3. **Janelas de Refeição Estratégicas:**
   - **Almoço (11:30 - 14:00):** O motor seleciona um restaurante situado a curta distância da atração matinal ou da atração da tarde, respeitando o teto de gastos do briefing (ex: até R$ 80/pessoa).
   - **Jantar (18:30 - 21:30):** Aloca opções acolhedoras para o anoitecer. Se o turista solicitou fondue como `must_have`, o motor obrigatoriamente aloca uma sequência tradicional de fondue.

4. **Margem Logística (`TRAVEL_BUFFER_PERCENT = 20%`):**
   - Nenhum deslocamento é agendado sem margem de tempo para manobras, estacionamento e trânsito turístico moderado.

5. **Acomodação de Crianças e Fadiga Diária:**
   - Para grupos com crianças, dias excessivamente extensos são desarmados, priorizando atrações familiares (Mini Mundo, Florybal, Alpen Park, chocolaterias) e limitando a 2-3 paradas diárias no ritmo tranquilo.

---

## 3. Validação pós-geração (`ItineraryValidator`)

O `ItineraryValidator` inspeciona cada dia e atividade após a geração:
- Local existe e está ativo no catálogo.
- Local está aberto no dia da semana e no horário planejado.
- Tempo de deslocamento e duração são fisicamente possíveis (ex: Atividade A termina 14:00, deslocamento 25 min → Atividade B não pode começar 14:10).
- Faixa orçamentária é calculada (`estimatedDailyCostMin/Max` e `estimatedTripCostMin/Max`), sem somar hospedagem quando `lodgingIncluded = false`.
- Conflitos simples são deterministicamente corrigidos pelo método `autoCorrectTimeline()`.
