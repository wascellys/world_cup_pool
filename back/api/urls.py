from django.urls import path, include
from rest_framework import routers

from .views import ParticipantViewSet, PoolViewSet, GameViewSet, GuessViewSet, ParticipantPoolViewSet
from .views import auth_login, auth_me

router = routers.DefaultRouter()
router.register('participant', ParticipantViewSet)
router.register('pool', PoolViewSet)
router.register('game', GameViewSet)
router.register('guess', GuessViewSet)
router.register('participant-pool', ParticipantPoolViewSet)

urlpatterns = [
    path('auth/login/', auth_login),
    path('auth/me/', auth_me),
    path('', include(router.urls)),
]
