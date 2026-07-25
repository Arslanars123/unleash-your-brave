import { AuthController } from '../modules/auth/auth.controller.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { UserController } from '../modules/users/user.controller.js';
import { InMemoryUserRepository } from '../modules/users/user.repository.js';
import { createUserRouter } from '../modules/users/user.routes.js';
import { UserService } from '../modules/users/user.service.js';
import { seedDemoData } from './seed.js';

/**
 * Manual composition root. Keeps constructors explicit and makes it trivial to
 * swap the in-memory repository for a real database adapter later.
 */
export async function createContainer() {
  const userRepository = new InMemoryUserRepository();
  const userService = new UserService(userRepository);
  const authService = new AuthService(userRepository, userService);

  const userController = new UserController(userService);
  const authController = new AuthController(authService);

  await seedDemoData(userService);

  return {
    routers: {
      auth: createAuthRouter(authController),
      users: createUserRouter(userController),
    },
    services: { userService, authService },
  };
}

export type Container = Awaited<ReturnType<typeof createContainer>>;
