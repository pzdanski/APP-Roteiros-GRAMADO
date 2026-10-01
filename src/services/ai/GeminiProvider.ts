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

    // Contextual local responses with authentic Serra Gaúcha personality (Sprint 9.1 Sections 7, 8, 9, 10)
    const { generateSmartGuideResponse } = await import('./GuideContextService');
    const localResult = generateSmartGuideResponse(userMessage, tripContext);
    return {
      replyText: localResult.replyText,
      links: localResult.links,
      suggestedAction: localResult.suggestedAction || undefined,
      confidenceLevel: localResult.confidenceLevel
    };
  }
}

export const aiProvider: AIProvider = new GeminiProvider();
