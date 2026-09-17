// src/app/core/services/product.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import {
  Observable,
  throwError,
  catchError,
  tap,
  map,
  BehaviorSubject,
  of,
  switchMap,
} from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Product } from '../models/ProductModel/product.model';
import { ProductFilters } from '../models/ProductModel/product-filters.model';
import { IdGeneratorService } from './id-generator.service';
import { CategoryService } from './category.service';

export interface ProductResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private apiUrl = 'http://localhost:3000/products';

  private productsCache$: Observable<ProductResponse> | null = null;
  private lastCacheTime = 0;
  private cacheDuration = 5 * 60 * 1000;
  private lastFilters: string = '';

  private favoritesSubject = new BehaviorSubject<string[]>([]);
  public favorites$ = this.favoritesSubject.asObservable();

  private isBrowser: boolean;
  private readonly http: HttpClient;
  private readonly idGenerator: IdGeneratorService;
  private readonly categoryService: CategoryService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    http: HttpClient,
    idGenerator: IdGeneratorService,
    categoryService: CategoryService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.http = http;
    this.idGenerator = idGenerator;
    this.categoryService = categoryService;

    if (this.isBrowser) {
      this.loadFavoritesFromStorage();
    }
  }

  /**
   * 🔥 Busca produtos com filtros
   */
  getProducts(filters?: ProductFilters, useCache: boolean = true): Observable<ProductResponse> {
    const filtersKey = JSON.stringify(filters || {});
    const cacheKey = `${filtersKey}`;

    // 🔥 Se filtros mudaram, invalidar cache
    if (this.lastFilters !== cacheKey) {
      this.productsCache$ = null;
      this.lastCacheTime = 0;
      this.lastFilters = cacheKey;
    }

    if (useCache && this.productsCache$ && Date.now() - this.lastCacheTime < this.cacheDuration) {
      return this.productsCache$;
    }

    let params = new HttpParams();

    const page = filters?.page || 1;
    const limit = filters?.limit || 12;

    const hasCategoryFilter = !!filters?.category;
    const hasLocationFilter = !!(filters?.state || filters?.city);
    const needsManualProcessing = hasCategoryFilter || hasLocationFilter;

    if (!needsManualProcessing) {
      params = params.set('_page', page.toString());
      params = params.set('_limit', limit.toString());
    }

    if (filters) {
      // Filtros que funcionam no servidor
      if (filters.minPrice !== undefined && filters.minPrice !== null && filters.minPrice > 0) {
        params = params.set('price_gte', filters.minPrice.toString());
      }
      if (filters.maxPrice !== undefined && filters.maxPrice !== null && filters.maxPrice < 10000) {
        params = params.set('price_lte', filters.maxPrice.toString());
      }
      if (filters.search) {
        params = params.set('q', filters.search);
      }
      if (filters.condition) {
        params = params.set('condition', filters.condition);
      }
      if (filters.sellerId) {
        params = params.set('seller.id', filters.sellerId);
      }

      if (!needsManualProcessing && filters.sortBy) {
        switch (filters.sortBy) {
          case 'price_asc':
            params = params.set('_sort', 'price');
            params = params.set('_order', 'asc');
            break;
          case 'price_desc':
            params = params.set('_sort', 'price');
            params = params.set('_order', 'desc');
            break;
          case 'newest':
            params = params.set('_sort', 'createdAt');
            params = params.set('_order', 'desc');
            break;
          case 'popular':
            params = params.set('_sort', 'seller.sales');
            params = params.set('_order', 'desc');
            break;
        }
      }
    }

    params = params.set('_t', Date.now().toString());

    const categorySlug = filters?.category;

    const request = this.http
      .get<any>(this.apiUrl, {
        params,
        observe: 'response',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      })
      .pipe(
        switchMap((response) => {
          let products: Product[] = response.body || [];
          let total = parseInt(response.headers.get('X-Total-Count') || '0', 10) || products.length;

          if (hasCategoryFilter && categorySlug) {
            return this.categoryService.getCategories().pipe(
              map((categories: any[]) => {
                const category = categories.find((c: any) => c.slug === categorySlug);
                const categoryName = category?.name || categorySlug;

                products = products.filter((p: Product) => p.category === categoryName);

                return this.applyAllFilters(products, filters, total, page, limit);
              }),
              catchError(() => {
                // Fallback: filtrar pelo slug também
                const slug = categorySlug;
                products = products.filter(
                  (p: Product) =>
                    p.category === slug ||
                    (p.category && p.category.toLowerCase() === slug.toLowerCase()),
                );
                return of(this.applyAllFilters(products, filters, total, page, limit));
              }),
            );
          }

          return of(this.applyAllFilters(products, filters, total, page, limit));
        }),
        tap((response) => {
          this.lastCacheTime = Date.now();
        }),
        catchError(this.handleError),
      );

    // 🔥 Salvar no cache apenas se useCache = true
    if (useCache) {
      this.productsCache$ = request;
    }

    return request;
  }

  private applyAllFilters(
    products: Product[],
    filters: ProductFilters | undefined,
    total: number,
    page: number,
    limit: number,
  ): ProductResponse {
    if (!filters) {
      return {
        products,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    if (filters.state) {
      const stateUF = filters.state.toUpperCase().trim();
      products = products.filter((p: Product) => {
        const location = (p.location || '').toUpperCase().trim();
        return (
          location.includes(`- ${stateUF}`) ||
          location.includes(`-${stateUF}`) ||
          location.endsWith(` ${stateUF}`) ||
          location.endsWith(stateUF)
        );
      });
    }

    if (filters.city) {
      const city = filters.city.toLowerCase().trim();
      products = products.filter((p: Product) => {
        const location = (p.location || '').toLowerCase().trim();
        return location.includes(city);
      });
    }

    if (filters.hasDiscount) {
      products = products.filter((p: Product) => p.oldPrice && p.oldPrice > p.price);
    }

    if (filters.freeShipping) {
      products = products.filter((p: Product) => p.freeShipping === true);
    }

    if (filters.inStock) {
      products = products.filter((p: Product) => p.stock > 0);
    }

    if (filters.condition) {
      products = products.filter((p: Product) => p.condition === filters.condition);
    }

    if (filters.minPrice !== undefined && filters.minPrice !== null && filters.minPrice > 0) {
      products = products.filter((p: Product) => p.price >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined && filters.maxPrice !== null && filters.maxPrice < 10000) {
      products = products.filter((p: Product) => p.price <= filters.maxPrice!);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase().trim();
      products = products.filter((p: Product) => {
        return (
          (p.name || '').toLowerCase().includes(search) ||
          (p.description || '').toLowerCase().includes(search)
        );
      });
    }

    if (filters.sortBy) {
      products = this.sortProducts(products, filters.sortBy);
    }

    const favorites = this.favoritesSubject.value;
    products.forEach((product: Product) => {
      product.isFavorite = favorites.includes(String(product.id));
    });

    total = products.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = products.slice(startIndex, endIndex);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      products: paginatedProducts,
      total,
      page,
      limit,
      totalPages,
    };
  }

  private sortProducts(products: Product[], sortBy: string): Product[] {
    const sorted = [...products];

    switch (sortBy) {
      case 'price_asc':
        return sorted.sort((a, b) => a.price - b.price);

      case 'price_desc':
        return sorted.sort((a, b) => b.price - a.price);

      case 'newest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

      case 'popular':
        return sorted.sort((a, b) => {
          const salesA = a.seller?.sales || 0;
          const salesB = b.seller?.sales || 0;
          return salesB - salesA;
        });

      case 'rating':
        return sorted.sort((a, b) => {
          const ratingA = a.seller?.rating || 0;
          const ratingB = b.seller?.rating || 0;
          return ratingB - ratingA;
        });

      case 'sales':
        return sorted.sort((a, b) => {
          const salesA = a.seller?.sales || 0;
          const salesB = b.seller?.sales || 0;
          return salesB - salesA;
        });

      default:
        return sorted;
    }
  }

  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`).pipe(
      map((product: Product) => {
        const favorites = this.favoritesSubject.value;
        product.isFavorite = favorites.includes(String(product.id));
        return product;
      }),
      catchError(this.handleError),
    );
  }

  getRelatedProducts(
    category: string,
    productId: string,
    limit: number = 4,
  ): Observable<Product[]> {
    const params = new HttpParams()
      .set('category', category)
      .set('id_ne', productId)
      .set('_limit', limit.toString());

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  getProductsByCategory(category: string, limit?: number): Observable<Product[]> {
    let params = new HttpParams().set('category', category);
    if (limit) {
      params = params.set('_limit', limit.toString());
    }

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  getFeaturedProducts(limit: number = 8): Observable<Product[]> {
    const params = new HttpParams()
      .set('_sort', 'seller.sales')
      .set('_order', 'desc')
      .set('_limit', limit.toString());

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  getProductsOnSale(limit: number = 8): Observable<Product[]> {
    const params = new HttpParams().set('discount_ne', '0').set('_limit', limit.toString());

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  getProductsByPriceRange(
    minPrice: number,
    maxPrice: number,
    limit?: number,
  ): Observable<Product[]> {
    let params = new HttpParams()
      .set('price_gte', minPrice.toString())
      .set('price_lte', maxPrice.toString());

    if (limit) {
      params = params.set('_limit', limit.toString());
    }

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  searchProducts(searchTerm: string, limit?: number): Observable<Product[]> {
    let params = new HttpParams().set('q', searchTerm);
    if (limit) {
      params = params.set('_limit', limit.toString());
    }

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  createProduct(product: Partial<Product>): Observable<Product> {
    const images =
      product.images && Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : ['https://via.placeholder.com/300x300/667eea/ffffff?text=Sem+Imagem'];

    const productId = this.idGenerator.generateProductId();

    const newProduct: any = {
      id: productId,
      name: product.name || '',
      description: product.description || '',
      price: Number(product.price) || 0,
      category: product.category || '',
      condition: product.condition || 'new',
      location: product.location || '',
      stock: Number(product.stock) || 1,
      images: images,
      storeId: product.storeId || '',
      createdAt: new Date().toISOString(),
    };

    if (product.oldPrice && product.oldPrice > 0) {
      newProduct.oldPrice = Number(product.oldPrice);
    }

    if (product.seller) {
      newProduct.seller = product.seller;
    }

    return this.http.post<Product>(this.apiUrl, newProduct).pipe(
      tap((response) => {
        this.invalidateCache();
      }),
      catchError(this.handleError),
    );
  }

  updateProduct(id: string, product: Partial<Product>): Observable<Product> {
    return this.http
      .patch<Product>(`${this.apiUrl}/${id}`, {
        ...product,
        updatedAt: new Date().toISOString(),
      })
      .pipe(
        tap(() => {
          this.invalidateCache();
        }),
        catchError(this.handleError),
      );
  }

  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.invalidateCache();
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.invalidateCache();
          return of(void 0);
        }
        if (error.status === 500) {
          return this.deactivateProduct(id);
        }
        return throwError(() => new Error('Não foi possível excluir o produto.'));
      }),
    );
  }

  private deactivateProduct(id: string): Observable<void> {
    return this.http
      .patch<Product>(`${this.apiUrl}/${id}`, {
        active: false,
        deletedAt: new Date().toISOString(),
      })
      .pipe(
        tap(() => {
          this.invalidateCache();
        }),
        map(() => void 0),
        catchError(() => {
          this.invalidateCache();
          return of(void 0);
        }),
      );
  }

  toggleFavorite(productId: string): Observable<Product> {
    const currentFavorites = this.favoritesSubject.value;
    const newFavoriteStatus = !currentFavorites.includes(productId);

    this.updateFavorites(productId, newFavoriteStatus);
    this.invalidateCache();

    return this.http
      .patch<Product>(`${this.apiUrl}/${productId}`, {
        isFavorite: newFavoriteStatus,
      })
      .pipe(
        tap(() => {
          this.updateFavorites(productId, newFavoriteStatus);
        }),
        catchError(() => {
          return this.getProductById(productId).pipe(
            map((product: Product) => ({
              ...product,
              isFavorite: newFavoriteStatus,
            })),
          );
        }),
      );
  }

  getFavoriteProducts(): Observable<Product[]> {
    const favoriteIds = this.favoritesSubject.value;
    if (favoriteIds.length === 0) {
      return of([]);
    }

    let params = new HttpParams();
    favoriteIds.forEach((id) => {
      params = params.append('id', id);
    });

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  private updateFavorites(productId: string, isFavorite: boolean): void {
    const currentFavorites = this.favoritesSubject.value;
    let newFavorites: string[];

    if (isFavorite) {
      newFavorites = currentFavorites.includes(productId)
        ? currentFavorites
        : [...currentFavorites, productId];
    } else {
      newFavorites = currentFavorites.filter((id) => id !== productId);
    }

    this.favoritesSubject.next(newFavorites);

    if (this.isBrowser) {
      try {
        localStorage.setItem('favorites', JSON.stringify(newFavorites));
      } catch (error) {
        console.error('Erro ao salvar favoritos:', error);
      }
    }
  }

  private loadFavoritesFromStorage(): void {
    if (!this.isBrowser) return;

    try {
      const favoritesData = localStorage.getItem('favorites');
      if (favoritesData) {
        const favorites = JSON.parse(favoritesData);
        this.favoritesSubject.next(favorites);
      }
    } catch (error) {
      console.error('Erro ao carregar favoritos:', error);
    }
  }

  invalidateCache(): void {
    this.productsCache$ = null;
    this.lastCacheTime = 0;
    this.lastFilters = '';
  }

  refreshProducts(filters?: ProductFilters): Observable<ProductResponse> {
    this.invalidateCache();
    return this.getProducts(filters, false);
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocorreu um erro ao processar sua requisição.';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 0:
          errorMessage = 'Não foi possível conectar ao servidor.';
          break;
        case 404:
          errorMessage = 'Produto não encontrado.';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor.';
          break;
        default:
          errorMessage = `Código: ${error.status}, Mensagem: ${error.message}`;
      }
    }

    console.error('❌ Erro no ProductService:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
