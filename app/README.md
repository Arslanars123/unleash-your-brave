# Unleash Your Brave — Flutter App

Mobile client built with **Clean Architecture** + **BLoC**.

## Folder layout

```
lib/
├── app/                         Composition root (DI, router, MaterialApp)
├── core/                        Shared kernels (errors, network, theme, usecase)
└── features/
    ├── auth/
    │   ├── domain/              Entities, repository contracts, use cases
    │   ├── data/                Models, datasources, repository implementations
    │   └── presentation/        BLoC + pages
    └── home/
        └── presentation/        Authenticated landing screen
```

Dependency rule (strict):

```
presentation → domain ← data
```

`domain` never imports Flutter, Dio, or SharedPreferences.

## Quick start

```bash
cp .env.example .env
flutter pub get
flutter run
```

Point `API_BASE_URL` at the backend. On a physical device use your machine's LAN IP
instead of `localhost`.

## Demo account

| Email                       | Password    |
| --------------------------- | ----------- |
| member@unleashyourbrave.com | Member123!  |
