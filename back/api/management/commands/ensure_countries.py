import json

from django.apps import apps
from django.core.management.base import BaseCommand

from api.models import Country


class Command(BaseCommand):
    help = 'Creates or updates countries from the fixture.'

    def handle(self, *args, **options):
        fixture_path = apps.get_app_config('api').path + '/fixtures/countries.json'
        created_count = 0
        updated_count = 0

        with open(fixture_path, encoding='utf-8') as fixture_file:
            countries = json.load(fixture_file)

        for item in countries:
            fields = item['fields']
            code = fields['code']
            country = Country.objects.filter(code=code).order_by('id').first()

            if country is None:
                Country.objects.create(
                    id=item.get('pk'),
                    name=fields['name'],
                    code=code,
                    image=fields['image'],
                )
                created_count += 1
                continue

            changes = []
            for field in ('name', 'image'):
                value = fields[field]
                if getattr(country, field) != value:
                    setattr(country, field, value)
                    changes.append(field)

            if changes:
                country.save(update_fields=changes)
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Countries synchronized. Created: {created_count}. Updated: {updated_count}.'
            )
        )
