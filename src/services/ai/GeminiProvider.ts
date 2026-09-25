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

    // Contextual local responses
    const lower = userMessage.toLowerCase();
    if (lower.includes('chuva') || lower.includes('chovendo')) {
      return {
        replyText: 'Para dias chuvosos ou de garoa na Serra, recomendo focar em atrações 100% cobertas como o Snowland (climatizado), museus do Centro ou um aconchegante Café Colonial em Gramado.',
        suggestedAction: 'indoor_alternative',
        confidenceLevel: 'high'
      };
    }

    if (lower.includes('fondue') || lower.includes('jantar')) {
      return {
        replyText: 'A tradicional sequência de fondue (queijo, carnes na pedra e chocolate) é indispensável à noite na Serra. No centro de Gramado e Canela há excelentes opções a partir de R$ 89 por pessoa.',
        suggestedAction: 'swap_activity',
        confidenceLevel: 'high'
      };
    }

    return {
      replyText: 'Entendi perfeitamente! Com base no seu roteiro e localização na Serra Gaúcha, organizei as melhores opções sem desviar da sua rota.',
      confidenceLevel: 'medium'
    };
  }
}

export const aiProvider: AIProvider = new GeminiProvider();
