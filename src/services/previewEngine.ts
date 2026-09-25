import { 
  TripPreferences, 
  TripPreview, 
  PreviewDay, 
  PreviewActivity, 
  City, 
  PreviewSlotType 
} from '../types';
import { calculateTripPrice, SEED_PLACES } from '../data/seedData';

class PreviewEngine {
  /**
   * Generates a lightweight, secure TripPreview.
   * STRICT SECURITY RULE:
   * Locked items do NOT contain real place names or secret IDs in the payload.
   * Only the teaser item (Day 1 activity 1) is revealed.
   */
  generatePreview(preferences: TripPreferences): TripPreview {
    const totalDays = this.calculateDays(preferences);
    const primaryCity: City = preferences.hotel_city || preferences.accommodation?.city || 'Gramado';
    const hasHotel = 
      preferences.accommodation_status === 'booked' || 
      (!!preferences.hotel_name && preferences.accommodation_status !== 'not_booked' && preferences.accommodation_status !== 'undecided');

    const days: PreviewDay[] = [];

    // Find teaser place for Day 1 teaser (Lago Negro or similar landmark in primaryCity)
    const teaserCandidate = SEED_PLACES.find(p => p.slug === 'lago-negro') || SEED_PLACES[0];

    const isFamily = preferences.children_count > 0;
    const wantsFondue = preferences.must_have?.some(m => m.toLowerCase().includes('fondue')) || 
                        preferences.interests.some(i => i.toLowerCase().includes('gastronomia'));
    const isRelaxed = preferences.pace === 'tranquilo';
    const isIntense = preferences.pace === 'aproveitar_bastante';

    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dateStr = this.calculateDateForDay(preferences.start_date, dayNum - 1);
      
      // City alternation logic
      let dayCity: City = primaryCity;
      if (dayNum === 2) {
        dayCity = primaryCity === 'Gramado' ? 'Canela' : 'Gramado';
      } else if (dayNum === 3 && totalDays >= 4) {
        dayCity = preferences.interests.includes('Natureza') ? 'Canela' : 'Gramado';
      } else if (dayNum === 4 && totalDays >= 5) {
        dayCity = 'Nova Petrópolis';
      }

      const dayTheme = this.getDayTheme(dayNum, dayCity, preferences);
      const activities: PreviewActivity[] = [];

      // Slot 1: Manhã (09:00 or 09:30)
      if (dayNum === 1) {
        // Day 1 Morning is REVEALED to demonstrate itinerary quality
        activities.push({
          id: `prev-d1-a1`,
          time: '09:00',
          slot_type: 'morning',
          category_label: 'Atração Âncora da Serra',
          city: dayCity,
          locked: false,
          teaser_title: `${teaserCandidate.name} — Manhã em Gramado`,
          teaser_description: teaserCandidate.description,
          estimated_cost_range: 'Grátis (pedalinho opcional)',
          indoor_outdoor_tag: 'ao_ar_livre',
          revealed_place: {
            id: teaserCandidate.id,
            name: teaserCandidate.name,
            category: teaserCandidate.category,
            description: teaserCandidate.description,
            image_url: teaserCandidate.media?.[0]?.url || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
            rating: teaserCandidate.rating || 4.8,
            city: teaserCandidate.city,
            indoor_type: teaserCandidate.indoor_type,
            price_level: teaserCandidate.price_level,
            duration_minutes: teaserCandidate.average_duration_minutes || 90
          }
        });
      } else {
        activities.push({
          id: `prev-d${dayNum}-a1`,
          time: '09:30',
          slot_type: 'morning',
          category_label: dayCity === 'Canela' ? 'Passeio em Canela' : 'Atração Selecionada',
          city: dayCity,
          locked: true,
          teaser_title: isFamily ? '🌲 Parque Temático & Interativo' : '🌲 Passeio na Natureza e Mirantes',
          teaser_description: 'Atração selecionada estrategicamente no horário de menor movimento e fila rápida.',
          estimated_cost_range: 'Ingresso incluso ou compra antecipada',
          indoor_outdoor_tag: 'ao_ar_livre'
        });
      }

      // Slot 2: Almoço (12:00 / 12:30)
      const lunchBudget = preferences.budget_food_per_person 
        ? `até R$ ${preferences.budget_food_per_person}/pessoa` 
        : 'R$ 65 - R$ 90/pessoa';

      activities.push({
        id: `prev-d${dayNum}-a2`,
        time: '12:30',
        slot_type: 'lunch',
        category_label: 'Gastronomia Regional',
        city: dayCity,
        locked: true,
        teaser_title: `🍴 Restaurante selecionado para seu perfil (${dayCity})`,
        teaser_description: `Almoço típico da Serra alinhado ao seu teto de gastos (${lunchBudget}), próximo à atração da manhã para evitar trânsito.`,
        estimated_cost_range: lunchBudget,
        indoor_outdoor_tag: 'coberto'
      });

      // Slot 3: Tarde (14:30 / 15:00)
      activities.push({
        id: `prev-d${dayNum}-a3`,
        time: '14:30',
        slot_type: 'afternoon',
        category_label: isFamily ? 'Diversão em Família' : 'Experiência Cultural & Lazer',
        city: dayCity,
        locked: true,
        teaser_title: isFamily 
          ? '🎟 Atração Encantadora para as Crianças' 
          : '🎟 Passeio Recomendado de Tarde',
        teaser_description: 'Experiência enriquecedora e fotográfica, planejada sem pressa conforme o ritmo escolhido.',
        estimated_cost_range: 'Valor compatível com seu orçamento',
        indoor_outdoor_tag: 'misto'
      });

      // Optional Slot 4 (Pause / Café) if intense or pace allows
      if (isIntense || dayNum === 1 || dayNum === 2) {
        activities.push({
          id: `prev-d${dayNum}-a4`,
          time: '17:00',
          slot_type: 'pause',
          category_label: 'Pausa Aconchegante',
          city: dayCity,
          locked: true,
          teaser_title: '☕ Café Colonial ou Fábrica Artesanal de Chocolate',
          teaser_description: 'Parada perfeita para recarregar as energias, provar delícias artesanais e tirar belas fotos.',
          estimated_cost_range: 'R$ 25 - R$ 45/pessoa',
          indoor_outdoor_tag: 'coberto'
        });
      }

      // Slot 5: Jantar / Noite (19:30 / 20:00)
      const isFondueNight = wantsFondue && (dayNum === 1 || dayNum === 2);
      activities.push({
        id: `prev-d${dayNum}-a5`,
        time: '19:30',
        slot_type: 'dinner',
        category_label: isFondueNight ? 'Noite de Fondue' : 'Jantar & Vida Noturna',
        city: dayCity,
        locked: true,
        teaser_title: isFondueNight 
          ? '✨ Sequência Tradicional de Fondue na Pedra' 
          : `✨ Experiência Gastronômica Noturna em ${dayCity}`,
        teaser_description: isFondueNight 
          ? 'A autêntica sequência serrana (queijo, carnes na pedra e chocolates nobres), sem pegadinhas de cupons vencidos.' 
          : 'Ambiente aconchegante com opções de massas frescas, galeto tradicional ou carnes nobres.',
        estimated_cost_range: isFondueNight ? 'R$ 98 - R$ 139/pessoa' : 'R$ 70 - R$ 110/pessoa',
        indoor_outdoor_tag: 'coberto'
      });

      const lockedCount = activities.filter(a => a.locked).length;
      const mealsCount = activities.filter(a => a.slot_type === 'lunch' || a.slot_type === 'dinner').length;

      days.push({
        day_number: dayNum,
        date: dateStr,
        city_focus: dayCity,
        theme_title: dayTheme,
        activities,
        summary_counts: {
          total_activities: activities.length,
          meals: mealsCount,
          locked_count: lockedCount
        }
      });
    }

    const priceBrl = calculateTripPrice(totalDays);

    return {
      id: `prev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      preferences,
      days,
      total_days: totalDays,
      price_brl: priceBrl,
      logistics_base_city: primaryCity,
      has_hotel_confirmed: hasHotel,
      hotel_name: preferences.hotel_name || preferences.accommodation?.name,
      revealed_place_name: teaserCandidate.name,
      created_at: new Date().toISOString(),
      is_preview_only: true
    };
  }

  private calculateDays(preferences: TripPreferences): number {
    if (preferences.number_of_days && preferences.number_of_days >= 1) {
      return preferences.number_of_days;
    }
    try {
      const s = new Date(preferences.start_date);
      const e = new Date(preferences.end_date);
      const diff = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return isNaN(diff) || diff < 1 ? 4 : diff;
    } catch {
      return 4;
    }
  }

  private calculateDateForDay(startDateStr: string, offsetDays: number): string {
    try {
      const d = new Date(startDateStr);
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().split('T')[0];
    } catch {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().split('T')[0];
    }
  }

  private getDayTheme(dayNum: number, city: City, preferences: TripPreferences): string {
    if (dayNum === 1) {
      return `Boas-vindas a ${city} & Cartões Postais`;
    }
    if (dayNum === 2) {
      return `Encantos de ${city} & Gastronomia Típica`;
    }
    if (dayNum === 3) {
      return preferences.interests.includes('Natureza') 
        ? `Canyons, Parques & Vistas Panorâmicas` 
        : `Rotas Coloniais, Chocolate & Compras`;
    }
    if (dayNum === 4) {
      return `Experiências Especiais & Despedida Memorável`;
    }
    return `Exploração Completa da Serra Gaúcha • Dia ${dayNum}`;
  }
}

export const previewEngine = new PreviewEngine();
