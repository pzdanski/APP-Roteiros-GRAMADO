import { TripPreferences } from '../../types';

export interface ParseTripPromptResult {
  preferences: Partial<TripPreferences>;
  missingFields: string[];
  rawTranscript: string;
  confidenceScore: number;
}

export interface GuideAnswerResult {
  replyText: string;
  suggestedAction?: 'swap_activity' | 'view_nearby' | 'adjust_budget' | 'indoor_alternative';
  recommendedPlaceIds?: string[];
  links?: Array<{ label: string; url: string; type?: string }>;
  places?: any[];
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface AIProvider {
  name: string;
  isAvailable(): boolean;
  parseTripInput(rawText: string): Promise<ParseTripPromptResult>;
  askTripGuide(userMessage: string, tripContext: Record<string, unknown>): Promise<GuideAnswerResult>;
}
