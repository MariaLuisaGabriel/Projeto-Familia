"""Entidades e carregamento declarativo de templates de área (Python puro — R-01, R-15)."""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class FieldSpec:
    """Especificação de um campo customizado definido no template."""

    key: str
    label: str
    field_type: str
    analyzable: bool = False
    options: tuple[str, ...] = ()
    min_value: int | None = None
    max_value: int | None = None


@dataclass(frozen=True)
class EventTypeSpec:
    """Tipo de compromisso configurado no workspace (ex.: aula, bloco prático)."""

    key: str
    label: str
    icon: str
    color: str
    default_duration_min: int
    fields: tuple[FieldSpec, ...] = ()


@dataclass(frozen=True)
class ItemTypeSpec:
    """Tipo de item de estudo configurado no workspace."""

    key: str
    label: str
    icon: str
    fields: tuple[FieldSpec, ...] = ()


@dataclass(frozen=True)
class TopicSeedSpec:
    """Tópico inicial dentro de uma disciplina da taxonomia."""

    key: str
    title: str
    weight: int = 1


@dataclass(frozen=True)
class SubjectSeedSpec:
    """Disciplina inicial da árvore de conteúdo do template."""

    key: str
    title: str
    color: str
    topics: tuple[TopicSeedSpec, ...] = ()


@dataclass(frozen=True)
class GeneratorConfigSpec:
    """Configuração de gerador declarada no template."""

    kind: str
    items_per_week: int = 4
    item_type_key: str = "estudo"


@dataclass(frozen=True)
class WidgetCardView:
    """Representação pronta para exibição de um widget do painel (L-05, R-42)."""

    spec: str
    base_key: str
    param: str | None
    title: str
    subtitle: str
    metric_value: str
    badge_text: str


def _empty_event_types() -> list[EventTypeSpec]:
    return []


def _empty_item_types() -> list[ItemTypeSpec]:
    return []


def _empty_taxonomy() -> list[SubjectSeedSpec]:
    return []


def _empty_generators() -> list[GeneratorConfigSpec]:
    return []


def _empty_str_list() -> list[str]:
    return []


def _default_active_modules() -> list[str]:
    return ["workspaces", "agenda", "study"]


@dataclass
class WorkspaceSnapshot:
    """Cópia versionada dos metadados de um template instanciado em um workspace (R-15)."""

    workspace_id: str
    name: str
    template_id: str
    template_version: str
    description: str
    timezone: str
    event_types: list[EventTypeSpec] = field(default_factory=_empty_event_types)
    item_types: list[ItemTypeSpec] = field(default_factory=_empty_item_types)
    taxonomy: list[SubjectSeedSpec] = field(default_factory=_empty_taxonomy)
    generators: list[GeneratorConfigSpec] = field(default_factory=_empty_generators)
    dashboard_specs: list[str] = field(default_factory=_empty_str_list)
    active_modules: list[str] = field(default_factory=_default_active_modules)


def _parse_fields(raw_fields: list[dict[str, Any]]) -> tuple[FieldSpec, ...]:
    result: list[FieldSpec] = []
    for item in raw_fields:
        opts = tuple(str(o) for o in item.get("options", []))
        min_raw = item.get("min")
        max_raw = item.get("max")
        result.append(
            FieldSpec(
                key=str(item.get("key", "")),
                label=str(item.get("label") or item.get("key", "")),
                field_type=str(item.get("type", "text")),
                analyzable=bool(item.get("analyzable", False)),
                options=opts,
                min_value=int(min_raw) if isinstance(min_raw, int) else None,
                max_value=int(max_raw) if isinstance(max_raw, int) else None,
            )
        )
    return tuple(result)


def load_area_templates(repo_root: Path) -> list[WorkspaceSnapshot]:
    """Lê todos os pacotes em `area_templates/*/template.json` e cria snapshots isolados."""
    templates_dir = repo_root / "area_templates"
    snapshots: list[WorkspaceSnapshot] = []
    if not templates_dir.exists():
        return snapshots

    for folder in sorted(templates_dir.iterdir()):
        manifest_path = folder / "template.json"
        if not folder.is_dir() or not manifest_path.exists():
            continue
        raw: dict[str, Any] = json.loads(manifest_path.read_text(encoding="utf-8"))
        tpl_id = str(raw.get("id", folder.name))

        event_types = [
            EventTypeSpec(
                key=str(et.get("key", "")),
                label=str(et.get("label", "")),
                icon=str(et.get("icon", "calendar")),
                color=str(et.get("color", "#1f5fa8")),
                default_duration_min=int(et.get("defaultDurationMin", 60)),
                fields=_parse_fields(et.get("fields", [])),
            )
            for et in raw.get("eventTypes", [])
        ]

        item_types = [
            ItemTypeSpec(
                key=str(it.get("key", "")),
                label=str(it.get("label", "")),
                icon=str(it.get("icon", "book")),
                fields=_parse_fields(it.get("fields", [])),
            )
            for it in raw.get("itemTypes", [])
        ]

        taxonomy = [
            SubjectSeedSpec(
                key=str(sub.get("key", "")),
                title=str(sub.get("title", "")),
                color=str(sub.get("color", "#3B5249")),
                topics=tuple(
                    TopicSeedSpec(
                        key=str(top.get("key", "")),
                        title=str(top.get("title", "")),
                        weight=int(top.get("weight", 1)),
                    )
                    for top in sub.get("topics", [])
                ),
            )
            for sub in raw.get("taxonomy", [])
        ]

        generators = [
            GeneratorConfigSpec(
                kind=str(gen.get("kind", "linear")),
                items_per_week=int(gen.get("params", {}).get("itemsPerWeek", 4)),
                item_type_key=str(
                    gen.get("params", {}).get(
                        "itemTypeKey",
                        item_types[0].key if item_types else "estudo",
                    )
                ),
            )
            for gen in raw.get("generators", [])
        ]

        snapshots.append(
            WorkspaceSnapshot(
                workspace_id=f"ws-{tpl_id}",
                name=str(raw.get("name", tpl_id)),
                template_id=tpl_id,
                template_version=str(raw.get("version", "1.0.0")),
                description=str(raw.get("description", "")),
                timezone="America/Sao_Paulo",
                event_types=event_types,
                item_types=item_types,
                taxonomy=taxonomy,
                generators=generators,
                dashboard_specs=[str(w) for w in raw.get("dashboard", [])],
            )
        )

    return snapshots
