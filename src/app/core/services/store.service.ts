// src/app/core/services/store.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map, switchMap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Store, StoreForm } from '../models/store.model';
import { User } from '../models/user.model';
import { Product } from '../models/ProductModel/product.model';
import { AuthService } from './auth.service';
import { IdGeneratorService } from './id-generator.service';
import { ProductService } from './product.service';
import { AlertService } from './alert.service';

@Injectable({
  providedIn: 'root',
})
export class StoreService {
  private apiUrl = 'http://localhost:3000/stores';
  private productsApiUrl = 'http://localhost:3000/products';
  private usersApiUrl = 'http://localhost:3000/users';

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
  private readonly idGenerator = inject(IdGeneratorService);
  private readonly productService = inject(ProductService);
  private readonly alertService = inject(AlertService);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this.loadStoreFromStorage();
    }
  }

  hasStore(userId: number | string): Observable<boolean> {
    const id = String(userId);

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

    return this.http.get<Store[]>(`${this.apiUrl}?userId=${id}`).pipe(
      map((stores) => {
        return stores.length > 0;
      }),
      catchError((error) => {
        console.error('❌ Erro ao verificar loja:', error);
        return of(false);
      }),
    );
  }

  /**
   * Busca a loja do usuário
   */
  getStoreByUser(userId: number | string): Observable<Store | null> {
    const id = String(userId);
    return this.http.get<Store[]>(`${this.apiUrl}?userId=${id}`).pipe(
      map((stores) => {
        return stores.length > 0 ? stores[0] : null;
      }),
      tap((store) => {
        if (store && this.isBrowser) {
          localStorage.setItem('currentStore', JSON.stringify(store));
          this.currentStoreSubject.next(store);

          const userData = localStorage.getItem('currentUser');
          if (userData) {
            try {
              const user = JSON.parse(userData);
              if (user && !user.storeId) {
                const updatedUser = {
                  ...user,
                  hasStore: true,
                  storeId: String(store.id),
                };
                localStorage.setItem('currentUser', JSON.stringify(updatedUser));
              }
            } catch (e) {
              console.error('Erro ao atualizar usuário:', e);
            }
          }
        }
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar loja:', error);
        return of(null);
      }),
    );
  }

  getStoreById(id: string | number): Observable<Store | null> {
    const storeId = String(id);
    return this.http.get<Store>(`${this.apiUrl}/${storeId}`).pipe(
      tap((store) => {
        console.log('🏪 Loja encontrada:', store?.storeName);
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar loja:', error);
        return of(null);
      }),
    );
  }

  getStoreProducts(storeId: string | number): Observable<Product[]> {
    const id = String(storeId);
    return this.http.get<Product[]>(`${this.productsApiUrl}?storeId=${id}`).pipe(
      map((products) => {
        this.products = products;
        this.filteredProducts = products;
        this.productsSubject.next(products);
        this.filteredProductsSubject.next(products);
        return products;
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar produtos da loja:', error);
        return of([]);
      }),
    );
  }

  createStoreProduct(storeId: string | number, productData: Partial<Product>): Observable<Product> {
    const id = String(storeId);
    return this.getStoreById(id).pipe(
      switchMap((store) => {
        const sellerName = store?.storeName || 'Vendedor';
        const userId = store?.userId || 1;
        const userIdStr = String(userId);

        const productId = this.idGenerator.generateProductId();

        const newProduct: any = {
          id: productId,
          ...productData,
          storeId: id,
          createdAt: new Date().toISOString(),
          isFavorite: false,
          seller: {
            id: userIdStr,
            name: sellerName,
            rating: productData.seller?.rating || 0,
            sales: productData.seller?.sales || 0,
            memberSince: store?.createdAt || new Date().toISOString(),
          },
        };

        return this.http.post<Product>(this.productsApiUrl, newProduct).pipe(
          tap((product) => {
            this.products.push(product);
            this.filteredProducts = [...this.products];
            this.productsSubject.next(this.products);
            this.filteredProductsSubject.next(this.filteredProducts);
          }),
          catchError((error) => {
            return throwError(() => new Error('Erro ao criar produto. Tente novamente.'));
          }),
        );
      }),
    );
  }

  updateStoreProduct(productId: string, productData: Partial<Product>): Observable<Product> {
    return this.http
      .patch<Product>(`${this.productsApiUrl}/${productId}`, {
        ...productData,
        updatedAt: new Date().toISOString(),
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

  createStore(storeData: StoreForm, user: User): Observable<Store> {
    const storeId = this.idGenerator.generateStoreId();

    return this.hasStore(user.id).pipe(
      switchMap((hasStore) => {
        if (hasStore) {
          return throwError(() => new Error('Usuário já possui uma loja.'));
        }

        const newStore: any = {
          id: storeId,
          userId: String(user.id),
          storeName: storeData.storeName,
          description: storeData.description,
          category: storeData.category,
          // 🔥 LOGO E BANNER - Garantir que sejam salvos
          logo: storeData.logo || 'https://via.placeholder.com/200x200/667eea/ffffff?text=Loja',
          banner: storeData.banner || 'https://via.placeholder.com/1200x400/667eea/ffffff?text=Banner',
          documentType: user.documentType,
          cpf: user.documentType === 'pf' ? user.document : undefined,
          cnpj: user.documentType === 'pj' ? user.document : undefined,
          address: storeData.address || user.address,
          phone: storeData.phone || user.phone,
          email: storeData.email || user.email,
          website: storeData.website || '',
          socialMedia: storeData.socialMedia || {},
          rating: 0,
          totalSales: 0,
          active: true,
          createdAt: new Date().toISOString(),
        };

        return this.http.post<Store>(this.apiUrl, newStore).pipe(
          switchMap((store) => {
            const storeIdString = String(store.id);

            return this.http.patch<User>(`${this.usersApiUrl}/${user.id}`, {
              hasStore: true,
              storeId: storeIdString,
            }).pipe(
              switchMap((updatedUser) => {
                const mergedUser = {
                  ...updatedUser,
                  hasStore: true,
                  storeId: storeIdString,
                };

                return this.authService.updateUser(mergedUser).pipe(
                  map(() => {
                    if (this.isBrowser) {
                      localStorage.setItem('currentStore', JSON.stringify(store));
                      const finalUser = {
                        ...JSON.parse(localStorage.getItem('currentUser') || '{}'),
                        hasStore: true,
                        storeId: storeIdString,
                      };
                      localStorage.setItem('currentUser', JSON.stringify(finalUser));
                      this.authService.forceUpdateUser(finalUser);
                    }
                    this.currentStoreSubject.next(store);
                    return store;
                  }),
                );
              }),
              catchError((error) => {
                console.error('❌ Erro ao atualizar usuário:', error);
                const storeIdString = String(store.id);
                const fallbackUser = { ...user, hasStore: true, storeId: storeIdString };
                this.authService.syncUser(fallbackUser);
                if (this.isBrowser) {
                  localStorage.setItem('currentStore', JSON.stringify(store));
                  localStorage.setItem('currentUser', JSON.stringify(fallbackUser));
                }
                this.currentStoreSubject.next(store);
                return of(store);
              }),
            );
          }),
          catchError((error) => {
            console.error('❌ Erro ao criar loja:', error);
            return throwError(() => new Error('Erro ao criar loja. Tente novamente.'));
          }),
        );
      }),
    );
  }

  updateStore(id: string | number, storeData: Partial<Store>): Observable<Store> {
    const storeId = String(id);

    const updateData: any = {
      ...storeData,
      updatedAt: new Date().toISOString(),
    };

    if (storeData.logo !== undefined) {
      updateData.logo = storeData.logo || '';
    }
    if (storeData.banner !== undefined) {
      updateData.banner = storeData.banner || '';
    }

    return this.http.patch<Store>(`${this.apiUrl}/${storeId}`, updateData).pipe(
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

  checkApiHealth(): Observable<{ status: string; timestamp: string }> {
    return this.http.get<{ status: string; timestamp: string }>(`http://localhost:3000/`).pipe(
      map(() => ({
        status: 'online',
        timestamp: new Date().toISOString(),
      })),
      catchError((error) => {
        console.error('❌ API local não está respondendo:', error);
        return throwError(
          () => new Error('API local indisponível. Execute: json-server --watch db.json --port 3000'),
        );
      }),
    );
  }
}
