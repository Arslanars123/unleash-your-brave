# Client testing mode — removal checklist

Temporary admin flag that unlocks **upcoming**-edition check-in and session reviews for client demos.

Search the codebase for: `CLIENT_TESTING_MODE`

## Delete these

| Area | Path |
|------|------|
| Module | `backend/src/modules/client-testing/` |
| Repo | `backend/src/db/repositories/mongo-client-testing.repository.ts` |
| Dashboard feature | `dashboard/src/features/client-testing/` |
| This file | `docs/CLIENT_TESTING_MODE_REMOVAL.md` |

## Revert wiring

1. `backend/src/app/container.ts` — remove ClientTestingService / router / injections into CheckInService & EffectiveAccessService
2. `backend/src/app/create-app.ts` — remove `/api/v1/client-testing` mount
3. `dashboard/src/app/router.tsx` — remove `/client-testing` route
4. `dashboard/src/app/layout/AppShell.tsx` — remove Testing nav link
5. `dashboard/src/features/checkins/pages/CheckInsPage.tsx` — remove testing query / `checkInOpen` override / banner

## Revert bypass logic

1. `checkin.service.ts` — `assertCheckInWindowOpen` must again reject `upcoming` only (no testing branch)
2. `access.service.ts` — stop forcing `eventStarted` / `submitReviews` when testing is on

## Optional cleanup

- Drop Mongo collection `client_testing_settings`

## Verify after removal

- Upcoming edition on Check-in page shows “Check-in will be available when the event starts.”
- Scan / complete-with-form / complete-my-form API reject upcoming
- Session reviews stay locked until event start date
