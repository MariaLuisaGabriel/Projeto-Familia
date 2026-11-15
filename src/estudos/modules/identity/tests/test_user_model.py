import uuid

import pytest

from estudos.modules.identity.models import User

pytestmark = pytest.mark.django_db


def test_create_user_uses_email_as_login_and_has_no_username():
    user = User.objects.create_user(email="Pessoa@Exemplo.com", password="s3nha-forte!")

    assert user.email == "Pessoa@exemplo.com"  # domínio normalizado
    assert User.USERNAME_FIELD == "email"
    assert not hasattr(user, "username") or user.username is None
    assert user.check_password("s3nha-forte!")


def test_user_primary_key_is_uuid_v7():
    user = User.objects.create_user(email="a@exemplo.com", password="x")

    assert isinstance(user.pk, uuid.UUID)
    assert user.pk.version == 7


def test_create_superuser_sets_staff_flags():
    admin = User.objects.create_superuser(email="admin@exemplo.com", password="x")

    assert admin.is_staff
    assert admin.is_superuser
