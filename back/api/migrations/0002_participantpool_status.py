# Generated migration for ParticipantPool status field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='participantpool',
            name='status',
            field=models.CharField(
                choices=[('pending', 'Pendente'), ('approved', 'Aprovado'), ('rejected', 'Recusado')],
                default='pending',
                max_length=10
            ),
        ),
        migrations.AddField(
            model_name='participantpool',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name='participantpool',
            name='approved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterUniqueTogether(
            name='participantpool',
            unique_together={('participant', 'pool')},
        ),
    ]
