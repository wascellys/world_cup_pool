from django.urls import path, include
from rest_framework import routers

from .views import ParticipantViewSet, PoolViewSet, GameViewSet, GuessViewSet

router = routers.DefaultRouter()
router.register('participant', ParticipantViewSet)
router.register('pool', PoolViewSet)
router.register('game', GameViewSet)
router.register('guess', GuessViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
