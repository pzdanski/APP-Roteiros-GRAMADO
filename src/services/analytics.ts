export type AnalyticsEvent = 
  | 'app_init'
  | 'landing_view'
  | 'start_trip'
  | 'audio_started'
  | 'audio_completed'
  | 'trip_parsed'
  | 'trip_confirmed'
  | 'generation_started'
  | 'preview_viewed'
  | 'open_checkout'
  | 'checkout_started'
  | 'payment_completed'
  | 'trip_opened'
  | 'place_opened'
  | 'route_changed'
  | 'swap_activity'
  | 'report_submitted'
  | 'guide_message'
  | 'nearby_used'
  | 'dev_unlock';

export function trackEvent(eventName: AnalyticsEvent, properties?: Record<string, unknown>): void {
  try {
    if (typeof window !== 'undefined') {
      // Dispatch to GA4 if window.gtag exists
      const w = window as unknown as { gtag?: (...args: unknown[]) => void; clarity?: (...args: unknown[]) => void };
      if (typeof w.gtag === 'function') {
        w.gtag('event', eventName, properties);
      }
      // Dispatch to Microsoft Clarity if window.clarity exists
      if (typeof w.clarity === 'function') {
        w.clarity('event', eventName);
      }
    }
  } catch {
    // Non-blocking
  }
}
