import type { Request, Response } from 'express';
import { BadRequestError } from '../../core/errors/app-error.js';
import { sendSuccess } from '../../core/http/response.js';
import { uploadsPublicPath } from './upload.paths.js';

export class UploadController {
  uploadImage = async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      throw new BadRequestError('Image file is required');
    }

    sendSuccess(
      res,
      {
        url: `${uploadsPublicPath}/events/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
      201,
    );
  };

  uploadMaterial = async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      throw new BadRequestError('Material file is required');
    }

    sendSuccess(
      res,
      {
        url: `${uploadsPublicPath}/materials/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
      201,
    );
  };
}
