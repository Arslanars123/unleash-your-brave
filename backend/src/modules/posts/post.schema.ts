import { z } from 'zod';
import { isValidMediaUrl } from '../uploads/media-url.js';

const imageSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .default('')
  .refine((value) => isValidMediaUrl(value), {
    message: 'Image must be a valid URL or uploaded file path',
  });

export const postIdParamSchema = z.object({
  id: z.string().uuid('Expected a valid post id'),
});

export const postCommentParamSchema = z.object({
  id: z.string().uuid('Expected a valid post id'),
  commentId: z.string().uuid('Expected a valid comment id'),
});

export const listPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});

export const listPostCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export const createPostSchema = z.object({
  text: z.string().trim().min(1, 'Post text is required').max(2200),
  image: imageSchema,
  commentsEnabled: z.boolean().optional().default(true),
});

export const updatePostSchema = z
  .object({
    text: z.string().trim().min(1).max(2200).optional(),
    image: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => value === undefined || isValidMediaUrl(value), {
        message: 'Image must be a valid URL or uploaded file path',
      }),
    commentsEnabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export const createPostCommentSchema = z.object({
  text: z.string().trim().min(1, 'Comment is required').max(1000),
});

export const updatePostCommentSchema = z.object({
  text: z.string().trim().min(1, 'Comment is required').max(1000),
});
