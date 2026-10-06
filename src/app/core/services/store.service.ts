// src/app/core/services/store.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map, switchMap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Store, StoreForm } from '../models/store.model';
import { User } from '../models/user.model';
import { Product } from '../models/ProductModel/product.model';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
import { AlertService } from './alert.service';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root',
})
export class StoreService {
  private apiUrl = `${environment.apiUrl}/stores`;
  private productsApiUrl = `${environment.apiUrl}/products`;
  private usersApiUrl = `${environment.apiUrl}/users`;

  private currentStoreSubject = new BehaviorSubject<Store | null>(null);
  public currentStore$ = this.currentStoreSubject.asObservable();

  private productsSubject = new BehaviorSubject<Product[]>([]);
  public products$ = this.productsSubject.asObservable();

  private filteredProductsSubject = new BehaviorSubject<Product[]>([]);
  public filteredProducts$ = this.filteredProductsSubject.asObservable();

  public loading = false;
  public products: Product[] = [];
  public filteredProducts: Product[] = [];

  private isBrowser: boolean;
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly productService = inject(ProductService);
  private readonly alertService = inject(AlertService);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this.loadStoreFromStorage();
    }
  }

  // ============================================================
  // HAS STORE
  // ============================================================
  hasStore(userId: number | string): Observable<boolean> {
    const id = String(userId);

    // Atalho local: se já sabe que tem loja, evita request
    if (this.isBrowser) {
      try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          if (userData.hasStore === true && userData.storeId) {
            return of(true);
          }
        }
      } catch (e) {
        console.error('Erro ao ler localStorage:', e);
      }
    }

    // Backend: GET /api/stores/user/{userId}
    //   → 200 = tem loja
    //   → 404 = não tem loja
    return this.http
      .get<Store>(`${this.apiUrl}/user/${id}`, { headers: this.authHeaders() })
      .pipe(
        map(() => true),
        catchError((error) => {
          if (error.status === 404) return of(false);
          console.error('❌ Erro ao verificar loja:', error);
          return of(false);
        }),
      );
  }

  // ============================================================
  // GET STORE BY USER
  // ============================================================
  getStoreByUser(userId: number | string): Observable<Store | null> {
    const id = String(userId);
    return this.http
      .get<Store>(`${this.apiUrl}/user/${id}`, { headers: this.authHeaders() })
      .pipe(
        tap((store) => {
          if (store && this.isBrowser) {
            localStorage.setItem('currentStore', JSON.stringify(store));
            this.currentStoreSubject.next(store);

            // Sincroniza o user com hasStore/storeId
            const userData = localStorage.getItem('currentUser');
            if (userData) {
              try {
                const user = JSON.parse(userData);
                if (user && (!user.hasStore || !user.storeId)) {
                  const updatedUser = {
                    ...user,
                    hasStore: true,
                    storeId: String(store.id),
                  };
                  localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                  this.authService.forceUpdateUser(updatedUser);
                }
              } catch (e) {
                console.error('Erro ao atualizar usuário:', e);
              }
            }
          }
        }),
        catchError((error) => {
          if (error.status === 404) {
            // Não tem loja — não é erro
            if (this.isBrowser) localStorage.removeItem('currentStore');
            this.currentStoreSubject.next(null);
            return of(null);
          }
          console.error('❌ Erro ao buscar loja:', error);
          return of(null);
        }),
      );
  }

  // ============================================================
  // GET STORE BY ID (público)
  // ============================================================
  getStoreById(id: string | number): Observable<Store | null> {
    const storeId = String(id);
    return this.http.get<Store>(`${this.apiUrl}/${storeId}`).pipe(
      tap((store) => console.log('🏪 Loja encontrada:', store?.storeName)),
      catchError((error) => {
        console.error('❌ Erro ao buscar loja:', error);
        return of(null);
      }),
    );
  }

  // ============================================================
  // LISTAR LOJAS (público, com filtros e paginação)
  // ============================================================
  listStores(filters: {
    category?: string;
    search?: string;
    city?: string;
    state?: string;
    minRating?: number;
    sortBy?: 'rating' | 'sales' | 'newest' | 'name';
    page?: number;
    limit?: number;
  } = {}): Observable<{
    stores: Store[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });

    const url = params.toString() ? `${this.apiUrl}?${params.toString()}` : this.apiUrl;

    return this.http
      .get<{
        stores: Store[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(url)
      .pipe(
        catchError((error) => {
          console.error('❌ Erro ao listar lojas:', error);
          return of({ stores: [], total: 0, page: 1, limit: 20, totalPages: 0 });
        }),
      );
  }

  // ============================================================
  // GET STORE PRODUCTS — chama direto o endpoint /api/products?storeId=...
  // ============================================================
  getStoreProducts(storeId: string | number): Observable<Product[]> {
    const id = String(storeId);

    return this.http
      .get<{ products: Product[] } | Product[]>(`${this.productsApiUrl}?storeId=${id}&limit=100`)
      .pipe(
        map((response) => {
          // Backend retorna { products, total, page, ... } — extrai o array
          const list = Array.isArray(response) ? response : (response.products ?? []);
          return list as Product[];
        }),
        tap((products) => {
          this.products = products;
          this.filteredProducts = products;
          this.productsSubject.next(products);
          this.filteredProductsSubject.next(products);
        }),
        catchError((error) => {
          console.error('❌ Erro ao buscar produtos da loja:', error);
          return of([] as Product[]);
        }),
      );
  }

  // ============================================================
  // CREATE STORE PRODUCT
  // ============================================================
  createStoreProduct(storeId: string | number, productData: Partial<Product>): Observable<Product> {
    const id = String(storeId);

    const payload: any = {
      name: productData.name,
      description: productData.description ?? '',
      category: productData.category ?? '',
      price: productData.price ?? 0,
      originalPrice: productData.originalPrice ?? null,
      stock: productData.stock ?? 0,
      mainImage: productData.mainImage ?? null,
      images: (productData as any).images ?? null,
      featured: (productData as any).featured ?? false,
      storeId: id,
    };

    return this.http
      .post<Product>(this.productsApiUrl, payload, { headers: this.authHeaders() })
      .pipe(
        tap((product) => {
          this.products.push(product);
          this.filteredProducts = [...this.products];
          this.productsSubject.next(this.products);
          this.filteredProductsSubject.next(this.filteredProducts);
        }),
        catchError((error) => {
          console.error('❌ Erro ao criar produto:', error);
          const msg = error?.error?.message || 'Erro ao criar produto. Tente novamente.';
          return throwError(() => new Error(msg));
        }),
      );
  }

  // ============================================================
  // UPDATE STORE PRODUCT
  // ============================================================
  updateStoreProduct(productId: string, productData: Partial<Product>): Observable<Product> {
    const payload: any = {
      name: productData.name,
      description: productData.description,
      category: productData.category,
      price: productData.price,
      originalPrice: productData.originalPrice,
      stock: productData.stock,
      mainImage: productData.mainImage,
      images: (productData as any).images,
      active: (productData as any).active,
      featured: (productData as any).featured,
    };

    // Remove chaves undefined para não sobrescrever no backend
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    return this.http
      .patch<Product>(`${this.productsApiUrl}/${productId}`, payload, {
        headers: this.authHeaders(),
      })
      .pipe(
        tap((product) => {
          const index = this.products.findIndex((p) => String(p.id) === productId);
          if (index !== -1) {
            this.products[index] = product;
            this.filteredProducts = [...this.products];
            this.productsSubject.next(this.products);
            this.filteredProductsSubject.next(this.filteredProducts);
          }
        }),
        catchError((error) => {
          console.error('❌ Erro ao atualizar produto:', error);
          return throwError(() => new Error('Erro ao atualizar produto.'));
        }),
      );
  }

  // ============================================================
  // DELETE PRODUCT
  // ============================================================
  deleteProduct(productId: string): void {
    const productToDelete = this.products.find((p) => String(p.id) === productId);
    if (!productToDelete) {
      this.alertService.warning('Produto não encontrado', 'Este produto não está mais disponível.');
      return;
    }

    this.alertService
      .confirm(
        'Excluir produto?',
        `Tem certeza que deseja excluir "${productToDelete.name}"? Esta ação não pode ser desfeita.`,
        'Sim, excluir',
        'Cancelar',
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.loading = true;
          const previousProducts = [...this.products];
          const previousFiltered = [...this.filteredProducts];

          this.products = this.products.filter((p) => String(p.id) !== productId);
          this.filteredProducts = this.filteredProducts.filter((p) => String(p.id) !== productId);
          this.productsSubject.next(this.products);
          this.filteredProductsSubject.next(this.filteredProducts);

          this.productService.deleteProduct(productId).subscribe({
            next: () => {
              this.loading = false;
              this.alertService.success('Produto excluído!', 'O produto foi removido com sucesso. 🎉');
            },
            error: (error: any) => {
              this.loading = false;
              if (error.status !== 404) {
                this.products = previousProducts;
                this.filteredProducts = previousFiltered;
                this.productsSubject.next(this.products);
                this.filteredProductsSubject.next(this.filteredProducts);
                this.alertService.error('Erro ao excluir produto', 'Não foi possível excluir o produto.');
              } else {
                this.alertService.info('Produto removido', 'Este produto já foi removido.');
              }
            },
          });
        }
      });
  }

  // ============================================================
  // CREATE STORE
  // ============================================================
  createStore(storeData: StoreForm, user: User): Observable<Store> {
    return this.hasStore(user.id).pipe(
      switchMap((hasStore) => {
        if (hasStore) {
          return throwError(() => new Error('Usuário já possui uma loja.'));
        }

        const payload = {
          storeName: storeData.storeName,
          description: storeData.description,
          category: storeData.category,
          logo: storeData.logo || null,
          banner: storeData.banner || null,
          address: storeData.address || user.address || {
            street: '',
            number: '',
            complement: '',
            neighborhood: '',
            city: '',
            state: '',
            cep: '',
            country: 'Brasil',
          },
          phone: storeData.phone || user.phone || '',
          email: storeData.email || user.email || '',
          website: storeData.website || null,
          socialMedia: storeData.socialMedia || null,
        };

        return this.http
          .post<Store>(this.apiUrl, payload, { headers: this.authHeaders() })
          .pipe(
            switchMap((store) => {
              const storeIdString = String(store.id);

              // Sincroniza o usuário no backend
              return this.http
                .patch<User>(
                  `${this.usersApiUrl}/${user.id}`,
                  { hasStore: true, storeId: storeIdString },
                  { headers: this.authHeaders() },
                )
                .pipe(
                  map((updatedUser) => {
                    const mergedUser: User = {
                      ...updatedUser,
                      hasStore: true,
                      storeId: storeIdString,
                    };

                    if (this.isBrowser) {
                      localStorage.setItem('currentStore', JSON.stringify(store));
                      localStorage.setItem('currentUser', JSON.stringify(mergedUser));
                      localStorage.setItem('userBackup', JSON.stringify(mergedUser));
                    }

                    this.authService.forceUpdateUser(mergedUser);
                    this.currentStoreSubject.next(store);

                    return store;
                  }),
                  catchError((error) => {
                    console.error('❌ Erro ao atualizar usuário:', error);

                    // Loja criada — apenas o user não foi atualizado
                    const fallbackUser: User = {
                      ...user,
                      hasStore: true,
                      storeId: storeIdString,
                    };

                    this.authService.syncUser(fallbackUser);

                    if (this.isBrowser) {
                      localStorage.setItem('currentStore', JSON.stringify(store));
                      localStorage.setItem('currentUser', JSON.stringify(fallbackUser));
                      localStorage.setItem('userBackup', JSON.stringify(fallbackUser));
                    }

                    this.currentStoreSubject.next(store);
                    return of(store);
                  }),
                );
            }),
            catchError((error) => {
              console.error('❌ Erro ao criar loja:', error);
              const msg = error?.error?.message || 'Erro ao criar loja. Tente novamente.';
              return throwError(() => new Error(msg));
            }),
          );
      }),
    );
  }

  // ============================================================
  // UPDATE STORE
  // ============================================================
  updateStore(id: string | number, storeData: Partial<Store>): Observable<Store> {
    const storeId = String(id);

    const payload: any = {
      storeName: storeData.storeName,
      description: storeData.description,
      category: storeData.category,
      phone: storeData.phone,
      email: storeData.email,
      website: storeData.website,
      socialMedia: storeData.socialMedia,
      address: storeData.address,
    };

    // Remove chaves undefined
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    return this.http
      .patch<Store>(`${this.apiUrl}/${storeId}`, payload, { headers: this.authHeaders() })
      .pipe(
        tap((store) => {
          if (this.isBrowser) {
            localStorage.setItem('currentStore', JSON.stringify(store));
          }
          this.currentStoreSubject.next(store);
        }),
        catchError((error) => {
          console.error('❌ Erro ao atualizar loja:', error);
          return throwError(() => new Error('Erro ao atualizar loja.'));
        }),
      );
  }

  // ============================================================
  // UPLOAD LOGO / BANNER (Cloudinary)
  // ============================================================
  uploadStoreLogo(storeId: string | number, base64: string): Observable<{ logoUrl: string }> {
    return this.http
      .post<{ logoUrl: string }>(
        `${this.apiUrl}/${storeId}/logo`,
        { base64Image: base64 },
        { headers: this.authHeaders() },
      )
      .pipe(
        tap((res) => {
          if (this.isBrowser) {
            const current = this.currentStoreSubject.value;
            if (current) {
              const updated = { ...current, logo: res.logoUrl };
              localStorage.setItem('currentStore', JSON.stringify(updated));
              this.currentStoreSubject.next(updated);
            }
          }
        }),
        catchError((error) => {
          console.error('❌ Erro ao enviar logo:', error);
          throw error;
        }),
      );
  }

  uploadStoreBanner(storeId: string | number, base64: string): Observable<{ bannerUrl: string }> {
    return this.http
      .post<{ bannerUrl: string }>(
        `${this.apiUrl}/${storeId}/banner`,
        { base64Image: base64 },
        { headers: this.authHeaders() },
      )
      .pipe(
        tap((res) => {
          if (this.isBrowser) {
            const current = this.currentStoreSubject.value;
            if (current) {
              const updated = { ...current, banner: res.bannerUrl };
              localStorage.setItem('currentStore', JSON.stringify(updated));
              this.currentStoreSubject.next(updated);
            }
          }
        }),
        catchError((error) => {
          console.error('❌ Erro ao enviar banner:', error);
          throw error;
        }),
      );
  }

  // ============================================================
  // LOAD FROM STORAGE / CLEAR
  // ============================================================
  private loadStoreFromStorage(): void {
    if (!this.isBrowser) return;
    try {
      const storeData = localStorage.getItem('currentStore');
      if (storeData) {
        const store = JSON.parse(storeData);
        this.currentStoreSubject.next(store);
      }
    } catch (error) {
      console.error('Erro ao carregar loja:', error);
    }
  }

  clearStore(): void {
    if (this.isBrowser) {
      localStorage.removeItem('currentStore');
    }
    this.currentStoreSubject.next(null);
  }

  // ============================================================
  // HEALTH CHECK
  // ============================================================
  checkApiHealth(): Observable<{ status: string; timestamp: string }> {
    return this.http.get(`${environment.apiUrl.replace('/api', '')}/swagger/index.html`).pipe(
      map(() => ({ status: 'online', timestamp: new Date().toISOString() })),
      catchError((error) => {
        console.error('❌ API não está respondendo:', error);
        return throwError(
          () => new Error('API indisponível. Verifique se o backend .NET está rodando.'),
        );
      }),
    );
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
}
