import type { AppBrandingRepository } from '../../db/repositories/mongo-app-branding.repository.js';
import type {
  PublicAppBranding,
  UpdateAppBrandingInput,
} from './app-branding.types.js';

function toPublic(branding: {
  homeCoverImage: string;
  supportEmail: string;
  supportPhone: string;
  updatedAt: Date;
}): PublicAppBranding {
  return {
    homeCoverImage: branding.homeCoverImage ?? '',
    supportEmail: branding.supportEmail ?? '',
    supportPhone: branding.supportPhone ?? '',
    updatedAt: branding.updatedAt.toISOString(),
  };
}

export class AppBrandingService {
  constructor(private readonly branding: AppBrandingRepository) {}

  async get(): Promise<PublicAppBranding> {
    return toPublic(await this.branding.get());
  }

  async update(input: UpdateAppBrandingInput): Promise<PublicAppBranding> {
    const current = await this.branding.get();
    const saved = await this.branding.save({
      ...current,
      homeCoverImage:
        input.homeCoverImage !== undefined
          ? input.homeCoverImage.trim()
          : current.homeCoverImage,
      supportEmail:
        input.supportEmail !== undefined
          ? input.supportEmail.trim()
          : current.supportEmail,
      supportPhone:
        input.supportPhone !== undefined
          ? input.supportPhone.trim()
          : current.supportPhone,
    });
    return toPublic(saved);
  }
}
