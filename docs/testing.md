# Plano de Testes & Auditoria — DUO21

## 1. Testes Automatizados da Camada de Dados

### Teste 1: Supabase como Source of Truth
- Configuração: `DATA_MODE=supabase`.
- Simulação de queda do banco: O backend e repositories devem lançar `DATABASE_UNAVAILABLE`.
- Comportamento proibido: Criar arquivo `.data` ou responder mock silenciosamente com HTTP 200.

### Teste 2: Modo Mock Explícito
- Configuração: `DATA_MODE=mock`.
- Permitido somente quando `NODE_ENV=development` ou `test`.
- Responde com dados de teste claramente sinalizados.

### Teste 3: Isolamento Cross-Trip
- Criar Viagem A (Token A) e Viagem B (Token B).
- Acesso com Token A em `/api/db/trips/token/:token` deve retornar Viagem A.
- Tentativa de acessar Viagem B usando Token A é bloqueada.

### Teste 4: Bloqueio de DEV_TEST em Produção
- Configuração: `NODE_ENV=production`.
- Envio de requisição com `unlock_source: 'dev_test'` retorna HTTP 403 `FORBIDDEN`.

### Teste 5: Autenticação de Rotas Administrativas
- Requisição para `/api/admin/*` ou `POST /api/db/places` sem `x-admin-key` ou Bearer token retorna HTTP 401 `UNAUTHORIZED`.
- Com chave válida, executa com sucesso.

### Teste 6: CostGuard e Cache
- Primeira consulta (Cache Miss): Persiste em `external_data_cache`.
- Segunda consulta (Cache Hit): Retorna do cache com custo zero.
- Projeção de custo acima do teto emite `COST_LIMIT_WARNING`.

### Teste 7: Resolução de Hospedagem
- Entrada: "Vou ficar no Hotel Sky Gramado"
- Comportamento: Resolve entidade com lat/lng, persiste em cache e alimenta anchor logístico.
- Segunda execução: Retorna de cache com ZERO chamadas adicionais ao Google.

### Teste 8: Resolução de Must-Have
- Entrada: "Quero conhecer o Lago Negro"
- Comportamento: Resolve entidade oficial real no catálogo (sem alucinação por LLM).

### Teste 9: Local-First Fondue
- Entrada: "Quero fondue"
- Comportamento: Supabase possui >= 5 candidatos -> Google Discovery NÃO é disparado.

### Teste 10: Sem Hospedagem
- Entrada: "Ainda não reservei hospedagem"
- Comportamento: Zero chamadas ao Google Places, utilizando Centro de Gramado provisório.

### Teste 11: Clusterização por Cidade & Anti Zigue-Zague
- Entrada: Viagem de 4 dias (Gramado + Canela)
- Comportamento: Dia 1 em Gramado (ancorado no hotel), Dia 2 em Canela, Dia 3 em Nova Petrópolis/Gramado, Dia 4 em Canela. Zero alternâncias caóticas no mesmo turno.

### Teste 12: Margem Logística & Buffer
- Comportamento: Cada deslocamento inclui 20% de margem logística (`TRAVEL_BUFFER_PERCENT = 0.20`) para estacionamento e trânsito turístico.

### Teste 13: Must-Have Fondue no Jantar
- Entrada: `must_have: ['fondue']`
- Comportamento: Aloca obrigatoriamente sequência de fondue (Restaurante Colosseo / Belle Du Valais) na janela de jantar (19:30).

### Teste 14: Cache de Rotas e Clima
- Comportamento: Primeira rota ou previsão = MISS. Segunda chamada com mesmos parâmetros = HIT (0 novas chamadas externas).

### Teste 15: Adaptação Climática (WeatherReplanService)
- Simulação de chuva forte (`HEAVY_RAIN`) em dia com atração aberta:
- Comportamento: Detecta impacto, propõe substituição por local coberto e não consome quota (`consumed_quota = false`).
