"""Erros de domínio compartilhados por todos os módulos.

Serviços levantam estes erros; views os traduzem em respostas HTTP. Assim nenhum serviço
conhece HTTP (R-02).
"""


class DomainError(Exception):
    """Base de todos os erros de regra de negócio. A mensagem é exibível ao usuário."""


class NotFoundError(DomainError):
    """O recurso não existe ou não pertence ao workspace informado (R-35)."""


class PermissionDeniedError(DomainError):
    """O usuário não tem o papel necessário no workspace (R-48)."""


class LimitExceededError(DomainError):
    """Um limite da ARQUITETURA §8.2 seria ultrapassado (R-26)."""

    def __init__(self, limit: str, maximum: int) -> None:
        self.limit = limit
        self.maximum = maximum
        super().__init__(f"Limite atingido: {limit} (máximo {maximum}).")
