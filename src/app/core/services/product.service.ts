// src/app/core/services/product.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import {
  Observable,
  throwError,
  catchError,
  map,
  BehaviorSubject,
  of,
} from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Product } from '../models/ProductModel/product.model';
import { ProductFilters } from '../models/ProductModel/product-filters.model';
import { CategoryService } from './category.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/enviroment';

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
  private apiUrl = `${environment.apiUrl}/products`;

  private favoritesSubject = new BehaviorSubject<string[]>([]);
  public favorites$ = this.favoritesSubject.asObservable();

  private readonly FAVORITES_KEY_PREFIX = 'favorites_';
  private readonly GUEST_FAVORITES_KEY = 'favorites_guest';

  private isBrowser: boolean;
  private currentUserId: string | null = null;

  private readonly http: HttpClient;
  private readonly categoryService: CategoryService;
  private readonly authService: AuthService;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    http: HttpClient,
    categoryService: CategoryService,
    authService: AuthService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.http = http;
    this.categoryService = categoryService;
    this.authService = authService;

    this.authService.currentUser$.subscribe((user) => {
      const newUserId = user?.id ? String(user.id) : null;
      if (this.currentUserId !== newUserId) {
        this.currentUserId = newUserId;
        this.loadFavoritesForCurrentUser();
      }
    });

    if (this.isBrowser) {
      this.loadFavoritesForCurrentUser();
    }
  }

  // ============================================================
  // FAVORITOS
  // ============================================================
  private getFavoritesKey(): string {
    return this.currentUserId
      ? `${this.FAVORITES_KEY_PREFIX}${this.currentUserId}`
      : this.GUEST_FAVORITES_KEY;
  }

  private loadFavoritesForCurrentUser(): void {
    if (!this.isBrowser) return;
    try {
      const data = localStorage.getItem(this.getFavoritesKey());
      if (data) {
        this.favoritesSubject.next(JSON.parse(data) || []);
      } else {
        this.favoritesSubject.next([]);
      }
    } catch (error) {
      console.error('Erro ao carregar favoritos:', error);
      this.favoritesSubject.next([]);
    }
  }

  private updateFavorites(productId: string, isFavorite: boolean): void {
    const current = this.favoritesSubject.value;
    const next = isFavorite
      ? current.includes(productId) ? current : [...current, productId]
      : current.filter((id) => id !== productId);

    this.favoritesSubject.next(next);

    if (this.isBrowser) {
      try {
        localStorage.setItem(this.getFavoritesKey(), JSON.stringify(next));
      } catch (error) {
        console.error('Erro ao salvar favoritos:', error);
      }
    }
  }

  // ============================================================
  // GET PRODUCTS
  // ============================================================
  getProducts(filters?: ProductFilters, useCache: boolean = true): Observable<ProductResponse> {
    let params = new HttpParams();

    if (filters) {
      if (filters.page) params = params.set('page', filters.page.toString());
      if (filters.limit) params = params.set('limit', filters.limit.toString());
      if (filters.category) params = params.set('category', filters.category);
      if (filters.search) params = params.set('search', filters.search);
      if (filters.minPrice !== undefined && filters.minPrice > 0)
        params = params.set('minPrice', filters.minPrice.toString());
      if (filters.maxPrice !== undefined && filters.maxPrice < 10000)
        params = params.set('maxPrice', filters.maxPrice.toString());
      if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
      if (filters.storeId) params = params.set('storeId', filters.storeId);
      if (filters.sellerId) params = params.set('sellerId', filters.sellerId);
    }

    return this.http.get<ProductResponse>(this.apiUrl, { params }).pipe(
      map((response) => {
        const favorites = this.favoritesSubject.value;
        response.products.forEach((p) => {
          p.isFavorite = favorites.includes(String(p.id));
        });
        return response;
      }),
      catchError(this.handleError),
    );
  }

  // ============================================================
  // GET BY ID
  // ============================================================
  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`).pipe(
      map((product) => {
        product.isFavorite = this.favoritesSubject.value.includes(String(product.id));
        return product;
      }),
      catchError(this.handleError),
    );
  }

  // ============================================================
  // GET PRODUCTS BY STORE
  // ============================================================
  getProductsByStore(storeId: string | number): Observable<Product[]> {
    const id = String(storeId);
    const params = new HttpParams().set('storeId', id).set('limit', '100');

    return this.http.get<ProductResponse>(this.apiUrl, { params }).pipe(
      map((response) => {
        const favorites = this.favoritesSubject.value;
        response.products.forEach((p) => {
          p.isFavorite = favorites.includes(String(p.id));
        });
        return response.products;
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar produtos da loja:', error);
        return of([]);
      }),
    );
  }

  // ============================================================
  // OUTROS GETs
  // ============================================================
  getRelatedProducts(category: string, productId: string, limit: number = 4): Observable<Product[]> {
    const params = new HttpParams()
      .set('category', category)
      .set('limit', limit.toString());

    return this.http.get<ProductResponse>(this.apiUrl, { params }).pipe(
      map((res) => res.products.filter((p) => String(p.id) !== String(productId))),
      catchError(this.handleError),
    );
  }

  getProductsByCategory(category: string, limit?: number): Observable<Product[]> {
    let params = new HttpParams().set('category', category);
    if (limit) params = params.set('limit', limit.toString());

    return this.http.get<ProductResponse>(this.apiUrl, { params }).pipe(
      map((res) => res.products),
      catchError(this.handleError),
    );
  }

  getFeaturedProducts(limit: number = 8): Observable<Product[]> {
    const params = new HttpParams().set('sortBy', 'sales').set('limit', limit.toString());
    return this.http.get<ProductResponse>(this.apiUrl, { params }).pipe(
      map((res) => res.products),
      catchError(this.handleError),
    );
  }

  getProductsOnSale(limit: number = 8): Observable<Product[]> {
    const params = new HttpParams().set('limit', '100');
    return this.http.get<ProductResponse>(this.apiUrl, { params }).pipe(
      map((res) => res.products.filter((p) => p.originalPrice && p.originalPrice > p.price).slice(0, limit)),
      catchError(this.handleError),
    );
  }

  getProductsByPriceRange(minPrice: number, maxPrice: number, limit?: number): Observable<Product[]> {
    let params = new HttpParams()
      .set('minPrice', minPrice.toString())
      .set('maxPrice', maxPrice.toString());
    if (limit) params = params.set('limit', limit.toString());

    return this.http.get<ProductResponse>(this.apiUrl, { params }).pipe(
      map((res) => res.products),
      catchError(this.handleError),
    );
  }

  searchProducts(searchTerm: string, limit?: number): Observable<Product[]> {
    let params = new HttpParams().set('search', searchTerm);
    if (limit) params = params.set('limit', limit.toString());

    return this.http.get<ProductResponse>(this.apiUrl, { params }).pipe(
      map((res) => res.products),
      catchError(this.handleError),
    );
  }

  // ============================================================
  // 🔥 UPLOAD DE IMAGEM (Cloudinary via backend)
  // ============================================================
  uploadProductImage(base64Image: string): Observable<{ imageUrl: string }> {
    return this.http
      .post<{ imageUrl: string }>(
        `${this.apiUrl}/upload-image`,
        { base64Image },
        { headers: this.authHeaders() }
      )
      .pipe(
        catchError((error) => {
          console.error('❌ Erro ao enviar imagem:', error);
          const msg = error?.error?.message || 'Falha ao enviar imagem.';
          return throwError(() => new Error(msg));
        })
      );
  }

  // ============================================================
  // CREATE
  // ============================================================
  createProduct(product: Partial<Product>): Observable<Product> {
    const images = (product.images ?? []).filter((i) => i && i.trim() !== '');
    const payload = {
      name: product.name || '',
      description: product.description || '',
      category: product.category || '',
      price: Number(product.price) || 0,
      originalPrice: product.oldPrice && product.oldPrice > 0 ? Number(product.oldPrice) : null,
      stock: Number(product.stock) || 0,
      mainImage: images[0] ?? null,
      images: images.length > 0 ? images : null,
      condition: product.condition || 'new',
      location: product.location || null,
      freeShipping: product.freeShipping ?? false,
      featured: product.featured ?? false,
      storeId: product.storeId || null,
    };

    return this.http
      .post<Product>(this.apiUrl, payload, { headers: this.authHeaders() })
      .pipe(catchError(this.handleError));
  }

  // ============================================================
  // UPDATE
  // ============================================================
  updateProduct(id: string, product: Partial<Product>): Observable<Product> {
    const images = product.images
      ? product.images.filter((i) => i && i.trim() !== '')
      : undefined;

    const payload: any = {
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      originalPrice: product.oldPrice !== undefined
        ? (product.oldPrice > 0 ? product.oldPrice : null)
        : undefined,
      stock: product.stock,
      mainImage: images && images.length > 0 ? images[0] : undefined,
      images: images,
      condition: product.condition,
      location: product.location,
      freeShipping: product.freeShipping,
      active: product.active,
      featured: product.featured,
    };

    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    return this.http
      .patch<Product>(`${this.apiUrl}/${id}`, payload, { headers: this.authHeaders() })
      .pipe(catchError(this.handleError));
  }

  // ============================================================
  // DELETE
  // ============================================================
  deleteProduct(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${id}`, { headers: this.authHeaders() })
      .pipe(catchError(this.handleError));
  }

  // ============================================================
  // FAVORITOS (toggle)
  // ============================================================
  toggleFavorite(productId: string): Observable<Product> {
    const current = this.favoritesSubject.value;
    const newStatus = !current.includes(productId);

    this.updateFavorites(productId, newStatus);

    return this.getProductById(productId).pipe(
      map((product) => ({ ...product, isFavorite: newStatus })),
      catchError(() => {
        return of({ id: productId, isFavorite: newStatus } as Product);
      }),
    );
  }

  getFavoriteProducts(): Observable<Product[]> {
    const ids = this.favoritesSubject.value;
    if (ids.length === 0) return of([]);

    const requests = ids.map((id) =>
      this.getProductById(id).pipe(catchError(() => of(null)))
    );

    return new Observable((subscriber) => {
      Promise.all(requests.map((r) => r.toPromise())).then((products) => {
        subscriber.next(products.filter((p) => p !== null) as Product[]);
        subscriber.complete();
      });
    });
  }

  clearFavorites(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.getFavoritesKey());
    this.favoritesSubject.next([]);
  }

  clearAllFavorites(): void {
    if (!this.isBrowser) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(this.FAVORITES_KEY_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    this.favoritesSubject.next([]);
  }

  // ============================================================
  // CACHE (stubs)
  // ============================================================
  invalidateCache(): void {}
  refreshProducts(filters?: ProductFilters): Observable<ProductResponse> {
    return this.getProducts(filters, false);
  }

  // ============================================================
  // HEADERS
  // ============================================================
  private authHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }

  // ============================================================
  // ERROR
  // ============================================================
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocorreu um erro ao processar sua requisição.';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 0: errorMessage = 'Não foi possível conectar ao servidor.'; break;
        case 401: errorMessage = 'Sessão expirada. Faça login novamente.'; break;
        case 403: errorMessage = 'Você não tem permissão para esta ação.'; break;
        case 404: errorMessage = 'Produto não encontrado.'; break;
        case 500: errorMessage = error?.error?.message || 'Erro interno do servidor.'; break;
        default: errorMessage = `Código: ${error.status}, Mensagem: ${error.message}`;
      }
    }

    console.error('❌ Erro no ProductService:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
