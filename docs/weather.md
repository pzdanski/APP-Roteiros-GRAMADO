# Previsão Meteorológica & Microclima da Serra — DUO21

## 1. Princípios da Integração de Clima

O clima na Serra Gaúcha é dinâmico, influenciando diretamente a viabilidade de passeios abertos vs. cobertos.

1. **Cache por Cidade e Data (`external_data_cache`):**
   - Chave de cache: `weather:gramado:2026-10-10`.
   - **Uma única chamada atende a todas as atrações agendadas para aquele dia naquela cidade.**
   - O turista nunca dispara requisições climáticas individuais por atração.

2. **Horizonte de Previsão Confiável (14 dias):**
   - **Datas até 14 dias:** Consulta à API meteorológica (Open-Meteo com coordenadas calibradas para Gramado, Canela e Nova Petrópolis).
   - **Datas além de 14 dias:** O motor marca `forecast_unavailable: true` e utiliza a **sazonalidade histórica da Serra Gaúcha** (Inverno, Verão, Primavera, Outono) com `confidence: 'LOW'`, sem inventar dados diários falsos.

---

## 2. Classificações Normalizadas de Clima & Perfil de Local

### Condições Meteorológicas:
- `CLEAR`: Céu aberto/ensolarado.
- `PARTLY_CLOUDY`: Parcialmente nublado com sol.
- `CLOUDY`: Nublado/encoberto.
- `RAIN`: Chuva moderada / chuviscos.
- `HEAVY_RAIN`: Chuva forte e contínua.
- `STORM`: Temporal / trovoada.
- `COLD`: Frio severo (< 6°C).
- `HOT`: Calor atípico (> 30°C).
- `UNKNOWN`: Condição indeterminada.

### Perfil dos Locais (`indoor_type`):
- `indoor`: 100% coberto (ex: Snowland, Mini Mundo coberto, Mundo de Chocolate).
- `outdoor`: Ao ar livre (ex: Lago Negro, Alpen Park, Mirantes).
- `mixed`: Parcialmente coberto e aberto (ex: Parque da Ferradura, Olivas).
- `rain_ok`: Seguro mesmo com chuva fraca (ex: Rua Coberta).

---

## 3. Adaptação Climática sem Consumo de Cota (`WeatherReplanService`)

Caso a previsão mude para `HEAVY_RAIN` ou `STORM`:
- O `WeatherReplanService` detecta as atividades `outdoor` afetadas.
- Propõe alternativas cobertas na mesma cidade.
- Registra alteração com `change_type: 'WEATHER'` e **`consumed_quota: false`**, garantindo que o turista não seja penalizado em suas cotas diárias de mudanças estruturais por eventos da natureza.
