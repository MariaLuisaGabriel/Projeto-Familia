"""Caso de uso: obter o workspace ativo e construir os widgets do painel (R-15, R-42)."""

from django.conf import settings

from ..domain.template_loader import (
    WidgetCardView,
    WorkspaceSnapshot,
    load_area_templates,
)

_WORKSPACE_CACHE: dict[str, WorkspaceSnapshot] = {}


def _ensure_loaded() -> dict[str, WorkspaceSnapshot]:
    if not _WORKSPACE_CACHE:
        for snap in load_area_templates(settings.BASE_DIR):
            _WORKSPACE_CACHE[snap.workspace_id] = snap
    return _WORKSPACE_CACHE


def list_workspaces() -> list[WorkspaceSnapshot]:
    """Lista todos os workspaces instanciados a partir dos templates de área disponíveis."""
    return list(_ensure_loaded().values())


def get_active_workspace(workspace_id: str | None = None) -> WorkspaceSnapshot:
    """Retorna o workspace solicitado (ou o primeiro disponível como padrão)."""
    store = _ensure_loaded()
    if workspace_id and workspace_id in store:
        return store[workspace_id]
    first = next(iter(store.values()), None)
    if first is None:
        return WorkspaceSnapshot(
            workspace_id="ws-default",
            name="Workspace Padrão",
            template_id="default",
            template_version="1.0.0",
            description="Workspace genérico inicial.",
            timezone=settings.DEFAULT_WORKSPACE_TIMEZONE,
        )
    return first


def build_dashboard_widgets(
    workspace: WorkspaceSnapshot,
    *,
    completed_items: int = 0,
    total_items: int = 0,
    events_count_by_type: dict[str, int] | None = None,
) -> list[WidgetCardView]:
    """Monta os cartões de widgets declarados no metadado `dashboard` do workspace (L-05)."""
    counts = events_count_by_type or {}
    total_topics = sum(len(s.topics) for s in workspace.taxonomy)
    pct = round((completed_items / total_items) * 100) if total_items > 0 else 0
    cards: list[WidgetCardView] = []

    for spec in workspace.dashboard_specs:
        parts = spec.split(":", 1)
        base_key = parts[0]
        param = parts[1] if len(parts) > 1 else None

        if base_key == "progress":
            cards.append(
                WidgetCardView(
                    spec=spec,
                    base_key=base_key,
                    param=None,
                    title="Progresso do Cronograma",
                    subtitle=f"{completed_items} de {total_items} itens concluídos",
                    metric_value=f"{pct}%",
                    badge_text="progresso",
                )
            )
        elif base_key == "events-of-type" and param:
            et_label = next(
                (et.label for et in workspace.event_types if et.key == param),
                param,
            )
            cards.append(
                WidgetCardView(
                    spec=spec,
                    base_key=base_key,
                    param=param,
                    title=et_label,
                    subtitle="Compromissos registrados deste tipo",
                    metric_value=str(counts.get(param, 0)),
                    badge_text=param,
                )
            )
        elif base_key == "upcoming" and param:
            et_label = next(
                (et.label for et in workspace.event_types if et.key == param),
                param,
            )
            cards.append(
                WidgetCardView(
                    spec=spec,
                    base_key=base_key,
                    param=param,
                    title=f"Próximos: {et_label}",
                    subtitle="Agenda futura filtrada por tipo",
                    metric_value=str(counts.get(param, 0)),
                    badge_text=f"agenda:{param}",
                )
            )
        elif base_key == "hours-by-subject":
            cards.append(
                WidgetCardView(
                    spec=spec,
                    base_key=base_key,
                    param=None,
                    title="Disciplinas e Tópicos",
                    subtitle=f"{total_topics} tópicos distribuídos na taxonomia",
                    metric_value=f"{len(workspace.taxonomy)} áreas",
                    badge_text="taxonomia",
                )
            )
        elif base_key == "accuracy-by-topic":
            cards.append(
                WidgetCardView(
                    spec=spec,
                    base_key=base_key,
                    param=None,
                    title="Desempenho por Tópico",
                    subtitle="Acompanhamento de revisões e questões",
                    metric_value=f"{total_topics} tópicos",
                    badge_text="análise",
                )
            )
        elif base_key == "countdown":
            cards.append(
                WidgetCardView(
                    spec=spec,
                    base_key=base_key,
                    param=param,
                    title="Contagem Regressiva",
                    subtitle="Horizonte configurado no gerador do workspace",
                    metric_value="16 sem",
                    badge_text="meta",
                )
            )

    return cards
