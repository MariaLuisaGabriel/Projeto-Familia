# Como contribuir

Este guia cobre o fluxo de trabalho e as convenções de código. As regras de arquitetura (R-xx) estão em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md); aqui ficam os hábitos que mantêm o código fácil de ler e de rastrear.

**Objetivo:** quem abre um módulo deve entender em poucos minutos o que ele faz, de quem depende, quem depende dele e onde procurar o resto.

---

## 1. Fluxo de trabalho

- **Kanban** no GitHub Projects, em ciclos de duas semanas que terminam com uma demonstração curta para os clientes. O plano dos ciclos está em [`docs/produto/roadmap.md`](docs/produto/roadmap.md).
- **Trunk-based:** `main` sempre implantável. Branches curtas (idealmente menos de 2 dias), com nome `tipo/descricao-curta` (`feat/gerador-linear`, `fix/fuso-agenda`, `docs/adr-0009`).
- **Todo PR é revisado pelo outro desenvolvedor.** Ninguém faz merge do próprio PR sem revisão, salvo correção urgente em produção (e aí a revisão acontece logo depois).
- **PRs pequenos.** Se a descrição precisa de mais de três parágrafos, provavelmente são dois PRs.
- **Antes de abrir o PR:** `make check` passando localmente (é o mesmo que o CI roda).
- **Decisão que contradiz a arquitetura:** pare e escreva um ADR (`docs/adr/0000-modelo.md`) antes de implementar.

### Commits

Mensagens em português, no imperativo, com prefixo do tipo:

```
feat(study): adiciona gerador linear
fix(agenda): corrige fuso em eventos recorrentes
docs(adr): registra ADR-0011 sobre Procrastinate
refactor, test, chore, ci — mesmo formato
```

O escopo entre parênteses é o módulo ou a área (`study`, `ui`, `registries`, `adr`).

### Revisão

O revisor confere, além da correção do código:

- as regras citadas no PR fazem sentido e não falta nenhuma óbvia;
- as convenções da seção 2 foram seguidas;
- o README do módulo e o `api.py` refletem a mudança;
- nenhum serviço atravessa relação para ler dados de outro módulo (`item.workspace.members...`), ponto que o CI ainda não pega (ver ARQUITETURA §13.2).

---

## 2. Convenções de código

### 2.1 Língua

- **Código em inglês:** nomes de variáveis, funções, classes, models, tabelas, chaves de registro e de template (`StudyItem`, `complete_review`, `"select"`).
- **Português** na interface, na documentação, nos ADRs, nas mensagens de commit e nos comentários.
- O módulo `agenda` mantém o nome (ver ARQUITETURA §3).
- Ao introduzir um termo de domínio novo, adicione a tradução em `docs/GLOSSARIO.md` (ex.: *revisão* → `review`, *disciplina* → `subject`). Assim, quem procura "revisão" na documentação sabe que deve buscar `review` no código.

### 2.2 Estrutura de um módulo

Siga ARQUITETURA §4.2. Em resumo, ao abrir um módulo, leia nesta ordem:

1. `README.md`: o que o módulo faz e como se liga ao resto;
2. `api.py`: tudo que outros módulos podem usar;
3. `services/`: um arquivo por caso de uso;
4. `domain/`: lógica pura, quando existir.

### 2.3 README de cada módulo

Todo módulo tem um `README.md` curto (cabe em uma tela), a partir do modelo em [`docs/guias/modelo-readme-modulo.md`](docs/guias/modelo-readme-modulo.md). As seções são fixas, para que todos os READMEs se leiam do mesmo jeito.

O README é atualizado **no mesmo PR** que muda o que ele descreve: nova função no `api.py`, nova tabela, nova dependência, novo evento.

### 2.4 `api.py`: a interface pública

- Declara `__all__` explicitamente. O que não está em `__all__` não é público.
- Cada função exportada tem uma docstring de uma ou duas linhas dizendo **o caso de uso**, não a implementação.
- Exporta funções de serviço, DTOs e eventos. **Nunca** models (R-03, R-04).

```python
"""Interface pública do módulo agenda. Única coisa importável por outros módulos (R-03)."""

from .services.create_event import create_event
from .services.list_week import list_week, WeekView

__all__ = ["create_event", "list_week", "WeekView"]
```

### 2.5 Um caso de uso por arquivo

`services/` tem um arquivo por caso de uso, nomeado com verbo + objeto: `services/create_event.py`, `services/complete_review.py`. A listagem da pasta funciona como a lista de funcionalidades do módulo.

Funções auxiliares usadas por vários casos de uso ficam em `services/_shared.py` (o `_` indica uso interno).

### 2.6 Registros: o nome do arquivo é a chave

Cada entrada de registro fica num arquivo com o mesmo nome da sua chave: `"select"` → `registries/field_types/select.py`, `"linear"` → `registries/generators/linear.py`. Chaves com hífen viram sublinhado no arquivo (`"multi-select"` → `multi_select.py`).

Quem lê um `template.json` e encontra `"type": "select"` sabe onde está o código sem precisar perguntar.

### 2.7 URLs sempre por nome (R-65)

Em templates, sempre `{% url %}`, inclusive em HTMX:

```html
<!-- certo -->
<button hx-post="{% url 'agenda:create_event' %}">Salvar</button>

<!-- errado: quebra em silêncio se a rota mudar -->
<button hx-post="/agenda/eventos/novo/">Salvar</button>
```

Em Python, `reverse("agenda:create_event")`. Toda `urls.py` define `app_name` igual ao nome do módulo.

### 2.8 Nada de comportamento invisível

- Sem Django signals para lógica de negócio (R-08).
- Sem descoberta automática de handlers ou registros por varredura de pastas: tudo é registrado explicitamente, numa linha que pode ser encontrada por busca.
- Sem `getattr` dinâmico ou import por string para escolher comportamento; use o registro correspondente.

### 2.9 Comentários e referências

- Cite regras (`R-35`) e ADRs (`ADR-0006`) **apenas** em decisões não óbvias, em que alguém poderia "consertar" o código e quebrar a regra. Não cite em toda função.
- Comentário explica o **porquê**. O **o quê** deve estar claro pelo nome.

### 2.10 Testes

- Testes do módulo ficam em `modules/<nome>/tests/`, com um arquivo por caso de uso (`test_complete_review.py`).
- O nome do teste descreve o comportamento: `test_complete_review_schedules_next_review_in_workspace_timezone`.
- Testes que atravessam módulos ficam em `tests/` na raiz (arquitetura, contratos, paridade, e2e).

---

## 3. Definição de pronto

Um item do Kanban só vai para **Concluído** quando:

- [ ] `make check` passa e o CI está verde
- [ ] o outro desenvolvedor revisou e aprovou
- [ ] testes cobrem o comportamento novo (e o caso de isolamento por workspace, se toca dados de usuário)
- [ ] README do módulo e `api.py` atualizados, se a interface mudou
- [ ] receita em `docs/EXTENDING.md` atualizada, se é uma extensão (R-54)
- [ ] ADR escrito, se a mudança exige (ARQUITETURA §15.1)
- [ ] está em produção ou pronto para a próxima demo
