# ESPECIFICAÇÃO DE INFRAESTRUTURA: GOOGLE CLOUD TASKS
## Catalog Accelerator — Execução Durável em Cloud Run Multinstância
**Sprint 10D — Release Gate P0**

---

### 1. Visão Geral
Para garantir que a execução de microlotes de enriquecimento não dependa da permanência do navegador aberto ou de requisições HTTP síncronas de longa duração no Cloud Run (que sofrem com timeouts de requisição e encerramento de contêineres), a arquitetura utiliza o **Google Cloud Tasks** como fila de despacho assíncrono desacoplada.

```
[Administrador /duo-control]
           │
           ▼ (POST /api/admin/accelerator/execute-microlot)
[Cloud Run: Instância Web]
           │
           ├── 1. Adquire Lease Distribuído no Supabase
           ├── 2. Registra Execution (Status: QUEUED)
           └── 3. Enfileira Tarefa no Cloud Tasks ────────────────┐
                                                                 │
                                                                 ▼
                                                  [Cloud Tasks Queue: catalog-accelerator-queue]
                                                                 │ (Disparo assíncrono com retry controlado)
                                                                 ▼ (POST /api/internal/tasks/process-microlot)
                                                  [Cloud Run: Instância Worker]
                                                                 │
                                                                 ├── 4. Valida Lease & Zombie Worker Check
                                                                 ├── 5. Processa Itens (Max 10 / microlote)
                                                                 ├── 6. Salva Checkpoints granulares no Supabase
                                                                 └── 7. Libera Lease (Status: COMPLETED)
```

---

### 2. Recursos GCP Necessários
1. **Cloud Tasks API:** `cloudtasks.googleapis.com` habilitada no projeto `roteiro-ia-510021`.
2. **Cloud Tasks Queue:** `catalog-accelerator`
   - Região: `southamerica-east1` (São Paulo, Brasil).
   - Concorrência máxima: `1` despacho simultâneo por fase para respeitar limites do Cost Guard.
3. **Service Account Dedicada:** `catalog-worker-invoker@roteiro-ia-510021.iam.gserviceaccount.com`

---

### 3. Service Account e Permissões Mínimas (Princípio do Menor Privilégio)
* **Para a aplicação Cloud Run (Service Account do Runtime do App):**
  - Papel: `roles/cloudtasks.enqueuer` (apenas permissão para enfileirar tarefas na fila `catalog-accelerator`).
  - Papel: `roles/iam.serviceAccountUser` na service account `catalog-worker-invoker`.
* **Para a Service Account do Worker Invoker (`catalog-worker-invoker`):**
  - Papel no Cloud Run: `roles/run.invoker` concedido estritamente para invocar o serviço `duo21-app` (ou URL do Cloud Run).
  - Nenhuma permissão em outros serviços ou dados.

---

### 4. Variáveis de Ambiente Necessárias no Cloud Run
```env
# Google Cloud Project & Cloud Tasks (Produção)
GCP_PROJECT_ID=roteiro-ia-510021
GOOGLE_CLOUD_PROJECT=roteiro-ia-510021
CLOUD_TASKS_LOCATION=southamerica-east1
CLOUD_TASKS_QUEUE=catalog-accelerator
CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=catalog-worker-invoker@roteiro-ia-510021.iam.gserviceaccount.com
CLOUD_RUN_SERVICE_URL=https://<SUA_URL_CLOUDRUN>.run.app
CLOUD_RUN_AUDIENCE=https://<SUA_URL_CLOUDRUN>.run.app
INTERNAL_TASKS_SECRET=<GERAR_TOKEN_ALEATORIO_64_CHARS>
```

---

### 5. Endpoint Interno Protegido
* **Rota:** `POST /api/internal/tasks/process-microlot`
* **Autenticação Dupla:**
  1. Google OIDC Token via cabeçalho `Authorization: Bearer <ID_TOKEN>` gerado automaticamente pelo Cloud Tasks via service account `catalog-worker-invoker`.
  2. Cabeçalho compartilhado `x-internal-tasks-secret` validado server-side.
  3. Rejeição com `401 Unauthorized` para qualquer visitante anônimo ou requisição sem credenciais.

---

### 6. Política de Retry e Idempotência
* **Configuração da Fila Cloud Tasks:**
  - `max-attempts`: 3 tentativas.
  - `min-backoff`: 10s.
  - `max-backoff`: 60s.
  - `max-doublings`: 2.
  - `max-concurrent-dispatches`: 1.
* **Idempotência por Nome da Tarefa (Task Name):**
  - Nome da tarefa: `projects/<PROJECT_ID>/locations/<LOCATION>/queues/<QUEUE>/tasks/microlot-<executionId>`
  - O Cloud Tasks descarta tarefas duplicadas com mesmo nome dentro do período de retenção (evita enfileiramento repetido).
* **Idempotência no Banco (Supabase):**
  - O endpoint interno consulta `getExecution(executionId)`: se o status já for `COMPLETED`, responde `200 OK` imediatamente sem reprocessar.
  - Checkpoints individuais por item garantem que qualquer retomada continue a partir do próximo item pendente.

---

### 7. Custos Potenciais
* **Google Cloud Tasks:**
  - Franquia gratuita mensal oficial: **1 milhão de tarefas/mês**.
  - Acima da franquia: $0.40 por milhão de tarefas.
  - Volume esperado do Catalog Accelerator: ~50 a 200 tarefas/mês.
  - **Custo estimado Cloud Tasks: R$ 0,00 / mês.**
* **Cloud Run:**
  - Franquia gratuita mensal: 2 milhões de requisições, 360.000 vCPU-segundos, 180.000 GiB-segundos.
  - Cada microlote de 10 itens dura ~5 a 15 segundos de CPU.
  - **Custo estimado Cloud Run: R$ 0,00 (absorvido no Free Tier).**
