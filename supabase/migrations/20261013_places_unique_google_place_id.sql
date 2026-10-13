-- Impede duplicidade de locais reais por Google Place ID (rede de segurança para o Catalog Accelerator).
-- ANTES DE APLICAR, confirme que não há duplicatas existentes (a consulta abaixo deve retornar 0 linhas):
--   SELECT google_place_id, COUNT(*) FROM public.places
--   WHERE google_place_id IS NOT NULL AND is_demo IS NOT TRUE
--   GROUP BY 1 HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_places_google_place_id_real
  ON public.places (google_place_id)
  WHERE google_place_id IS NOT NULL AND is_demo IS NOT TRUE;
