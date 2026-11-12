# Modelo de README de módulo

Copie o bloco abaixo para `src/estudos/modules/<nome>/README.md` e preencha. Mantenha curto: deve caber em uma tela. Seções sem conteúdo ficam com "Nenhum(a)." em vez de serem apagadas, para que todos os READMEs tenham a mesma forma.

---

```markdown
# Módulo `<nome>`

<Uma ou duas frases: o que este módulo faz e por que existe.>

## Responsável por
- ...

## Não é responsável por
- ... (→ módulo `<outro>`)

## Interface pública (`api.py`)
| Função / tipo | Caso de uso |
|---|---|
| `create_event` | Cria um evento na agenda do workspace |

## Tabelas que possui
| Model | Tabela | Observação |
|---|---|---|
| `Event` | `agenda_event` | `custom_fields` validado pelo `FieldTypeRegistry` |

## Depende de
- `workspaces` (via `workspaces.api`): model abstrato, verificação de papel

## Usado por
- `study` (via `agenda.api.list_week`)

## Eventos
- **Emite:** `EventCreated.v1` (a partir da Fase 2)
- **Consome:** Nenhum.

## Registros usados
- `FieldTypeRegistry` (campos customizados de `EventType`)

## Decisões e regras relevantes
- ADR-0008 (recorrência com RRULE)
- R-40 (UTC + fuso do workspace)

## Onde começar a ler
1. `services/create_event.py`: caso de uso principal
2. `domain/recurrence.py`: expansão de RRULE
```
