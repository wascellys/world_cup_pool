import json

import requests
from django.core.management import BaseCommand

from api.models import Country


class Command(BaseCommand):
    help = '--create to create token service'

    def add_arguments(self, parser):
        parser.add_argument('--create', action='store_true')

    def handle(self, *args, **options):
        try:
            if options.get('create'):
                self.create_country()
        finally:
            pass

    def create_country(self):
        result = requests.get("https://restcountries.com/v3.1/all")
        response_json = json.loads(result.content.decode("utf-8"))
        for data in response_json:
            name = data.get("name").get("common")
            code = data.get("cca3")
            country, created = Country.objects.get_or_create(name=name, code=code,
                                                             image="https://countryflagsapi.com/svg/" + code)
        country.save()
        return country
