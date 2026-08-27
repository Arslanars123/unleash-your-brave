export interface AppBranding {
  id: string;
  homeCoverImage: string;
  updatedAt: Date;
}

export interface PublicAppBranding {
  homeCoverImage: string;
  updatedAt: string;
}

export interface UpdateAppBrandingInput {
  homeCoverImage?: string;
}
