import type { Request, Response } from 'express';
import { sendSuccess } from '../../core/http/response.js';
import type { AuthService } from './auth.service.js';
import type {
  ChangePasswordInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
} from './auth.schema.js';

export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.register(req.body as RegisterInput), 201);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.login(req.body as LoginInput));
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.changePassword(req.auth!.userId, req.body as ChangePasswordInput),
    );
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body as RefreshInput;
    sendSuccess(res, await this.service.refresh(refreshToken));
  };

  me = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.me(req.auth!.userId));
  };
}
