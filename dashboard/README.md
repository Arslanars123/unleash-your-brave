# Unleash Your Brave — Admin Dashboard

React + TypeScript admin console for managing the platform.

## Layout

```
src/
├── app/                 App shell, router, providers
├── features/
│   ├── auth/            Login + session
│   ├── dashboard/       Overview metrics
│   └── users/           User management
├── shared/
│   ├── api/             Axios client + interceptors
│   ├── lib/             Helpers (storage, cn)
│   ├── types/           Shared API contracts
│   └── ui/              Reusable primitives
└── styles/              Global design system
```

Feature folders own their API clients, pages, and local components. Shared code
lives under `shared/` and must not import from features.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173 and sign in with the seeded admin account from the
API (`admin@unleashyourbrave.com` / `Admin123!`).
