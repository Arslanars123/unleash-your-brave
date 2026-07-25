# Unleash Your Brave — API

Node.js + TypeScript REST API that powers both the Flutter mobile app and the
React admin dashboard.

## Layout

```
src/
├── app/              Composition root (DI container, Express factory, seed)
├── config/           Environment validation
├── core/             Shared primitives (errors, logger, response helpers)
├── middleware/       Cross-cutting Express middleware
├── modules/
│   ├── auth/         Login, register, refresh, /me
│   └── users/        Admin user CRUD + stats
├── types/            Ambient TypeScript declarations
└── server.ts         Process entry point
```

Each module follows the same vertical slice:

`routes → controller → service → repository`

Services never import Express. Controllers never talk to the database. That
keeps the API easy to test and easy to grow (new modules drop in beside `users`
and `auth`).

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Health check: `GET http://localhost:4000/health`

## Demo accounts (seeded on boot)

| Role   | Email                        | Password    |
| ------ | ---------------------------- | ----------- |
| admin  | admin@unleashyourbrave.com   | Admin123!   |
| member | member@unleashyourbrave.com  | Member123!  |

## Persistence

The current repository is an in-memory store so the project boots with zero
external dependencies. Swap `InMemoryUserRepository` in `src/app/container.ts`
for a Prisma / Drizzle / TypeORM adapter when you are ready — the service
interfaces do not change.
