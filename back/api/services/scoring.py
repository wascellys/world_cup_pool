from api.models import Guess, ParticipantPool


def _match_result(home: int, away: int) -> str:
    if home > away:
        return "home"
    if home < away:
        return "away"
    return "draw"


def calculate_guess_points(guess: Guess, game, pool) -> int:
    if game.score_first_team in (None, "") or game.score_second_team in (None, ""):
        return 0

    try:
        guess_home = int(guess.guess_first_team)
        guess_away = int(guess.guess_second_team)
        actual_home = int(game.score_first_team)
        actual_away = int(game.score_second_team)
        correct_pts = int(pool.correct_score)
        result_pts = int(pool.result_score)
    except (ValueError, TypeError):
        return 0

    if guess_home == actual_home and guess_away == actual_away:
        return correct_pts

    if _match_result(guess_home, guess_away) == _match_result(actual_home, actual_away):
        return result_pts

    return 0


def build_pool_ranking(pool):
    participant_pools = (
        ParticipantPool.objects.filter(pool=pool, status='approved')
        .select_related("participant__user")
        .order_by("participant__user__first_name")
    )

    ranking = []
    for participant_pool in participant_pools:
        guesses = Guess.objects.filter(participant=participant_pool).select_related("game")
        total_points = sum(calculate_guess_points(guess, guess.game, pool) for guess in guesses)
        ranking.append(
            {
                "participant_id": participant_pool.participant_id,
                "name": participant_pool.participant.user.get_full_name(),
                "avatar": participant_pool.participant.avatar,
                "total_points": total_points,
                "guesses_count": guesses.count(),
            }
        )

    ranking.sort(key=lambda entry: (-entry["total_points"], entry["name"]))
    for position, entry in enumerate(ranking, start=1):
        entry["position"] = position

    return ranking
