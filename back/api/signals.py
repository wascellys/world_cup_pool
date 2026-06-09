from django.core.management import call_command
from django.db.models.signals import post_migrate
from django.dispatch import receiver

from api.models import Country


@receiver(post_migrate)
def load_initial_countries(sender, app_config, **kwargs):
    if app_config.name != 'api':
        return

    if Country.objects.exists():
        return

    call_command('loaddata', 'countries.json', app_label='api', verbosity=0)
