"""Interface pública do módulo study. Única coisa importável por outros módulos (R-03)."""

from .domain.study_plan import StudyItemRecord, generate_linear_schedule
from .services.list_study_plan import (
    get_study_progress,
    list_study_items,
    run_linear_generator,
)
from .services.toggle_study_item import toggle_study_item

__all__ = [
    "StudyItemRecord",
    "generate_linear_schedule",
    "get_study_progress",
    "list_study_items",
    "run_linear_generator",
    "toggle_study_item",
]
