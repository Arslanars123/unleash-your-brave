/**
 * CLIENT_TESTING_MODE — temporary. See client-testing.types.ts for removal steps.
 */
import type { ClientTestingRepository } from '../../db/repositories/mongo-client-testing.repository.js';
import type {
  PublicClientTestingSettings,
  UpdateClientTestingSettingsInput,
} from './client-testing.types.js';

function toPublic(settings: {
  enabled: boolean;
  updatedAt: Date;
  updatedBy: string | null;
}): PublicClientTestingSettings {
  return {
    enabled: Boolean(settings.enabled),
    updatedAt: settings.updatedAt.toISOString(),
    updatedBy: settings.updatedBy,
  };
}

export class ClientTestingService {
  constructor(private readonly store: ClientTestingRepository) {}

  async get(): Promise<PublicClientTestingSettings> {
    return toPublic(await this.store.get());
  }

  /** Fast boolean for date-gate bypasses. */
  async isEnabled(): Promise<boolean> {
    const settings = await this.store.get();
    return Boolean(settings.enabled);
  }

  async update(
    input: UpdateClientTestingSettingsInput,
    adminUserId: string,
  ): Promise<PublicClientTestingSettings> {
    const current = await this.store.get();
    const saved = await this.store.save({
      ...current,
      enabled: Boolean(input.enabled),
      updatedBy: adminUserId,
    });
    return toPublic(saved);
  }
}
