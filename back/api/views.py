from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from django.contrib.auth import authenticate
from rest_framework import generics, status
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import action
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ViewSet, ModelViewSet
from .serializers import ParticipantSerializer, PoolSerializer, GameSerializer, ParticipantPoolSerializer, \
    GuessSerializer

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.response import Response

from .models import Participant, Pool, Game, ParticipantPool, Guess
from .services.scoring import build_pool_ranking, calculate_guess_points
from rest_framework.authtoken.models import Token


def get_participant_for_user(user):
    return Participant.objects.filter(user=user).first()


GUESSING_CLOSED_MESSAGE = 'O prazo para enviar o palpite encerrou!'


def is_guessing_closed(game):
    return timezone.now() >= game.date_closing_game


@api_view(['POST'])
def auth_login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    if not username or not password:
        return Response({'message': 'username and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(username=username, password=password)
    if not user:
        return Response({'message': 'invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    token, _created = Token.objects.get_or_create(user=user)
    participant = getattr(user, 'participant', None)
    return Response({
        'token': token.key,
        'id': participant.id if participant else None,
        'username': user.username,
        'nome': user.get_full_name(),
        'avatar': getattr(participant, 'avatar', None),
    })


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def auth_me(request):
    participant = getattr(request.user, 'participant', None)
    return Response({
        'id': participant.id if participant else None,
        'username': request.user.username,
        'nome': request.user.get_full_name(),
        'avatar': getattr(participant, 'avatar', None),
    })


class ParticipantViewSet(ViewSet):
    queryset = Participant.objects.all()
    serializer_class = ParticipantSerializer

    def list(self, request):
        try:
            serializers = self.serializer_class(self.queryset, many=True)
            return Response(data=serializers.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'message': 'Error to get data', 'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def create(self, request, *args, **kwargs):
        try:
            user = User()
            name = request.data.pop('name').split(' ')
            mid = max(1, len(name) // 2)
            first_name = " ".join([n for n in name[:mid] if n])
            last_name = " ".join([n for n in name[mid:] if n])

            with transaction.atomic():
                username = request.data.pop('username')
                password = request.data.pop('password', None) or str(username)
                user.username = username
                user.first_name = first_name
                user.last_name = last_name
                user.set_password(password)
                user.save()

                participant = Participant.objects.create(**request.data, user=user)
                token, created = Token.objects.get_or_create(user=user)

                response = Response({
                    'token': token.key,
                    'id': participant.id,
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
        participante = get_participant_for_user(self.request.user)
        if not participante:
            return Response({'message': 'Participant not found for current user'}, status=status.HTTP_404_NOT_FOUND)

        pool_ids = ParticipantPool.objects.filter(participant=participante, status='approved').values_list('pool_id', flat=True)
        queryset = self.queryset.filter(id__in=pool_ids)
        try:
            serializers = self.serializer_class(queryset, many=True)
            return Response({'data': serializers.data}, status=status.HTTP_200_OK)
        except (Exception,) as e:
            return Response({'message': "Error to get data", "detail": e.args[0]},
                            status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        participante = get_participant_for_user(self.request.user)
        if not participante:
            return Response({'message': 'Participant not found for current user'}, status=status.HTTP_404_NOT_FOUND)

        try:
            serializer = self.serializer_class(data=request.data)
            serializer.initial_data['owner'] = participante.pk
            if serializer.is_valid():
                with transaction.atomic():
                    serializer.save()
                    ParticipantPool.objects.create(participant=participante, pool=serializer.instance, status='approved')
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except (Exception,) as e:
            return Response({'message': "Error to insert data", "detail": e.args[0]},
                            status=status.HTTP_400_BAD_REQUEST)

    def retrieve(self, request, *args, **kwargs):
        try:
            pools = Pool.objects.get(cod=kwargs['pk'])
            participante = get_participant_for_user(request.user)
            is_participant = False
            if participante:
                is_participant = ParticipantPool.objects.filter(pool=pools, participant=participante, status='approved').exists()
            data = self.serializer_class(pools).data
            data['is_participant'] = is_participant
            return Response(data=data, status=status.HTTP_200_OK)
        except ObjectDoesNotExist:
            return Response({'message': 'Pool doesnt exists!'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'])
    def participants(self, request, pk=None):

        if ParticipantPool.objects.filter(pool__cod=pk, status='approved'):
            result = ParticipantPool.objects.filter(pool__cod=pk, status='approved')
            serializer = ParticipantPoolSerializer(result, many=True)
            return Response(serializer.data)
        else:
            return Response({'message': 'data doesnt exists!'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def save(self, request, pk=None):
        participante = get_participant_for_user(self.request.user)
        if not participante:
            return Response({'message': 'Participant not found for current user'}, status=status.HTTP_404_NOT_FOUND)

        existing = ParticipantPool.objects.filter(pool__cod=pk, participant__user__id=self.request.user.pk).first()
        if existing:
            if existing.status == 'pending':
                return Response(
                    {'message': 'you already have a pending request for this pool'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            elif existing.status == 'approved':
                return Response(
                    {'message': 'you are already participating in this pool'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            pool = Pool.objects.get(cod=pk)
            if existing and existing.status == 'pending' and pool.is_public:
                existing.status = 'approved'
                existing.approved_at = timezone.now()
                existing.save()
                return Response({'message': 'Your request was automatically approved because the pool is public.'}, status=status.HTTP_200_OK)

            status_value = 'approved' if pool.is_public else 'pending'
            participant_pool = ParticipantPool.objects.create(pool=pool, participant=participante, status=status_value)

            if pool.is_public:
                return Response({'message': 'You were automatically approved to enter this public pool.'}, status=status.HTTP_201_CREATED)
            return Response({'message': 'Request sent successfully'}, status=status.HTTP_201_CREATED)
        except ObjectDoesNotExist:
            return Response({'message': 'Pool doesnt exists!'}, status=status.HTTP_404_NOT_FOUND)
        except (Exception,) as e:
            return Response({'message': 'error when trying to participate in the pool', 'detail': str(e)},
                            status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def pending_participants(self, request, pk=None):
        try:
            pool = Pool.objects.get(cod=pk)
        except ObjectDoesNotExist:
            return Response({'message': 'Pool doesnt exists!'}, status=status.HTTP_404_NOT_FOUND)

        participante = get_participant_for_user(request.user)
        if not participante or pool.owner_id != participante.id:
            return Response({'message': 'you are not the owner of this pool'}, status=status.HTTP_403_FORBIDDEN)

        pending = ParticipantPool.objects.filter(pool=pool, status='pending')
        serializer = ParticipantPoolSerializer(pending, many=True)
        return Response({'data': serializer.data}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def approve_participant(self, request, pk=None):
        try:
            pool = Pool.objects.get(cod=pk)
        except ObjectDoesNotExist:
            return Response({'message': 'Pool doesnt exists!'}, status=status.HTTP_404_NOT_FOUND)

        participante = get_participant_for_user(request.user)
        if not participante or pool.owner_id != participante.id:
            return Response({'message': 'you are not the owner of this pool'}, status=status.HTTP_403_FORBIDDEN)

        participant_pool_id = request.data.get('participant_pool_id')
        try:
            participant_pool = ParticipantPool.objects.get(id=participant_pool_id, pool=pool, status='pending')
            participant_pool.status = 'approved'
            participant_pool.approved_at = timezone.now()
            participant_pool.save()
            serializer = ParticipantPoolSerializer(participant_pool)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except ParticipantPool.DoesNotExist:
            return Response({'message': 'Participant request not found'}, status=status.HTTP_404_NOT_FOUND)
        except (Exception,) as e:
            return Response({'message': 'error when approving participant', 'detail': str(e)},
                            status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject_participant(self, request, pk=None):
        try:
            pool = Pool.objects.get(cod=pk)
        except ObjectDoesNotExist:
            return Response({'message': 'Pool doesnt exists!'}, status=status.HTTP_404_NOT_FOUND)

        participante = get_participant_for_user(request.user)
        if not participante or pool.owner_id != participante.id:
            return Response({'message': 'you are not the owner of this pool'}, status=status.HTTP_403_FORBIDDEN)

        participant_pool_id = request.data.get('participant_pool_id')
        try:
            participant_pool = ParticipantPool.objects.get(id=participant_pool_id, pool=pool, status='pending')
            participant_pool.status = 'rejected'
            participant_pool.save()
            serializer = ParticipantPoolSerializer(participant_pool)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except ParticipantPool.DoesNotExist:
            return Response({'message': 'Participant request not found'}, status=status.HTTP_404_NOT_FOUND)
        except (Exception,) as e:
            return Response({'message': 'error when rejecting participant', 'detail': str(e)},
                            status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def ranking(self, request, pk=None):
        try:
            pool = Pool.objects.get(cod=pk)
        except ObjectDoesNotExist:
            return Response({'message': 'Pool doesnt exists!'}, status=status.HTTP_404_NOT_FOUND)

        participante = get_participant_for_user(request.user)
        if not participante:
            return Response({'message': 'Participant not found for current user'}, status=status.HTTP_404_NOT_FOUND)

        if not ParticipantPool.objects.filter(pool=pool, participant=participante).exists():
            return Response({'message': 'you are not participating in this pool'}, status=status.HTTP_403_FORBIDDEN)

        return Response({'data': build_pool_ranking(pool)}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def participant_guesses(self, request, pk=None):
        try:
            pool = Pool.objects.get(cod=pk)
        except ObjectDoesNotExist:
            return Response({'message': 'Pool doesnt exists!'}, status=status.HTTP_404_NOT_FOUND)

        participante = get_participant_for_user(request.user)
        if not participante:
            return Response({'message': 'Participant not found for current user'}, status=status.HTTP_404_NOT_FOUND)

        # only pool owner or participants can view participant guesses
        is_owner = pool.owner_id == participante.id
        is_participant = ParticipantPool.objects.filter(pool=pool, participant=participante, status='approved').exists()
        if not (is_owner or is_participant):
            return Response({'message': 'not allowed to view guesses for this pool'}, status=status.HTTP_403_FORBIDDEN)

        participant_pool_id = request.query_params.get('participant_pool_id')
        if not participant_pool_id:
            return Response({'message': 'participant_pool_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            participant_pool = ParticipantPool.objects.get(pk=participant_pool_id, pool=pool)
        except ParticipantPool.DoesNotExist:
            return Response({'message': 'participant not found in this pool'}, status=status.HTTP_404_NOT_FOUND)

        guesses = Guess.objects.filter(participant=participant_pool).select_related('game')
        result = []
        for g in guesses:
            guess_data = GuessSerializer(g).data
            guess_data['points_earned'] = calculate_guess_points(g, g.game, pool)
            result.append(guess_data)

        return Response({'data': result}, status=status.HTTP_200_OK)


class GameViewSet(ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Game.objects.all()
    serializer_class = GameSerializer

    def list(self, request, *args, **kwargs):
        participant = get_participant_for_user(self.request.user)
        if not participant:
            return Response({'message': 'Participant not found for current user'}, status=status.HTTP_404_NOT_FOUND)

        pool_cod = request.query_params.get('pool')
        pool = None
        if pool_cod:
            pool = Pool.objects.filter(cod=pool_cod).first()
            if not pool:
                return Response({'message': 'Pool doesnt exists!'}, status=status.HTTP_404_NOT_FOUND)
            if not ParticipantPool.objects.filter(pool=pool, participant=participant, status='approved').exists():
                return Response({'message': 'you are not participating in this pool'}, status=status.HTTP_403_FORBIDDEN)

        queryset = self.queryset
        try:
            serializers = self.serializer_class(queryset, many=True)
            for data in serializers.data:
                guess_filter = {
                    'game__pk': data.get("id"),
                    'participant__participant__id': participant.id,
                }
                if pool_cod:
                    guess_filter['participant__pool__cod'] = pool_cod

                guess = Guess.objects.filter(**guess_filter).select_related('game', 'participant__pool').first()
                if guess:
                    guessed_data = GuessSerializer(guess).data
                    if pool:
                        guessed_data['points_earned'] = calculate_guess_points(guess, guess.game, pool)
                    data["guessed"] = guessed_data
            return Response({'data': serializers.data}, status=status.HTTP_200_OK)
        except (Exception,) as e:
            return Response({'message': "Error to get data", "detail": e.args[0]},
                            status=status.HTTP_400_BAD_REQUEST)


class ParticipantPoolViewSet(ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = ParticipantPool.objects.all()
    serializer_class = ParticipantPoolSerializer

    def list(self, request):
        participante = get_participant_for_user(self.request.user)
        if not participante:
            return Response({'message': 'Participant not found for current user'}, status=status.HTTP_404_NOT_FOUND)

        queryset = self.queryset.filter(participant=participante)
        try:
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
    queryset = Guess.objects.select_related('game', 'participant__pool').all()
    serializer_class = GuessSerializer
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']

    def _get_participant_pool(self, pool_cod):
        participante = get_participant_for_user(self.request.user)
        if not participante:
            return None
        return ParticipantPool.objects.filter(participant=participante, pool__cod=pool_cod).first()

    def create(self, request, *args, **kwargs):
        pool_cod = request.data.get("pool")
        participant_pool = self._get_participant_pool(pool_cod)
        if not participant_pool:
            return Response({'message': 'you are not participating in this pool'}, status=status.HTTP_403_FORBIDDEN)

        try:
            game = Game.objects.get(pk=request.data.get("game"))
        except (Game.DoesNotExist, TypeError, ValueError):
            return Response({'message': 'Game not found'}, status=status.HTTP_404_NOT_FOUND)

        if is_guessing_closed(game):
            return Response({'message': GUESSING_CLOSED_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

        if Guess.objects.filter(participant=participant_pool, game=game).exists():
            return Response({'message': 'Guess already exists for this game. Use update instead.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer = self.serializer_class(data=request.data)
            serializer.initial_data['game'] = game.pk
            serializer.initial_data['participant'] = participant_pool.pk
            if serializer.is_valid():
                with transaction.atomic():
                    serializer.save()
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except (Exception,) as e:
            return Response({'message': "Error to insert data", "detail": e.args[0]},
                            status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        participant_pool = self._get_participant_pool(request.data.get("pool") or instance.participant.pool.cod)

        if not participant_pool or instance.participant_id != participant_pool.pk:
            return Response({'message': 'Not allowed to update this guess'}, status=status.HTTP_403_FORBIDDEN)

        game = Game.objects.get(pk=instance.game_id)
        if is_guessing_closed(game):
            return Response({'message': GUESSING_CLOSED_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(
            instance,
            data={
                'guess_first_team': request.data.get('guess_first_team', instance.guess_first_team),
                'guess_second_team': request.data.get('guess_second_team', instance.guess_second_team),
                'game': instance.game_id,
                'participant': instance.participant_id,
            },
            partial=partial,
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
