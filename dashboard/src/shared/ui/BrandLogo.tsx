interface BrandLogoProps {
  className?: string;
  height?: number;
  alt?: string;
}

/** Official Unleash Your Brave wordmark. */
export function BrandLogo({
  className = '',
  height = 132,
  alt = 'Unleash Your Brave',
}: BrandLogoProps) {
  return (
    <img
      src="/brand-logo.png"
      alt={alt}
      className={`brand-logo ${className}`.trim()}
      style={{ height, width: 'auto' }}
      decoding="async"
    />
  );
}
