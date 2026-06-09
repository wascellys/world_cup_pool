from django.db.models.signals import post_migrate
from django.dispatch import receiver
from django.core.management import call_command


@receiver(post_migrate)
def load_initial_countries(sender, app_config, **kwargs):
    if app_config.name != 'api':
        return

    call_command('ensure_countries', verbosity=0)
