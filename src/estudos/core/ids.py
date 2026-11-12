"""Geração de identificadores UUIDv7 (R-34).

UUIDv7 é ordenável por tempo, o que mantém os índices do Postgres compactos e permite
ordenar registros pela criação sem coluna extra.
"""

import uuid


def new_id() -> uuid.UUID:
    """Gera um novo UUIDv7."""
    return uuid.uuid7()
