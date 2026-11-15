"""Desenvolvimento local."""

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "dev-inseguro-nao-use-em-producao")

from .base import *  # noqa: F403

DEBUG = True

# E-mails (verificação, recuperação de senha) aparecem no terminal.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
