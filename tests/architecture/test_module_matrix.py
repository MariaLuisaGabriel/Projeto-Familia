"""R-03, R-04 e R-05: dependências entre módulos seguem a matriz da ARQUITETURA §4.3.

- Um módulo só importa outro módulo pelo `api.py` público (R-03).
- A dependência precisa estar permitida na matriz abaixo (R-05).
- `ForeignKey` por referência textual ("app.Model") também precisa estar na matriz (R-04),
  porque não aparece como import.

Ao mudar a matriz, atualize também a ARQUITETURA §4.3 (exige ADR).
"""

import re

import grimp

from ._paths import MODULES, REPO_ROOT

# Linha pode depender de coluna (ARQUITETURA §4.3).
ALLOWED: dict[str, set[str]] = {
    "identity": set(),
    "workspaces": {"identity"},
    "agenda": {"identity", "workspaces"},
    "study": {"identity", "workspaces", "agenda"},
    "practice": {"identity", "workspaces", "study"},
    "notes": {"identity", "workspaces"},
    "rules": {"identity", "workspaces", "agenda", "study", "practice", "notes"},
    "analytics": {"identity", "workspaces"},
}

PREFIX = "estudos.modules."
STRING_RELATION = re.compile(
    r"""(?:ForeignKey|OneToOneField|ManyToManyField)\(\s*["'](\w+)\.\w+["']"""
)


def _module_of(name: str) -> str | None:
    if not name.startswith(PREFIX):
        return None
    return name.removeprefix(PREFIX).split(".")[0]


def _existing_modules() -> list[str]:
    return sorted(p.name for p in MODULES.iterdir() if (p / "apps.py").exists())


def test_every_module_is_declared_in_matrix():
    undeclared = set(_existing_modules()) - ALLOWED.keys()
    assert not undeclared, f"Módulos fora da matriz da §4.3: {undeclared}"


def test_imports_between_modules_follow_matrix_and_public_api():
    graph = grimp.build_graph("estudos")
    violations: list[str] = []

    for importer in sorted(graph.modules):
        source = _module_of(importer)
        if source is None:
            continue
        for imported in graph.find_modules_directly_imported_by(importer):
            target = _module_of(imported)
            if target is None or target == source:
                continue
            if target not in ALLOWED.get(source, set()):
                violations.append(
                    f"{importer} -> {imported}: {source} não pode depender de {target} (R-05)"
                )
            elif imported != f"{PREFIX}{target}.api":
                violations.append(
                    f"{importer} -> {imported}: importe apenas {PREFIX}{target}.api (R-03)"
                )

    assert not violations, "\n".join(violations)


def test_string_relations_follow_matrix():
    violations: list[str] = []

    for module in _existing_modules():
        for path in (MODULES / module).rglob("*.py"):
            if "migrations" in path.parts:
                continue
            for target in STRING_RELATION.findall(path.read_text(encoding="utf-8")):
                if target != module and target in ALLOWED and target not in ALLOWED[module]:
                    violations.append(
                        f"{path.relative_to(REPO_ROOT)}: relação com {target} fora da matriz (R-04)"
                    )

    assert not violations, "\n".join(violations)
