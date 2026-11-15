"""Domínio puro do módulo `study`: itens de estudo e gerador linear determinístico (R-01, R-24)."""

from dataclasses import dataclass


@dataclass
class StudyItemRecord:
    """Item de estudo planejado para uma semana do cronograma."""

    id: str
    workspace_id: str
    subject_title: str
    topic_key: str
    topic_title: str
    item_type_key: str
    item_type_label: str
    week_number: int
    weight: int
    completed: bool = False


def generate_linear_schedule(
    *,
    workspace_id: str,
    subjects_with_topics: list[tuple[str, list[tuple[str, str, int]]]],
    items_per_week: int,
    item_type_key: str,
    item_type_label: str,
) -> list[StudyItemRecord]:
    """Distribui os tópicos em sequência uniforme pelas semanas disponíveis (R-24)."""
    per_week = max(1, min(items_per_week, 50))
    records: list[StudyItemRecord] = []
    flat_index = 0

    for subject_title, topics in subjects_with_topics:
        for topic_key, topic_title, weight in topics:
            week_num = (flat_index // per_week) + 1
            records.append(
                StudyItemRecord(
                    id=f"{workspace_id}-item-{flat_index + 1}",
                    workspace_id=workspace_id,
                    subject_title=subject_title,
                    topic_key=topic_key,
                    topic_title=topic_title,
                    item_type_key=item_type_key,
                    item_type_label=item_type_label,
                    week_number=week_num,
                    weight=weight,
                    completed=False,
                )
            )
            flat_index += 1

    return records
