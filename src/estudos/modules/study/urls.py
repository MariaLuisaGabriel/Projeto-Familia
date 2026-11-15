from django.urls import path

from . import views

app_name = "study"

urlpatterns = [
    path("", views.index, name="index"),
    path("itens/<str:item_id>/alternar/", views.toggle_item_view, name="toggle_item"),
    path("gerador/linear/", views.run_generator_view, name="run_generator"),
]
