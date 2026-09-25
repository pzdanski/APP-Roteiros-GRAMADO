import { MediaItem, MediaType } from '../../types';

export interface MediaProvider {
  name: string;
  resolvePlaceImage(placeId: string, fallbackUrl?: string): string;
  getMediaItems(placeId: string): MediaItem[];
}

const FALLBACK_SERRA_IMAGE = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';

export class DuoMediaProvider implements MediaProvider {
  name = 'DUO21 Media Repository';

  private mediaPriority: Record<MediaType, number> = {
    own: 1,
    partner: 2,
    official: 3,
    google: 4,
    external: 5,
    demo: 6
  };

  resolvePlaceImage(placeId: string, fallbackUrl?: string): string {
    if (fallbackUrl && fallbackUrl.startsWith('http')) {
      return fallbackUrl;
    }
    return FALLBACK_SERRA_IMAGE;
  }

  getMediaItems(placeId: string): MediaItem[] {
    return [
      {
        id: `med_${placeId}_1`,
        placeId,
        source: 'own',
        url: FALLBACK_SERRA_IMAGE,
        caption: 'Acervo DUO21 / Divulga Lugares',
        attribution: 'Equipe Editorial Divulga Lugares',
        type: 'image',
        active: true,
        isDemo: true
      }
    ];
  }
}

export const mediaProvider: MediaProvider = new DuoMediaProvider();
