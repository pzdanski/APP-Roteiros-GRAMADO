import React from 'react';
import { X, CloudRain, Sun, Cloud, CloudFog, AlertCircle, Calendar, Umbrella } from 'lucide-react';
import { Trip, NormalizedWeatherForecast } from '../types';

interface WeatherForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  forecastMap: Record<string, NormalizedWeatherForecast | null>;
  selectedDate?: string;
}

export const WeatherForecastModal: React.FC<WeatherForecastModalProps> = ({
  isOpen,
  onClose,
  trip,
  forecastMap,
  selectedDate
}) => {
  if (!isOpen) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getWeatherIcon = (cond?: string) => {
    switch (cond) {
      case 'CLEAR':
        return <Sun className="w-6 h-6 text-amber-500 fill-amber-300" />;
      case 'RAIN':
      case 'HEAVY_RAIN':
      case 'STORM':
        return <CloudRain className="w-6 h-6 text-blue-500" />;
      case 'COLD':
      case 'FOG':
        return <CloudFog className="w-6 h-6 text-slate-400" />;
      default:
        return <Cloud className="w-6 h-6 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div 
        id="modal-weather-forecast"
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[88vh] flex flex-col animate-in fade-in slide-in-from-bottom duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#FAF9F6] border-b border-[#E7DFCE] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
              <CloudRain className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#1B4332]">
                Previsão do Tempo na Serra Gaúcha
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Microclima de {trip.preferences.hotel_city || 'Gramado'} e Canela
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Days Forecast List */}
        <div className="p-4 overflow-y-auto space-y-3 divide-y divide-[#F1EBE0]">
          {trip.days.map((day) => {
            const dayDate = new Date(day.date + 'T12:00:00');
            const diffDays = Math.ceil((dayDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            const isReliableHorizon = diffDays >= 0 && diffDays <= 14;
            const forecast = forecastMap[day.date];
            const isSelected = selectedDate === day.date;

            return (
              <div 
                key={day.day_number}
                className={`pt-3 first:pt-0 ${isSelected ? 'bg-amber-50/50 -mx-2 px-2 py-2 rounded-2xl' : ''}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#1B4332]" />
                    <span className="font-extrabold text-xs text-[#1E293B]">
                      DIA {day.day_number} • {day.date}
                    </span>
                    <span className="text-[10px] font-bold text-[#7A6F5D] uppercase bg-[#FAF9F6] px-1.5 py-0.5 rounded border border-[#E7DFCE]">
                      {day.city_focus}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
                      Dia selecionado
                    </span>
                  )}
                </div>

                {!isReliableHorizon ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Previsão disponível mais perto da data da viagem.</span>
                      <span className="text-[11px] text-slate-500">
                        Modelos meteorológicos de alta precisão cobrem até 14 dias de antecedência para a Serra Gaúcha.
                      </span>
                    </div>
                  </div>
                ) : forecast ? (
                  <div className="bg-[#FAF9F6] p-3 rounded-2xl border border-[#E7DFCE] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {getWeatherIcon(forecast.condition)}
                        <div>
                          <span className="text-base font-extrabold text-[#1E293B]">
                            {forecast.temp_min}°C / {forecast.temp_max}°C
                          </span>
                          <span className="text-xs text-[#64748B] block">
                            Chuva: {forecast.rain_probability}% {forecast.precipitation_mm > 0 ? `(${forecast.precipitation_mm}mm)` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          forecast.is_indoor_recommended 
                            ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}>
                          {forecast.is_indoor_recommended ? '🌧️ Foco Coberto' : '☀️ Ar Livre OK'}
                        </span>
                        <span className="text-[9px] text-[#64748B] block mt-0.5">
                          {forecast.provider === 'CACHE' ? 'Dados verificados' : 'Open-Meteo'}
                        </span>
                      </div>
                    </div>

                    {/* Itinerary Tip */}
                    <div className="pt-1 text-xs text-[#475569] leading-relaxed border-t border-[#F1EBE0]">
                      <p>
                        💡 <strong>Indicação para o roteiro:</strong>{' '}
                        {forecast.is_indoor_recommended
                          ? 'Probabilidade de chuva significativa. Aproveite atrações como Snowland, museus cobertos, cafés coloniais e fondues.'
                          : 'Condições favoráveis para caminhadas ao ar livre pelo Lago Negro, Bondinhos e ruas floridas de Gramado e Canela.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                    Carregando dados meteorológicos...
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-[#FAF9F6] border-t border-[#E7DFCE] text-[10px] text-[#7A6F5D] text-center">
          Atualizado continuamente com dados microclimáticos da Serra Gaúcha.
        </div>
      </div>
    </div>
  );
};
