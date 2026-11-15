"""Caso de uso: criar um evento na agenda do workspace validando campos (R-35, R-36)."""

from estudos.core.errors import NotFoundError
from estudos.modules.workspaces.api import WorkspaceSnapshot

from ..domain.event_record import AgendaEventRecord, build_agenda_event
from .list_events import _ensure_seeded


def create_event(
    workspace: WorkspaceSnapshot,
    *,
    event_type_key: str,
    title: str,
    start_date: str,
    start_time: str,
    custom_fields: dict[str, str],
) -> AgendaEventRecord:
    """Cria um evento associado a um tipo declarado no workspace e valida seus campos."""
    event_type = next((et for et in workspace.event_types if et.key == event_type_key), None)
    if event_type is None:
        raise NotFoundError(f"Tipo de evento '{event_type_key}' não existe neste workspace.")

    allowed_map = {f.key: f.options for f in event_type.fields if f.options}
    record = build_agenda_event(
        workspace_id=workspace.workspace_id,
        event_type_key=event_type.key,
        event_type_label=event_type.label,
        title=title,
        start_date=start_date,
        start_time=start_time,
        duration_min=event_type.default_duration_min,
        color=event_type.color,
        allowed_options_by_field=allowed_map,
        custom_fields=custom_fields,
    )
    events = _ensure_seeded(workspace)
    events.insert(0, record)
    return record
