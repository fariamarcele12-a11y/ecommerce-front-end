// src/app/core/services/product.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import {
  Observable,
  throwError,
  catchError,
  tap,
  map,
  shareReplay,
  BehaviorSubject,
  of,
  switchMap,
} from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Product } from '../models/ProductModel/product.model';
import { ProductFilters } from '../models/ProductModel/product-filters.model';
import { IdGeneratorService } from './id-generator.service';
import { CategoryService } from './category.service'; // 🔥 IMPORTAR CategoryService

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
  private readonly categoryService: CategoryService; // 🔥 ADICIONAR

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    http: HttpClient,
    idGenerator: IdGeneratorService,
    categoryService: CategoryService, // 🔥 ADICIONAR no construtor
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.http = http;
    this.idGenerator = idGenerator;
    this.categoryService = categoryService; // 🔥 ATRIBUIR

    if (this.isBrowser) {
      this.loadFavoritesFromStorage();
    }
  }

  /**
   * Busca produtos com suporte para forçar recarga
   */
  getProducts(filters?: ProductFilters, useCache: boolean = true): Observable<ProductResponse> {
    const filtersKey = JSON.stringify(filters || {});
    const cacheKey = `${filtersKey}`;

    if (this.lastFilters !== cacheKey) {
      console.log('🔄 Filtros mudaram, invalidando cache');
      this.invalidateCache();
      this.lastFilters = cacheKey;
    }

    if (useCache && this.productsCache$ && Date.now() - this.lastCacheTime < this.cacheDuration) {
      console.log('📦 Usando cache para filtros:', filters);
      return this.productsCache$;
    }

    let params = new HttpParams();

    const page = filters?.page || 1;
    const limit = filters?.limit || 12;

    if (filters) {
      if (filters.category) {
        params = params.set('category', filters.category);
        console.log(`🔍 Filtrando por categoria: "${filters.category}"`);
      }
      if (filters.minPrice !== undefined && filters.minPrice !== null) {
        params = params.set('price_gte', filters.minPrice.toString());
      }
      if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
        params = params.set('price_lte', filters.maxPrice.toString());
      }
      if (filters.search) {
        params = params.set('q', filters.search);
      }
      if (filters.condition) {
        params = params.set('condition', filters.condition);
      }
      if (filters.location) {
        params = params.set('location', filters.location);
      }
      if (filters.sortBy === 'price_asc') {
        params = params.set('_sort', 'price');
        params = params.set('_order', 'asc');
      } else if (filters.sortBy === 'price_desc') {
        params = params.set('_sort', 'price');
        params = params.set('_order', 'desc');
      } else if (filters.sortBy === 'newest') {
        params = params.set('_sort', 'createdAt');
        params = params.set('_order', 'desc');
      } else if (filters.sortBy === 'popular') {
        params = params.set('_sort', 'seller.sales');
        params = params.set('_order', 'desc');
      }
      if (filters.limit) {
        params = params.set('_limit', filters.limit.toString());
      }
      if (filters.page) {
        params = params.set('_page', filters.page.toString());
        if (filters.limit) {
          params = params.set('_limit', filters.limit.toString());
        }
      }
    }

    params = params.set('_page', page.toString());
    params = params.set('_limit', limit.toString());
    params = params.set('_t', Date.now().toString());

    console.log('🌐 URL da requisição:', `${this.apiUrl}?${params.toString()}`);

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
        map((response) => {
          let products = response.body || [];
          const total =
            parseInt(response.headers.get('X-Total-Count') || '0', 10) || products.length;

          if (filters?.category) {
            const categoryName = filters.category;
            products = products.filter((p: Product) => p.category === categoryName);
            console.log(
              `🔍 Filtro manual aplicado: "${categoryName}" -> ${products.length} produtos`,
            );
          }

          const favorites = this.favoritesSubject.value;
          products.forEach((product: Product) => {
            product.isFavorite = favorites.includes(String(product.id));
          });

          const totalPages = Math.ceil(total / limit) || 1;

          console.log(`📦 ${products.length} produtos retornados (Total: ${total})`);
          console.log('📋 Categorias encontradas:', [
            ...new Set(products.map((p: Product) => p.category)),
          ]);

          return {
            products,
            total: total,
            page,
            limit,
            totalPages,
          } as ProductResponse;
        }),
        tap((response) => {
          this.lastCacheTime = Date.now();
          console.log(
            `✅ ${response.products.length} produtos carregados (Total: ${response.total})`,
          );
        }),
        shareReplay(1),
        catchError(this.handleError),
      );

    this.productsCache$ = request;
    return request;
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
    console.log('🔑 ID único gerado para o produto:', productId);

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

    console.log('📦 Enviando para API:', JSON.stringify(newProduct, null, 2));

    return this.http.post<Product>(this.apiUrl, newProduct).pipe(
      tap((response) => {
        console.log('✅ Produto criado com ID:', response.id);
        this.invalidateCache();
      }),
      catchError((error) => {
        console.error('❌ Erro detalhado:', error);
        if (error.error) {
          console.error('❌ Resposta do servidor:', error.error);
        }
        return this.handleError(error);
      }),
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

  /**
   * 🔥 DELETE PRODUCT - CORRIGIDO
   */
  deleteProduct(id: string): Observable<void> {
    console.log(`🗑️ Excluindo produto com ID: ${id}`);

    // 🔥 Tentativa direta de exclusão SEM verificação prévia
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        console.log(`✅ Produto ${id} excluído com sucesso!`);
        this.invalidateCache();
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erro ao excluir produto:', error);

        // 🔥 Se for erro 404, produto já foi excluído
        if (error.status === 404) {
          console.warn('⚠️ Produto já foi excluído anteriormente');
          this.invalidateCache();
          return of(void 0);
        }

        // 🔥 Se for erro 500, tentar via PATCH (desativar)
        if (error.status === 500) {
          console.warn('⚠️ Erro 500 no DELETE, tentando desativar produto...');
          return this.deactivateProduct(id);
        }

        return throwError(() => new Error('Não foi possível excluir o produto. Tente novamente.'));
      }),
    );
  }

  private deactivateProduct(id: string): Observable<void> {
    console.log(`🔄 Desativando produto ${id}...`);

    return this.http
      .patch<Product>(`${this.apiUrl}/${id}`, {
        active: false,
        deletedAt: new Date().toISOString(),
      })
      .pipe(
        tap(() => {
          console.log(`✅ Produto ${id} desativado com sucesso!`);
          this.invalidateCache();
        }),
        map(() => void 0),
        catchError((error: HttpErrorResponse) => {
          console.error('❌ Falha ao desativar produto:', error);

          // 🔥 Último recurso: invalidar cache e retornar sucesso
          this.invalidateCache();
          return of(void 0);
        }),
      );
  }
  /**
   * 🔥 UPDATE CATEGORY PRODUCT COUNT - CORRIGIDO
   */
  private updateCategoryProductCount(categoryName: string, delta: number): void {
    if (!categoryName) {
      console.warn('⚠️ Categoria não informada, pulando atualização');
      return;
    }

    console.log(
      `🔄 Atualizando contador da categoria: ${categoryName} (${delta > 0 ? '+' : ''}${delta})`,
    );

    // Buscar a categoria pelo nome usando o categoryService
    this.categoryService.getCategories().subscribe({
      next: (categories: any[]) => {
        const category = categories.find((c: any) => c.name === categoryName);
        if (category) {
          const newCount = Math.max(0, (category.productCount || 0) + delta);
          console.log(`📊 Novo contador: ${newCount} (era ${category.productCount})`);

          this.categoryService
            .updateCategory(category.id, {
              productCount: newCount,
            })
            .subscribe({
              next: (updated: any) => {
                console.log(
                  `✅ Categoria "${updated.name}" atualizada para ${updated.productCount} produtos`,
                );
              },
              error: (error: any) => {
                console.error('❌ Erro ao atualizar contador da categoria:', error);
              },
            });
        } else {
          console.warn(`⚠️ Categoria não encontrada: ${categoryName}`);
        }
      },
      error: (error: any) => {
        console.error('❌ Erro ao buscar categorias:', error);
      },
    });
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
        catchError((error: HttpErrorResponse) => {
          console.warn('⚠️ Erro ao sincronizar favorito, mantendo estado local:', error);
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
      if (!currentFavorites.includes(productId)) {
        newFavorites = [...currentFavorites, productId];
      } else {
        newFavorites = currentFavorites;
      }
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
          errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
          break;
        case 404:
          errorMessage = 'Produto não encontrado.';
          break;
        case 409:
          errorMessage = 'Conflito ao processar a requisição.';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
          break;
        default:
          errorMessage = `Código: ${error.status}, Mensagem: ${error.message}`;
      }
    }

    console.error('❌ Erro no ProductService:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
