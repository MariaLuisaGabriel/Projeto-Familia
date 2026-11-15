# Glossário: termos de domínio → nomes no código

O código é escrito em inglês; a interface e a documentação, em português (CONTRIBUTING §2.1). Esta tabela faz a ponte: para achar no código algo que você conhece pelo nome em português, procure a coluna "No código".

Conceitos de arquitetura (outbox, registro, hexagonal leve...) estão definidos na [ARQUITETURA §19](ARQUITETURA.md#19-glossário).

Ao introduzir um termo novo no código, adicione a linha aqui no mesmo PR.

| Termo (português) | No código | Módulo | Observação |
|---|---|---|---|
| Usuário, conta | `User` | `identity` | Login por e-mail |
| Workspace, espaço de estudo | `Workspace` | `workspaces` | Mantido em inglês também na interface |
| Membro, papel | `Membership`, `Role` | `workspaces` | Papéis: `owner`, `editor`, `viewer` |
| Template de área | `AreaTemplate` | `workspaces` | Pasta `area_templates/`. Não confundir com template HTML |
| Agenda | módulo `agenda` | `agenda` | Nome do módulo mantido em português |
| Tipo de evento | `EventType` | `agenda` | Ex.: aula, plantão, simulado |
| Evento, compromisso | `Event` | `agenda` | |
| Recorrência | `rrule` | `agenda` | RFC 5545 (ADR-0008) |
| Disciplina | `Subject` | `study` | |
| Tópico, assunto | `Topic` | `study` | |
| Tipo de item | `ItemType` | `study` | Ex.: revisão, leitura |
| Item de estudo | `StudyItem` | `study` | |
| Revisão | `review` | `study` / `practice` | Item de estudo em `study`; revisão de cartão em `practice` |
| Cronograma | `schedule` | `study` | Gerado por um gerador |
| Gerador | `Generator` | `registries` | Ex.: `linear`, `weighted` |
| Questão | `Question` | `practice` | |
| Tentativa, resposta | `Attempt` | `practice` | |
| Cartão | `Card` | `practice` | Repetição espaçada (FSRS) |
| Anotação, nota | `Note` | `notes` | |
| Meta | `Goal` | a definir | |
| Regra (automação) | `Rule` | `rules` | |
| Campo customizado | `custom_fields` | todos | Coluna `JSONField` (R-36) |

Os nomes de módulos futuros e das entidades ainda não implementadas são a intenção atual; confirme na implementação e corrija aqui se mudarem.
