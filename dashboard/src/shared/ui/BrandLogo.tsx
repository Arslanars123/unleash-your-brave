/** Bump when wordmark assets change — busts CDN/browser cache for `/brand-logo*.png`. */
const BRAND_LOGO_VERSION = '3';

interface BrandLogoProps {
  className?: string;
  height?: number;
  alt?: string;
  /** `light` = wordmark for white backgrounds; `dark` = wordmark for black backgrounds */
  variant?: 'light' | 'dark';
}

/** Official Unleash Your Brave wordmark. */
export function BrandLogo({
  className = '',
  height = 168,
  alt = 'Unleash Your Brave',
  variant = 'light',
}: BrandLogoProps) {
  const src =
    variant === 'dark'
      ? `/brand-logo-dark.png?v=${BRAND_LOGO_VERSION}`
      : `/brand-logo.png?v=${BRAND_LOGO_VERSION}`;

  return (
    <img
      src={src}
      alt={alt}
      className={`brand-logo ${className}`.trim()}
      style={{ height, width: 'auto' }}
      decoding="async"
    />
  );
}
