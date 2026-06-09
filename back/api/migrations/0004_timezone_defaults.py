import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_pool_is_public'),
    ]

    operations = [
        migrations.AlterField(
            model_name='participantpool',
            name='created_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AlterField(
            model_name='pool',
            name='created_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
    ]
