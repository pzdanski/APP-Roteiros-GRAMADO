# Banco de Dados - Supabase PostgreSQL

## 1. Estratégia de Dados

O banco de dados principal do ecossistema é o **Supabase PostgreSQL**. O Firebase **não** é utilizado como banco de dados principal.

## 2. Tabelas Principais

- `travelers`: Cadastro do turista (e-mail, nome, telefone).
- `trips`: Viagem associada com `secure_token` único (ex: `v_4x9...`), status (`draft`, `preview`, `paid`, `archived`) e preço cobrado.
- `trip_preferences`: Preferências, datas, quantidade de adultos/crianças, idades, orçamento, hotel, transporte e ritmo.
- `trip_days`: Dias do roteiro, cidade foco, título temático e estimativa diária.
- `trip_activities`: Atividades em cada dia com horários, tempos de deslocamento e referências a locais.
- `trip_usage`: Controle diário de mensagens do Guia (teto de 30 msgs) e alterações estruturais (teto de 3 por dia).
- `places`: Catálogo oficial de locais turísticos (Gramado, Canela e Nova Petrópolis) com coordenadas, duração, tipo de clima (`indoor`, `outdoor`, `mixed`, `rain_ok`) e dicas Divulga Lugares.
- `place_prices`: Histórico e confirmação de preços com nível de confiança (`high`, `medium`, `low`, `unknown`) e data de checagem.
- `events`: Eventos âncora (Natal Luz, Sonho de Natal, Festival de Cinema, etc.).
- `payment_orders`: Cobranças Asaas (PIX / Cartão) com status e payload do webhook.
- `user_reports`: Relatos de usuários para auditoria da curadoria (divergência de preços ou horários).

## 3. Segurança e RLS (Row Level Security)

Todas as tabelas possuem RLS ativado:
- `places` e `events`: Acesso público para leitura (somente registros ativos).
- `trips`: Acesso condicionado ao `secure_token` da viagem.
- `payment_orders`: Restrito ao backend ou proprietário da sessão.
- Nenhuma `SERVICE_ROLE_KEY` é injetada no frontend.
