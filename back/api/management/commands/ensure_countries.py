from django.core.management import call_command
from django.core.management.base import BaseCommand

from api.models import Country


class Command(BaseCommand):
    help = 'Loads the countries fixture when the table is empty.'

    def handle(self, *args, **options):
        if Country.objects.exists():
            self.stdout.write('Countries already exist.')
            return

        call_command('loaddata', 'countries.json', app_label='api', verbosity=0)
        self.stdout.write(self.style.SUCCESS('Countries fixture loaded.'))
