from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_participantpool_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='pool',
            name='is_public',
            field=models.BooleanField(default=False),
        ),
    ]
