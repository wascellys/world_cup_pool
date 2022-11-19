from datetime import datetime

import shortuuid
from django.contrib.auth.models import User
from django.db import models


class Participant(models.Model):
    user = models.OneToOneField(User, on_delete=models.PROTECT, related_name="participant")
    avatar = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return str(self.user.get_full_name())


class Country(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=5)
    image = models.CharField(max_length=100)

    def __str__(self):
        return str(self.name)


class Pool(models.Model):
    name = models.CharField(max_length=100)
    cod = models.CharField(max_length=100, default=shortuuid.ShortUUID().random(length=8))
    created_at = models.DateTimeField(default=datetime.now())
    correct_score = models.CharField(max_length=10)
    result_score = models.CharField(max_length=10)
    owner = models.ForeignKey(Participant, on_delete=models.CASCADE)
    avatar = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return str(self.name)


class ParticipantPool(models.Model):
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE)
    pool = models.ForeignKey(Pool, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.participant.user.get_full_name()} X {self.pool.name}"


class Game(models.Model):
    first_team = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='first_team')
    second_team = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='second_team')
    date_game = models.DateTimeField()
    date_closing_game = models.DateTimeField()
    score_first_team = models.CharField(max_length=20, null=True, blank=True)
    score_second_team = models.CharField(max_length=20, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    stadium = models.CharField(max_length=100, null=True, blank=True)
    round = models.CharField(max_length=100, null=True, blank=True)
    group = models.CharField(max_length=1, null=True, blank=True)

    def __str__(self):
        return f"{self.first_team} X {self.second_team}"


class Guess(models.Model):
    participant = models.ForeignKey(ParticipantPool, on_delete=models.CASCADE)
    game = models.ForeignKey(Game, on_delete=models.CASCADE)
    guess_first_team = models.CharField(max_length=10)
    guess_second_team = models.CharField(max_length=10)

    class Meta:
        unique_together = ['game', 'participant']

    def __str__(self):
        return f'{self.participant.participant.user.get_full_name()} ({self.game})'
