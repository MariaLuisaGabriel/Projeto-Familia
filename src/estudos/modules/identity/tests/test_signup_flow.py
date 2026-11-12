"""Fluxo de conta pelo django-allauth: cadastro por e-mail com verificação obrigatória."""

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse

pytestmark = pytest.mark.django_db


def test_signup_creates_user_and_sends_verification_email(client):
    response = client.post(
        reverse("account_signup"),
        {
            "email": "nova@exemplo.com",
            "password1": "Uma-senha-boa-123",
            "password2": "Uma-senha-boa-123",
        },
    )

    assert response.status_code == 302
    assert get_user_model().objects.filter(email="nova@exemplo.com").exists()
    assert len(mail.outbox) == 1
    assert "nova@exemplo.com" in mail.outbox[0].to


def test_home_requires_login(client):
    response = client.get(reverse("ui:home"))

    assert response.status_code == 302
    assert reverse("account_login") in response["Location"]


def test_login_page_uses_app_layout(client):
    response = client.get(reverse("account_login"))

    assert response.status_code == 200
    assert b"hx-headers=" in response.content  # layout base com CSRF para HTMX (R-62)
