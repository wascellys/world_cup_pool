from rest_framework import serializers
from rest_framework.fields import SerializerMethodField

from .models import Participant, Pool, Game, ParticipantPool, Guess


class ParticipantSerializer(serializers.ModelSerializer):
    name = SerializerMethodField(read_only=True)

    class Meta:
        model = Participant
        fields = ['id', 'avatar', 'name']

    def get_name(self, obj):
        return obj.user.get_full_name()


class PoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pool
        fields = '__all__'


class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = '__all__'
        depth = 1


class ParticipantPoolSerializer(serializers.ModelSerializer):
    participant = ParticipantSerializer()
    pool = PoolSerializer()

    class Meta:
        model = ParticipantPool
        fields = ['participant', 'pool']


class GuessSerializer(serializers.ModelSerializer):

    class Meta:
        model = Guess
        fields = '__all__'

