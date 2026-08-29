import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
import { toPublicStoreCategory, toPublicStoreProduct } from './store.mapper.js';
import type {
  PaginatedResult,
  StoreCategoryRepository,
  StoreProductRepository,
} from './store.repository.js';
import type {
  CreateStoreCategoryInput,
  CreateStoreProductInput,
  ListStoreCategoriesQuery,
  ListStoreProductsQuery,
  PublicStoreCategory,
  PublicStoreProduct,
  StoreCategory,
  StoreProduct,
  UpdateStoreCategoryInput,
  UpdateStoreProductInput,
} from './store.types.js';

export class StoreService {
  constructor(
    private readonly categories: StoreCategoryRepository,
    private readonly products: StoreProductRepository,
  ) {}

  async listCategories(
    query: ListStoreCategoriesQuery,
  ): Promise<PaginatedResult<PublicStoreCategory>> {
    const { items, total } = await this.categories.list(query);
    const mapped = await Promise.all(
      items.map(async (category) => {
        const productCount = await this.products.countByCategory(category.id);
        return toPublicStoreCategory(category, productCount);
      }),
    );

    return { items: mapped, total };
  }

  async getCategoryById(id: string): Promise<PublicStoreCategory> {
    const category = await this.requireCategory(id);
    const productCount = await this.products.countByCategory(id);
    return toPublicStoreCategory(category, productCount);
  }

  async createCategory(input: CreateStoreCategoryInput): Promise<PublicStoreCategory> {
    const created = await this.categories.create({
      name: input.name.trim(),
      description: input.description ?? '',
      image: input.image ?? '',
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    });
    return toPublicStoreCategory(created, 0);
  }

  async updateCategory(id: string, input: UpdateStoreCategoryInput): Promise<PublicStoreCategory> {
    await this.requireCategory(id);
    const updated = await this.categories.update(id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });
    if (!updated) throw new NotFoundError('Store category');
    const productCount = await this.products.countByCategory(id);
    return toPublicStoreCategory(updated, productCount);
  }

  async deleteCategory(id: string): Promise<void> {
    await this.requireCategory(id);
    await this.products.clearCategory(id);
    if (!(await this.categories.delete(id))) {
      throw new NotFoundError('Store category');
    }
  }

  async listProducts(query: ListStoreProductsQuery): Promise<PaginatedResult<PublicStoreProduct>> {
    const { items, total } = await this.products.list(query);
    const mapped = await Promise.all(items.map((product) => this.toPublicProduct(product)));
    return { items: mapped, total };
  }

  async getProductById(id: string): Promise<PublicStoreProduct> {
    return this.toPublicProduct(await this.requireProduct(id));
  }

  async createProduct(input: CreateStoreProductInput): Promise<PublicStoreProduct> {
    const categoryId = input.categoryId ?? null;
    if (categoryId) {
      await this.assertCategoryExists(categoryId);
    }
    if (!input.images?.length) {
      throw new BadRequestError('Add at least one product image');
    }

    const created = await this.products.create({
      categoryId,
      name: input.name.trim(),
      description: input.description ?? '',
      sku: input.sku?.trim() ?? '',
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      currency: (input.currency ?? 'USD').toUpperCase(),
      images: input.images,
      trackInventory: true,
      stockQty: input.stockQty ?? 0,
      lowStockThreshold: input.lowStockThreshold ?? 5,
      isActive: input.isActive ?? true,
      featured: input.featured ?? false,
      sortOrder: input.sortOrder ?? 0,
    });

    return this.toPublicProduct(created);
  }

  async updateProduct(id: string, input: UpdateStoreProductInput): Promise<PublicStoreProduct> {
    if (input.categoryId !== undefined && input.categoryId) {
      await this.assertCategoryExists(input.categoryId);
    }
    if (input.images !== undefined && input.images.length === 0) {
      throw new BadRequestError('Add at least one product image');
    }

    const updated = await this.products.update(id, {
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.sku !== undefined ? { sku: input.sku.trim() } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.compareAtPrice !== undefined ? { compareAtPrice: input.compareAtPrice } : {}),
      ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
      ...(input.images !== undefined ? { images: input.images } : {}),
      trackInventory: true,
      ...(input.stockQty !== undefined ? { stockQty: input.stockQty } : {}),
      ...(input.lowStockThreshold !== undefined
        ? { lowStockThreshold: input.lowStockThreshold }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.featured !== undefined ? { featured: input.featured } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    });

    if (!updated) throw new NotFoundError('Store product');
    return this.toPublicProduct(updated);
  }

  async deleteProduct(id: string): Promise<void> {
    if (!(await this.products.delete(id))) {
      throw new NotFoundError('Store product');
    }
  }

  private async toPublicProduct(product: StoreProduct): Promise<PublicStoreProduct> {
    let categoryName: string | null = null;
    if (product.categoryId) {
      const category = await this.categories.findById(product.categoryId);
      categoryName = category?.name ?? null;
    }
    return toPublicStoreProduct(product, categoryName);
  }

  private async requireCategory(id: string): Promise<StoreCategory> {
    const category = await this.categories.findById(id);
    if (!category) throw new NotFoundError('Store category');
    return {
      ...category,
      description: category.description ?? '',
      image: category.image ?? '',
      sortOrder: category.sortOrder ?? 0,
      isActive: category.isActive !== false,
    };
  }

  private async requireProduct(id: string): Promise<StoreProduct> {
    const product = await this.products.findById(id);
    if (!product) throw new NotFoundError('Store product');
    return {
      ...product,
      categoryId: product.categoryId ?? null,
      description: product.description ?? '',
      sku: product.sku ?? '',
      compareAtPrice: product.compareAtPrice ?? null,
      currency: product.currency || 'USD',
      images: product.images ?? [],
      trackInventory: true,
      stockQty: product.stockQty ?? 0,
      lowStockThreshold: product.lowStockThreshold ?? 5,
      isActive: product.isActive !== false,
      featured: Boolean(product.featured),
      sortOrder: product.sortOrder ?? 0,
    };
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.categories.findById(categoryId);
    if (!category) throw new BadRequestError('Selected category was not found');
  }
}
