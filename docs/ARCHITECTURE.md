# Architecture

## Separation of concerns

```
┌────────────┐      HTTP       ┌────────────┐      HTTP       ┌────────────┐
│  app/      │ ─────────────── │  backend/  │ ─────────────── │ dashboard/ │
│  Flutter   │                 │  Node API  │                 │  React     │
└────────────┘                 └────────────┘                 └────────────┘
```

`app/` and `dashboard/` are **separate folders and separate projects**. They do not
share build tooling, packages, or runtime code. The only shared contract is the
versioned HTTP API under `/api/v1`.

## Flutter visual system

See [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) for colors, type, and component rules.
Tokens are implemented in `app/lib/core/theme/` (`app_colors.dart`,
`app_typography.dart`, `app_theme.dart`). All new Flutter screens should follow
that dark luxury / editorial event-app aesthetic.

## Flutter (`app/`) — Clean Architecture

Per-feature layers:

| Layer          | Responsibility                                      | May depend on        |
| -------------- | --------------------------------------------------- | -------------------- |
| `domain`       | Entities, repository interfaces, use cases           | Nothing external     |
| `data`         | Models, datasources, repository implementations      | `domain` + IO libs   |
| `presentation` | BLoC / widgets                                       | `domain` only        |

Cross-cutting utilities live in `core/` (failures, Dio client, theme, UseCase base).
Wiring happens once in `app/di/injection.dart` via `get_it`.

## Backend (`backend/`) — Layered modules

```
routes → controller → service → repository
```

- Controllers speak HTTP.
- Services own business rules and never import Express.
- Repositories hide persistence (currently in-memory; swap for Prisma later).

Modules are vertical slices (`auth`, `users`) so new domains drop in without
touching the composition root beyond registering a router.

## Dashboard (`dashboard/`) — Feature-sliced React

```
features/<name>/{api,pages,components,context}
shared/{api,ui,lib,types}
app/{router,layout,providers}
```

Features may import from `shared/` and `app/`, but not from sibling features.
This keeps the admin console scalable as new screens appear.
