import { AIProvider, ParseTripPromptResult, GuideAnswerResult } from './AIProvider';
import { heuristicParseTripInput } from './heuristicParser';

export class GeminiProvider implements AIProvider {
  name = 'GeminiProvider';

  isAvailable(): boolean {
    return true;
  }

  async parseTripInput(rawText: string): Promise<ParseTripPromptResult> {
    try {
      const response = await fetch('/api/trip/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: rawText })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.preferences) {
          return data as ParseTripPromptResult;
        }
      }
    } catch {
      // Fallback seamlessly to local heuristic parser
    }

    return heuristicParseTripInput(rawText);
  }

  async askTripGuide(userMessage: string, tripContext: Record<string, unknown>): Promise<GuideAnswerResult> {
    try {
      const response = await fetch('/api/trip/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, context: tripContext })
      });

      if (response.ok) {
        const data = await response.json();
        return data as GuideAnswerResult;
      }
    } catch {
      // Fallback
    }

    // Contextual local responses with authentic Serra Gaúcha personality (Sections 9.12, 9.13, 9.14)
    const lower = userMessage.toLowerCase();
    const { SEED_PLACES } = await import('../../data/seedData');
    const matched = SEED_PLACES.filter(p => lower.includes(p.name.toLowerCase()) || lower.includes(p.slug));
    const targetPlaces = matched.length > 0 ? matched : SEED_PLACES.slice(0, 3);

    // 9.13 Guia responde horários com dados do app
    if (lower.includes('horário') || lower.includes('horario') || lower.includes('abre') || lower.includes('fecha')) {
      const hoursList = targetPlaces.map(p => {
        if (p.always_open) return `${p.name}: Sempre aberto`;
        const seg = p.opening_hours?.seg || Object.values(p.opening_hours || {})[0];
        return seg ? `${p.name}: ${seg}` : `${p.name}: Horário não confirmado`;
      }).join('\n• ');

      return {
        replyText: `Tchê, conferi aqui os horários cadastrados para ti:\n• ${hoursList}`,
        confidenceLevel: 'high'
      };
    }

    // 9.14 Guia com links estruturados
    if (lower.includes('site') || lower.includes('instagram') || lower.includes('link') || lower.includes('vídeo') || lower.includes('video')) {
      const links: Array<{ label: string; url: string; type: string }> = [];
      targetPlaces.forEach(p => {
        if (p.website) links.push({ label: `Site - ${p.name}`, url: p.website, type: 'official' });
        if (p.instagram) links.push({ label: `Instagram - ${p.name}`, url: p.instagram, type: 'instagram' });
        if (p.divulga_lugares_tip?.video_url) links.push({ label: `Vídeo - ${p.name}`, url: p.divulga_lugares_tip.video_url, type: 'video' });
      });

      return {
        replyText: links.length > 0 
          ? 'Bah, separei os links oficiais cadastrados para ti logo abaixo:' 
          : 'Tchê, não temos links oficiais verificados cadastrados para este local no momento.',
        links: links.slice(0, 4),
        confidenceLevel: 'high'
      };
    }

    if (lower.includes('chuva') || lower.includes('chovendo')) {
      return {
        replyText: 'Bah, para dias chuvosos ou de garoa na Serra, recomendo focar em atrações 100% cobertas como o Snowland (climatizado), museus do Centro ou um aconchegante Café Colonial em Gramado.',
        suggestedAction: 'indoor_alternative',
        confidenceLevel: 'high'
      };
    }

    if (lower.includes('fondue') || lower.includes('jantar')) {
      return {
        replyText: 'Tchê, a tradicional sequência de fondue (queijo, carnes na pedra e chocolate) é indispensável à noite na Serra. No centro de Gramado e Canela há excelentes opções a partir de R$ 89 por pessoa.',
        suggestedAction: 'swap_activity',
        confidenceLevel: 'high'
      };
    }

    return {
      replyText: 'Bah, qualquer dúvida sobre o teu roteiro pela Serra, só me chamar que organizo pra ti!',
      confidenceLevel: 'medium'
    };
  }
}

export const aiProvider: AIProvider = new GeminiProvider();
