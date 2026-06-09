const API_MESSAGES: Record<string, string> = {
  "O prazo para enviar o palpite encerrou!": "O prazo para enviar o palpite encerrou!",
  "Guessing period has closed for this game": "O prazo para enviar o palpite encerrou!",
  "you are not participating in this pool": "Você não participa deste bolão.",
  "Guess already exists for this game. Use update instead.": "Palpite já registrado para este jogo.",
  "Not allowed to update this guess": "Você não pode alterar este palpite.",
  "invalid credentials": "Usuário ou senha inválidos.",
  "you are already participating in this pool": "Você já participa deste bolão.",
  "Pool doesnt exists!": "Bolão não encontrado.",
};

export function formatApiMessage(message: string): string {
  return API_MESSAGES[message] ?? message;
}
