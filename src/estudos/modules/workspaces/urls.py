from django.urls import path

from . import views

app_name = "workspaces"

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("alternar/", views.switch_workspace, name="switch"),
    path("camada-1/", views.customize_layer1_view, name="customize_layer1"),
]
