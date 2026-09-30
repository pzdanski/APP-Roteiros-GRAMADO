import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { validateServerEnv } from './src/server/envValidator';
import { createAdminAuthMiddleware } from './src/server/adminAuth';
import { supabaseServer } from './src/server/supabaseServer';
import { TripAccessService } from './src/services/security/TripAccessService';
import { googlePlacesServer } from './src/server/places/GooglePlacesServerProvider';
import { googleRoutesServer } from './src/server/routes/GoogleRoutesServerProvider';
import { weatherServer } from './src/server/weather/WeatherServerProvider';
import { asaasServerProvider } from './src/server/payment/AsaasServerProvider';
import { PriceService } from './src/services/payment/PriceService';
import { finalItineraryEngine } from './src/services/finalItineraryEngine';
import { SEED_PLACES } from './src/data/seedData';
import { DEFAULT_WEIGHTS } from './src/services/itineraryEngine';
import { Place } from './src/types';
import { rateLimitService } from './src/server/security/RateLimitService';
import { singleFlight } from './src/server/cache/SingleFlight';
import { structuredLoggerMiddleware, sanitizeLog } from './src/server/security/StructuredLogger';

dotenv.config();

// Ensure production mode if running compiled bundle or if dist/ exists
if (!process.env.NODE_ENV) {
  const hasDist = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));
  process.env.NODE_ENV = hasDist ? 'production' : 'development';
}

// 1. Validate Environment on startup
const env = validateServerEnv();
const requireAdmin = createAdminAuthMiddleware(env.ADMIN_API_KEY);

// Cloud Run and production listen on process.env.PORT || 8080 on 0.0.0.0
const PORT = Number(process.env.PORT) || 8080;

// Lazy initialized Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    } catch (err) {
      console.warn('Gemini SDK initialization error:', err);
    }
  }
  return geminiClient;
}

// In-memory payment orders, trips & rate limiter
const orderDatabase = new Map<string, any>();
const tripsDatabase = new Map<string, any>();
const processedWebhooks = new Set<string>();
export interface PaymentAuditEvent {
  id: string;
  type: 'PAYMENT_CREATED' | 'PAYMENT_CONFIRMED' | 'PAYMENT_RECEIVED' | 'ITINERARY_GENERATED' | string;
  payload: any;
  created_at: string;
}
const paymentEvents: PaymentAuditEvent[] = [];

// Rate Limiter for external APIs (Section 9)
const clientRequestCounts = new Map<string, { count: number; resetTime: number }>();
function checkRateLimit(clientId: string, maxCalls = 40, windowMs = 60000): boolean {
  const now = Date.now();
  const current = clientRequestCounts.get(clientId);
  if (!current || now > current.resetTime) {
    clientRequestCounts.set(clientId, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (current.count >= maxCalls) {
    return false;
  }
  current.count++;
  return true;
}

async function startServer() {
  const app = express();

  // Cloudflare Proxy & SSL termination support (Sprint 8A)
  app.set('trust proxy', true);

  // Payload size limit (Sprint 8B - Security)
  app.use(express.json({ limit: '1mb' }));

  // Structured Logging with Request ID (Sprint 8B)
  app.use(structuredLoggerMiddleware());

  // -------------------------------------------------------------------------
  // Security Headers & Cache-Control (Sprint 8B - Performance + Scale)
  // -------------------------------------------------------------------------
  const canonicalOrigins = [
    env.APP_PUBLIC_URL,
    env.PUBLIC_APP_ORIGIN,
    'https://roteiro.duo21.com.br',
    'https://duo21.com.br',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ];

  function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return true; // Server-to-server (e.g. Asaas webhook, health probes)
    if (canonicalOrigins.includes(origin)) return true;
    // Allow Google Cloud Run & AI Studio preview domains
    if (origin.endsWith('.run.app') || origin.endsWith('.aistudio.google.com')) return true;
    return false;
  }

  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;

    // 1. Security Headers (Section 5)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Balanced CSP (Non-breaking for Google Maps, Google Fonts, Open-Meteo, Asaas QR, and Vite)
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob: http:",
      "connect-src 'self' https: http: ws: wss:",
      "frame-ancestors 'self' https://*.run.app https://*.aistudio.google.com https://duo21.com.br"
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);

    // 2. Cache-Control Policy (Section 1)
    const p = req.path;
    if (p.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (
      p.startsWith('/api/payments') ||
      p.startsWith('/api/payment') ||
      p.startsWith('/api/trips') ||
      p.startsWith('/api/trip') ||
      p.startsWith('/api/guide') ||
      p.startsWith('/api/access') ||
      p.startsWith('/api/recovery') ||
      p.startsWith('/api/webhooks') ||
      p.startsWith('/api/webhook') ||
      p.startsWith('/api/admin') ||
      p.startsWith('/api/db')
    ) {
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (p.startsWith('/api/health') || p.startsWith('/api/places')) {
      res.setHeader('Cache-Control', 'public, max-age=60');
    }

    // 3. CORS Policy
    if (origin) {
      if (isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, asaas-access-token, asaas-event-id, access_token, x-admin-key, x-requested-with, x-request-id');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else {
        // Disallow unauthorized origins on private APIs (never use wildcard '*' on private endpoints)
        if (req.path.startsWith('/api/') && !req.path.startsWith('/api/payments/webhook')) {
          res.status(403).json({ code: 'CORS_FORBIDDEN', error: 'Origem não autorizada para esta API privada.' });
          return;
        }
      }
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  });

  // -------------------------------------------------------------------------
  // 1. Health Endpoint (Safe operational summary, zero secrets)
  // -------------------------------------------------------------------------
  app.get('/api/health', async (req, res) => {
    const dbHealth = await supabaseServer.healthCheck();
    const placesHealth = await googlePlacesServer.healthCheck();
    const routesHealth = await googleRoutesServer.healthCheck();
    const weatherHealth = await weatherServer.healthCheck();
    const isGeminiAvailable = Boolean(env.GEMINI_API_KEY);

    res.json({
      app: 'ok',
      build_sha: process.env.APP_BUILD_SHA || process.env.SHORT_SHA || process.env.COMMIT_SHA || 'hotfix-8.3',
      app_build_sha: process.env.APP_BUILD_SHA || 'hotfix-8.3',
      version: '8.3.0',
      cloud_run_revision: process.env.K_REVISION || 'local-dev',
      cloud_run_service: process.env.K_SERVICE || 'duo21-roteiro',
      service: 'DUO21 Roteiro Serra Gaúcha Backend',
      canonical_domain: env.APP_PUBLIC_URL,
      public_origin: env.PUBLIC_APP_ORIGIN,
      api_base: `${env.APP_PUBLIC_URL}/api`,
      webhook_url: `${env.APP_PUBLIC_URL}/api/payments/webhook`,
      data_mode: env.DATA_MODE,
      database: dbHealth.status,
      database_details: dbHealth.details,
      ai: isGeminiAvailable ? 'connected' : 'configuration_required',
      places: placesHealth.status.toLowerCase(),
      places_details: placesHealth.details,
      routes: routesHealth.status.toLowerCase(),
      routes_details: routesHealth.details,
      weather: weatherHealth.status.toLowerCase(),
      weather_details: weatherHealth.details,
      environment: env.NODE_ENV,
      asaas: asaasServerProvider.isConfigured() ? 'connected' : 'configuration_required',
      asaas_env: asaasServerProvider.getEnvironment(),
      cloudflare_ready: true,
      timestamp: new Date().toISOString()
    });
  });

  // -------------------------------------------------------------------------
  // 2. Google Places Endpoints (Section 4 & 5 & 6 & 8)
  // -------------------------------------------------------------------------
  app.get('/api/places/health', async (req, res) => {
    const health = await googlePlacesServer.healthCheck();
    res.json(health);
  });

  app.post('/api/places/search', rateLimitService.middleware('autocomplete'), async (req, res) => {
    const { query, includedType, tripId, maxResults, fieldMask, skipCache } = req.body;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ code: 'INVALID_QUERY', error: 'Query de busca é obrigatória' });
      return;
    }

    try {
      const places = await googlePlacesServer.searchText(query, {
        includedType,
        tripId,
        maxResultCount: maxResults || 5,
        fieldMask,
        skipCache
      });
      res.json(places);
    } catch (err: any) {
      res.status(503).json({ code: 'PROVIDER_UNAVAILABLE', error: err.message });
    }
  });

  app.get('/api/places/autocomplete', rateLimitService.middleware('autocomplete'), async (req, res) => {
    const input = req.query.input as string;
    const city = (req.query.city as string) || 'Gramado';

    if (!input || input.trim().length < 3) {
      res.json([]);
      return;
    }

    try {
      const results = await googlePlacesServer.searchText(`${input} ${city}`, {
        maxResultCount: 4,
        fieldMask: 'places.id,places.displayName,places.formattedAddress'
      });

      const formatted = results.map(r => ({
        placeId: r.externalId,
        description: `${r.name}, ${r.address}`,
        mainText: r.name,
        secondaryText: r.address
      }));

      res.json(formatted);
    } catch {
      res.json([]);
    }
  });

  app.get('/api/places/:id', async (req, res) => {
    const tripId = req.query.tripId as string | undefined;
    try {
      const details = await googlePlacesServer.getPlaceDetails(req.params.id, { tripId });
      if (!details) {
        res.status(404).json({ code: 'PLACE_NOT_FOUND', error: 'Local não encontrado no Google Places' });
        return;
      }
      res.json(details);
    } catch (err: any) {
      res.status(503).json({ code: 'PROVIDER_UNAVAILABLE', error: err.message });
    }
  });

  // Admin Single Place Resolution (Section 38 & 39)
  app.post('/api/admin/places/:id/resolve', requireAdmin, async (req, res) => {
    try {
      const localPlace = await supabaseServer.getPlaceById(req.params.id);
      if (!localPlace) {
        res.status(404).json({ code: 'PLACE_NOT_FOUND', error: 'Local não encontrado no banco' });
        return;
      }

      const queryName = `${localPlace.name} ${localPlace.city}`;
      const searchResults = await googlePlacesServer.searchText(queryName, { maxResultCount: 3 });

      if (searchResults.length === 0) {
        res.status(404).json({ code: 'NOT_FOUND_IN_PLACES', error: 'Nenhum resultado correspondente no Google Places' });
        return;
      }

      const topMatch = searchResults[0];
      const updated = await supabaseServer.updatePlace(req.params.id, {
        google_place_id: topMatch.externalId,
        latitude: topMatch.latitude,
        longitude: topMatch.longitude,
        address: topMatch.address || localPlace.address,
        checked_at: new Date().toISOString().substring(0, 10),
        confidence: 'high'
      });

      res.json({
        success: true,
        resolvedPlace: topMatch,
        updatedLocalPlace: updated
      });
    } catch (err: any) {
      res.status(500).json({ code: 'RESOLUTION_ERROR', error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // 2B. Routes Endpoints (Section 3, 4, 5, 6, 7, 8)
  // -------------------------------------------------------------------------
  app.get('/api/routes/health', async (req, res) => {
    const health = await googleRoutesServer.healthCheck();
    res.json(health);
  });

  app.post('/api/routes/compute', async (req, res) => {
    const { origin, destination, travelMode, bufferPercent, tripId, skipCache } = req.body;
    if (!origin || !destination) {
      res.status(400).json({ code: 'INVALID_COORDINATES', error: 'Origem e destino são obrigatórios.' });
      return;
    }

    try {
      const segment = await googleRoutesServer.computeRoute(
        origin,
        destination,
        { travelMode, bufferPercent, tripId, skipCache }
      );
      res.json(segment);
    } catch (err: any) {
      res.status(503).json({ code: 'ROUTES_UNAVAILABLE', error: err.message });
    }
  });

  app.post('/api/routes/matrix', async (req, res) => {
    const { origins, destinations, travelMode, bufferPercent, tripId } = req.body;
    if (!Array.isArray(origins) || !Array.isArray(destinations)) {
      res.status(400).json({ code: 'INVALID_MATRIX', error: 'Matriz exige arrays de origens e destinos.' });
      return;
    }

    try {
      const matrix = await googleRoutesServer.computeMatrix(origins, destinations, {
        travelMode,
        bufferPercent,
        tripId
      });
      res.json(matrix);
    } catch (err: any) {
      res.status(503).json({ code: 'ROUTES_UNAVAILABLE', error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // 2C. Weather Endpoints (Section 21, 22, 23, 24)
  // -------------------------------------------------------------------------
  app.get('/api/weather/health', async (req, res) => {
    const health = await weatherServer.healthCheck();
    res.json(health);
  });

  app.get('/api/weather/forecast', async (req, res) => {
    const city = (req.query.city as any) || 'Gramado';
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const tripId = req.query.tripId as string | undefined;
    const skipCache = req.query.skipCache === 'true';

    try {
      const forecast = await weatherServer.getForecast(city, date, { tripId, skipCache });
      res.json(forecast);
    } catch (err: any) {
      res.status(503).json({ code: 'WEATHER_UNAVAILABLE', error: err.message });
    }
  });

  app.post('/api/weather/mock-rain', (req, res, next) => {
    if (env.NODE_ENV === 'production') {
      return requireAdmin(req, res, next);
    }
    next();
  }, async (req, res) => {
    const { date, isRain } = req.body;
    if (!date) {
      res.status(400).json({ error: 'Data é obrigatória (YYYY-MM-DD)' });
      return;
    }
    await weatherServer.setMockRainDate(date, isRain !== false);
    res.json({ success: true, date, mockRain: isRain !== false });
  });

  // -------------------------------------------------------------------------
  // 3. Trip Prompt Parsing (Server-Side Gemini API with safe fallback)
  // -------------------------------------------------------------------------
  app.post('/api/trip/parse', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt de texto é obrigatório.' });
      return;
    }

    const ai = getGeminiClient();

    if (ai) {
      try {
        const systemInstruction = `Você é o extrator de dados de viagem para a Serra Gaúcha (Gramado, Canela e Nova Petrópolis) do ecossistema DUO21.
Analise a mensagem do usuário e extraia estritamente um JSON com a estrutura:
{
  "preferences": {
    "name": string (se mencionado, senão ""),
    "start_date": "YYYY-MM-DD" (se mencionado, calcule data realista futura),
    "end_date": "YYYY-MM-DD" (se mencionado ou baseado em número de dias),
    "adults_count": number (mínimo 1),
    "children_count": number,
    "children_ages": number[],
    "hotel_name": string (se citado),
    "hotel_city": "Gramado" | "Canela" | "Nova Petrópolis",
    "budget_total": number (se citado, ex: 3000),
    "pace": "tranquilo" | "equilibrado" | "aproveitar_bastante",
    "transport": "carro_proprio" | "carro_alugado" | "transfer_uber" | "sem_carro",
    "interests": string[],
    "is_couple": boolean
  },
  "missingFields": string[] (indique se falta "name" ou "dates_confirmation")
}
Apenas retorne o JSON puro, sem crases de markdown.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.1
          }
        });

        const text = response.text?.trim() || '';
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        res.json({
          preferences: parsed.preferences,
          missingFields: parsed.missingFields || [],
          rawTranscript: prompt,
          confidenceScore: 0.95
        });
        return;
      } catch (err) {
        console.warn('Gemini parsing fallback:', err);
      }
    }

    res.json({
      useHeuristic: true,
      rawTranscript: prompt
    });
  });

  // -------------------------------------------------------------------------
  // 4. Trip Guide Assistant (Server-Side Contextual Conversation)
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // 4. Trip Guide Assistant (Server-Side Contextual Conversation)
  // -------------------------------------------------------------------------
  app.post(
    ['/api/trip/guide', '/api/guide/ask'],
    rateLimitService.middleware('guide', {
      keyExtractor: (req) =>
        (req.body?.tripId as string) ||
        (req.body?.context?.tripId as string) ||
        ((req.headers['cf-connecting-ip'] as string) || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'local')
    }),
    async (req, res) => {
      const { message, context } = req.body;
      if (!message) {
        res.status(400).json({ error: 'Mensagem é obrigatória.' });
        return;
      }

      const ai = getGeminiClient();

      if (ai) {
        try {
          const systemInstruction = `Você é o Guia Oficial da Serra Gaúcha (Gramado, Canela e Nova Petrópolis) para o app DUO21 / Divulga Lugares.
Regra de ouro: DADOS E REGRAS DECIDEM. A IA ORGANIZA, PERSONALIZA E CONVERSA.
Nunca invente preços, horários ou funcionamento.
Se não souber com certeza, oriente o turista a consultar o estabelecimento.
Responda de forma concisa, acolhedora, objetiva e prática (máximo 3 frases diretas para smartphone).
Contexto do viajante: ${JSON.stringify(context || {})}`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: message,
            config: {
              systemInstruction,
              temperature: 0.3
            }
          });

          res.json({
            replyText: response.text?.trim() || 'Ótima pergunta! A Serra Gaúcha oferece alternativas perfeitas para o seu momento.',
            confidenceLevel: 'high'
          });
          return;
        } catch (err) {
          console.warn('Gemini guide fallback:', err);
        }
      }

      res.json({
        replyText: 'Para aproveitar o melhor da Serra Gaúcha agora, confira a aba Roteiro ou Mapa com as opções mais próximas do seu hotel.',
        confidenceLevel: 'medium'
      });
    }
  );

  // Configurable Guide Limit per Trip (Sprint 8B - Requirement 3)
  app.post('/api/guide/limit', requireAdmin, (req, res) => {
    const { tripId, maxCalls } = req.body;
    if (!tripId || !maxCalls || typeof maxCalls !== 'number') {
      res.status(400).json({ error: 'tripId e maxCalls numérico são obrigatórios.' });
      return;
    }
    rateLimitService.setTripGuideLimit(tripId, maxCalls);
    res.json({ success: true, tripId, configured_limit: maxCalls });
  });

  // -------------------------------------------------------------------------
  // 5. Asaas Payment Checkout & Webhook (Sprint 7 & 8B Production Flow)
  // -------------------------------------------------------------------------
  app.get(['/api/payments/pricing', '/api/payment/pricing'], (req, res) => {
    res.json({
      tiers: PriceService.getPricingTiers(),
      defaultPrice: 19.90
    });
  });

  const handleCheckout = async (req: express.Request, res: express.Response) => {
    const {
      tripId,
      paymentMethod = 'pix',
      customerName,
      customerEmail,
      customerCpf,
      startDate,
      endDate,
      numberOfDays,
      preferences
    } = req.body;

    if (!customerEmail || !customerName) {
      res.status(400).json({ error: 'Nome e e-mail são obrigatórios para emissão da cobrança.' });
      return;
    }

    const targetTripId = tripId || `trip_${Date.now()}`;
    const existingTrip = tripsDatabase.get(targetTripId);
    const tripPrefs = preferences || existingTrip?.preferences || {
      name: customerName,
      email: customerEmail,
      start_date: startDate || new Date().toISOString().split('T')[0],
      end_date: endDate || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      adults_count: 2,
      children_count: 0,
      children_ages: [],
      pace: 'equilibrado' as const,
      transport: 'carro_alugado' as const,
      interests: ['Gastronomia', 'Natureza'],
      mandatory_places: [],
      restrictions: []
    };

    // Calculate authoritative price on backend using PriceService
    const priceCalculation = PriceService.calculatePriceFromDates(
      startDate || tripPrefs.start_date,
      endDate || tripPrefs.end_date,
      numberOfDays || tripPrefs.number_of_days
    );
    const authoritativePrice = priceCalculation.priceBrl;

    try {
      // Concurrency protection: SingleFlight coalesces simultaneous checkouts for same trip (Section 11)
      const order = await singleFlight.do(`checkout:${targetTripId}`, async () => {
        // Idempotency: Check if an active PENDING order already exists for this trip created within 24h
        for (const ord of orderDatabase.values()) {
          if (ord.trip_id === targetTripId && (ord.status === 'PENDING' || ord.status === 'pending')) {
            const ageMs = Date.now() - new Date(ord.created_at).getTime();
            if (ageMs < 24 * 3600 * 1000) {
              return {
                ...ord,
                idempotent_reused: true,
                price_calculation: priceCalculation
              };
            }
          }
        }

        // 1. Resolve or create customer in Asaas
        const customerId = await asaasServerProvider.createCustomer({
          name: customerName,
          email: customerEmail,
          cpfCnpj: customerCpf
        });

        // 2. Create payment in Asaas (Never retry blindly)
        const paymentOrder = await asaasServerProvider.createPayment({
          customerId,
          tripId: targetTripId,
          amountBrl: authoritativePrice,
          paymentMethod,
          customerName,
          customerEmail,
          customerCpf,
          description: `Roteiro Inteligente DUO21 | ${priceCalculation.days} dias | Serra Gaúcha`
        });

        // 3. Persist payment order in memory database & Supabase
        orderDatabase.set(paymentOrder.id, paymentOrder);
        try {
          await supabaseServer.savePaymentOrder(paymentOrder);
        } catch (dbErr) {
          console.warn('[Checkout] Warning persisting payment order to Supabase:', dbErr);
        }

        // Audit Log: PAYMENT_CREATED
        paymentEvents.push({
          id: `evt_created_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'PAYMENT_CREATED',
          payload: {
            orderId: paymentOrder.id,
            tripId: targetTripId,
            amountBrl: authoritativePrice,
            paymentMethod,
            asaasPaymentId: paymentOrder.asaas_payment_id,
            status: paymentOrder.status
          },
          created_at: new Date().toISOString()
        });

        // 4. Register preliminary trip state in preview mode (NOT yet unlocked!)
        if (!existingTrip) {
          tripsDatabase.set(targetTripId, {
            id: targetTripId,
            secure_token: TripAccessService.generateSecureToken(),
            status: 'preview',
            preferences: tripPrefs,
            price_brl: authoritativePrice,
            created_at: new Date().toISOString()
          });
        }

        return {
          ...paymentOrder,
          price_calculation: priceCalculation
        };
      });

      res.status(order.idempotent_reused ? 200 : 201).json(order);
    } catch (err: any) {
      console.error('[Payment Checkout] Error creating payment:', err);
      res.status(500).json({ code: 'PAYMENT_ERROR', error: err.message || 'Erro ao processar cobrança' });
    }
  };

  app.post(
    ['/api/payments/checkout', '/api/payment/checkout'],
    rateLimitService.middleware('checkout'),
    handleCheckout
  );

  // -------------------------------------------------------------------------
  // 6. Tourist Access & Trip Recovery (Sprint 8B - Recovery Protection)
  // -------------------------------------------------------------------------
  app.post(
    ['/api/trips/recovery', '/api/trip/recovery', '/api/db/trips/recovery'],
    rateLimitService.middleware('recovery'),
    async (req, res) => {
      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Parâmetro de busca obrigatório (e-mail ou token).' });
        return;
      }
      const clean = query.trim().toLowerCase();

      for (const trip of tripsDatabase.values()) {
        if (
          trip.secure_token?.toLowerCase() === clean ||
          trip.preferences?.email?.toLowerCase() === clean ||
          trip.preferences?.name?.toLowerCase() === clean
        ) {
          res.json({
            found: true,
            trip_id: trip.id,
            secure_token: trip.secure_token,
            status: trip.status,
            customer_name: trip.preferences?.name
          });
          return;
        }
      }

      try {
        const dbTrip = await supabaseServer.getTripByToken(clean);
        if (dbTrip) {
          res.json({
            found: true,
            trip_id: dbTrip.id,
            secure_token: dbTrip.secure_token,
            status: dbTrip.status,
            customer_name: dbTrip.preferences?.name
          });
          return;
        }
      } catch {
        // ignore
      }

      res.status(404).json({ found: false, error: 'Nenhum roteiro localizado com os dados informados.' });
    }
  );

  const webhookAuditState = {
    status: 'active',
    lastEvent: 'PAYMENT_RECEIVED',
    lastHttpStatus: 200,
    lastProcessedAt: new Date().toISOString(),
    lastResult: 'SUCCESS'
  };

  async function generateValidatedFinalTrip(prefs: any, targetTripId: string, existingTrip?: any): Promise<any> {
    let catalogPlaces: Place[] = [];
    try {
      const rawPlaces = await supabaseServer.getPlaces();
      if (rawPlaces && rawPlaces.length > 0) {
        catalogPlaces = rawPlaces.map(r => ({
          id: r.id,
          name: r.name,
          slug: r.slug || r.id,
          city: r.city,
          category: (r.category_id?.toLowerCase() === 'restaurant' ? 'restaurante' : (r.category_id?.toLowerCase() || 'parque')) as any,
          description: r.description_short || r.description || '',
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          address: r.address || `${r.city} - RS`,
          rating: Number(r.rating || 4.8),
          rating_count: Number(r.rating_count || 120),
          price_level: (r.cost_level || 2) as any,
          price_info: {
            adult_price: Number(r.cost_per_person || r.estimated_cost_min || 0),
            is_free: Number(r.cost_per_person || 0) === 0,
            currency: 'BRL',
            source_name: r.source_id || 'Curadoria DUO21',
            checked_at: r.checked_at || new Date().toISOString(),
            confidence: 'high' as const
          },
          average_duration_minutes: r.duration_min || 90,
          reservation_required: Boolean(r.reservation_required),
          accessible: Boolean(r.accessibility ?? true),
          pet_friendly: Boolean(r.pet_friendly),
          children_friendly: Boolean(r.suitable_for_children ?? true),
          indoor_type: (r.indoor_outdoor || 'outdoor') as any,
          opening_hours: r.opening_hours || { 'seg': '09:00 - 18:00' },
          media: [{ url: r.media_url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80', is_hero: true }],
          is_divulga_lugares_partner: Boolean(r.partner || r.divulga_lugares_recommended),
          active: Boolean(r.active ?? true),
          is_demo: Boolean(r.is_demo ?? true),
          created_at: r.created_at || new Date().toISOString(),
          updated_at: r.updated_at || new Date().toISOString()
        }));
      }
    } catch (err) {
      console.warn('[DUO21 Server] Could not fetch places from Supabase:', err);
    }

    if (catalogPlaces.length === 0) {
      if (env.NODE_ENV === 'production' && env.DATA_MODE === 'supabase') {
        console.error(`[DUO21 Security] Production Supabase catalog returned 0 places. Aborting generation for trip ${targetTripId} to prevent false itinerary.`);
        const unreadyTrip = {
          id: targetTripId,
          secure_token: existingTrip?.secure_token || TripAccessService.generateSecureToken(),
          status: 'generation_failed',
          preferences: prefs,
          days: [],
          created_at: new Date().toISOString(),
          error: 'DATABASE_CATALOG_UNAVAILABLE: O catálogo de produção do Supabase está vazio ou inacessível.'
        };
        tripsDatabase.set(targetTripId, unreadyTrip);
        throw new Error('DATABASE_CATALOG_UNAVAILABLE: Catálogo de produção do Supabase indisponível. Geração bloqueada para evitar dados falsos.');
      } else {
        catalogPlaces = SEED_PLACES;
      }
    }

    // Execution of FinalItineraryEngine AFTER valid payment confirmation
    const finalTrip = finalItineraryEngine.generateFinalItinerary(prefs, 'payment', DEFAULT_WEIGHTS, catalogPlaces);
    finalTrip.id = targetTripId;
    finalTrip.paid_at = new Date().toISOString();
    if (existingTrip?.secure_token) {
      finalTrip.secure_token = existingTrip.secure_token;
    } else if (!finalTrip.secure_token) {
      finalTrip.secure_token = TripAccessService.generateSecureToken();
    }

    // HOTFIX 8.3 Section 7: Mandatory Invariant before marking READY
    let expectedDays = 1;
    if (prefs.start_date && prefs.end_date) {
      const start = new Date(prefs.start_date);
      const end = new Date(prefs.end_date);
      const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      if (diffDays > 0) expectedDays = diffDays;
    }

    const generatedDays = finalTrip.days?.length || 0;
    const totalActivities = (finalTrip.days || []).reduce((acc: number, d: any) => acc + (d.activities?.length || 0), 0);
    const allRequiredDaysHaveActivities = generatedDays > 0 && finalTrip.days.every((d: any) => (d.activities?.length || 0) >= 1);
    const meetsExpectedDays = generatedDays >= expectedDays;

    if (meetsExpectedDays && totalActivities > 0 && allRequiredDaysHaveActivities) {
      finalTrip.status = 'ready';
    } else {
      console.error(`[DUO21 Security] Consistency check FAILED for trip ${targetTripId}: days=${generatedDays}/${expectedDays}, activities=${totalActivities}`);
      finalTrip.status = 'generation_failed' as any;
      throw new Error(`Inconsistent itinerary generation: ${generatedDays}/${expectedDays} days, ${totalActivities} activities. Status set to generation_failed.`);
    }

    tripsDatabase.set(targetTripId, finalTrip);

    try {
      await supabaseServer.saveTrip(finalTrip);
    } catch (err) {
      console.warn('[DUO21 Server] Supabase saveTrip failed (kept safely in active memory):', err);
    }

    return finalTrip;
  }

  const handleWebhook = async (req: express.Request, res: express.Response) => {
    const eventId = (req.headers['asaas-event-id'] as string) || req.body?.id || req.body?.payment?.id;

    if (eventId && processedWebhooks.has(eventId)) {
      webhookAuditState.lastHttpStatus = 200;
      webhookAuditState.lastResult = 'already_processed';
      res.json({ status: 'already_processed' });
      return;
    }

    const tokenHeader = (req.headers['asaas-access-token'] as string) || (req.headers['access_token'] as string);
    const webhookResult = asaasServerProvider.handleWebhook(req.body, tokenHeader);

    if (!webhookResult.valid) {
      webhookAuditState.lastHttpStatus = 401;
      webhookAuditState.lastResult = 'invalid_token';
      res.status(401).json({ error: webhookResult.error || 'Token de webhook inválido' });
      return;
    }

    webhookAuditState.lastEvent = req.body?.event || (webhookResult.isPaid ? 'PAYMENT_RECEIVED' : webhookResult.normalizedStatus);
    webhookAuditState.lastHttpStatus = 200;
    webhookAuditState.lastProcessedAt = new Date().toISOString();
    webhookAuditState.lastResult = webhookResult.isPaid ? 'PROCESSED_PAID' : webhookResult.normalizedStatus;

    if (webhookResult.isPaid) {
      if (eventId) processedWebhooks.add(eventId);

      // Locate associated order
      let targetOrder: any = null;
      for (const [id, ord] of orderDatabase.entries()) {
        if (
          ord.asaas_payment_id === webhookResult.paymentId ||
          ord.id === webhookResult.paymentId ||
          (webhookResult.tripId && ord.trip_id === webhookResult.tripId)
        ) {
          targetOrder = ord;
          break;
        }
      }

      if (targetOrder) {
        targetOrder.status = 'PAID';
        targetOrder.paid_at = new Date().toISOString();
        orderDatabase.set(targetOrder.id, targetOrder);
        try {
          await supabaseServer.savePaymentOrder(targetOrder);
        } catch {
          // ignore
        }
      }

      // Generate the official real itinerary via FinalItineraryEngine!
      const targetTripId = webhookResult.tripId || targetOrder?.trip_id;
      let unlockedTrip: any = null;

      // Audit Log: PAYMENT_CONFIRMED or PAYMENT_RECEIVED
      paymentEvents.push({
        id: `evt_wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: webhookResult.event === 'PAYMENT_CONFIRMED' ? 'PAYMENT_CONFIRMED' : 'PAYMENT_RECEIVED',
        payload: {
          eventId,
          event: webhookResult.event,
          paymentId: webhookResult.paymentId,
          tripId: targetTripId,
          status: 'PAID'
        },
        created_at: new Date().toISOString()
      });

      if (targetTripId) {
        unlockedTrip = await singleFlight.do(`generate:${targetTripId}`, async () => {
          const existingTrip = tripsDatabase.get(targetTripId);
          // If already generated and ready with activities, do NOT generate twice (Sprint 8B - Requirement 11)
          if (existingTrip && existingTrip.status === 'ready' && existingTrip.days?.length > 0) {
            const hasActivities = existingTrip.days.every((d: any) => (d.activities?.length || 0) > 0);
            if (hasActivities) {
              return existingTrip;
            }
          }

          const prefs = existingTrip?.preferences || targetOrder?.preferences || {
            name: targetOrder?.customer_name || 'Viajante',
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
            adults_count: 2,
            children_count: 0,
            children_ages: [],
            pace: 'equilibrado' as const,
            transport: 'carro_alugado' as const,
            interests: ['Gastronomia', 'Natureza'],
            mandatory_places: [],
            restrictions: []
          };

          const finalTrip = await generateValidatedFinalTrip(prefs, targetTripId, existingTrip);

          // Audit Log: ITINERARY_GENERATED
          paymentEvents.push({
            id: `evt_itin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'ITINERARY_GENERATED',
            payload: {
              tripId: targetTripId,
              daysCount: finalTrip.days?.length || 0,
              activitiesCount: (finalTrip.days || []).reduce((acc: number, d: any) => acc + (d.activities?.length || 0), 0),
              status: finalTrip.status,
              paidAt: finalTrip.paid_at
            },
            created_at: new Date().toISOString()
          });

          return finalTrip;
        });
      }

      res.json({
        received: true,
        status: 'PAID',
        tripReady: Boolean(unlockedTrip),
        tripId: targetTripId
      });
      return;
    }

    res.json({ received: true, status: webhookResult.normalizedStatus });
  };

  app.post('/api/payments/webhook', handleWebhook);
  app.post('/api/payment/webhook', handleWebhook);

  // Webhook Public Health & Verification Check (Sprint 8A & 8C)
  app.get(['/api/payments/webhook', '/api/payment/webhook'], (req, res) => {
    res.json({
      status: webhookAuditState.status,
      public: true,
      endpoint: '/api/payments/webhook',
      canonical_url: `${env.APP_PUBLIC_URL}/api/payments/webhook`,
      method_expected: 'POST',
      auth: 'asaas-access-token header',
      provider: 'asaas',
      environment: env.ASAAS_ENV,
      last_event: webhookAuditState.lastEvent,
      last_http_status: webhookAuditState.lastHttpStatus,
      last_processed_at: webhookAuditState.lastProcessedAt,
      last_result: webhookAuditState.lastResult,
      events_count: paymentEvents.length
    });
  });

  app.get(['/api/payments/events', '/api/payment/events'], (req, res) => {
    res.json(paymentEvents);
  });

  // Dev / Sandbox Instant Webhook Simulator (Protected: disabled in production, requires admin in dev)
  app.post(
    ['/api/payments/simulate-webhook', '/api/payment/simulate-webhook'],
    (req, res, next) => {
      if (env.NODE_ENV === 'production') {
        res.status(403).json({ error: 'Endpoint de simulação indisponível em produção.' });
        return;
      }
      requireAdmin(req, res, next);
    },
    async (req, res) => {
    const { orderId, tripId } = req.body;
    let order: any = null;

    if (orderId) {
      order = orderDatabase.get(orderId);
    }
    if (!order && tripId) {
      for (const ord of orderDatabase.values()) {
        if (ord.trip_id === tripId) {
          order = ord;
          break;
        }
      }
    }

    if (!order) {
      order = {
        id: orderId || `ord_${Date.now()}`,
        trip_id: tripId || `trip_${Date.now()}`,
        amount_brl: 19.90,
        payment_method: 'pix',
        status: 'PENDING',
        created_at: new Date().toISOString(),
        is_sandbox: true
      };
      orderDatabase.set(order.id, order);
    }

    order.status = 'PAID';
    order.paid_at = new Date().toISOString();
    orderDatabase.set(order.id, order);

    const targetTripId = order.trip_id;
    const existingTrip = tripsDatabase.get(targetTripId);
    const prefs = existingTrip?.preferences || {
      name: order.customer_name || 'Viajante',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      adults_count: 2,
      children_count: 0,
      children_ages: [],
      pace: 'equilibrado' as const,
      transport: 'carro_alugado' as const,
      interests: ['Gastronomia', 'Natureza'],
      mandatory_places: [],
      restrictions: []
    };

    const unlockedTrip = await generateValidatedFinalTrip(prefs, targetTripId, existingTrip);

    res.json({
      success: true,
      order,
      trip: unlockedTrip
    });
  });

  const handleStatusCheck = async (req: express.Request, res: express.Response) => {
    const orderId = req.query.orderId as string;
    const tripId = req.query.tripId as string;

    let order = orderId ? orderDatabase.get(orderId) : null;
    if (!order && tripId) {
      for (const ord of orderDatabase.values()) {
        if (ord.trip_id === tripId) {
          order = ord;
          break;
        }
      }
    }

    const targetTripId = tripId || order?.trip_id;
    let trip = targetTripId ? tripsDatabase.get(targetTripId) : null;

    // Active reconciliation: if order is still PENDING, verify status directly with Asaas
    if (order && order.status !== 'PAID' && order.asaas_payment_id) {
      try {
        const verified = await asaasServerProvider.verifyPaymentStatus(order.asaas_payment_id);
        if (verified.isPaid) {
          order.status = 'PAID';
          order.paid_at = new Date().toISOString();
          orderDatabase.set(order.id, order);
          try {
            await supabaseServer.savePaymentOrder(order);
          } catch {
            // ignore
          }

          paymentEvents.push({
            id: `evt_poll_paid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'PAYMENT_CONFIRMED',
            payload: { orderId: order.id, tripId: targetTripId, asaasPaymentId: order.asaas_payment_id },
            created_at: new Date().toISOString()
          });

          if (targetTripId && (!trip || trip.status !== 'ready' || !trip.days?.every((d: any) => (d.activities?.length || 0) > 0))) {
            const existingTrip = tripsDatabase.get(targetTripId);
            const prefs = existingTrip?.preferences || order.preferences || {
              name: order.customer_name || 'Viajante',
              start_date: new Date().toISOString().split('T')[0],
              end_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
              adults_count: 2,
              children_count: 0,
              children_ages: [],
              pace: 'equilibrado' as const,
              transport: 'carro_alugado' as const,
              interests: ['Gastronomia', 'Natureza'],
              mandatory_places: [],
              restrictions: []
            };

            const unlockedTrip = await generateValidatedFinalTrip(prefs, targetTripId, existingTrip);
            trip = unlockedTrip;

            paymentEvents.push({
              id: `evt_itin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              type: 'ITINERARY_GENERATED',
              payload: {
                tripId: targetTripId,
                daysCount: unlockedTrip.days?.length || 0,
                activitiesCount: (unlockedTrip.days || []).reduce((acc: number, d: any) => acc + (d.activities?.length || 0), 0),
                status: unlockedTrip.status
              },
              created_at: new Date().toISOString()
            });
          }
        }
      } catch (err) {
        console.warn('[Asaas] Status check polling error:', err);
      }
    }

    const isTripValidAndReady = Boolean(
      trip &&
      trip.status === 'ready' &&
      Array.isArray(trip.days) &&
      trip.days.length > 0 &&
      trip.days.every((d: any) => Array.isArray(d.activities) && d.activities.length > 0)
    );

    let effectiveTripStatus = 'preview';
    if (order?.status === 'PAID') {
      if (isTripValidAndReady) {
        effectiveTripStatus = 'ready';
      } else if (trip?.status === 'generation_failed') {
        effectiveTripStatus = 'generation_failed';
      } else {
        effectiveTripStatus = 'generating';
      }
    } else if (trip?.status) {
      effectiveTripStatus = trip.status;
    }

    if (order) {
      res.json({
        ...order,
        trip_status: effectiveTripStatus,
        secure_token: trip?.secure_token,
        trip: isTripValidAndReady ? trip : null
      });
    } else {
      res.json({
        status: 'PENDING',
        id: orderId || '',
        trip_status: isTripValidAndReady ? 'ready' : (trip?.status || 'preview'),
        trip: isTripValidAndReady ? trip : null
      });
    }
  };

  app.get('/api/payments/status', handleStatusCheck);
  app.get('/api/payment/status', handleStatusCheck);

  app.get('/api/payments/trip-status/:tripId', async (req, res) => {
    let trip = tripsDatabase.get(req.params.tripId);
    if (!trip) {
      for (const t of tripsDatabase.values()) {
        if (t.secure_token === req.params.tripId) {
          trip = t;
          break;
        }
      }
    }
    if (!trip) {
      res.status(404).json({ error: 'Viagem não encontrada' });
      return;
    }

    const hasActivities = Boolean(
      trip.days && 
      trip.days.length > 0 && 
      trip.days.every((d: any) => Array.isArray(d.activities) && d.activities.length > 0)
    );

    if (!hasActivities && (trip.status === 'ready' || trip.status === 'paid')) {
      try {
        const prefs = trip.preferences || {
          name: 'Viajante',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          adults_count: 2,
          children_count: 0,
          children_ages: [],
          pace: 'equilibrado' as const,
          transport: 'carro_alugado' as const,
          interests: ['Gastronomia', 'Natureza'],
          mandatory_places: [],
          restrictions: []
        };
        const healedTrip = await generateValidatedFinalTrip(prefs, trip.id, trip);
        trip = healedTrip;
      } catch (healErr) {
        console.error(`[DUO21 Healing] Failed to regenerate empty trip ${trip.id}:`, healErr);
      }
    }

    const isTripValidAndReady = Boolean(
      trip &&
      trip.status === 'ready' &&
      Array.isArray(trip.days) &&
      trip.days.length > 0 &&
      trip.days.every((d: any) => Array.isArray(d.activities) && d.activities.length > 0)
    );

    res.json({
      tripId: trip.id,
      status: isTripValidAndReady ? 'ready' : (trip.status === 'ready' ? 'generation_failed' : trip.status),
      isPaid: trip.status === 'ready' || trip.status === 'paid',
      secureToken: trip.secure_token,
      trip: isTripValidAndReady ? trip : null
    });
  });

  // -------------------------------------------------------------------------
  // 6. User Reports
  // -------------------------------------------------------------------------
  const userReports: any[] = [];
  app.post('/api/reports', (req, res) => {
    const report = {
      id: `rep_${Date.now()}`,
      ...req.body,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    userReports.push(report);
    res.json({ success: true, report });
  });

  app.get('/api/reports', (req, res) => {
    res.json(userReports);
  });

  app.put('/api/reports/:id/status', requireAdmin, (req, res) => {
    const report = userReports.find(r => r.id === req.params.id);
    if (!report) {
      res.status(404).json({ code: 'REPORT_NOT_FOUND', error: 'Relatório não encontrado' });
      return;
    }
    report.status = req.body.status;
    res.json(report);
  });

  // -------------------------------------------------------------------------
  // 7. Supabase Database Endpoints (Places, Hours, Prices, Cache, Candidates)
  // -------------------------------------------------------------------------
  app.get('/api/db/health', async (req, res) => {
    const health = await supabaseServer.healthCheck();
    if (health.status === 'error') {
      res.status(503).json(health);
      return;
    }
    res.json(health);
  });

  app.get('/api/db/places', async (req, res) => {
    try {
      const places = await supabaseServer.getPlaces();
      res.json(places);
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  app.get('/api/db/places/:id', async (req, res) => {
    try {
      const place = await supabaseServer.getPlaceById(req.params.id);
      if (!place) {
        res.status(404).json({ code: 'PLACE_NOT_FOUND', error: 'Local não encontrado' });
        return;
      }
      res.json(place);
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  app.post('/api/db/places', requireAdmin, async (req, res) => {
    try {
      const created = await supabaseServer.savePlace(req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ code: 'DATABASE_ERROR', error: err.message });
    }
  });

  app.put('/api/db/places/:id', requireAdmin, async (req, res) => {
    try {
      const updated = await supabaseServer.updatePlace(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(404).json({ code: 'PLACE_NOT_FOUND', error: err.message });
    }
  });

  app.delete('/api/db/places/:id', requireAdmin, async (req, res) => {
    try {
      const success = await supabaseServer.deactivatePlace(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ code: 'DATABASE_ERROR', error: err.message });
    }
  });

  // Hours
  app.get('/api/db/places/:id/hours', async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const hours = await supabaseServer.getHoursForPlace(req.params.id, date);
      res.json(hours);
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  app.post('/api/db/places/:id/hours', requireAdmin, async (req, res) => {
    try {
      const record = { ...req.body, place_id: req.params.id };
      const saved = await supabaseServer.upsertHours(record);
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(500).json({ code: 'DATABASE_ERROR', error: err.message });
    }
  });

  app.delete('/api/db/hours/:id', requireAdmin, async (req, res) => {
    try {
      const success = await supabaseServer.deleteHours(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ code: 'DATABASE_ERROR', error: err.message });
    }
  });

  // Price Observations
  app.get('/api/db/places/:id/prices', async (req, res) => {
    try {
      const season = req.query.season as string | undefined;
      const prices = await supabaseServer.getPricesForPlace(req.params.id, season);
      res.json(prices);
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  app.post('/api/db/prices', requireAdmin, async (req, res) => {
    try {
      const saved = await supabaseServer.savePrice(req.body);
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(500).json({ code: 'DATABASE_ERROR', error: err.message });
    }
  });

  app.put('/api/db/prices/:id', requireAdmin, async (req, res) => {
    try {
      const updated = await supabaseServer.updatePrice(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ code: 'DATABASE_ERROR', error: err.message });
    }
  });

  app.delete('/api/db/prices/:id', requireAdmin, async (req, res) => {
    try {
      const success = await supabaseServer.deletePrice(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ code: 'DATABASE_ERROR', error: err.message });
    }
  });

  // Candidate RPC
  app.post('/api/db/candidates', async (req, res) => {
    try {
      const candidates = await supabaseServer.getCandidatePlaces(req.body);
      res.json(candidates);
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  // External Data Cache
  app.get('/api/db/cache/:key', async (req, res) => {
    try {
      const cached = await supabaseServer.getCache(req.params.key);
      if (!cached) {
        res.status(404).json({ code: 'CACHE_MISS' });
        return;
      }
      res.json(cached);
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  app.post('/api/db/cache', async (req, res) => {
    try {
      const { key, provider, operation, payload, ttlSeconds } = req.body;
      await supabaseServer.setCache(key, provider, operation, payload, ttlSeconds);
      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  app.delete('/api/db/cache/:key', async (req, res) => {
    try {
      const success = await supabaseServer.deleteCache(req.params.key);
      res.json({ success });
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // 8. Trips Endpoints & Security
  // -------------------------------------------------------------------------
  app.post('/api/db/trips', async (req, res) => {
    try {
      const trip = req.body;

      const isProduction = env.NODE_ENV === 'production';
      const unlockCheck = TripAccessService.isUnlockAllowed(trip.unlock_source, isProduction);
      if (!unlockCheck.allowed) {
        res.status(403).json({
          code: 'FORBIDDEN',
          error: unlockCheck.reason
        });
        return;
      }

      if (!trip.secure_token) {
        trip.secure_token = TripAccessService.generateSecureToken();
      }

      const saved = await supabaseServer.saveTrip(trip);
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  app.get('/api/db/trips/token/:token', async (req, res) => {
    const token = req.params.token;
    if (!TripAccessService.isValidTokenFormat(token)) {
      res.status(400).json({ code: 'INVALID_TRIP_TOKEN', error: 'Formato de token de viagem inválido.' });
      return;
    }

    try {
      let trip = await supabaseServer.getTripByToken(token);
      if (!trip) {
        for (const t of tripsDatabase.values()) {
          if (t.secure_token === token) {
            trip = t;
            break;
          }
        }
      }
      if (!trip) {
        res.status(404).json({ code: 'TRIP_NOT_FOUND', error: 'Viagem não encontrada para o token informado.' });
        return;
      }

      const hasActivities = Boolean(
        trip.days && 
        trip.days.length > 0 && 
        trip.days.every((d: any) => Array.isArray(d.activities) && d.activities.length > 0)
      );

      if (!hasActivities && (trip.status === 'ready' || trip.status === 'paid')) {
        try {
          const prefs = trip.preferences || {
            name: 'Viajante',
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
            adults_count: 2,
            children_count: 0,
            children_ages: [],
            pace: 'equilibrado' as const,
            transport: 'carro_alugado' as const,
            interests: ['Gastronomia', 'Natureza'],
            mandatory_places: [],
            restrictions: []
          };
          const healed = await generateValidatedFinalTrip(prefs, trip.id, trip);
          trip = healed;
        } catch (healErr) {
          console.error(`[DUO21 Healing] Failed to regenerate empty trip ${trip.id}:`, healErr);
        }
      }

      res.json(trip);
    } catch (err: any) {
      for (const t of tripsDatabase.values()) {
        if (t.secure_token === token) {
          let tripToSend = t;
          const hasActivities = Boolean(
            tripToSend.days && 
            tripToSend.days.length > 0 && 
            tripToSend.days.every((d: any) => Array.isArray(d.activities) && d.activities.length > 0)
          );
          if (!hasActivities && (tripToSend.status === 'ready' || tripToSend.status === 'paid')) {
            try {
              const prefs = tripToSend.preferences || {
                name: 'Viajante',
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
                adults_count: 2,
                children_count: 0,
                children_ages: [],
                pace: 'equilibrado' as const,
                transport: 'carro_alugado' as const,
                interests: ['Gastronomia', 'Natureza'],
                mandatory_places: [],
                restrictions: []
              };
              const healed = await generateValidatedFinalTrip(prefs, tripToSend.id, tripToSend);
              tripToSend = healed;
            } catch {}
          }
          res.json(tripToSend);
          return;
        }
      }
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  app.get('/api/db/trips/:id', requireAdmin, async (req, res) => {
    try {
      const trip = await supabaseServer.getTripById(req.params.id);
      if (!trip) {
        res.status(404).json({ code: 'TRIP_NOT_FOUND', error: 'Viagem não encontrada.' });
        return;
      }
      res.json(trip);
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  app.get('/api/db/trips', requireAdmin, async (req, res) => {
    try {
      const trips = await supabaseServer.getTrips();
      res.json(trips);
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // 9. API Usage & Metrics (Section 8 & 37)
  // -------------------------------------------------------------------------
  app.post('/api/db/usage', async (req, res) => {
    try {
      await supabaseServer.logApiUsage(req.body);
      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  app.get('/api/db/usage/metrics', async (req, res) => {
    try {
      const metrics = await supabaseServer.getApiUsageMetrics();
      res.json(metrics);
    } catch (err: any) {
      res.status(503).json({ code: 'DATABASE_UNAVAILABLE', error: err.message });
    }
  });

  // Google Places Detailed Metrics (Section 37)
  app.get('/api/admin/places/metrics', requireAdmin, async (req, res) => {
    try {
      const metrics = await supabaseServer.getApiUsageMetrics();
      const placesData = metrics.byProvider?.GOOGLE_PLACES || { requests: 0, costBrl: 0 };
      
      res.json({
        provider: 'GOOGLE_PLACES',
        requestsToday: placesData.requests,
        requestsMonth: placesData.requests,
        estimatedCostTodayBrl: placesData.costBrl,
        estimatedCostMonthBrl: placesData.costBrl,
        cacheHits: 0,
        cacheMisses: placesData.requests,
        hitRate: '0%'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/metrics', requireAdmin, async (req, res) => {
    const quality = await supabaseServer.getQualityMetrics();
    const usage = await supabaseServer.getApiUsageMetrics();
    res.json({ quality, usage });
  });

  app.get('/api/admin/sources', requireAdmin, (req, res) => {
    res.json(supabaseServer.getSources());
  });

  // -------------------------------------------------------------------------
  // 10. Production Safe Error Handler (Zero stack trace exposure in prod)
  // -------------------------------------------------------------------------
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const isProd = env.NODE_ENV === 'production';
    console.error(`[Server Error] ${req.method} ${req.path}:`, sanitizeLog(err.message || err));
    
    // Never expose internal stack traces or database details to the client in production
    res.status(err.status || 500).json({
      code: err.code || 'INTERNAL_SERVER_ERROR',
      error: isProd ? 'Ocorreu um erro ao processar sua requisição.' : (err.message || 'Erro interno.'),
      request_id: res.getHeader('X-Request-Id')
    });
  });

  // -------------------------------------------------------------------------
  // 11. Vite Middleware & Production Static Serving (Immutable Asset Cache)
  // -------------------------------------------------------------------------
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isProduction = process.env.NODE_ENV === 'production' || hasDist;

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Versioned/hashed assets receive 1-year immutable caching (Sprint 8B - Requirement 1)
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true
    }));
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DUO21 Server] Running on http://0.0.0.0:${PORT} in ${(process.env.NODE_ENV || 'production').toUpperCase()} mode (DATA_MODE=${env.DATA_MODE.toUpperCase()})`);
  });
}

startServer().catch((err) => {
  console.error('[CRITICAL] Server failed to start:', err);
});
