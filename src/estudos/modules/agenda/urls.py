from django.urls import path

from . import views

app_name = "agenda"

urlpatterns = [
    path("", views.index, name="index"),
    path("campos-tipo/", views.event_type_fields, name="event_type_fields"),
    path("novo/", views.create_event_view, name="create_event"),
]
