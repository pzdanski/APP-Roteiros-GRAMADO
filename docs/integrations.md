# Integrações & Provedores do Roteiro Inteligente DUO21

A arquitetura do DUO21 adota o padrão **Provider / Repository Pattern**. A interface do usuário consome interfaces abstratas, permitindo alternar de modo Mock/Demo para Provedores Reais com facilidade e sem reescrever telas ou regras de negócio.

---

## 1. Provedor de Banco de Dados (`TripRepository`, `PlaceRepository`, `PaymentRepository`, `UserReportRepository`)
- **Interface:** `src/services/repositories/`
- **Provedor Mock / Dev:** `InMemoryTripRepository`, `InMemoryPlaceRepository`, etc.
- **Provedor Real:** `SupabaseTripRepository` via tabelas PostgreSQL: `trips`, `places`, `payments`, `user_reports`, `events`, `trip_changes`.
- **Como Alternar:** Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` no ambiente; o repositório chaveia para o cliente Supabase oficial.

---

## 2. Provedor de Pagamentos (`PaymentRepository` / Asaas)
- **Interface:** `src/services/repositories/PaymentRepository.ts`
- **Provedor Mock / Sandbox:** Gera PIX estático simulado em desenvolvimento e permite auto-aprovação para testes de ponta a ponta sem despesas.
- **Provedor Real:** `AsaasPaymentRepository` chamando `/api/payment/checkout` no backend com autenticação de chave segura.
- **Validação de Pagamento:** Somente o webhook autenticado do Asaas ou consulta direta com `ASAAS_API_KEY` pode transitar um status para `paid` real. Desbloqueios de desenvolvimento gravam `unlock_source: 'dev_test'` para jamais contaminar métricas contábeis.

---

## 3. Provedor de Mapas (`MapProvider`)
- **Interface:** `src/services/map/MapProvider.ts`
- **Provedor Mock:** `MockMapProvider` com clusters geográficos de Gramado, Canela e Nova Petrópolis e tiles OpenStreetMap / MapLibre.
- **Provedor Real:** MapLibre GL JS / Google Maps Platform (`GOOGLE_PLACES_API_KEY`).
- **Navegação:** Link universal `https://www.google.com/maps/search/?api=1&query=...` disponível em todas as paradas do roteiro.

---

## 4. Provedor de Clima (`WeatherProvider`)
- **Interface:** `src/services/weather/WeatherProvider.ts`
- **Provedor Mock:** `MockWeatherProvider` com previsões da Serra Gaúcha calibradas por estação (12°C a 23°C).
- **Provedor Real:** Open-Meteo API (gratuita e sem chave obrigatória) ou WeatherAPI.

---

## 5. Provedor de Rotas e Tempos (`RouteProvider`)
- **Interface:** `src/services/routes/RouteProvider.ts`
- **Provedor Mock:** `MockRouteProvider` utilizando matriz de distâncias reais entre cidades da Serra (Gramado ↔ Canela: 8 km / ~15 min; Gramado ↔ Nova Petrópolis: 34 km / ~45 min) e velocidades médias urbanas/serranas.
- **Provedor Real:** OSRM ou Google Directions API.

---

## 6. Provedor de Mídia e Conteúdo (`MediaProvider`)
- **Interface:** `src/services/media/MediaProvider.ts`
- **Provedor Ativo:** `DuoMediaProvider` com fotos curadas de alta definição e links de Reels/vídeos dos parceiros do Divulga Lugares.
- **Provedor Real:** Supabase Storage / Cloudflare R2 / Instagram Graph API.

---

## 7. Provedor de Ofertas e Cupons (`OfferProvider`)
- **Interface:** `src/services/offers/OfferProvider.ts`
- **Provedor Ativo:** `MockOfferProvider` com descontos verificados para atrações parceiras em Gramado e Canela (ex: Fondue tradicional, Snowland, Roda Canela).
- **Provedor Real:** Feed de parceiros locais / Tchê Ofertas / Prime Gourmet.

---

## 8. Provedor de IA (`GeminiProvider`)
- **Interface:** `src/services/ai/GeminiProvider.ts`
- **Provedor Padrão:** `GeminiProvider` chamando `@google/genai` (modelo `gemini-2.5-flash`) de forma server-side via `/api/trip/parse` e `/api/trip/guide`.
- **Fallback Local Resiliente:** `heuristicParser.ts` extrai preferências locais mesmo quando a chave de API estiver ausente ou indisponível.

---

## Registro Central de Provedores
O registro `src/services/providers/index.ts` mantém o status consolidado de cada provedor e expõe o método `testProvider(id)` consumido no painel de administração em `/admin` ou via aba "APIs & Provedores".
