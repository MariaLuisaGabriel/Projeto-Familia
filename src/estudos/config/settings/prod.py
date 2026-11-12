"""Produção. Variáveis sensíveis vêm do ambiente (ver .env.example e docs/guias/deploy.md)."""

from .base import *  # noqa: F403
from .base import env

DEBUG = False

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True

CSRF_TRUSTED_ORIGINS = [f"https://{host}" for host in ALLOWED_HOSTS]  # noqa: F405

# E-mail transacional: definido na escolha da hospedagem (roadmap, C2).
EMAIL_BACKEND = env("DJANGO_EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
DEFAULT_FROM_EMAIL = env("DJANGO_DEFAULT_FROM_EMAIL", "nao-responda@localhost")
