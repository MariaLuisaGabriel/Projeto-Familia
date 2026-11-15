"""Model de usuário próprio (R-63).

Existe desde a primeira migração para que o projeto nunca precise trocar `AUTH_USER_MODEL`
com dados em produção. Login é por e-mail (django-allauth); não há `username`.
"""

from typing import Any, ClassVar

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models

from estudos.core.ids import new_id


class EmailUserManager(UserManager["User"]):
    """Manager que usa o e-mail como identificador, no lugar de `username`."""

    def _create_user_by_email(self, email: str, password: str | None, **extra_fields: Any) -> User:
        if not email:
            raise ValueError("O e-mail é obrigatório.")
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(  # type: ignore[override]
        self, email: str, password: str | None = None, **extra_fields: Any
    ) -> User:
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user_by_email(email, password, **extra_fields)

    def create_superuser(  # type: ignore[override]
        self, email: str, password: str | None = None, **extra_fields: Any
    ) -> User:
        extra_fields["is_staff"] = True
        extra_fields["is_superuser"] = True
        return self._create_user_by_email(email, password, **extra_fields)


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=new_id, editable=False)
    username = None  # type: ignore[assignment]
    email = models.EmailField("e-mail", unique=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # type: ignore[assignment]  # noqa: RUF012

    objects: ClassVar[EmailUserManager] = EmailUserManager()  # type: ignore[assignment]

    class Meta:
        verbose_name = "usuário"
        verbose_name_plural = "usuários"

    def __str__(self) -> str:
        return self.email
