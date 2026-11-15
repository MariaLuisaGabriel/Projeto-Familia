"""Domínio puro do módulo de referência `agenda` (R-01, R-36, R-56)."""

from dataclasses import dataclass, field

from estudos.core.errors import DomainError, LimitExceededError
from estudos.core.ids import new_id


def _empty_custom_fields() -> dict[str, str]:
    return {}


@dataclass(frozen=True)
class AgendaEventRecord:
    """Ocorrência na agenda de um workspace com campos customizados validados (R-34, R-36)."""

    id: str
    workspace_id: str
    event_type_key: str
    event_type_label: str
    title: str
    start_date: str
    start_time: str
    duration_min: int
    color: str
    custom_fields: dict[str, str] = field(default_factory=_empty_custom_fields)


def build_agenda_event(
    *,
    workspace_id: str,
    event_type_key: str,
    event_type_label: str,
    title: str,
    start_date: str,
    start_time: str,
    duration_min: int,
    color: str,
    allowed_options_by_field: dict[str, tuple[str, ...]],
    custom_fields: dict[str, str],
) -> AgendaEventRecord:
    """Valida os campos customizados contra a definição do tipo e cria o registro (R-21, R-36)."""
    clean_title = title.strip() or event_type_label
    if len(clean_title) > 2000:
        raise LimitExceededError("short_text_chars", 2000)

    validated_fields: dict[str, str] = {}
    for field_key, raw_val in custom_fields.items():
        val = str(raw_val).strip()
        if not val:
            continue
        allowed = allowed_options_by_field.get(field_key)
        if allowed and val not in allowed:
            raise DomainError(f"Valor '{val}' inválido para o campo '{field_key}' (R-36).")
        validated_fields[field_key] = val

    return AgendaEventRecord(
        id=str(new_id()),
        workspace_id=workspace_id,
        event_type_key=event_type_key,
        event_type_label=event_type_label,
        title=clean_title,
        start_date=start_date or "2026-11-16",
        start_time=start_time or "08:00",
        duration_min=max(15, duration_min),
        color=color,
        custom_fields=validated_fields,
    )
