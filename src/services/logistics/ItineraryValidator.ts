import { Trip, TripDay, TripActivity, Place } from '../../types';

export interface ValidationIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  code: string;
  dayNumber: number;
  activityId?: string;
  placeName?: string;
  message: string;
  suggestedFix?: string;
}

export interface ValidationReport {
  isValid: boolean;
  issues: ValidationIssue[];
  autoCorrected: boolean;
  summary: {
    totalActivities: number;
    hoursCheckedCount: number;
    travelFeasibilityScore: number; // 0 to 100
    weatherSuitabilityScore: number; // 0 to 100
  };
}

export class ItineraryValidator {
  /**
   * Validates an entire generated itinerary against real operational constraints (Sections 32, 33, 34).
   */
  validate(trip: Trip): ValidationReport {
    const issues: ValidationIssue[] = [];
    let hoursChecked = 0;
    let feasibleTransitions = 0;
    let totalTransitions = 0;
    let weatherChecks = 0;
    let weatherPassed = 0;

    for (const day of trip.days) {
      const dayDate = new Date(day.date);
      const dayOfWeekIndex = dayDate.getDay(); // 0 = Sun, 1 = Mon ...
      const dayOfWeekKey = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][dayOfWeekIndex];

      let prevEndTimeMinutes = -1;

      for (let i = 0; i < day.activities.length; i++) {
        const act = day.activities[i];
        const place = act.place;

        // 1. Existence and Active status
        if (!place || !place.id) {
          issues.push({
            severity: 'ERROR',
            code: 'INVALID_PLACE',
            dayNumber: day.day_number,
            activityId: act.id,
            message: 'Atividade sem local válido associado.'
          });
          continue;
        }

        if (place.active === false) {
          issues.push({
            severity: 'ERROR',
            code: 'INACTIVE_PLACE',
            dayNumber: day.day_number,
            activityId: act.id,
            placeName: place.name,
            message: `O local "${place.name}" está inativo no catálogo.`
          });
        }

        // 2. Opening hours check
        hoursChecked++;
        const hoursForDay = place.opening_hours?.[dayOfWeekKey];
        if (hoursForDay && hoursForDay.toLowerCase().includes('fechado')) {
          issues.push({
            severity: 'ERROR',
            code: 'PLACE_CLOSED_ON_DAY',
            dayNumber: day.day_number,
            activityId: act.id,
            placeName: place.name,
            message: `"${place.name}" está fechado em ${dayOfWeekKey.toUpperCase()} (${hoursForDay}).`,
            suggestedFix: 'Mover atividade para outro dia ou substituir por atração aberta.'
          });
        }

        // 3. Time feasibility & Inter-activity transition check (Section 34)
        const actStartMinutes = this.timeToMinutes(act.time);
        const duration = act.duration_minutes || place.average_duration_minutes || 60;
        const actEndMinutes = actStartMinutes + duration;

        if (prevEndTimeMinutes > 0) {
          totalTransitions++;
          const travelMinutes = act.travel_time_from_prev_minutes || 10;
          const travelBuffer = act.travel_buffer_minutes || Math.round(travelMinutes * 0.20);
          const requiredStart = prevEndTimeMinutes + travelMinutes + travelBuffer;

          if (actStartMinutes < prevEndTimeMinutes) {
            issues.push({
              severity: 'ERROR',
              code: 'OVERLAPPING_ACTIVITIES',
              dayNumber: day.day_number,
              activityId: act.id,
              placeName: place.name,
              message: `Conflito de horário: "${place.name}" inicia às ${act.time}, antes do término da atividade anterior.`,
              suggestedFix: `Ajustar início para ${this.minutesToTime(requiredStart)}.`
            });
          } else if (actStartMinutes < requiredStart) {
            issues.push({
              severity: 'WARNING',
              code: 'TIGHT_TRANSIT_BUFFER',
              dayNumber: day.day_number,
              activityId: act.id,
              placeName: place.name,
              message: `Margem de trânsito apertada entre atividades (${actStartMinutes - prevEndTimeMinutes} min disponíveis, recomendado ${travelMinutes + travelBuffer} min).`,
              suggestedFix: `Adicionar margem logística de 10 min.`
            });
          } else {
            feasibleTransitions++;
          }
        }

        prevEndTimeMinutes = actEndMinutes;

        // 4. Children suitability check (Section 36)
        if (trip.preferences.children_count > 0) {
          const suitable = place.suitable_for || [];
          const tags = place.tags || [];
          const isAdultOnly = tags.includes('adultos') || tags.includes('balada') || suitable.includes('apenas_adultos');
          if (isAdultOnly) {
            issues.push({
              severity: 'WARNING',
              code: 'CHILDREN_UNSUITABLE',
              dayNumber: day.day_number,
              activityId: act.id,
              placeName: place.name,
              message: `"${place.name}" pode não ser adequado para crianças pequenas.`,
              suggestedFix: 'Substituir por parque temático ou chocolateria interativa.'
            });
          }
        }

        // 5. Weather check
        weatherChecks++;
        const forecast = day.weather_forecast;
        const condition = typeof forecast === 'object' && 'condition' in forecast ? forecast.condition : undefined;
        if (condition === 'HEAVY_RAIN' || condition === 'STORM') {
          if (place.indoor_type === 'outdoor' && !act.is_anchor_event) {
            issues.push({
              severity: 'WARNING',
              code: 'WEATHER_OUTDOOR_RAIN',
              dayNumber: day.day_number,
              activityId: act.id,
              placeName: place.name,
              message: `Atividade ao ar livre agendada em dia com previsão de ${condition}.`,
              suggestedFix: 'Acionar WeatherReplanService para atração coberta.'
            });
          } else {
            weatherPassed++;
          }
        } else {
          weatherPassed++;
        }
      }
    }

    const errorCount = issues.filter(i => i.severity === 'ERROR').length;
    const travelScore = totalTransitions > 0 ? Math.round((feasibleTransitions / totalTransitions) * 100) : 100;
    const weatherScore = weatherChecks > 0 ? Math.round((weatherPassed / weatherChecks) * 100) : 100;

    return {
      isValid: errorCount === 0,
      issues,
      autoCorrected: false,
      summary: {
        totalActivities: trip.days.reduce((acc, d) => acc + d.activities.length, 0),
        hoursCheckedCount: hoursChecked,
        travelFeasibilityScore: travelScore,
        weatherSuitabilityScore: weatherScore
      }
    };
  }

  /**
   * Deterministically auto-corrects timeline overlaps in an itinerary (Section 41).
   */
  autoCorrectTimeline(trip: Trip): Trip {
    const updatedDays: TripDay[] = trip.days.map(day => {
      let currentMinute = 540; // 09:00 AM in minutes from midnight

      const correctedActivities: TripActivity[] = day.activities.map((act, index) => {
        const place = act.place;
        const duration = act.duration_minutes || place.average_duration_minutes || 60;
        const travel = act.travel_time_from_prev_minutes || 10;
        const buffer = act.travel_buffer_minutes || Math.round(travel * 0.20);

        if (index > 0) {
          currentMinute += (travel + buffer);
        }

        // Align meals to reasonable meal windows
        if (place.category === 'restaurante') {
          if (currentMinute < 690) currentMinute = 720; // At least 12:00 for lunch
          if (currentMinute > 870 && currentMinute < 1140) currentMinute = 1170; // 19:30 for dinner
        }

        const formattedTime = this.minutesToTime(currentMinute);
        currentMinute += duration;

        return {
          ...act,
          time: formattedTime
        };
      });

      return {
        ...day,
        activities: correctedActivities
      };
    });

    return {
      ...trip,
      days: updatedDays
    };
  }

  private timeToMinutes(timeStr: string): number {
    if (!timeStr || !timeStr.includes(':')) return 540;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 9) * 60 + (m || 0);
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}

export const itineraryValidator = new ItineraryValidator();
