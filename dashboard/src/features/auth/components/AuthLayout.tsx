import type { ReactNode } from 'react';
import { BrandLogo } from '@/shared/ui/BrandLogo';

interface AuthLayoutProps {
  children: ReactNode;
  /** Short line under the brand on the visual panel */
  brandLine?: string;
}

/** Shared immersive auth chrome — brand panel + form stage. */
export function AuthLayout({
  children,
  brandLine = 'Events, memberships, and the people who make them brave.',
}: AuthLayoutProps) {
  return (
    <div className="auth-stage">
      <aside className="auth-brand-panel" aria-hidden={false}>
        <div className="auth-brand-atmosphere" aria-hidden="true">
          <span className="auth-orb auth-orb-a" />
          <span className="auth-orb auth-orb-b" />
          <span className="auth-orb auth-orb-c" />
          <span className="auth-grain" />
        </div>

        <div className="auth-brand-content">
          <p className="auth-brand-kicker">Admin portal</p>
          <BrandLogo variant="dark" height={148} className="auth-brand-logo" />
          <p className="auth-brand-line">{brandLine}</p>
        </div>

        <p className="auth-brand-foot">Built for the experience floor</p>
      </aside>

      <main className="auth-form-panel">
        <div className="auth-form-frame auth-form-enter">{children}</div>
      </main>
    </div>
  );
}
