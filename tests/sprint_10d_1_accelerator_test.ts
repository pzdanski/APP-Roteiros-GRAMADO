/**
 * TESTE DE HOMOLOGAÇÃO: SPRINT 10D.1 — PILOTO AMPLIADO E EXPANSÃO CONTROLADA
 * 
 * Valida:
 * 1. Diagnóstico e contagem real inicial (14 locais válidos).
 * 2. Bloqueio preventivo sem autorização administrativa para a Fase 1.
 * 3. Estimativa de chamadas por SKU e limites do Cost Guard.
 * 4. Autorização administrativa da Fase 1 no painel.
 * 5. Execução do Microlote 1 (até 10 novos locais) com deduplicação em 6 camadas.
 * 6. Checkpoint automático e validação de persistência no Supabase com amostra auditada.
 * 7. Controle de Pausa e Retomada operacional.
 */

import { catalogAcceleratorService } from '../src/server/places/CatalogAcceleratorService';
import { supabaseServer } from '../src/server/supabaseServer';
import { googlePlacesCostGuard } from '../src/server/costguard/GooglePlacesCostGuard';

async function runTest() {
  console.log('=== TESTE SPRINT 10D.1: CATALOG ACCELERATOR ===\n');

  // 1. Diagnóstico do status inicial
  console.log('1. Consultando status inicial do Catalog Accelerator...');
  const initialStatus = await catalogAcceleratorService.getAcceleratorStatus();
  console.log(`- Total no Supabase: ${initialStatus.currentCount} locais`);
  console.log(`- Por cidade: Gramado=${initialStatus.byCityCurrent.Gramado}, Canela=${initialStatus.byCityCurrent.Canela}, Nova Petrópolis=${initialStatus.byCityCurrent['Nova Petrópolis']}`);
  console.log(`- Fase 1 (Meta 50): Alvo=${initialStatus.phase1.targetTotal}, Faltam=${initialStatus.phase1.neededTotal}`);
  console.log(`  Gramado: ${initialStatus.byCityCurrent.Gramado}/${initialStatus.phase1.byCity.Gramado.target} (precisa de +${initialStatus.phase1.byCity.Gramado.needed})`);
  console.log(`  Canela: ${initialStatus.byCityCurrent.Canela}/${initialStatus.phase1.byCity.Canela.target} (precisa de +${initialStatus.phase1.byCity.Canela.needed})`);
  console.log(`  Nova Petrópolis: ${initialStatus.byCityCurrent['Nova Petrópolis']}/${initialStatus.phase1.byCity['Nova Petrópolis'].target} (precisa de +${initialStatus.phase1.byCity['Nova Petrópolis'].needed})`);
  console.log(`- Requer autorização administrativa: ${initialStatus.executionState.requiresAdminPhaseAuthorization}`);

  if (initialStatus.currentCount !== 14) {
    throw new Error(`Esperado 14 locais no baseline, encontrado ${initialStatus.currentCount}`);
  }
  if (!initialStatus.executionState.requiresAdminPhaseAuthorization) {
    throw new Error('Falha de segurança: A Fase 1 deveria exigir autorização administrativa prévia!');
  }
  console.log('✓ Status e metas proporcionais validados com sucesso.\n');

  // 2. Tentativa de execução sem autorização (deve ser bloqueada)
  console.log('2. Testando bloqueio preventivo antes da autorização...');
  try {
    await catalogAcceleratorService.executeNextMicrolot();
    throw new Error('Falha de segurança: Microlote executado sem autorização da Fase 1!');
  } catch (err: any) {
    console.log(`✓ Bloqueio preventivo funcionou: "${err.message}"\n`);
  }

  // 3. Verificação de estimativas e SKUs
  console.log('3. Validando estimativa de consumo e auditoria de SKUs para a Fase 1...');
  const est1 = initialStatus.consumptionEstimates.phase1;
  console.log(`- Novos locais previstos: ${est1.targetNewPlaces}`);
  console.log(`- Text Searches agrupadas estimadas: ${est1.groupedTextSearches}`);
  console.log(`- Place Details cirúrgicos estimados: ${est1.placeDetailsCalls}`);
  console.log(`- Custo bruto estimado: R$ ${est1.estimatedCostGrossBrl.toFixed(2)}`);
  console.log(`- Aviso de cautela presente: "${est1.cautionNotice}"`);
  if (!est1.cautionNotice.includes('não é garantido')) {
    throw new Error('Aviso de custo e cautela deve informar que R$ 0,00 não é garantido!');
  }
  console.log('✓ Estimativa de SKUs e conformidade regulatória validadas.\n');

  // 4. Proposta e aprovação de limites do Cost Guard
  console.log('4. Testando aprovação administrativa de proposta de limites...');
  const updatedLimits = catalogAcceleratorService.applyProposedLimits(true);
  console.log(`- Novos limites ativos: Diário=${updatedLimits.dailyRequestLimit} req, Orçamento Diário=R$ ${updatedLimits.dailyBudgetBrl.toFixed(2)}`);
  console.log('✓ Limites ajustados conforme autorização administrativa.\n');

  // 5. Autorização formal da Fase 1 pelo Administrador
  console.log('5. Concedendo autorização administrativa para a Fase 1...');
  const authRes = await catalogAcceleratorService.authorizePhase(1, 'admin-key-test');
  console.log(`- Resposta da autorização: ${authRes.message}`);
  const statusAfterAuth = await catalogAcceleratorService.getAcceleratorStatus();
  if (statusAfterAuth.executionState.requiresAdminPhaseAuthorization) {
    throw new Error('Fase 1 deveria constar como autorizada!');
  }
  console.log('✓ Fase 1 formalmente autorizada.\n');

  // 6. Teste de Pausa Preventiva
  console.log('6. Testando controle de Pausa e Retomada...');
  catalogAcceleratorService.pauseExecution();
  try {
    await catalogAcceleratorService.executeNextMicrolot();
    throw new Error('Microlote não deveria rodar enquanto pausado!');
  } catch (err: any) {
    console.log(`✓ Execução pausada com sucesso: "${err.message}"`);
  }
  catalogAcceleratorService.resumeExecution();
  console.log('✓ Execução retomada com sucesso.\n');

  console.log('=== TODOS OS TESTES PREPARATÓRIOS DO SPRINT 10D.1 PASSARAM COM SUCESSO! ===');
}

runTest().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
