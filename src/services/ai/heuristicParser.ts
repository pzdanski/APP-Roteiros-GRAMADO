import { TripPreferences, City, BudgetFlexibility } from '../../types';
import { ParseTripPromptResult } from './AIProvider';

export function heuristicParseTripInput(rawText: string): ParseTripPromptResult {
  const text = rawText.toLowerCase();
  const preferences: Partial<TripPreferences> = {
    interests: [],
    mandatory_places: [],
    must_have: [],
    nice_to_have: [],
    restrictions: [],
    avoid: []
  };

  // 1. Name detection
  const nameMatch = rawText.match(/(?:meu nome é|me chamo|sou o|sou a|nome:\s*|^)([A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõç]+)/);
  if (nameMatch && nameMatch[1] && !['Ola', 'Olá', 'Oi', 'Vou', 'Viagem', 'Dia', 'Quero'].includes(nameMatch[1])) {
    preferences.name = nameMatch[1];
  } else {
    // Check if the prompt starts with a single capitalized word like "Paulo, 20 a 24..."
    const firstWord = rawText.trim().split(/[\s,]+/)[0];
    if (firstWord && /^[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõç]+$/.test(firstWord) && !['Ola', 'Olá', 'Oi', 'Vou', 'Quero', 'Preciso'].includes(firstWord)) {
      preferences.name = firstWord;
    }
  }

  // 2. Adults, Children & Relationships
  let adults = 2; // sensible default
  let children = 0;
  const childrenAges: number[] = [];

  if (text.includes('sozinho') || text.includes('sozinha') || text.includes('apenas eu') || text.includes('viajo só')) {
    adults = 1;
    preferences.is_couple = false;
  } else if (text.includes('esposa') || text.includes('marido') || text.includes('namorada') || text.includes('namorado') || text.includes('casal') || text.includes('com meu parceiro') || text.includes('com minha parceira')) {
    adults = 2;
    preferences.is_couple = true;
  } else {
    const adultsMatch = text.match(/(\d+|um|uma|dois|duas|três|tres|quatro|cinco)\s*(?:adultos?|pessoas?|amigos?)/);
    if (adultsMatch) {
      const w = adultsMatch[1];
      const wordMap: Record<string, number> = { 'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'tres': 3, 'quatro': 4, 'cinco': 5 };
      adults = wordMap[w] || parseInt(w, 10) || 2;
    }
  }

  // Check children ages like "dois filhos de 7 e 11 anos", "2 filhos (7 e 11)"
  const kidsWithAgesMatch = text.match(/(?:(\d+|um|uma|dois|duas|três|tres)\s*)?(?:filhos?|crianças?|criancas?|kids)[^\d]*de\s*(\d{1,2})\s*(?:e|,)\s*(\d{1,2})\s*(?:anos)?/);
  if (kidsWithAgesMatch) {
    const countWord = kidsWithAgesMatch[1];
    const wordMap: Record<string, number> = { 'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'tres': 3 };
    children = wordMap[countWord] || parseInt(countWord, 10) || 2;
    childrenAges.push(parseInt(kidsWithAgesMatch[2], 10), parseInt(kidsWithAgesMatch[3], 10));
  } else {
    const kidsMatch = text.match(/(\d+|um|uma|dois|duas|três|tres)\s*(filhos|filhas|crianças|criancas|kids)/);
    if (kidsMatch) {
      const numWord = kidsMatch[1];
      if (numWord === '1' || numWord === 'um' || numWord === 'uma') children = 1;
      else if (numWord === '2' || numWord === 'dois' || numWord === 'duas') children = 2;
      else if (numWord === '3' || numWord === 'três' || numWord === 'tres') children = 3;
      else children = parseInt(numWord, 10) || 1;
    }
    // Single child mention
    if (children === 0 && (text.includes('com meu filho') || text.includes('com minha filha') || text.includes('com criança'))) {
      children = 1;
    }
  }

  // Check elderly
  if (text.includes('idoso') || text.includes('idosa') || text.includes('meus pais') || text.includes('minha mãe') || text.includes('meu pai') || text.includes('terceira idade')) {
    preferences.has_elderly = true;
  }

  preferences.adults_count = adults;
  preferences.children_count = children;
  preferences.children_ages = childrenAges;

  // 3. Destination & Cities
  const citiesDesired: City[] = [];
  let primaryCity: City = 'Gramado';

  if (text.includes('canela')) {
    citiesDesired.push('Canela');
    if (!text.includes('gramado')) primaryCity = 'Canela';
  }
  if (text.includes('gramado') || !text.includes('canela')) {
    citiesDesired.push('Gramado');
  }
  if (text.includes('nova petrópolis') || text.includes('nova petropolis')) {
    citiesDesired.push('Nova Petrópolis');
  }

  preferences.hotel_city = primaryCity;
  preferences.destination = citiesDesired.join(' e ') || 'Gramado e Canela';
  preferences.cities_desired = citiesDesired.length > 0 ? citiesDesired : ['Gramado', 'Canela'];

  // 4. Duration and Dates
  const today = new Date();
  const monthsMap: Record<string, number> = {
    janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
    julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
  };

  let foundSpecificDates = false;
  let parsedDaysCount = 4; // default

  // Match days count like "4 dias em gramado", "ficaremos 5 dias"
  const daysExplicitMatch = text.match(/(\d+|um|dois|tres|três|quatro|cinco|seis|sete|oito|dez)\s*(?:dias|noites)/);
  if (daysExplicitMatch) {
    const word = daysExplicitMatch[1];
    const map: Record<string, number> = {
      '1': 1, 'um': 1, '2': 2, 'dois': 2, '3': 3, 'tres': 3, 'três': 3,
      '4': 4, 'quatro': 4, '5': 5, 'cinco': 5, '6': 6, 'seis': 6,
      '7': 7, 'sete': 7, '8': 8, 'oito': 8, '10': 10, 'dez': 10
    };
    parsedDaysCount = map[word] || parseInt(word, 10) || 4;
    preferences.number_of_days = parsedDaysCount;
  }

  // Check specific range like "20 a 24 de setembro", "10 a 14/11"
  const rangeWithMonthMatch = text.match(/(\d{1,2})\s*(?:a|até|-)\s*(\d{1,2})\s*(?:de\s*([a-zç]+)|\/(\d{1,2}))/);
  if (rangeWithMonthMatch) {
    const startDay = parseInt(rangeWithMonthMatch[1], 10);
    const endDay = parseInt(rangeWithMonthMatch[2], 10);
    const monthName = rangeWithMonthMatch[3];
    const monthNum = rangeWithMonthMatch[4] ? parseInt(rangeWithMonthMatch[4], 10) - 1 : (monthName ? monthsMap[monthName] : today.getMonth());
    
    if (startDay >= 1 && startDay <= 31 && endDay >= 1 && endDay <= 31 && monthNum !== undefined) {
      let year = today.getFullYear();
      if (monthNum < today.getMonth() || (monthNum === today.getMonth() && endDay < today.getDate())) {
        year += 1;
      }
      const s = new Date(year, monthNum, startDay);
      const e = new Date(year, monthNum, endDay);
      preferences.start_date = s.toISOString().split('T')[0];
      preferences.end_date = e.toISOString().split('T')[0];
      parsedDaysCount = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      preferences.number_of_days = parsedDaysCount;
      foundSpecificDates = true;
    }
  }

  if (!foundSpecificDates) {
    // Generate dates based on parsedDaysCount starting 2 weeks ahead
    const startDate = new Date();
    startDate.setDate(today.getDate() + 14);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + (parsedDaysCount - 1));

    preferences.start_date = startDate.toISOString().split('T')[0];
    preferences.end_date = endDate.toISOString().split('T')[0];
    preferences.number_of_days = parsedDaysCount;
  }

  // 5. Accommodation
  if (text.includes('ainda não reservei') || text.includes('ainda nao reservei') || text.includes('não reservei') || text.includes('sem hotel') || text.includes('ainda não tenho')) {
    preferences.accommodation_status = 'not_booked';
    preferences.accommodation = { city: primaryCity, wants_help_finding: false };
  } else if (text.includes('não sei onde ficar') || text.includes('ainda não sei onde') || text.includes('procurando onde')) {
    preferences.accommodation_status = 'undecided';
    preferences.accommodation = { city: primaryCity, wants_help_finding: true };
  } else if (text.includes('já temos hospedagem') || text.includes('ja temos hospedagem') || text.includes('hospedagem reservada') || text.includes('temos hospedagem em gramado')) {
    preferences.accommodation_status = 'booked';
    preferences.hotel_name = 'Hospedagem em Gramado';
    preferences.accommodation = { name: 'Hospedagem em Gramado', city: primaryCity };
  } else {
    const hotelNamedMatch = rawText.match(/(?:hotel|pousada|resort|airbnb|flat|chalé|cabana)\s+([A-ZÁÉÍÓÚÂÊÔÃÕ][a-zA-Z0-9\s]+?)(?:,|\.|\bem\b|\bna\b|$)/i);
    if (hotelNamedMatch && hotelNamedMatch[1] && !text.includes('ainda não') && !text.includes('quero um hotel')) {
      preferences.accommodation_status = 'booked';
      preferences.hotel_name = hotelNamedMatch[0].trim();
      preferences.accommodation = { name: hotelNamedMatch[0].trim(), city: primaryCity };
    } else {
      preferences.accommodation_status = 'not_booked';
      preferences.accommodation = { city: primaryCity };
    }
  }

  // 6. Natural Language Budget (Section 8 of prompt)
  // Check food per person: "almoço até uns 80 reais", "80 reais por pessoa nos almoços"
  const lunchPerPersonMatch = text.match(/(?:almoço|almoços|refeições|refeicao)[^\d]*(?:até|uns|maximo|máximo|de)?\s*(?:r\$)?\s*(\d{2,3})\s*(?:reais)?\s*(?:por pessoa|cada)?/);
  if (lunchPerPersonMatch) {
    preferences.budget_food_per_person = parseInt(lunchPerPersonMatch[1], 10);
  } else {
    const perPersonGeneralMatch = text.match(/(?:gastar|uns|até)\s*(?:r\$)?\s*(\d{2,3})\s*(?:reais)?\s*por pessoa/);
    if (perPersonGeneralMatch) {
      preferences.budget_food_per_person = parseInt(perPersonGeneralMatch[1], 10);
    }
  }

  // Check dinner / fondue budget
  const dinnerBudgetMatch = text.match(/(?:jantar|fondue|noite)[^\d]*(?:até|uns|de)?\s*(?:r\$)?\s*(\d{2,3})\s*(?:reais)?/);
  if (dinnerBudgetMatch) {
    preferences.budget_dinner_per_person = parseInt(dinnerBudgetMatch[1], 10);
  } else if (text.includes('fondue')) {
    preferences.budget_dinner_per_person = 120;
  }

  // Total budget
  let budgetTotal = 3000;
  let flexibility: BudgetFlexibility = 'equilibrado';

  if (text.includes('econômico') || text.includes('economico') || text.includes('gastar pouco') || text.includes('barato')) {
    flexibility = 'economico';
    budgetTotal = Math.max(1500, parsedDaysCount * (adults + children * 0.5) * 180);
  } else if (text.includes('luxo') || text.includes('sem limite') || text.includes('melhores restaurantes') || text.includes('5 estrelas')) {
    flexibility = 'luxo';
    budgetTotal = Math.max(6000, parsedDaysCount * (adults + children * 0.5) * 600);
  } else if (text.includes('conforto') || text.includes('premium')) {
    flexibility = 'conforto';
    budgetTotal = Math.max(4500, parsedDaysCount * (adults + children * 0.5) * 400);
  }

  const explicitBudgetMatch = text.match(/(?:orçamento|orcamento|gastar no total|teto|total de)?\s*(?:r\$)?\s*(\d{1,3}(?:\.\d{3})*|\d+)\s*(?:reais|mil|k)?/);
  if (text.includes('3 mil') || text.includes('três mil') || text.includes('tres mil')) {
    budgetTotal = 3000;
  } else if (text.includes('4 mil') || text.includes('quatro mil')) {
    budgetTotal = 4000;
  } else if (text.includes('5 mil') || text.includes('cinco mil')) {
    budgetTotal = 5000;
  } else if (text.includes('2 mil') || text.includes('dois mil')) {
    budgetTotal = 2000;
  } else if (explicitBudgetMatch && parseInt(explicitBudgetMatch[1].replace('.', ''), 10) >= 500) {
    budgetTotal = parseInt(explicitBudgetMatch[1].replace('.', ''), 10);
  } else {
    budgetTotal = Math.max(2000, parsedDaysCount * (adults + (children > 0 ? children * 0.5 : 0)) * 250);
  }

  preferences.budget_total = Math.round(budgetTotal);
  preferences.budget_flexibility = flexibility;

  // 7. Interests, MustHave, NiceToHave, Avoid
  const interests: string[] = [];
  const mustHaves: string[] = [];
  const niceToHaves: string[] = [];
  const avoids: string[] = [];

  if (text.includes('fondue')) {
    mustHaves.push('Sequência de Fondue Tradicional');
    interests.push('Gastronomia');
  }

  if (text.includes('natureza') || text.includes('cascata') || text.includes('lago') || text.includes('ar livre')) {
    interests.push('Natureza');
  }

  if (children > 0 || text.includes('criança') || text.includes('crianca') || text.includes('filhos') || text.includes('diferente para as crianças')) {
    interests.push('Passeios para Crianças');
    niceToHaves.push('Atrações lúdicas e interativas');
  }

  if (text.includes('parque') || text.includes('snowland') || text.includes('acquamotion') || text.includes('olivas')) {
    interests.push('Parques');
    if (text.includes('snowland')) mustHaves.push('Snowland Gramado');
    if (text.includes('olivas')) mustHaves.push('Olivas de Gramado');
  }

  if (text.includes('chocolate') || text.includes('florybal') || text.includes('prawer') || text.includes('lugano')) {
    interests.push('Chocolate');
  }

  if (text.includes('vinho') || text.includes('vinícola') || text.includes('vinicola') || text.includes('degustação')) {
    interests.push('Vinhos');
  }

  if (text.includes('foto') || text.includes('mirante') || text.includes('instagram')) {
    interests.push('Fotos e Mirantes');
  }

  if (text.includes('lugares gratuitos') || text.includes('passeios gratuitos') || text.includes('grátis') || text.includes('gratuito')) {
    interests.push('Passeios Gratuitos');
    niceToHaves.push('Experiências Gratuitas e Contemplativas');
  }

  // Avoids
  if (text.includes('não quero que todos os passeios sejam caros') || text.includes('não quero tudo caro') || text.includes('gastar pouco com passeios')) {
    avoids.push('Atrações de custo excessivo em série');
  }
  if (text.includes('não quero ficar correndo') || text.includes('sem correria') || text.includes('sem pressa')) {
    avoids.push('Ritmo acelerado e excesso de atividades');
  }
  if (text.includes('nada de acordar cedo') || text.includes('não acordar cedo')) {
    avoids.push('Horários muito cedo');
  }
  if (text.includes('evitar filas') || text.includes('sem fila')) {
    avoids.push('Horários de pico');
  }

  if (interests.length === 0) {
    interests.push('Natureza', 'Gastronomia', 'Pontos Turísticos');
  }

  if (!preferences.name) {
    preferences.name = text.includes('somos') || children > 0 ? 'Família Silva' : 'Viajante';
  }

  preferences.interests = Array.from(new Set(interests));
  preferences.mandatory_places = mustHaves;
  preferences.must_have = mustHaves;
  preferences.nice_to_have = niceToHaves;
  preferences.restrictions = avoids;
  preferences.avoid = avoids;

  // 8. Pace
  if (text.includes('não quero ficar correndo') || text.includes('sem correria') || text.includes('tranquilo') || text.includes('calmo') || text.includes('relaxar')) {
    preferences.pace = 'tranquilo';
  } else if (text.includes('aproveitar bastante') || text.includes('tudo que puder') || text.includes('intenso') || text.includes('muitas atrações')) {
    preferences.pace = 'aproveitar_bastante';
  } else {
    preferences.pace = 'equilibrado';
  }

  // 9. Transport
  if (text.includes('carro próprio') || text.includes('carro proprio') || text.includes('meu carro') || text.includes('de carro')) {
    preferences.transport = 'carro_proprio';
  } else if (text.includes('carro alugado') || text.includes('alugar carro') || text.includes('locadora')) {
    preferences.transport = 'carro_alugado';
  } else if (text.includes('uber') || text.includes('transfer') || text.includes('táxi')) {
    preferences.transport = 'transfer_uber';
  } else if (text.includes('sem carro') || text.includes('a pé')) {
    preferences.transport = 'sem_carro';
  } else {
    preferences.transport = 'carro_alugado';
  }

  // 10. Required for Generation Rules (Section 6 & 7)
  // Required:
  // - Period or number of days (detected if daysExplicitMatch or rangeWithMonthMatch or foundSpecificDates)
  // - Travelers count (adults >= 1) -> we default to 2 if not given, or explicit
  // - Destination (Gramado, Canela, Serra) -> present
  const hasDaysOrDates = Boolean(daysExplicitMatch || rangeWithMonthMatch || foundSpecificDates || text.includes('dia'));
  const hasTravelers = Boolean(adults >= 1);
  const hasDestination = Boolean(citiesDesired.length > 0 || text.includes('gramado') || text.includes('canela') || text.includes('serra'));

  const missingFields: string[] = [];
  // Only ask for strictly missing essential information!
  if (!preferences.name) {
    // Note: name is convenient, but we can ask or use "Viajante"
    missingFields.push('name');
  }

  if (!hasDaysOrDates) {
    missingFields.push('dates_confirmation');
  }

  const isSatisfied = hasDaysOrDates && hasTravelers && hasDestination;
  preferences.required_for_generation_satisfied = isSatisfied;

  return {
    preferences: preferences as TripPreferences,
    missingFields,
    rawTranscript: rawText,
    confidenceScore: 0.96
  };
}
