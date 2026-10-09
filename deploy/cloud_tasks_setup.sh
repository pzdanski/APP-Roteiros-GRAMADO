#!/usr/bin/env bash
# ==============================================================================
# SPRINT 10D RELEASE GATE P0: SCRIPT DE CONFIGURAÇÃO DO GOOGLE CLOUD TASKS
# USO: Não executar automaticamente. Para uso do operador de infraestrutura.
# ==============================================================================

set -euo pipefail

# 1. Configurações base (Sprint 10D Finalização)
PROJECT_ID="${GCP_PROJECT_ID:-roteiro-ia-510021}"
REGION="${CLOUD_TASKS_LOCATION:-southamerica-east1}"
QUEUE_NAME="${CLOUD_TASKS_QUEUE:-catalog-accelerator}"
SERVICE_ACCOUNT_NAME="catalog-worker-invoker"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
CLOUD_RUN_SERVICE_NAME="${CLOUD_RUN_SERVICE_NAME:-duo21-app}"

echo "=== Configurando Cloud Tasks para Catalog Accelerator ==="
echo "Projeto: ${PROJECT_ID}"
echo "Região: ${REGION}"
echo "Fila: ${QUEUE_NAME}"

# 2. Habilita API do Cloud Tasks
echo "▶ Habilitando Cloud Tasks API..."
gcloud services enable cloudtasks.googleapis.com --project="${PROJECT_ID}"

# 3. Cria Service Account dedicada para invocação segura
echo "▶ Criando Service Account do Worker..."
if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT_EMAIL}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --display-name="Catalog Accelerator Worker Invoker" \
    --project="${PROJECT_ID}"
fi

# 4. Concede permissão de invocar o Cloud Run à Service Account (roles/run.invoker)
echo "▶ Concedendo roles/run.invoker no Cloud Run..."
gcloud run services add-iam-policy-binding "${CLOUD_RUN_SERVICE_NAME}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/run.invoker" \
  --region="${REGION}" \
  --project="${PROJECT_ID}"

# 5. Concede permissão para a Service Account do App enfileirar no Cloud Tasks
APP_SA="$(gcloud run services describe "${CLOUD_RUN_SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || echo '')"
if [ -n "${APP_SA}" ]; then
  echo "▶ Concedendo roles/cloudtasks.enqueuer à Service Account do App (${APP_SA})..."
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${APP_SA}" \
    --role="roles/cloudtasks.enqueuer"
  
  echo "▶ Concedendo roles/iam.serviceAccountUser na Service Account do Worker..."
  gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT_EMAIL}" \
    --member="serviceAccount:${APP_SA}" \
    --role="roles/iam.serviceAccountUser" \
    --project="${PROJECT_ID}"
fi

# 6. Cria a fila Cloud Tasks com limites estritos de concorrência e retry
echo "▶ Criando fila Cloud Tasks '${QUEUE_NAME}' em '${REGION}'..."
if ! gcloud tasks queues describe "${QUEUE_NAME}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud tasks queues create "${QUEUE_NAME}" \
    --location="${REGION}" \
    --max-attempts=3 \
    --min-backoff=10s \
    --max-backoff=60s \
    --max-doublings=2 \
    --max-concurrent-dispatches=1 \
    --project="${PROJECT_ID}"
else
  echo "Fila ${QUEUE_NAME} já existe. Atualizando configurações..."
  gcloud tasks queues update "${QUEUE_NAME}" \
    --location="${REGION}" \
    --max-attempts=3 \
    --min-backoff=10s \
    --max-backoff=60s \
    --max-doublings=2 \
    --max-concurrent-dispatches=1 \
    --project="${PROJECT_ID}"
fi

echo "=== Configuração do Cloud Tasks concluída com sucesso! ==="
