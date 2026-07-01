import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import {
  Observable,
  throwError,
  catchError,
  tap,
  map,
  shareReplay,
  BehaviorSubject,
  switchMap,
} from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Product } from '../models/ProductModel/product.model';
import { ProductFilters } from '../models/ProductModel/product-filters.model';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  // URLs da API
  private apiUrl = 'https://ecommerce-api-mf.vercel.app/products';
  private localApiUrl = 'http://localhost:3000/products';

  // Cache
  private productsCache$: Observable<Product[]> | null = null;
  private lastCacheTime = 0;
  private readonly cacheDuration = 5 * 60 * 1000; // 5 minutos

  // Favoritos
  private favoritesSubject = new BehaviorSubject<number[]>([]);
  public favorites$ = this.favoritesSubject.asObservable();

  private readonly isBrowser: boolean;
  private readonly http = inject(HttpClient);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);

    // Carregar favoritos do localStorage
    if (this.isBrowser) {
      this.loadFavoritesFromStorage();
    }
  }

  /**
   * Busca produtos com filtros
   */
  /**
   * Busca produtos com filtros
   */
  getProducts(filters?: ProductFilters, useCache = true): Observable<Product[]> {
    // Se usar cache e tiver cache válido
    if (useCache && this.productsCache$ && Date.now() - this.lastCacheTime < this.cacheDuration) {
      return this.productsCache$;
    }

    let params = new HttpParams();

    if (filters) {
      // Categoria - IMPORTANTE: verificar se está sendo aplicado
      if (filters.category) {
        params = params.set('category', filters.category);
        console.log(`🔍 Filtrando por categoria: ${filters.category}`);
      }

      // Preço mínimo
      if (filters.minPrice && filters.minPrice > 0) {
        params = params.set('price_gte', filters.minPrice.toString());
      }

      // Preço máximo
      if (filters.maxPrice && filters.maxPrice < 10000) {
        params = params.set('price_lte', filters.maxPrice.toString());
      }

      // Busca por texto
      if (filters.search) {
        params = params.set('q', filters.search);
      }

      // Condição
      if (filters.condition) {
        params = params.set('condition', filters.condition);
      }

      // Localização
      if (filters.location) {
        params = params.set('location', filters.location);
      }

      // Em promoção (tem desconto)
      if (filters.hasDiscount) {
        params = params.set('discount_ne', '0');
      }

      // Frete grátis
      if (filters.freeShipping) {
        params = params.set('freeShipping', 'true');
      }

      // Em estoque
      if (filters.inStock) {
        params = params.set('stock_gt', '0');
      }

      // Ordenação
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

      // Limite de resultados
      if (filters.limit) {
        params = params.set('_limit', filters.limit.toString());
      }

      // Paginação
      if (filters.page) {
        params = params.set('_page', filters.page.toString());
        if (filters.limit) {
          params = params.set('_limit', filters.limit.toString());
        }
      }
    }

    console.log('🔍 URL completa:', `${this.apiUrl}?${params.toString()}`);

    const request = this.http.get<Product[]>(this.apiUrl, { params }).pipe(
      tap((products) => {
        this.lastCacheTime = Date.now();
        const favorites = this.favoritesSubject.value;
        products.forEach((product) => {
          product.isFavorite = favorites.includes(product.id);
        });
        console.log(`📦 ${products.length} produtos encontrados`);
      }),
      shareReplay(1),
      catchError(this.handleError),
    );

    this.productsCache$ = request;
    return request;
  }

  /**
   * Busca produto por ID
   */
  getProductById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`).pipe(
      map((product) => {
        // Verificar se está nos favoritos
        const favorites = this.favoritesSubject.value;
        product.isFavorite = favorites.includes(product.id);
        return product;
      }),
      catchError(this.handleError),
    );
  }

  /**
   * Busca produtos relacionados
   */
  getRelatedProducts(category: string, productId: number, limit = 4): Observable<Product[]> {
    const params = new HttpParams()
      .set('category', category)
      .set('id_ne', productId.toString())
      .set('_limit', limit.toString());

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  /**
   * Busca produtos por categoria
   */
  getProductsByCategory(category: string, limit?: number): Observable<Product[]> {
    let params = new HttpParams().set('category', category);
    if (limit) {
      params = params.set('_limit', limit.toString());
    }

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  /**
   * Busca produtos em destaque (mais vendidos)
   */
  getFeaturedProducts(limit = 8): Observable<Product[]> {
    const params = new HttpParams()
      .set('_sort', 'seller.sales')
      .set('_order', 'desc')
      .set('_limit', limit.toString());

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  /**
   * Busca produtos com desconto
   */
  getProductsOnSale(limit = 8): Observable<Product[]> {
    const params = new HttpParams().set('discount_ne', '0').set('_limit', limit.toString());

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  /**
   * Busca produtos por faixa de preço
   */
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

  /**
   * Busca produtos por termo de busca
   */
  searchProducts(searchTerm: string, limit?: number): Observable<Product[]> {
    let params = new HttpParams().set('q', searchTerm);
    if (limit) {
      params = params.set('_limit', limit.toString());
    }

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  /**
   * Cria um novo produto
   */
  createProduct(product: Partial<Product>): Observable<Product> {
    const newProduct = {
      ...product,
      createdAt: new Date().toISOString(),
      isFavorite: false,
      seller: product.seller || {
        id: 1,
        name: 'Vendedor',
        rating: 0,
        sales: 0,
      },
    };

    return this.http.post<Product>(this.apiUrl, newProduct).pipe(
      tap(() => {
        // Invalidar cache
        this.invalidateCache();
      }),
      catchError(this.handleError),
    );
  }

  /**
   * Atualiza um produto
   */
  updateProduct(id: number, product: Partial<Product>): Observable<Product> {
    return this.http
      .patch<Product>(`${this.apiUrl}/${id}`, {
        ...product,
        updatedAt: new Date().toISOString(),
      })
      .pipe(
        tap(() => {
          // Invalidar cache
          this.invalidateCache();
        }),
        catchError(this.handleError),
      );
  }

  /**
   * Remove um produto
   */
  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        // Invalidar cache
        this.invalidateCache();
      }),
      catchError(this.handleError),
    );
  }

  /**
   * Alterna o status de favorito de um produto
   */
  toggleFavorite(productId: number): Observable<Product> {
    // Primeiro, obter o produto atual
    return this.http.get<Product>(`${this.apiUrl}/${productId}`).pipe(
      switchMap((product) => {
        // Alternar o status
        const newFavoriteStatus = !product.isFavorite;

        // Atualizar o produto
        return this.http
          .patch<Product>(`${this.apiUrl}/${productId}`, {
            isFavorite: newFavoriteStatus,
          })
          .pipe(
            tap(() => {
              // Atualizar lista de favoritos
              this.updateFavorites(productId, newFavoriteStatus);
              // Invalidar cache
              this.invalidateCache();
            }),
          );
      }),
      catchError(this.handleError),
    );
  }

  /**
   * Busca produtos favoritos
   */
  getFavoriteProducts(): Observable<Product[]> {
    const favoriteIds = this.favoritesSubject.value;
    if (favoriteIds.length === 0) {
      return new Observable((observer) => {
        observer.next([]);
        observer.complete();
      });
    }

    // Buscar produtos que estão na lista de favoritos
    let params = new HttpParams();
    favoriteIds.forEach((id) => {
      params = params.append('id', id.toString());
    });

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  /**
   * Atualiza a lista de favoritos
   */
  private updateFavorites(productId: number, isFavorite: boolean): void {
    const currentFavorites = this.favoritesSubject.value;
    let newFavorites: number[];

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

  /**
   * Carrega favoritos do localStorage
   */
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

  /**
   * Invalida o cache
   */
  invalidateCache(): void {
    this.productsCache$ = null;
    this.lastCacheTime = 0;
    console.log('🗑️ Cache de produtos invalidado');
  }

  /**
   * Força a atualização do cache
   */
  refreshProducts(filters?: ProductFilters): Observable<Product[]> {
    this.invalidateCache();
    return this.getProducts(filters, false);
  }

  /**
   * Alterna entre ambiente local e produção
   */
  setEnvironment(environment: 'local' | 'production'): void {
    if (environment === 'local') {
      this.apiUrl = this.localApiUrl;
    } else {
      this.apiUrl = 'https://ecommerce-api-mf.vercel.app/products';
    }
    this.invalidateCache();
  }

  /**
   * Tratamento de erros
   */
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

  /**
   * Verifica o status da API
   */
  checkApiHealth(): Observable<{ status: string; timestamp: string }> {
    const baseUrl = this.apiUrl.replace('/products', '');
    return this.http.get<{ status: string; timestamp: string }>(`${baseUrl}/health`).pipe(
      catchError((error) => {
        console.error('❌ API não está respondendo:', error);
        return throwError(() => new Error('API indisponível'));
      }),
    );
  }
}
