# Roadmap

> **Atualizado em:** 12/11/2026 · **Revisão:** ao fim de cada ciclo, depois da demo.
>
> O escopo de cada fase e as regras que passam a valer estão em [`ARQUITETURA.md` §17](../ARQUITETURA.md#17-implementação-por-fases). Este documento trata do **quando** e do **quem**.

## Premissas

- **Equipe:** 2 desenvolvedores, chamados aqui de **Dev A** (domínio e geradores) e **Dev B** (fundação, interface e infraestrutura). A divisão segue ARQUITETURA §17.1.
- **Ciclos de 2 semanas**, de segunda a sexta, terminando com uma demo curta para os clientes.
- **As datas são estimativas.** A capacidade real da equipe ainda não foi medida. Ao fim do ciclo 2, recalibrar as datas da Fase 0 com a velocidade observada.
- **Fases 1 a 4 têm horizonte indicativo**, sem ciclos detalhados. Cada fase é detalhada aqui quando a anterior estiver na metade.

---

## Fase 0 — MVP

**Meta:** a primeira cliente usando a versão real, no celular e no computador, com os dados do cronograma importados do protótipo.
**Previsão:** fim de fevereiro de 2027.

| Ciclo | Período | Dev A | Dev B | Demo para clientes |
|---|---|---|---|---|
| **C1** | 16/11 – 27/11/2026 | **Etapa 1:** protótipo em `area_templates/residencia-medica/fixtures/`, `cronograma.json` e `semanas-esperadas.json` extraídos, teste de paridade escrito (falhando) | **Etapa 0:** `pyproject.toml`, Docker Compose, `Makefile`, CI (ruff, pyright, pytest, import-linter), app `identity` com usuário próprio + allauth (R-63), ADRs 0009–0012 | Teste de paridade vermelho, mostrando o que significa "pronto" |
| **C2** | 30/11 – 11/12/2026 | **Etapa 2:** meta-schema em Pydantic, `FieldTypeRegistry` (`text`, `number`, `select`, `date`, `boolean`), `template.json` da residência validando; gerador `linear` no domínio | Layout base acessível (`ui/`), telas de login e cadastro, lint de templates (R-49, R-65), escolha da hospedagem | Login funcionando; template validando |
| **C3** | 14/12/2026 – 08/01/2027 *(inclui festas, capacidade reduzida)* | **Etapa 3:** model abstrato com `for_workspace` (R-34, R-35), workspace, membros e papéis, instanciação por cópia versionada (R-15) | Models e serviços de `agenda` (eventos, recorrência com `dateutil.rrule`) | **Marco:** teste de paridade verde |
| **C4** | 11/01 – 22/01/2027 | Importador do `cronograma.json` (R-41); `study` (disciplinas, tópicos, itens) | **Etapa 4:** telas HTMX da agenda, testes de isolamento por workspace | Cronograma da cliente importado e visível na agenda |
| **C5** | 25/01 – 05/02/2027 | **Etapa 4:** telas HTMX de `study` (itens do dia, concluir revisão) | **Etapa 5:** formulários gerados pelos metadados, manifest, service worker com cache de leitura limitado (R-46) | App instalável no celular da cliente (ambiente de homologação) |
| **C6** | 08/02 – 19/02/2027 *(Carnaval em 08–09/02)* | Customização da camada 1 (rótulos, cores, taxonomia); ajustes da demo anterior | **Etapa 6:** deploy em produção, backup diário com restauração testada (R-64), política de privacidade (R-52), `docs/guias/deploy.md` | **Marco:** primeira cliente em produção |
| **C7** | 22/02 – 05/03/2027 | Folga para estabilização: bugs do uso real, ajustes de usabilidade, dívida registrada nos ciclos anteriores | ← mesmo | Retrospectiva da Fase 0 e planejamento da Fase 1 |

### Marcos da Fase 0

| Marco | Critério verificável | Previsão |
|---|---|---|
| Fundação pronta | `make check` verde no CI em `main` | fim do C1 |
| Especificação executável | teste de paridade existe e falha pelo motivo certo | fim do C1 |
| Paridade | gerador `linear` produz as mesmas semanas do protótipo | fim do C3 |
| Dados reais | `cronograma.json` da cliente importado sem perda | fim do C4 |
| Em produção | cliente usando no celular e no computador, backup restaurado com sucesso pelo menos uma vez | fim do C6 |

### Decisões pendentes na Fase 0

| Decisão | Quem | Até |
|---|---|---|
| Hospedagem (provedor, região, custo mensal) | Dev B, com aprovação dos dois | fim do C2 |
| Período de retenção de dados e de backups (LGPD) | os dois | fim do C5 |
| Data em que o cronograma da cliente precisa estar no app (ver riscos) | conversa com a cliente | C1 |

---

## Fases seguintes (horizonte indicativo)

| Fase | Escopo resumido | Duração estimada | Janela indicativa |
|---|---|---|---|
| **1 — Segundo template** | Template `concurso-publico`, gerador `weighted`, convites e papéis no workspace, matriz de dependências completa no CI | 3 ciclos | mar – abr/2027 |
| **2 — Prática** | `practice` (questões, tentativas, FSRS), `analytics`, widgets de desempenho, outbox e worker com Procrastinate | 4 a 5 ciclos | mai – jul/2027 |
| **3 — Customização avançada** | Tipos e campos do usuário (camada 2), `notes`, templates compartilháveis, exportação `.ics`, scaffolding com Copier | 5 a 6 ciclos | 2º semestre/2027 |
| **4 — Automação** | `rules`: motor de regras (camada 3) | a definir | depois da Fase 3 |

A ordem entre as Fases 2 e 3 pode mudar conforme o que os clientes pedirem nas demos. A troca é decidida na retrospectiva da fase anterior e registrada aqui.

### Itens sem fase fixa

- **Offline de escrita:** reavaliar depois de um mês de uso real da Fase 0. Só entra com ADR (R-46).
- **API JSON / app nativo:** só se surgir demanda concreta (ARQUITETURA §18).

---

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| O cronograma da cliente já está em andamento e o MVP chega tarde para ser útil | Alto | Confirmar no C1 em que data ela precisa do app. Se for antes de fevereiro, antecipar o importador (C3) e entregar uma versão só de leitura da agenda antes do resto |
| Estimativas otimistas (capacidade não medida, festas e Carnaval no meio) | Médio | Recalibrar no fim do C2; o C7 existe como folga |
| A extração do `cronograma.json` revela regras do protótipo que o gerador `linear` não cobre | Médio | É exatamente o que a etapa 1 deve revelar cedo; se acontecer, registrar ADR antes de ampliar o gerador |
| Ficar sem rede no plantão impede registrar estudo | Médio | Fora de escopo na Fase 0 (R-46); coletar relatos reais da cliente para embasar o ADR de offline |
| Dependência de uma pessoa só por área (domínio × interface) | Médio | Revisão cruzada obrigatória em todo PR; os dois trabalham juntos na etapa 4 |

---

## Histórico de revisões

| Data | Mudança |
|---|---|
| 12/11/2026 | Versão inicial |
