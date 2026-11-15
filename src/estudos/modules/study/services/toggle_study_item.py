"""Caso de uso: alternar a conclusão de um item de estudo no workspace (R-35)."""

from estudos.modules.workspaces.api import WorkspaceSnapshot

from ..domain.study_plan import StudyItemRecord
from .list_study_plan import list_study_items


def toggle_study_item(workspace: WorkspaceSnapshot, item_id: str) -> StudyItemRecord | None:
    """Alterna o status concluído/pendente de um item pertencente ao workspace."""
    items = list_study_items(workspace)
    for item in items:
        if item.id == item_id and item.workspace_id == workspace.workspace_id:
            item.completed = not item.completed
            return item
    return None
