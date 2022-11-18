from django.core.exceptions import ObjectDoesNotExist
from django.shortcuts import render

# Create your views here.
from django.utils.decorators import method_decorator
from rest_framework import generics, status
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ViewSet, ModelViewSet
from .serializers import ParticipantSerializer, PoolSerializer, GameSerializer, ParticipantPoolSerializer, \
    GuessSerializer

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.response import Response

from .models import Participant, Pool, Game, ParticipantPool, Guess
from rest_framework.authtoken.models import Token


class ParticipantViewSet(ViewSet):
    queryset = Participant.objects.all()
    serializer_class = ParticipantSerializer

    def list(self, request):
        try:
            serializers = self.serializer_class(self.queryset, many=True)
            return Response(data=serializers.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(e.errors, status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        try:
            user = User()
            name = request.data.pop('name').split(' ')
            first_name = ''
            last_name = ''
            for n in range(len(name)):
                if (n < (len(name) / 2.0)):
                    first_name += name[n] + ''
                else:
                    last_name += name[n] + ''

            with transaction.atomic():
                username = request.data.pop('username')
                user.username = username
                user.first_name = first_name
                user.last_name = last_name
                user.set_password(str(username))
                user.save()

                participant = Participant.objects.create(**request.data, user=user)
                token, created = Token.objects.get_or_create(user=user)

                response = Response({
                    'token': token.key,
                    'username': user.username,
                    'nome': user.get_full_name(),
                    'avatar': participant.avatar,
                })

                return response
        except (Exception,) as e:
            return Response({'message': "Error to insert data", "detail": e.args[0]},
                            status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def pools(self, request, pk=None):

        try:
            result = ParticipantPool.objects.filter(participant__pk=pk)
            serializer = ParticipantPoolSerializer(result, many=True)
            return Response(serializer.data)
        except (Exception,) as e:
            return Response({'message': "Error to get data", "detail": e.args[0]},
                            status=status.HTTP_400_BAD_REQUEST)


class PoolViewSet(ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Pool.objects.all()
    serializer_class = PoolSerializer

    def list(self, request):
        queryset = self.queryset
        try:
            serializers = self.serializer_class(queryset, many=True)
            return Response({'data': serializers.data}, status=status.HTTP_200_OK)
        except (Exception,) as e:
            return Response({'message': "Error to insert data", "detail": e.args[0]},
                            status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.serializer_class(data=request.data)
            participante = Participant.objects.get(user=self.request.user)
            serializer.initial_data['owner'] = participante.pk
            if serializer.is_valid():
                with transaction.atomic():
                    serializer.save()
                    ParticipantPool.objects.create(participant=participante, pool=serializer.instance)
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except (Exception,) as e:
            return Response({'message': "Error to insert data", "detail": e.args[0]},
                            status=status.HTTP_400_BAD_REQUEST)

    def retrieve(self, request, *args, **kwargs):
        try:
            pools = Pool.objects.get(cod=kwargs['pk'])
            serializers = self.serializer_class(pools)
            return Response(data=serializers.data, status=status.HTTP_200_OK)
        except ObjectDoesNotExist:
            return Response({'message': 'Pool doesnt exists!'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'])
    def participants(self, request, pk=None):

        if ParticipantPool.objects.filter(pool__cod=pk):
            result = ParticipantPool.objects.filter(pool__cod=pk)
            serializer = ParticipantPoolSerializer(result, many=True)
            return Response(serializer.data)
        else:
            return Response({'message': 'data doesnt exists!'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def save(self, request, pk=None):

        if ParticipantPool.objects.filter(pool__cod=pk, participant__user__id=self.request.user.pk):
            return Response({'message': 'you are already participating in this pool'})
        else:
            try:
                participant = Participant.objects.get(user=self.request.user)
                pool = Pool.objects.get(cod=pk)
                ParticipantPool.objects.create(pool=pool, participant=participant)
                return Response({'message': 'success'})
            except (Exception,) as e:
                return Response({'message': 'error when trying to participate in the pool'})


class GameViewSet(ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Game.objects.all()
    serializer_class = GameSerializer

    def list(self, request, *args, **kwargs):
        participant = Participant.objects.get(user=self.request.user)
        queryset = self.queryset
        try:
            serializers = self.serializer_class(queryset, many=True)
            for data in serializers.data:
                if Guess.objects.filter(game__pk=data.get("id"), participant__participant__user__id=participant.id):
                    data['guessed'] = True
                return Response({'data': serializers.data}, status=status.HTTP_200_OK)
        except (Exception,) as e:
            return Response({'message': "Error to insert data", "detail": e.args[0]},
                            status=status.HTTP_400_BAD_REQUEST)


class ParticipantPoolViewSet(ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = ParticipantPool.objects.all()
    serializer_class = ParticipantPoolSerializer

    def list(self, request):
        queryset = self.queryset
        try:
            participant = ParticipantPool.objects.get(user=self.request.user)
            queryset = queryset.filter(owner=participant)
            serializers = self.serializer_class(queryset, many=True)
            return Response({'data': serializers.data}, status=status.HTTP_200_OK)
        except (Exception,) as e:
            return Response({'message': "Error to insert data", "detail": e.args[0]},
                            status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.serializer_class(data=request.data)
            participant = Participant.objects.get(user=self.request.user)
            serializer.initial_data['owner'] = participant.pk
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except (Exception,) as e:
            return Response({'message': "Error to insert data", "detail": e.args[0]},
                            status=status.HTTP_400_BAD_REQUEST)


class GuessViewSet(ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Guess.objects.all()
    serializer_class = GuessSerializer

    def create(self, request, *args, **kwargs):

        try:
            serializer = self.serializer_class(data=request.data)
            participante = Participant.objects.get(user=self.request.user)
            participant = ParticipantPool.objects.get(participant=participante,
                                                      pool__cod=request.data.get("pool"))

            serializer.initial_data['game'] = request.data.get("game")
            serializer.initial_data['participant'] = participant.pk
            if serializer.is_valid():
                with transaction.atomic():
                    serializer.save()
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except (Exception,) as e:
            return Response({'message': "Error to insert data", "detail": e.args[0]},
                            status=status.HTTP_400_BAD_REQUEST)
