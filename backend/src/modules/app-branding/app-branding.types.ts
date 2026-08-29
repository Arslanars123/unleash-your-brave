export interface AppBranding {
  id: string;
  homeCoverImage: string;
  supportEmail: string;
  supportPhone: string;
  updatedAt: Date;
}

export interface PublicAppBranding {
  homeCoverImage: string;
  supportEmail: string;
  supportPhone: string;
  updatedAt: string;
}

export interface UpdateAppBrandingInput {
  homeCoverImage?: string;
  supportEmail?: string;
  supportPhone?: string;
}
