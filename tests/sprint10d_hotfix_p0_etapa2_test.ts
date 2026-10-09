/**
 * SPRINT 10D HOTFIX P0 — ETAPA 2 DE 3
 * SUÍTE DE TESTES DE HOMOLOGAÇÃO: AUTORIZAÇÃO ADMINISTRATIVA PERSISTENTE
 * 
 * Cobertura Obrigatória (Seção 8):
 * 1. Administrador autenticado consegue autorizar.
 * 2. Visitante anônimo não consegue autorizar (rejeitado com 401).
 * 3. Autorização persiste no Supabase.
 * 4. Refresh mantém estado correto (consulta persistente).
 * 5. Reinício simulado do serviço/Cloud Run não perde autorização.
 * 6. Autorização revogada impede execução de microlotes.
 * 7. Autorização ausente impede execução de microlotes.
 * 8. Supabase indisponível bloqueia execução com mensagem clara.
 * 9. Duas solicitações simultâneas tratadas sem concorrência inconsistente.
 * 10. Frontend/API nunca apresenta autorização não confirmada pelo servidor.
 * 11. Cost Guard permanece ativo e configurado.
 * 12. Nenhuma chamada Google externa realizada (0 chamadas).
 */

import { CatalogAcceleratorService } from '../src/server/places/CatalogAcceleratorService';
import { supabaseServer } from '../src/server/supabaseServer';
import { googlePlacesCostGuard } from '../src/server/costguard/GooglePlacesCostGuard';
import { googlePlacesServer } from '../src/server/places/GooglePlacesServerProvider';
import { createAdminAuthMiddleware } from '../src/server/adminAuth';
import { Request, Response } from 'express';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FALHA DE ASSERTIVA] ${message}`);
  }
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🧪 INICIANDO TESTES SPRINT 10D HOTFIX P0 — ETAPA 2');
  console.log('   AUTORIZAÇÃO ADMINISTRATIVA PERSISTENTE & SEGURANÇA SERVER-SIDE');
  console.log('===============================================================\n');

  const adminApiKey = 'test-duo21-admin-secret-2026';
  const requireAdmin = createAdminAuthMiddleware(adminApiKey);
  let accelerator = new CatalogAcceleratorService();

  // Limpa autorizações anteriores no mock store para isolamento
  (supabaseServer as any).mockStore = {
    places: await supabaseServer.getPlaces(),
    authorizations: []
  };

  // ---------------------------------------------------------------------------
  // Teste 1 & 2: Autenticação Administrativa (Admin vs Anônimo)
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 1 & 2: Autenticação Administrativa Server-Side');
  
  // 2. Visitante anônimo não consegue autorizar
  let anonymousBlocked = false;
  let anonStatusCode = 0;
  const mockAnonReq = {
    headers: {},
    cookies: {}
  } as unknown as Request;
  const mockAnonRes = {
    status: (code: number) => {
      anonStatusCode = code;
      return {
        json: (data: any) => {
          if (code === 401 && data.code === 'UNAUTHORIZED') anonymousBlocked = true;
        }
      };
    }
  } as unknown as Response;

  requireAdmin(mockAnonReq, mockAnonRes, () => {
    throw new Error('Falha de segurança crítica: Visitante anônimo passou pela autenticação admin!');
  });
  assert(anonymousBlocked, `Visitante anônimo deve receber 401 UNAUTHORIZED (código recebido: ${anonStatusCode})`);
  console.log('   • Visitante anônimo: ✓ Bloqueado com 401 Unauthorized');

  // Tentativa de spoofing via headers ou referer falso (antigo loophole)
  let spoofBlocked = false;
  const mockSpoofReq = {
    headers: {
      'x-admin-control-plane': 'duo21',
      'referer': 'https://app.com/duo-control'
    }
  } as unknown as Request;
  requireAdmin(mockSpoofReq, mockAnonRes, () => {
    throw new Error('Falha de segurança crítica: Loophole de referer permitiu acesso anônimo!');
  });
  console.log('   • Tentativa de spoofing via referer /duo-control: ✓ Bloqueada');

  // 1. Administrador autenticado consegue passar
  let adminPassed = false;
  const mockAdminReq = {
    headers: {
      'x-admin-key': adminApiKey
    }
  } as unknown as Request;
  const mockAdminRes = {} as Response;
  requireAdmin(mockAdminReq, mockAdminRes, () => {
    adminPassed = true;
    assert((mockAdminReq as any).adminUser?.role === 'admin', 'Identidade do administrador deve ser anexada');
  });
  assert(adminPassed, 'Administrador com chave válida deve ser autenticado com sucesso');
  console.log('   • Administrador com x-admin-key: ✓ Autenticado e identificado');

  // Token de sessão criptográfico
  const sessionToken = requireAdmin.generateSessionToken();
  assert(requireAdmin.verifySessionToken(sessionToken) === true, 'Token de sessão gerado deve ser válido');
  let sessionPassed = false;
  const mockSessionReq = {
    headers: {
      'x-admin-session': sessionToken
    }
  } as unknown as Request;
  requireAdmin(mockSessionReq, mockAdminRes, () => {
    sessionPassed = true;
  });
  assert(sessionPassed, 'Administrador com token de sessão assinado deve ser aceito');
  console.log('   • Administrador com sessão assinada: ✓ Aceito sem expor chave');
  console.log('  ✓ Regras de autenticação administrativa 100% validadas.\n');

  // ---------------------------------------------------------------------------
  // Teste 7: Autorização ausente impede execução de microlotes
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 7: Autorização ausente impede execução de microlotes');
  const statusPreAuth = await accelerator.getAcceleratorStatus();
  assert(statusPreAuth.phase1.isAuthorized === false, 'Fase 1 não deve estar autorizada inicialmente');
  assert(statusPreAuth.phase1.statusLabel === 'AGUARDANDO_AUTORIZACAO', 'Label deve ser AGUARDANDO_AUTORIZACAO');
  assert(statusPreAuth.executionState.requiresAdminPhaseAuthorization === true, 'Deve exigir autorização');

  let executionBlockedBeforeAuth = false;
  try {
    await accelerator.executeNextMicrolot('test-admin');
  } catch (err: any) {
    executionBlockedBeforeAuth = true;
    assert(err.message.includes('requer autorização administrativa explícita'), `Mensagem de erro deve ser clara: ${err.message}`);
  }
  assert(executionBlockedBeforeAuth, 'Microlote DEVE ser bloqueado sem autorização persistente');
  console.log('  ✓ Bloqueio preventivo sem autorização validado com sucesso.\n');

  // ---------------------------------------------------------------------------
  // Teste 3: Autorização persiste no Supabase com auditoria completa
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 3: Autorização persiste no Supabase');
  const authResponse = await accelerator.authorizePhase(1, 'admin@duo21.internal', {
    dailyLimit: 60,
    monthlyLimit: 300,
    dailyBudgetBrl: 15.00,
    monthlyBudgetBrl: 75.00,
    reason: 'Autorização formal para início da Fase 1'
  });

  assert(authResponse.success === true, 'Autorização deve retornar success=true');
  assert(authResponse.authorization.status === 'AUTORIZADA', 'Status deve ser AUTORIZADA');
  assert(authResponse.authorization.authorized_by === 'admin@duo21.internal', 'Auditoria deve registrar quem autorizou');
  assert(Boolean(authResponse.authorization.authorization_id), 'Deve gerar authorization_id UUID');
  assert(authResponse.authorization.approved_limits?.dailyLimit === 60, 'Limites aprovados devem ser registrados');

  // Consulta direta no Supabase (Fonte da Verdade)
  const savedInSupabase = await supabaseServer.getPhaseAuthorization(1);
  assert(savedInSupabase !== null, 'Registro DEVE existir no Supabase');
  assert(savedInSupabase?.status === 'AUTORIZADA', 'Status no Supabase deve ser AUTORIZADA');
  assert(savedInSupabase?.authorized_by === 'admin@duo21.internal', 'Identidade deve ser idêntica');
  console.log('   • Registro salvo no Supabase com UUID:', savedInSupabase?.authorization_id);
  console.log('   • Identidade administrativa gravada:', savedInSupabase?.authorized_by);
  console.log('   • Limites aprovados auditados:', JSON.stringify(savedInSupabase?.approved_limits));
  console.log('  ✓ Persistência e auditoria no Supabase comprovadas.\n');

  // ---------------------------------------------------------------------------
  // Teste 4: Refresh mantém estado correto recuperado do Supabase
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 4: Refresh mantém estado correto');
  const statusAfterRefresh = await accelerator.getAcceleratorStatus();
  assert(statusAfterRefresh.phase1.isAuthorized === true, 'Após refresh status deve ser isAuthorized=true');
  assert(statusAfterRefresh.phase1.statusLabel === 'AUTORIZADA', 'statusLabel deve ser AUTORIZADA');
  assert(statusAfterRefresh.phase1.authorizationRecord?.authorized_by === 'admin@duo21.internal', 'Audit record recuperado do Supabase');
  assert(statusAfterRefresh.executionState.requiresAdminPhaseAuthorization === false, 'Não deve exigir nova autorização');
  console.log('  ✓ Refresh mantém autorização diretamente da Fonte da Verdade (Supabase).\n');

  // ---------------------------------------------------------------------------
  // Teste 5: Reinício simulado do serviço/Cloud Run não perde autorização
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 5: Reinício simulado do serviço/Cloud Run não perde autorização');
  // Criamos uma nova instância limpa do serviço, simulando novo container Cloud Run com memória zerada
  const freshRestartedAccelerator = new CatalogAcceleratorService();
  const statusAfterRestart = await freshRestartedAccelerator.getAcceleratorStatus();
  assert(statusAfterRestart.phase1.isAuthorized === true, 'Nova instância do container DEVE recuperar autorização do Supabase');
  assert(statusAfterRestart.phase1.statusLabel === 'AUTORIZADA', 'Status deve permanecer AUTORIZADA');
  assert(statusAfterRestart.phase1.authorizationRecord?.authorization_id === savedInSupabase?.authorization_id, 'UUID de autorização preservado');
  console.log('  ✓ Reinício simulado do Cloud Run recuperou perfeitamente a autorização do Supabase.\n');

  // ---------------------------------------------------------------------------
  // Teste 6: Autorização revogada impede execução
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 6: Autorização revogada impede execução');
  const revokeResponse = await accelerator.revokePhase(1, 'superadmin@duo21.internal', 'Pausa solicitada pela diretoria');
  assert(revokeResponse.success === true, 'Revogação deve ser bem-sucedida');
  assert(revokeResponse.authorization.status === 'REVOGADA', 'Status deve ser REVOGADA');
  assert(Boolean(revokeResponse.authorization.revoked_at), 'revoked_at deve ser preenchido');

  const statusAfterRevoke = await accelerator.getAcceleratorStatus();
  assert(statusAfterRevoke.phase1.isAuthorized === false, 'Fase revogada NÃO deve constar como autorizada');
  assert(statusAfterRevoke.phase1.statusLabel === 'REVOGADA', 'Status visual deve ser REVOGADA');
  assert(statusAfterRevoke.executionState.requiresAdminPhaseAuthorization === true, 'Deve exigir nova autorização');

  let executionBlockedWhenRevoked = false;
  try {
    await accelerator.executeNextMicrolot('test-admin');
  } catch (err: any) {
    executionBlockedWhenRevoked = true;
    assert(err.message.includes('requer autorização administrativa explícita'), 'Execução deve ser bloqueada com mensagem clara');
  }
  assert(executionBlockedWhenRevoked, 'Execução DEVE ser bloqueada quando a autorização foi revogada');
  console.log('  ✓ Revogação administrativa bloqueia imediatamente novas execuções.\n');

  // Reautoriza para os testes seguintes
  await accelerator.authorizePhase(1, 'admin@duo21.internal');
  const statusReauthorized = await accelerator.getAcceleratorStatus();
  assert(statusReauthorized.phase1.isAuthorized === true, 'Reautorização deve funcionar');
  console.log('  ✓ Reautorização concluída com sucesso.\n');

  // ---------------------------------------------------------------------------
  // Teste 8: Supabase indisponível bloqueia execução com mensagem clara
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 8: Supabase indisponível bloqueia execução');
  (supabaseServer as any).setDatabaseSimulatedUnavailable(true);

  const statusDbDown = await accelerator.getAcceleratorStatus();
  assert(statusDbDown.phase1.isAuthorized === false, 'Com banco offline, NÃO pode liberar execução');
  assert(statusDbDown.phase1.statusLabel === 'BLOQUEADA_POR_SEGURANCA', 'Label deve ser BLOQUEADA_POR_SEGURANCA');
  assert(statusDbDown.executionState.databaseAvailable === false, 'databaseAvailable deve ser false');

  let executionBlockedDbDown = false;
  try {
    await accelerator.executeNextMicrolot('test-admin');
  } catch (err: any) {
    executionBlockedDbDown = true;
  }
  assert(executionBlockedDbDown, 'Execução DEVE ser bloqueada se Supabase estiver offline');
  
  (supabaseServer as any).setDatabaseSimulatedUnavailable(false);
  console.log('  ✓ Bloqueio por segurança quando Supabase indisponível validado com sucesso.\n');

  // ---------------------------------------------------------------------------
  // Teste 9: Duas solicitações simultâneas não criam concorrência inconsistente
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 9: Proteção contra execuções concorrentes simultâneas');
  (accelerator as any).isExecuting = true;
  let concurrentBlocked = false;
  try {
    await accelerator.executeNextMicrolot('test-admin');
  } catch (err: any) {
    concurrentBlocked = true;
    assert(err.message.includes('concorrente bloqueada'), 'Mensagem de concorrência deve ser clara');
  }
  assert(concurrentBlocked, 'Segunda execução concorrente DEVE ser bloqueada pelo mutex');
  (accelerator as any).isExecuting = false;
  console.log('  ✓ Proteção mutex contra concorrência simultânea validada com sucesso.\n');

  // ---------------------------------------------------------------------------
  // Teste 10: Frontend nunca apresenta autorização não confirmada pelo servidor
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 10: Frontend e API não exibem autorização falsa');
  const liveStatus = await accelerator.getAcceleratorStatus();
  const rawDbRecord = await supabaseServer.getPhaseAuthorization(liveStatus.activePhase);
  if (!rawDbRecord || rawDbRecord.status !== 'AUTORIZADA' || rawDbRecord.revoked_at) {
    assert(liveStatus.phase1.isAuthorized === false, 'Se não comprovado no banco, isAuthorized deve ser falso');
  } else {
    assert(liveStatus.phase1.isAuthorized === true, 'Se comprovado e ativo no banco, isAuthorized deve ser verdadeiro');
  }
  console.log('  ✓ Sincronização estrita entre status exposto e registro do banco confirmada.\n');

  // ---------------------------------------------------------------------------
  // Teste 11: Cost Guard permanece ativo
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 11: Cost Guard permanece ativo e vigilante');
  const costConfig = googlePlacesCostGuard.getConfig();
  assert(costConfig.photosEnabled === false, 'Google Photos DEVE permanecer DESATIVADO');
  assert(costConfig.dailyRequestLimit > 0, 'Limite diário deve estar configurado');
  assert(costConfig.dailyBudgetBrl > 0, 'Orçamento diário deve estar configurado');
  console.log(`   • Cost Guard ativo: Diário=${costConfig.dailyRequestLimit} req, Orçamento=R$ ${costConfig.dailyBudgetBrl}, Fotos=${costConfig.photosEnabled ? 'SIM' : 'NÃO'}`);
  console.log('  ✓ Cost Guard 100% ativo e protegendo o projeto.\n');

  // ---------------------------------------------------------------------------
  // Teste 12: Zero chamadas externas ao Google Places realizadas nesta etapa
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 12: Nenhuma chamada Google externa realizada (0 chamadas)');
  const metrics = googlePlacesCostGuard.getMetrics(false);
  console.log(`   • Total de chamadas externas registradas hoje: ${metrics.callsToday} chamadas Google`);
  assert(metrics.callsToday === 0, 'Zero chamadas externas realizadas nesta etapa');
  console.log('  ✓ 0 chamadas externas realizadas nesta etapa.\n');

  console.log('===============================================================');
  console.log('🎉 TODOS OS 12 TESTES DA ETAPA 2 PASSARAM COM SUCESSO ABSOLUTO!');
  console.log('===============================================================');
}

runTestSuite().catch(err => {
  console.error('\n❌ ERRO NA SUÍTE DE TESTES DA ETAPA 2:', err);
  process.exit(1);
});
