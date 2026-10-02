# DUO21 — Política de Dados Google Places API (New)

## 1. Visão Geral e Princípio de Arquitetura

O Roteiro Inteligente DUO21 opera com uma arquitetura **Cache-First e Supabase-First**. A Google Places API (New) **não** é o banco principal da aplicação, funcionando estritamente como um provedor externo de resolução inicial e enriquecimento sob demanda executado exclusivamente por administradores via `/duo-control`.

Turistas navegando no aplicativo **nunca** realizam consultas diretas ou automáticas à Google Places API. Todo o catálogo de atrações, restaurantes, cafés e hospedagens da Serra Gaúcha é servido a partir da base local de curadoria e do Supabase.

---

## 2. Classificação de Dados e Regras de Armazenamento

Conforme os Termos de Serviço da Google Maps Platform (Places API New) e boas práticas de arquitetura:

| Categoria de Dado | Exemplos no DUO21 | Política de Retenção | Justificativa / Termos Google |
| :--- | :--- | :--- | :--- |
| **Persistência Permitida** | `google_place_id`, `latitude`, `longitude`, dados de curadoria própria DUO21 (nome editado, preços manuais, descrições editoriais) | Indefinida no Supabase | O identificador único (`place_id`) e as coordenadas geográficas para roteirização interna e associação de registros são explicitamente permitidos para armazenamento persistente. |
| **Cache Temporário** | Horários de funcionamento regulares (`regularOpeningHours`), avaliações numéricas (`rating`, `userRatingCount`), status do negócio (`businessStatus`) | TTL de 24 horas a 30 dias (máx. 30 dias conforme TOS Google) | Dados operacionais e de reputação sofrem alterações e não devem ser mantidos indefinidamente sem sincronização. |
| **Referência Externa** | `websiteUri` (Site Oficial), `nationalPhoneNumber` (Telefone), `googleMapsUri` (Link Maps) | Armazenado como link de direcionamento | Links de utilidade pública para navegação e contato do turista. |
| **Revalidação Necessária** | Fechamento temporário ou definitivo (`businessStatus`), horários sazonais e feriados | Verificação periódica ou alerta administrativo | Exige conferência periódica (trimestral ou semestral) para evitar envio de turistas a estabelecimentos encerrados. |

---

## 3. Disciplina de FieldMasks

É **terminantemente proibido** solicitar todos os campos (`*`) na Places API (New). Todas as chamadas devem usar FieldMasks cirúrgicos para minimizar custo de SKU e consumo de banda:

1. **Resolução Inicial (Text Search):**
   - Mask: `places.id,places.displayName,places.formattedAddress,places.location`
   - SKU: *Text Search (ID Only / Basic)*
2. **Enriquecimento Detalhado (Place Details):**
   - Mask: `id,displayName,formattedAddress,location,regularOpeningHours,websiteUri,nationalPhoneNumber,rating,userRatingCount`
   - SKU: *Place Details (Atmosphere / Contact / Essentials)*
3. **Mídia e Fotos (Place Photos):**
   - Mask: `id,displayName,photos`
   - SKU: *Place Photos*

---

## 4. Prioridade Editorial e Proteção de Dados Locais

Em qualquer operação de sincronização ou enriquecimento:
1. **Fotos Manuais / DUO21:** Fotos adicionadas pela equipe DUO21 ou parceiros comerciais **nunca** são sobrescritas por fotos externas do Google.
2. **Preços e Ingressos:** A tabela de preços apurada pela curadoria DUO21 tem precedência absoluta sobre dados genéricos de faixa de preço do Google.
3. **Conteúdo Divulga Lugares:** Vídeos, Reels e dicas exclusivas permanecem intactos.

---

## 5. Cost Guard e Limites Operacionais

O `GooglePlacesCostGuard` atua no backend impondo travas rígidas de segurança financeira:
- `GOOGLE_PLACES_ENABLED=false` por padrão. Nenhuma chamada externa ocorre sem ativação explícita.
- Limite diário padrão: 50 requisições / R$ 10,00.
- Limite mensal padrão: 500 requisições / R$ 100,00.
- Telemetria e auditoria completa por requisição com mascaramento de chaves e segredos em logs.
