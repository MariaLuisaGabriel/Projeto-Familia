"""Rotas raiz. Cada módulo registra as suas com `include()` e `app_name` próprio (R-65)."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("contas/", include("allauth.urls")),
    path("", include("estudos.ui.urls")),
]
