"""Interface pública do módulo agenda. Única coisa importável por outros módulos (R-03)."""

from .domain.event_record import AgendaEventRecord
from .services.create_event import create_event
from .services.list_events import count_events_by_type, list_events

__all__ = [
    "AgendaEventRecord",
    "count_events_by_type",
    "create_event",
    "list_events",
]
