"""Caso de uso: listar e gerar o cronograma de estudos do workspace (R-24, R-35)."""

from estudos.modules.workspaces.api import WorkspaceSnapshot

from ..domain.study_plan import StudyItemRecord, generate_linear_schedule

_STUDY_ITEMS_BY_WORKSPACE: dict[str, list[StudyItemRecord]] = {}


def _build_from_workspace(
    workspace: WorkspaceSnapshot,
    *,
    items_per_week: int | None = None,
) -> list[StudyItemRecord]:
    default_gen = workspace.generators[0] if workspace.generators else None
    per_week = items_per_week or (default_gen.items_per_week if default_gen else 4)
    first_item_type = workspace.item_types[0] if workspace.item_types else None
    item_type_key = first_item_type.key if first_item_type else "estudo"
    item_type_label = first_item_type.label if first_item_type else "Estudo"

    subjects_payload = [
        (
            sub.title,
            [(top.key, top.title, top.weight) for top in sub.topics],
        )
        for sub in workspace.taxonomy
    ]

    return generate_linear_schedule(
        workspace_id=workspace.workspace_id,
        subjects_with_topics=subjects_payload,
        items_per_week=per_week,
        item_type_key=item_type_key,
        item_type_label=item_type_label,
    )


def list_study_items(workspace: WorkspaceSnapshot) -> list[StudyItemRecord]:
    """Retorna os itens de estudo planejados para o workspace obrigatório (R-35)."""
    if workspace.workspace_id not in _STUDY_ITEMS_BY_WORKSPACE:
        _STUDY_ITEMS_BY_WORKSPACE[workspace.workspace_id] = _build_from_workspace(workspace)
    return _STUDY_ITEMS_BY_WORKSPACE[workspace.workspace_id]


def run_linear_generator(
    workspace: WorkspaceSnapshot,
    *,
    items_per_week: int,
) -> list[StudyItemRecord]:
    """Executa o gerador linear sobre a taxonomia do workspace e substitui o plano (R-24)."""
    items = _build_from_workspace(workspace, items_per_week=items_per_week)
    _STUDY_ITEMS_BY_WORKSPACE[workspace.workspace_id] = items
    return items


def get_study_progress(workspace: WorkspaceSnapshot) -> tuple[int, int]:
    """Retorna a tupla (concluídos, total) de itens de estudo do workspace."""
    items = list_study_items(workspace)
    completed = sum(1 for item in items if item.completed)
    return completed, len(items)
