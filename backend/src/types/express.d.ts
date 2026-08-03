import type { UserRole } from '../modules/users/user.types.js';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: UserRole;
        speakerId: string | null;
        sponsorId: string | null;
      };
    }
  }
}

export {};
