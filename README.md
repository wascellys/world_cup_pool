# World Cup API

API (Django + DRF) para bolão da Copa com autenticação por token e recursos:

- `POST /api/participant/` (cria participante e retorna `token`)
- `POST /api/auth/login/` (login e retorna `token`)
- `GET /api/auth/me/` (dados do usuário via token)
- `GET/POST /api/pool/`, `GET /api/game/`, `POST /api/guess/` (protegidos por token)

## Rodar o backend

```bash
cd back
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Docs: `http://localhost:8000/docs/`

## Rodar o frontend (Next.js)

Frontend em `frontend/` (estilo Duolingo + módulo de auth).

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```
