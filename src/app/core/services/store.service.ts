// src/app/core/services/store.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map, switchMap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Store, StoreForm } from '../models/store.model';
import { User } from '../models/user.model';
import { Product } from '../models/ProductModel/product.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class StoreService {
  // 🔥 URLs da API local apenas
  private apiUrl = 'http://localhost:3000/stores';
  private productsApiUrl = 'http://localhost:3000/products';
  private usersApiUrl = 'http://localhost:3000/users';

  private currentStoreSubject = new BehaviorSubject<Store | null>(null);
  public currentStore$ = this.currentStoreSubject.asObservable();

  private isBrowser: boolean;
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this.loadStoreFromStorage();
    }
  }

  /**
   * 🔥 Verifica se o usuário já tem uma loja
   */
  hasStore(userId: number | string): Observable<boolean> {
    const id = String(userId);
    console.log(`🔍 Verificando se usuário ${id} tem loja...`);

    // 🔥 PRIMEIRO: Verificar no localStorage
    if (this.isBrowser) {
      try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          if (userData.hasStore === true && userData.storeId) {
            console.log('📦 Loja encontrada no localStorage:', userData.storeId);
            return of(true);
          }
        }
      } catch (e) {
        console.error('Erro ao ler localStorage:', e);
      }
    }

    // 🔥 SEGUNDO: Verificar na API
    return this.http.get<Store[]>(`${this.apiUrl}?userId=${id}`).pipe(
      map((stores) => {
        console.log(`📦 Encontradas ${stores.length} lojas para o usuário`);
        return stores.length > 0;
      }),
      catchError((error) => {
        console.error('❌ Erro ao verificar loja:', error);
        return of(false);
      }),
    );
  }

  /**
   * Busca a loja do usuário (aceita string ou number) - VERSÃO CORRIGIDA
   */
  getStoreByUser(userId: number | string): Observable<Store | null> {
    const id = String(userId);
    console.log(`🔍 Buscando loja para userId: ${id}`);
    return this.http.get<Store[]>(`${this.apiUrl}?userId=${id}`).pipe(
      map((stores) => {
        console.log(`📦 Encontradas ${stores.length} lojas`);
        return stores.length > 0 ? stores[0] : null;
      }),
      tap((store) => {
        if (store && this.isBrowser) {
          localStorage.setItem('currentStore', JSON.stringify(store));
          this.currentStoreSubject.next(store);
          console.log('🏪 Loja salva no localStorage:', store.storeName);
          console.log('🏪 storeId:', store.id);

          // 🔥 Também atualizar o usuário com o storeId
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
                console.log('💾 Usuário atualizado com storeId:', updatedUser);
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

  /**
   * Busca loja por ID (aceita string ou number)
   */
  getStoreById(id: string | number): Observable<Store | null> {
    const storeId = String(id);
    console.log(`🔍 Buscando loja por ID: ${storeId}`);
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

  /**
   * Busca produtos de uma loja específica (aceita string ou number)
   */
  getStoreProducts(storeId: string | number): Observable<Product[]> {
    const id = String(storeId);
    console.log(`🔍 Buscando produtos da loja ${id}...`);
    return this.http.get<Product[]>(`${this.productsApiUrl}?storeId=${id}`).pipe(
      map((products) => {
        console.log(`📦 ${products.length} produtos encontrados na loja`);
        return products;
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar produtos da loja:', error);
        return of([]);
      }),
    );
  }

  // src/app/core/services/store.service.ts

  /**
   * 🔥 CRIA UM PRODUTO NA LOJA - VERSÃO CORRIGIDA
   */
  createStoreProduct(storeId: string | number, productData: Partial<Product>): Observable<Product> {
    const id = String(storeId);
    console.log(`📝 Criando produto na loja ${id}:`, productData);

    // 🔥 Buscar a loja para obter o nome do vendedor
    return this.getStoreById(id).pipe(
      switchMap((store) => {
        const sellerName = store?.storeName || 'Vendedor';

        const newProduct = {
          ...productData,
          storeId: id,
          createdAt: new Date().toISOString(),
          isFavorite: false,
          seller: {
            id: productData.seller?.id || 1,
            name: sellerName, // 🔥 Usar o nome da loja
            rating: productData.seller?.rating || 0,
            sales: productData.seller?.sales || 0,
          },
        };

        console.log('📦 Produto com seller:', newProduct);

        return this.http.post<Product>(this.productsApiUrl, newProduct).pipe(
          tap((product) => {
            console.log('✅ Produto criado com sucesso:', product);
          }),
          catchError((error) => {
            console.error('❌ Erro ao criar produto na loja:', error);
            if (error.error) {
              console.error('❌ Resposta do servidor:', error.error);
            }
            return throwError(() => new Error('Erro ao criar produto. Tente novamente.'));
          }),
        );
      }),
    );
  }

  /**
   * Atualiza um produto da loja
   */
  updateStoreProduct(productId: number, productData: Partial<Product>): Observable<Product> {
    return this.http
      .patch<Product>(`${this.productsApiUrl}/${productId}`, {
        ...productData,
        updatedAt: new Date().toISOString(),
      })
      .pipe(
        tap((product) => {
          console.log('✅ Produto atualizado:', product);
        }),
        catchError((error) => {
          console.error('❌ Erro ao atualizar produto:', error);
          return throwError(() => new Error('Erro ao atualizar produto.'));
        }),
      );
  }

  /**
   * Remove um produto da loja
   */
  deleteStoreProduct(productId: number): Observable<void> {
    return this.http.delete<void>(`${this.productsApiUrl}/${productId}`).pipe(
      tap(() => {
        console.log('✅ Produto removido');
      }),
      catchError((error) => {
        console.error('❌ Erro ao remover produto:', error);
        return throwError(() => new Error('Erro ao remover produto.'));
      }),
    );
  }

  /**
   * 🔥 CRIA UMA NOVA LOJA
   */
  createStore(storeData: StoreForm, user: User): Observable<Store> {
    console.log('📝 Criando loja para usuário:', user.id);
    console.log('📋 Dados da loja:', storeData);

    return this.hasStore(user.id).pipe(
      switchMap((hasStore) => {
        console.log('🔍 Usuário já tem loja?', hasStore);

        if (hasStore) {
          console.error('❌ Usuário já possui uma loja');
          return throwError(() => new Error('Usuário já possui uma loja.'));
        }

        const newStore: any = {
          userId: user.id,
          storeName: storeData.storeName,
          description: storeData.description,
          category: storeData.category,
          logo: storeData.logo || 'https://via.placeholder.com/200x200/667eea/ffffff?text=Loja',
          banner:
            storeData.banner || 'https://via.placeholder.com/1200x400/667eea/ffffff?text=Banner',
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

        console.log('📤 Enviando loja para API:', newStore);

        return this.http.post<Store>(this.apiUrl, newStore).pipe(
          switchMap((store) => {
            console.log('✅ Loja criada com sucesso:', store);
            console.log('🏪 ID da loja:', store.id);

            const storeIdString = String(store.id); // 🔥 Converter para string

            const updateData = {
              hasStore: true,
              storeId: storeIdString,
            };

            console.log('🔄 Atualizando usuário com:', updateData);

            return this.http.patch<User>(`${this.usersApiUrl}/${user.id}`, updateData).pipe(
              switchMap((updatedUser) => {
                console.log('✅ Usuário atualizado na API:', updatedUser);

                const mergedUser = {
                  ...updatedUser,
                  hasStore: true,
                  storeId: storeIdString,
                };

                console.log('📦 Usuário mesclado:', mergedUser);

                return this.authService.updateUser(mergedUser).pipe(
                  map((authResponse) => {
                    console.log('✅ AuthService atualizado:', authResponse);

                    if (this.isBrowser) {
                      localStorage.setItem('currentStore', JSON.stringify(store));
                    }
                    this.currentStoreSubject.next(store);

                    if (this.isBrowser) {
                      const finalUser = {
                        ...JSON.parse(localStorage.getItem('currentUser') || '{}'),
                        hasStore: true,
                        storeId: storeIdString,
                      };
                      localStorage.setItem('currentUser', JSON.stringify(finalUser));
                      console.log('💾 Usuário forçado no localStorage:', finalUser);

                      this.authService.forceUpdateUser(finalUser);
                    }

                    return store;
                  }),
                );
              }),
              catchError((error) => {
                console.error('❌ Erro ao atualizar usuário:', error);

                const storeIdString = String(store.id);

                const fallbackUser = {
                  ...user,
                  hasStore: true,
                  storeId: storeIdString,
                };

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
            if (error.error) {
              console.error('❌ Resposta do servidor:', error.error);
            }
            return throwError(() => new Error('Erro ao criar loja. Tente novamente.'));
          }),
        );
      }),
    );
  }

  /**
   * Atualiza a loja
   */
  updateStore(id: string | number, storeData: Partial<Store>): Observable<Store> {
    const storeId = String(id);
    return this.http
      .patch<Store>(`${this.apiUrl}/${storeId}`, {
        ...storeData,
        updatedAt: new Date().toISOString(),
      })
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

  /**
   * Carrega loja do localStorage
   */
  private loadStoreFromStorage(): void {
    if (!this.isBrowser) return;

    try {
      const storeData = localStorage.getItem('currentStore');
      if (storeData) {
        const store = JSON.parse(storeData);
        this.currentStoreSubject.next(store);
        console.log('🏪 Loja carregada do localStorage:', store.storeName);
      }
    } catch (error) {
      console.error('Erro ao carregar loja:', error);
    }
  }

  /**
   * Limpa a loja atual
   */
  clearStore(): void {
    if (this.isBrowser) {
      localStorage.removeItem('currentStore');
    }
    this.currentStoreSubject.next(null);
  }

  /**
   * 🔥 Verifica o status da API local
   */
  checkApiHealth(): Observable<{ status: string; timestamp: string }> {
    return this.http.get<{ status: string; timestamp: string }>(`http://localhost:3000/`).pipe(
      map(() => ({
        status: 'online',
        timestamp: new Date().toISOString(),
      })),
      catchError((error) => {
        console.error('❌ API local não está respondendo:', error);
        return throwError(
          () =>
            new Error('API local indisponível. Execute: json-server --watch db.json --port 3000'),
        );
      }),
    );
  }
}
