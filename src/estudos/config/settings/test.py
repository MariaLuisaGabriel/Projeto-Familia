"""Testes (pytest). Usa o Postgres local; o pytest-django cria um banco de teste à parte."""

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "teste")

from .base import *  # noqa: F403

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # só para acelerar testes
