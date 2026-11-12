"""Configurações que a arquitetura exige desde o primeiro deploy."""

from django.conf import settings


def test_custom_user_model_from_day_one():
    """R-63."""
    assert settings.AUTH_USER_MODEL == "identity.User"


def test_csrf_middleware_enabled():
    """R-62."""
    assert "django.middleware.csrf.CsrfViewMiddleware" in settings.MIDDLEWARE


def test_timezone_storage_is_utc():
    """R-40."""
    assert settings.USE_TZ is True
    assert settings.TIME_ZONE == "UTC"
