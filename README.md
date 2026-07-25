# Unleash Your Brave

Monorepo containing the mobile application, the admin dashboard, and the shared API that
serves both of them.

## Repository layout

```
unleash_your_brave/
├── app/          Flutter mobile app (Android, iOS, Web) — Clean Architecture
├── dashboard/    React + TypeScript admin dashboard — feature-sliced architecture
├── backend/      Node.js + TypeScript REST API — layered architecture
└── docs/         Architecture notes and conventions
```

`app/` and `dashboard/` are fully independent projects with their own toolchains and
dependency manifests. They share nothing at build time; the only contract between them is
the HTTP API exposed by `backend/`.

## Getting started

Each project is self-contained. Start whichever ones you need.

### Backend (`backend/`)

```bash
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:4000
```

### Admin dashboard (`dashboard/`)

```bash
cd dashboard
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
```

### Mobile app (`app/`)

```bash
cd app
cp .env.example .env
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run
```

## Requirements

| Tool    | Version  |
| ------- | -------- |
| Flutter | 3.24+    |
| Dart    | 3.5+     |
| Node.js | 20 LTS+  |
| npm     | 10+      |

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the layering rules, dependency
direction, and the conventions each project follows.
