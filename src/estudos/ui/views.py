from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render


@login_required
def home(request: HttpRequest) -> HttpResponse:
    """Página inicial após o login. Será substituída pelo painel do workspace (etapa 4)."""
    return render(request, "ui/home.html")
