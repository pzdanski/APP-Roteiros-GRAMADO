# Google Routes & Mountain Logistics — DUO21

## 1. Princípios de Arquitetura de Rotas

O cálculo de rotas no DUO21 é guiado por três regras fundamentais de engenharia e economia:

1. **Server-Side Exclusivo:**
   Toda comunicação com a Google Routes API ocorre estritamente no backend Node/Express (`/api/routes/*`), sem qualquer exposição de credenciais ao navegador do cliente.

2. **Cache-First com Chave Aproximada (`external_data_cache`):**
   Antes de qualquer chamada externa, o backend consulta o `external_data_cache`.
   A chave de cache aproxima as coordenadas a **3 casas decimais** (~100 metros de precisão):
   ```
   routes:-29.388,-50.875:-29.359,-50.814:DRIVING
   ```
   Isso maximiza drasticamente a taxa de cache hits entre turistas que transitam pelos mesmos pontos turísticos.

3. **Pré-filtro Haversine & Matriz Controlada:**
   Nunca calculamos combinações desnecessárias (ex: 30x30).
   O motor aplica:
   - Candidate RPC (filtragem por perfil)
   - Haversine (proximidade geográfica)
   - Clusterização por cidade (Gramado, Canela, Nova Petrópolis)
   - Apenas os segmentos sequenciais reais (Stop A → Stop B) passam pelo RouteProvider.

---

## 2. TTLs e Custos (`CostGuard`)

| Dado de Rota | TTL Padrão | Justificativa | Custo Estimado |
| :--- | :--- | :--- | :--- |
| **Distância (km / geometria)** | 7 dias | O traçado viário não muda com frequência | R$ 0,00 (cache) |
| **Tempo de Deslocamento** | 24 horas | Variação com base no tráfego sazonal | R$ 0,03 / chamada externa |
| **Simulação Haversine Montanha** | Ilimitado / 24h | Fallback determinístico calibrado | R$ 0,00 |

---

## 3. Calibração da Simulação de Montanha (Serra Gaúcha)

Quando a Google Routes API estiver indisponível ou em modo MOCK/DEV, o motor utiliza física viária calibrada para a topografia da Serra Gaúcha:
- **Fator de Curvatura de Serra:** `1.38x` da distância em linha reta (curvas da Av. das Hortênsias e RS-235).
- **Velocidade Média Urbana/Turística:** `38 km/h` (considerando rotatórias, lombadas e tráfego turístico).
- **Velocidade Rodoviária (RS-235):** `50 km/h` para trechos acima de 15 km (Gramado a Nova Petrópolis).
- **Margem Logística (`TRAVEL_BUFFER_PERCENT`):** `20%` adicionados ao tempo de trânsito para estacionamento e desembarque.
