import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Package, Pencil, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import { useEditionScope } from '@/features/events/hooks/useEditionScope';
import { storeApi } from '@/features/store/api/store-api';
import { CategoryFormModal } from '@/features/store/components/CategoryFormModal';
import { ProductFormModal } from '@/features/store/components/ProductFormModal';
import { getApiErrorMessage } from '@/shared/api/client';
import { resolveMediaUrl } from '@/shared/lib/media';
import type {
  PublicStoreCategory,
  PublicStoreProduct,
  StoreCategoryPayload,
  StoreProductPayload,
} from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 20;

type StoreTab = 'products' | 'categories';

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function StorePage() {
  const [tab, setTab] = useState<StoreTab>('products');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PublicStoreCategory | null>(null);
  const [editingProduct, setEditingProduct] = useState<PublicStoreProduct | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { eventId, isPastEdition, workspaceQuery } = useEditionScope();

  const categoriesQuery = useQuery({
    queryKey: ['store', 'categories', eventId],
    queryFn: () => storeApi.listCategories({ eventId, perPage: 100 }),
    enabled: Boolean(eventId),
  });

  const productsQuery = useQuery({
    queryKey: ['store', 'products', eventId, search, page, categoryFilter],
    queryFn: () =>
      storeApi.listProducts({
        eventId,
        search: search || undefined,
        page,
        perPage: PER_PAGE,
        categoryId: categoryFilter || undefined,
      }),
    enabled: Boolean(eventId),
  });

  useEffect(() => {
    setPage(1);
  }, [eventId, categoryFilter]);

  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  const createCategoryMutation = useMutation({
    mutationFn: (payload: StoreCategoryPayload) => storeApi.createCategory(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store', 'categories'] });
      toast.success('Category created');
      closeCategoryModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create category')),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StoreCategoryPayload }) =>
      storeApi.updateCategory(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store'] });
      toast.success('Category updated');
      closeCategoryModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update category')),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => storeApi.removeCategory(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store'] });
      toast.success('Category deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete category')),
  });

  const createProductMutation = useMutation({
    mutationFn: (payload: StoreProductPayload) => storeApi.createProduct(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store'] });
      toast.success('Product created');
      closeProductModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create product')),
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StoreProductPayload }) =>
      storeApi.updateProduct(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store'] });
      toast.success('Product updated');
      closeProductModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update product')),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => storeApi.removeProduct(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store'] });
      toast.success('Product deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete product')),
  });

  function closeCategoryModal() {
    setCategoryModalOpen(false);
    setEditingCategory(null);
  }

  function closeProductModal() {
    setProductModalOpen(false);
    setEditingProduct(null);
  }

  async function handleCategorySubmit(payload: StoreCategoryPayload) {
    if (editingCategory) {
      const ok = await confirm({
        title: 'Save category?',
        message: `Update “${editingCategory.name}”?`,
        confirmLabel: 'Save',
        tone: 'primary',
      });
      if (!ok) return;
      await updateCategoryMutation.mutateAsync({ id: editingCategory.id, payload });
      return;
    }
    if (!eventId) return toast.error('Schedule an event before managing the store');
    await createCategoryMutation.mutateAsync({ ...payload, eventId });
  }

  async function handleProductSubmit(payload: StoreProductPayload) {
    if (editingProduct) {
      const ok = await confirm({
        title: 'Save product?',
        message: `Update “${editingProduct.name}”?`,
        confirmLabel: 'Save',
        tone: 'primary',
      });
      if (!ok) return;
      await updateProductMutation.mutateAsync({ id: editingProduct.id, payload });
      return;
    }
    if (!eventId) return toast.error('Schedule an event before managing the store');
    await createProductMutation.mutateAsync({ ...payload, eventId });
  }

  async function handleDeleteCategory(category: PublicStoreCategory) {
    const ok = await confirm({
      title: 'Delete category?',
      message: `Delete “${category.name}”? Products in it become uncategorized.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteCategoryMutation.mutateAsync(category.id);
  }

  async function handleDeleteProduct(product: PublicStoreProduct) {
    const ok = await confirm({
      title: 'Delete product?',
      message: `Delete “${product.name}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteProductMutation.mutateAsync(product.id);
  }

  const categories = categoriesQuery.data?.items ?? [];
  const canEdit = Boolean(eventId);
  const bootstrapLoading =
    workspaceQuery.isLoading ||
    (Boolean(eventId) && (categoriesQuery.isLoading || productsQuery.isLoading));
  const categorySaving = createCategoryMutation.isPending || updateCategoryMutation.isPending;
  const productSaving = createProductMutation.isPending || updateProductMutation.isPending;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">Commerce</span>
          <h1>Store</h1>
          <p className="muted">
            {isPastEdition
              ? 'Catalog for a past edition — still editable by admins.'
              : 'Categories and products for the selected event. Changes sync to the mobile app.'}
          </p>
        </div>
        {canEdit ? (
          <div className="page-header-actions">
            {tab === 'categories' ? (
              <Button
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryModalOpen(true);
                }}
              >
                <Plus size={16} />
                Add category
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setEditingProduct(null);
                  setProductModalOpen(true);
                }}
              >
                <Plus size={16} />
                Add product
              </Button>
            )}
          </div>
        ) : null}
      </header>

      <EditionSwitcher />

      <div className="toolbar" style={{ gap: 8 }}>
        <Button
          variant={tab === 'products' ? 'primary' : 'secondary'}
          onClick={() => setTab('products')}
        >
          <Package size={16} />
          Products
        </Button>
        <Button
          variant={tab === 'categories' ? 'primary' : 'secondary'}
          onClick={() => setTab('categories')}
        >
          <ShoppingBag size={16} />
          Categories
        </Button>
      </div>

      {tab === 'products' ? (
        <div className="toolbar">
          <SearchSuggest
            label="Search"
            placeholder="Product name, SKU, or description"
            value={search}
            onChange={applySearch}
            disabled={!eventId}
            loadSuggestions={async (draft) => {
              if (!eventId) return [];
              const result = await storeApi.listProducts({
                search: draft,
                perPage: 6,
                eventId,
              });
              return result.items.map((product) => ({
                id: product.id,
                title: product.name,
                subtitle: money(product.price, product.currency),
              }));
            }}
          />
          <label className="field" style={{ minWidth: 180 }}>
            <span className="field-label">Category</span>
            <select
              className="field-input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              disabled={!eventId}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {search && tab === 'products' ? (
        <div className="active-filter-chip">
          Showing results for “{search}”
          <button type="button" aria-label="Clear filter" onClick={() => applySearch('')}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      {bootstrapLoading ? <Spinner /> : null}
      {!bootstrapLoading && !eventId ? (
        <p className="form-error">Schedule an event before managing the store.</p>
      ) : null}

      {eventId && tab === 'categories' && categoriesQuery.data ? (
        categories.length === 0 ? (
          <div className="empty-state">
            <ShoppingBag size={28} />
            <h2>No categories yet</h2>
            <p className="muted">Create categories to organize products in the app.</p>
            {canEdit ? (
              <Button
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryModalOpen(true);
                }}
              >
                <Plus size={16} />
                Add category
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Products</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className="cell-stack" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        {category.image ? (
                          <img
                            src={resolveMediaUrl(category.image)}
                            alt=""
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }}
                          />
                        ) : null}
                        <div>
                          <strong>{category.name}</strong>
                          {category.description ? (
                            <span className="muted cell-clamp">{category.description}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>{category.productCount}</td>
                    <td>{category.sortOrder}</td>
                    <td>
                      <span className={`badge ${category.isActive ? 'role-member' : 'role-admin'}`}>
                        {category.isActive ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="actions">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingCategory(category);
                          setCategoryModalOpen(true);
                        }}
                      >
                        <Pencil size={14} />
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => void handleDeleteCategory(category)}
                        disabled={deleteCategoryMutation.isPending}
                      >
                        <Trash2 size={14} />
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {eventId && tab === 'products' && productsQuery.data ? (
        productsQuery.data.items.length === 0 ? (
          <div className="empty-state">
            <Package size={28} />
            <h2>No products yet</h2>
            <p className="muted">Add products with price, images, and inventory.</p>
            {canEdit ? (
              <Button
                onClick={() => {
                  setEditingProduct(null);
                  setProductModalOpen(true);
                }}
              >
                <Plus size={16} />
                Add product
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {productsQuery.data.items.map((product) => {
                  const thumb = product.images[0];
                  return (
                    <tr key={product.id}>
                      <td>
                        <div
                          className="cell-stack"
                          style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
                        >
                          {thumb ? (
                            <img
                              src={resolveMediaUrl(thumb)}
                              alt=""
                              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }}
                            />
                          ) : null}
                          <div>
                            <strong>{product.name}</strong>
                            {product.sku ? <span className="hint">SKU {product.sku}</span> : null}
                            {product.featured ? <span className="hint">Featured</span> : null}
                          </div>
                        </div>
                      </td>
                      <td>{product.categoryName ?? '—'}</td>
                      <td>
                        {money(product.price, product.currency)}
                        {product.compareAtPrice != null ? (
                          <span className="muted" style={{ display: 'block', textDecoration: 'line-through' }}>
                            {money(product.compareAtPrice, product.currency)}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {product.inStock
                          ? product.isLowStock
                            ? `Low (${product.stockQty})`
                            : product.stockQty
                          : 'Out of stock'}
                      </td>
                      <td>
                        <span className={`badge ${product.isActive ? 'role-member' : 'role-admin'}`}>
                          {product.isActive ? 'Active' : 'Hidden'}
                        </span>
                      </td>
                      <td className="actions">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingProduct(product);
                            setProductModalOpen(true);
                          }}
                        >
                          <Pencil size={14} />
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => void handleDeleteProduct(product)}
                          disabled={deleteProductMutation.isPending}
                        >
                          <Trash2 size={14} />
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ListPagination
              page={productsQuery.data.meta.page}
              totalPages={productsQuery.data.meta.totalPages}
              total={productsQuery.data.meta.total}
              perPage={productsQuery.data.meta.perPage}
              onPageChange={setPage}
              label="products"
            />
          </div>
        )
      ) : null}

      <CategoryFormModal
        open={categoryModalOpen}
        mode={editingCategory ? 'edit' : 'create'}
        initial={editingCategory}
        loading={categorySaving}
        onClose={closeCategoryModal}
        onSubmit={handleCategorySubmit}
      />
      <ProductFormModal
        open={productModalOpen}
        mode={editingProduct ? 'edit' : 'create'}
        initial={editingProduct}
        categories={categories}
        loading={productSaving}
        onClose={closeProductModal}
        onSubmit={handleProductSubmit}
      />
    </div>
  );
}
