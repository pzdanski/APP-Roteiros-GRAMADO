import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { supabaseServer, populateInitialCatalogIfEmpty } from './src/server/supabaseServer';
import { SEED_PLACES } from './src/data/seedData';

dotenv.config();

// Seed catalog into local store on startup
populateInitialCatalogIfEmpty(SEED_PLACES);

const PORT = 3000;

// Lazy initialized Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (err) {
      console.warn('Gemini SDK initialization error:', err);
    }
  }
  return geminiClient;
}

// In-memory persistent store for development & mock fallback
const tripDatabase = new Map<string, any>();
const orderDatabase = new Map<string, any>();
const processedWebhooks = new Set<string>();

async function startServer() {
  const app = express();
  app.use(express.json());

  // -------------------------------------------------------------------------
  // 1. Health Endpoint
  // -------------------------------------------------------------------------
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'DUO21 Roteiro Serra Gaúcha Backend',
      gemini_configured: !!process.env.GEMINI_API_KEY,
      supabase_configured: !!process.env.SUPABASE_URL,
      asaas_configured: !!process.env.ASAAS_API_KEY,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  });

  // -------------------------------------------------------------------------
  // 2. Trip Prompt Parsing (Server-Side Gemini API with safe fallback)
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

    // Heuristic fallback if Gemini API key not present or failed
    res.json({
      useHeuristic: true,
      rawTranscript: prompt
    });
  });

  // -------------------------------------------------------------------------
  // 3. Trip Guide Assistant (Server-Side Contextual Conversation)
  // -------------------------------------------------------------------------
  app.post('/api/trip/guide', async (req, res) => {
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

    // Fallback response
    res.json({
      replyText: 'Para aproveitar o melhor da Serra Gaúcha agora, confira a aba Roteiro ou Mapa com as opções mais próximas do seu hotel.',
      confidenceLevel: 'medium'
    });
  });

  // -------------------------------------------------------------------------
  // 4. Asaas Payment Checkout & Webhook
  // -------------------------------------------------------------------------
  app.post('/api/payment/checkout', async (req, res) => {
    const { tripId, amountBrl, paymentMethod, customerName, customerEmail } = req.body;

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const isSandbox = !process.env.ASAAS_API_KEY;

    const newOrder = {
      id: orderId,
      trip_id: tripId,
      amount_brl: amountBrl || 19.90,
      payment_method: paymentMethod || 'pix',
      status: 'pending',
      customer_name: customerName,
      customer_email: customerEmail,
      pix_qr_code: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=00020126580014BR.GOV.BCB.PIX0136duo21-serra-gaucha-roteiro-licenca5204000053039865802BR5913DUO21%20TURISMO6007GRAMADO62070503***6304ABCD',
      pix_copy_paste: '00020126580014BR.GOV.BCB.PIX0136duo21-serra-gaucha-roteiro-licenca5204000053039865802BR5913DUO21 TURISMO6007GRAMADO62070503***6304ABCD',
      is_sandbox: isSandbox,
      created_at: new Date().toISOString()
    };

    orderDatabase.set(orderId, newOrder);
    res.json(newOrder);
  });

  // Idempotent Asaas Webhook
  app.post('/api/payment/webhook', (req, res) => {
    const eventId = req.headers['asaas-event-id'] || req.body?.id || req.body?.payment?.id;

    if (eventId && processedWebhooks.has(eventId)) {
      // Idempotent return: already handled
      res.json({ status: 'already_processed' });
      return;
    }

    const eventType = req.body?.event; // e.g. PAYMENT_RECEIVED, PAYMENT_CONFIRMED
    const paymentId = req.body?.payment?.id;

    if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') {
      if (eventId) processedWebhooks.add(eventId);

      // Mark matching order as paid
      for (const [id, order] of orderDatabase.entries()) {
        if (order.asaas_payment_id === paymentId || !order.asaas_payment_id) {
          order.status = 'paid';
          order.paid_at = new Date().toISOString();
          orderDatabase.set(id, order);
          break;
        }
      }
    }

    res.json({ received: true });
  });

  app.get('/api/payment/status', (req, res) => {
    const orderId = req.query.orderId as string;
    const order = orderDatabase.get(orderId);
    if (order) {
      res.json(order);
    } else {
      res.json({ status: 'pending', id: orderId });
    }
  });

  // -------------------------------------------------------------------------
  // 5. User Reports
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

  // -------------------------------------------------------------------------
  // 6. Supabase Database Endpoints (Places, Trips, Usage, Sources, Quality)
  // -------------------------------------------------------------------------
  app.get('/api/db/health', async (req, res) => {
    const health = await supabaseServer.healthCheck();
    res.json(health);
  });

  app.get('/api/db/places', async (req, res) => {
    const places = await supabaseServer.getPlaces();
    res.json(places);
  });

  app.get('/api/db/places/:id', async (req, res) => {
    const place = await supabaseServer.getPlaceById(req.params.id);
    if (!place) {
      res.status(404).json({ error: 'Local não encontrado' });
      return;
    }
    res.json(place);
  });

  app.post('/api/db/places', async (req, res) => {
    const created = await supabaseServer.savePlace(req.body);
    res.status(201).json(created);
  });

  app.put('/api/db/places/:id', async (req, res) => {
    try {
      const updated = await supabaseServer.updatePlace(req.params.id, req.body);
      res.json(updated);
    } catch {
      res.status(404).json({ error: 'Local não encontrado para atualização' });
    }
  });

  app.delete('/api/db/places/:id', async (req, res) => {
    const success = await supabaseServer.deactivatePlace(req.params.id);
    res.json({ success });
  });

  app.post('/api/db/trips', async (req, res) => {
    const saved = await supabaseServer.saveTrip(req.body);
    res.status(201).json(saved);
  });

  app.get('/api/db/trips/token/:token', async (req, res) => {
    const trip = await supabaseServer.getTripByToken(req.params.token);
    if (!trip) {
      res.status(404).json({ error: 'Viagem não encontrada para o token informado' });
      return;
    }
    res.json(trip);
  });

  app.get('/api/db/trips/:id', async (req, res) => {
    const trip = await supabaseServer.getTripById(req.params.id);
    if (!trip) {
      res.status(404).json({ error: 'Viagem não encontrada' });
      return;
    }
    res.json(trip);
  });

  app.get('/api/db/trips', async (req, res) => {
    const trips = await supabaseServer.getTrips();
    res.json(trips);
  });

  app.post('/api/db/usage', async (req, res) => {
    await supabaseServer.logApiUsage(req.body);
    res.status(201).json({ success: true });
  });

  app.get('/api/db/usage/metrics', async (req, res) => {
    const metrics = await supabaseServer.getApiUsageMetrics();
    res.json(metrics);
  });

  app.get('/api/db/sources', (req, res) => {
    res.json(supabaseServer.getSources());
  });

  app.get('/api/db/quality', (req, res) => {
    res.json(supabaseServer.getQualityMetrics());
  });

  // -------------------------------------------------------------------------
  // 7. Vite Middleware & Production Static Serving
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
