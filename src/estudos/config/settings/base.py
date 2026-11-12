"""Configuração comum a todos os ambientes. Ambientes específicos importam daqui."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[4]  # raiz do repositório
SRC_DIR = BASE_DIR / "src"


def env(name: str, default: str | None = None) -> str:
    """Lê uma variável de ambiente; falha cedo se for obrigatória e estiver ausente."""
    value = os.environ.get(name, default)
    if value is None:
        raise RuntimeError(f"Variável de ambiente obrigatória ausente: {name}")
    return value


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in env(name, default).split(",") if item.strip()]


SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = False
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

# ---------------------------------------------------------------- apps
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # `ui` vem antes do allauth para que o layout do app substitua o do allauth.
    "estudos.ui",
    "allauth",
    "allauth.account",
    # Módulos (ARQUITETURA §4). Cada módulo novo entra aqui no PR que o cria.
    "estudos.modules.identity",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",  # R-62
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "estudos.config.urls"
ASGI_APPLICATION = "estudos.config.asgi.application"
WSGI_APPLICATION = "estudos.config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            # R-49: autoescape fica no padrão (ligado). Não desligar.
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------- banco
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", "estudos"),
        "USER": env("POSTGRES_USER", "estudos"),
        "PASSWORD": env("POSTGRES_PASSWORD", "estudos"),
        "HOST": env("POSTGRES_HOST", "localhost"),
        "PORT": env("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------- contas (R-63)
AUTH_USER_MODEL = "identity.User"

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# django-allauth: login só por e-mail, sem username.
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_EMAIL_VERIFICATION = "mandatory"
ACCOUNT_LOGOUT_ON_PASSWORD_CHANGE = True
LOGIN_REDIRECT_URL = "ui:home"
LOGIN_URL = "account_login"

# ---------------------------------------------------------------- i18n e fuso (R-40)
LANGUAGE_CODE = "pt-br"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_WORKSPACE_TIMEZONE = "America/Sao_Paulo"

# ---------------------------------------------------------------- estáticos
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ---------------------------------------------------------------- limites (ARQUITETURA §8.2)
ESTUDOS_LIMITS = {
    "event_types": 50,
    "item_types": 30,
    "fields_per_type": 30,
    "analyzable_fields_per_type": 5,
    "select_options": 100,
    "checklist_items": 50,
    "short_text_chars": 2_000,
    "note_chars": 100_000,
    "attachment_mb": 10,
    "attachments_total_mb": 500,
    "active_rules": 50,
    "conditions_per_rule": 5,
    "actions_per_rule": 5,
    "rule_chain_depth": 3,
    "dashboard_widgets": 12,
    "generator_horizon_weeks": 104,
    "generator_max_created": 5_000,
}

# ---------------------------------------------------------------- logs (R-53)
# Logs só com identificadores e metadados técnicos, nunca conteúdo do usuário.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}
