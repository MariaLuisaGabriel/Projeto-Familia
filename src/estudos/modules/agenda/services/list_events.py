"""Caso de uso: listar compromissos da agenda filtrados por workspace (R-35)."""

from estudos.modules.workspaces.api import WorkspaceSnapshot

from ..domain.event_record import AgendaEventRecord, build_agenda_event

_EVENTS_BY_WORKSPACE: dict[str, list[AgendaEventRecord]] = {}


def _ensure_seeded(workspace: WorkspaceSnapshot) -> list[AgendaEventRecord]:
    if workspace.workspace_id not in _EVENTS_BY_WORKSPACE:
        seeded: list[AgendaEventRecord] = []
        for idx, et in enumerate(workspace.event_types[:2]):
            default_custom = {f.key: f.options[0] for f in et.fields if f.options}
            seeded.append(
                build_agenda_event(
                    workspace_id=workspace.workspace_id,
                    event_type_key=et.key,
                    event_type_label=et.label,
                    title=f"{et.label} #{idx + 1}",
                    start_date=f"2026-11-{16 + idx:02d}",
                    start_time="08:00" if idx == 0 else "14:00",
                    duration_min=et.default_duration_min,
                    color=et.color,
                    allowed_options_by_field={f.key: f.options for f in et.fields},
                    custom_fields=default_custom,
                )
            )
        _EVENTS_BY_WORKSPACE[workspace.workspace_id] = seeded
    return _EVENTS_BY_WORKSPACE[workspace.workspace_id]


def list_events(
    workspace: WorkspaceSnapshot,
    *,
    event_type_key: str | None = None,
) -> list[AgendaEventRecord]:
    """Lista os eventos do workspace obrigatório (R-35), com filtro opcional por tipo."""
    items = list(_ensure_seeded(workspace))
    if event_type_key:
        return [ev for ev in items if ev.event_type_key == event_type_key]
    return items


def count_events_by_type(workspace: WorkspaceSnapshot) -> dict[str, int]:
    """Conta quantos eventos existem por chave de tipo dentro do workspace."""
    counts: dict[str, int] = {}
    for ev in _ensure_seeded(workspace):
        counts[ev.event_type_key] = counts.get(ev.event_type_key, 0) + 1
    return counts
