export type ParticipantPool = {
  id: number;
  participant: Participant;
  pool: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at: string | null;
};

export type AuthUser = {
  id: number;
  username: string;
  nome: string;
  avatar: string | null;
};

export type Participant = {
  id: number;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  name: string;
  avatar: string | null;
};

export type Pool = {
  id: number;
  name: string;
  cod: string;
  created_at: string;
  correct_score: string;
  result_score: string;
  owner: number;
  avatar?: string | null;
  is_participant?: boolean;
  is_public?: boolean;
};

export type RankingEntry = {
  position: number;
  participant_id: number;
  name: string;
  avatar: string | null;
  total_points: number;
  guesses_count: number;
};

export type Country = {
  id: number;
  name: string;
  code: string;
  image: string;
};

export type Guess = {
  id: number;
  participant: {
    id: number;
    participant_id: number;
  };
  game: number;
  guess_first_team: string;
  guess_second_team: string;
  points_earned?: number;
};

export type GuessImportOption = {
  id: number;
  pool_name: string;
  pool_cod: string;
  guess_first_team: string;
  guess_second_team: string;
};

export type Game = {
  id: number;
  first_team: Country;
  second_team: Country;
  date_game: string;
  date_closing_game: string;
  score_first_team: string | null;
  score_second_team: string | null;
  city: string | null;
  stadium: string | null;
  round: string | null;
  group: string | null;
  guessed?: Guess;
};
