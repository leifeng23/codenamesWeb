# Cosmere CodeNames Web

网页版《CodeNames 三界宙版本》，从 Unity 项目迁移为 Next.js + PostgreSQL + Socket.IO 应用。

## Stack

- Next.js App Router + React + TypeScript
- Tailwind CSS, shadcn-style primitives, React Three Fiber, Motion, howler.js
- Prisma + PostgreSQL
- Socket.IO + Redis adapter
- Docker Compose + optional Caddy reverse proxy

## Local Setup

```bash
cp .env.example .env
npm install
npx prisma generate
docker compose up -d postgres redis
npm run db:migrate
npm run db:seed
npm run dev
npm run dev:realtime
```

Open:

- Web: http://localhost:3000
- Realtime health: http://localhost:4001/health

The seed script imports words from:

```text
/Users/cdisk/Documents/Unity-Project/CosmereCodesName/Assets/Excel/CosmereCodesName.xlsx
```

Set `UNITY_PROJECT_PATH` in `.env` if the Unity project moves.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

For production with Caddy:

```bash
SITE_DOMAIN=your.domain.com CADDY_EMAIL=you@example.com docker compose --profile production up --build -d
```

Run migrations and seed inside a one-off container before first use:

```bash
docker compose run --rm web npx prisma migrate deploy
docker compose run --rm web npm run db:seed
```
