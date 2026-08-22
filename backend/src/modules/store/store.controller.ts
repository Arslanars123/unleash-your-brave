import type { Request, Response } from 'express';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '../../core/http/response.js';
import type { StoreService } from './store.service.js';
import type {
  CreateStoreCategoryInput,
  CreateStoreProductInput,
  ListStoreCategoriesQuery,
  ListStoreProductsQuery,
  UpdateStoreCategoryInput,
  UpdateStoreProductInput,
} from './store.types.js';

export class StoreController {
  constructor(private readonly service: StoreService) {}

  listCategories = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListStoreCategoriesQuery;
    const { items, total } = await this.service.listCategories(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getCategoryById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getCategoryById(req.params.id as string));
  };

  createCategory = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.createCategory(req.body as CreateStoreCategoryInput), 201);
  };

  updateCategory = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.updateCategory(req.params.id as string, req.body as UpdateStoreCategoryInput),
    );
  };

  removeCategory = async (req: Request, res: Response): Promise<void> => {
    await this.service.deleteCategory(req.params.id as string);
    res.status(204).send();
  };

  listProducts = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListStoreProductsQuery;
    const { items, total } = await this.service.listProducts(query);
    sendPaginated(res, items, buildPaginationMeta(query.page, query.perPage, total));
  };

  getProductById = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.getProductById(req.params.id as string));
  };

  createProduct = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.service.createProduct(req.body as CreateStoreProductInput), 201);
  };

  updateProduct = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      await this.service.updateProduct(req.params.id as string, req.body as UpdateStoreProductInput),
    );
  };

  removeProduct = async (req: Request, res: Response): Promise<void> => {
    await this.service.deleteProduct(req.params.id as string);
    res.status(204).send();
  };
}
