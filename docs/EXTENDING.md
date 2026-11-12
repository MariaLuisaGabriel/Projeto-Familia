# Receitas de extensão

> **R-54:** toda extensão de um tipo listado na ARQUITETURA §13.1 **DEVE** seguir a receita correspondente aqui. Se a receita não existir, ela **DEVE** ser escrita no mesmo PR da primeira extensão daquele tipo.

Receitas marcadas com *(a escrever)* ainda não têm o primeiro exemplo no código. Quem fizer a primeira extensão daquele tipo escreve a receita a partir do que fez. Quando houver dois ou três exemplos, a receita vira modelo de scaffolding (R-57).

---

## 1. Módulo novo

**Esforço:** médio · **Regras:** R-01 a R-06, R-56 · **Exige ADR** (ARQUITETURA §15.1)

1. Escreva o ADR justificando o módulo e onde ele entra na matriz de dependências (§4.3).
2. Crie `src/estudos/modules/<nome>/` com a estrutura da ARQUITETURA §4.2, a partir do módulo de referência (R-56). Até existir `agenda`, use `identity` como exemplo de forma:
   - `__init__.py` vazio;
   - `apps.py` com `name = "estudos.modules.<nome>"` e `label = "<nome>"`;
   - `api.py` com `__all__` explícito;
   - `README.md` a partir de [`guias/modelo-readme-modulo.md`](guias/modelo-readme-modulo.md);
   - `urls.py` com `app_name = "<nome>"` (R-65), se tiver telas.
3. Registre o módulo:
   - em `INSTALLED_APPS` (`config/settings/base.py`);
   - em `containers` do contrato de camadas no `pyproject.toml`;
   - em `ALLOWED` de `tests/architecture/test_module_matrix.py`, se ainda não estiver.
4. Rode `make check`.

## 2. Template de área novo

**Esforço:** baixo · **Toca código?** Não · **Regras:** R-12 a R-14, R-51

*(a escrever na etapa 2 da Fase 0, junto com o meta-schema)*

## 3. Tipo de campo (`FieldTypeRegistry`)

**Esforço:** baixo · **Regras:** R-20 a R-23

*(a escrever na etapa 2 da Fase 0, com os primeiros tipos: `text`, `number`, `select`, `date`, `boolean`)*

Lembretes que já valem: o arquivo tem o nome da chave (`select.py`, CONTRIBUTING §2.6); validador e templates HTML ficam na mesma entrada (ARQUITETURA §7.1).

## 4. Gerador (`GeneratorRegistry`)

**Esforço:** baixo a médio · **Regras:** R-22 a R-24

*(a escrever na Fase 0, com o gerador `linear`)*

Lembrete que já vale: geradores são determinísticos (R-24) e vivem em `domain/`, sem Django.

## 5. Widget, gatilho, condição ou ação

*(a escrever nas Fases 2 e 4)*

## 6. Entidade nova no núcleo

**Esforço:** médio a alto · **Regras:** R-10, R-55 · **Exige ADR**

Siga a checklist da ARQUITETURA §13.3 por inteiro.
