/**
 * TEMPORARY — Client testing mode
 *
 * Allows check-in / reviews before an edition’s start date while the flag is ON.
 * When the flag is OFF, production date gates apply again.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * HOW TO REMOVE THIS FEATURE LATER (do not leave stubs — delete fully)
 * ═══════════════════════════════════════════════════════════════════════════
 * Search the repo for: CLIENT_TESTING_MODE
 * Then remove:
 *  1. This entire module: backend/src/modules/client-testing/
 *  2. Repository: backend/src/db/repositories/mongo-client-testing.repository.ts
 *  3. Wiring in backend/src/app/container.ts and create-app.ts
 *  4. Bypass branches in:
 *       - backend/src/modules/checkins/checkin.service.ts (assertCheckInWindowOpen)
 *       - backend/src/modules/access/access.service.ts (eventStarted / submitReviews)
 *  5. Dashboard:
 *       - features/client-testing/*
 *       - AppShell nav + router route
 *       - CheckInsPage testing-mode queries / checkInOpen override
 *  6. This doc: docs/CLIENT_TESTING_MODE_REMOVAL.md
 *  7. Optional: drop Mongo collection `client_testing_settings`
 *
 * After removal, verify: upcoming edition blocks check-in + reviews again.
 */

export interface ClientTestingSettings {
  id: string;
  /** When true, upcoming editions behave as testable (check-in + reviews). */
  enabled: boolean;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface PublicClientTestingSettings {
  enabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export interface UpdateClientTestingSettingsInput {
  enabled: boolean;
}
