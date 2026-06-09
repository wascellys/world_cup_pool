from django.contrib import admin

# Register your models here.

from api.models import Game, Participant, Country, ParticipantPool, Guess, Pool

admin.site.register(Participant)
admin.site.register(ParticipantPool)
admin.site.register(Game)
admin.site.register(Guess)
admin.site.register(Pool)


class CountryAdmin(admin.ModelAdmin):
    model = Country
    extra = 0
    ordering = ('name',)

admin.site.register(Country, CountryAdmin)

