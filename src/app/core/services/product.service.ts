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
   * 🔥 Busca produtos com filtros (CORRIGIDO para estado/cidade)
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

    // 🔥 Verificar se tem filtro de localização (state/city)
    const hasLocationFilter = !!(filters?.state || filters?.city);

    // 🔥 Se tem filtro de localização, buscar TODOS os produtos (sem paginação)
    // para depois filtrar e paginar manualmente
    if (hasLocationFilter) {
      console.log('📍 Filtro de localização detectado - buscando todos os produtos');
    }

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
      if (filters.sellerId) {
        params = params.set('seller.id', filters.sellerId);
      }

      // 🔥 Ordenação
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

      // 🔥 Paginação do servidor - APENAS se NÃO tiver filtro de localização
      if (!hasLocationFilter) {
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
    }

    // 🔥 Paginação padrão - APENAS se NÃO tiver filtro de localização
    if (!hasLocationFilter) {
      params = params.set('_page', page.toString());
      params = params.set('_limit', limit.toString());
    }

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
          let total = parseInt(response.headers.get('X-Total-Count') || '0', 10) || products.length;

          console.log(`📦 Produtos recebidos do servidor: ${products.length}`);

          // ============================================
          // 🔥 FILTROS MANUAIS
          // ============================================

          // 🔥 1. Filtro por CATEGORIA
          if (filters?.category) {
            const categoryName = filters.category.toLowerCase().trim();
            products = products.filter((p: Product) => {
              const productCategory = (p.category || '').toLowerCase().trim();
              return productCategory === categoryName;
            });
            console.log(`🔍 Filtro categoria "${filters.category}": ${products.length} produtos`);
          }

          // 🔥 2. Filtro por ESTADO (UF)
          if (filters?.state) {
            const stateUF = filters.state.toUpperCase().trim();
            products = products.filter((p: Product) => {
              const location = (p.location || '').toUpperCase().trim();
              // 🔥 Buscar por "- RJ", "-RJ" ou terminar com " RJ"
              return (
                location.includes(`- ${stateUF}`) ||
                location.includes(`-${stateUF}`) ||
                location.endsWith(` ${stateUF}`) ||
                location.endsWith(stateUF)
              );
            });
            console.log(`🔍 Filtro estado "${filters.state}": ${products.length} produtos`);
          }

          // 🔥 3. Filtro por CIDADE
          if (filters?.city) {
            const city = filters.city.toLowerCase().trim();
            products = products.filter((p: Product) => {
              const location = (p.location || '').toLowerCase().trim();
              return location.includes(city);
            });
            console.log(`🔍 Filtro cidade "${filters.city}": ${products.length} produtos`);
          }

          // 🔥 4. Filtro por DESCONTO
          if (filters?.hasDiscount) {
            products = products.filter((p: Product) => {
              return p.oldPrice && p.oldPrice > p.price;
            });
            console.log(`🔍 Filtro desconto: ${products.length} produtos`);
          }

          // 🔥 5. Filtro por FRETE GRÁTIS
          if (filters?.freeShipping) {
            products = products.filter((p: Product) => p.freeShipping === true);
            console.log(`🔍 Filtro frete grátis: ${products.length} produtos`);
          }

          // 🔥 6. Filtro por ESTOQUE
          if (filters?.inStock) {
            products = products.filter((p: Product) => p.stock > 0);
            console.log(`🔍 Filtro em estoque: ${products.length} produtos`);
          }

          // 🔥 7. Filtro por CONDIÇÃO
          if (filters?.condition) {
            products = products.filter((p: Product) => p.condition === filters.condition);
            console.log(`🔍 Filtro condição: ${products.length} produtos`);
          }

          // 🔥 8. Filtro por PREÇO (garantia manual)
          if (filters?.minPrice !== undefined && filters?.minPrice !== null) {
            products = products.filter((p: Product) => p.price >= filters.minPrice!);
          }
          if (filters?.maxPrice !== undefined && filters?.maxPrice !== null) {
            products = products.filter((p: Product) => p.price <= filters.maxPrice!);
          }

          // 🔥 9. Filtro por BUSCA (search)
          if (filters?.search) {
            const search = filters.search.toLowerCase().trim();
            products = products.filter((p: Product) => {
              return (
                (p.name || '').toLowerCase().includes(search) ||
                (p.description || '').toLowerCase().includes(search) ||
                (p.category || '').toLowerCase().includes(search)
              );
            });
            console.log(`🔍 Filtro busca "${filters.search}": ${products.length} produtos`);
          }

          // 🔥 Atualizar favoritos
          const favorites = this.favoritesSubject.value;
          products.forEach((product: Product) => {
            product.isFavorite = favorites.includes(String(product.id));
          });

          // 🔥 Paginação MANUAL (quando tem filtro de localização)
          if (hasLocationFilter) {
            total = products.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            products = products.slice(startIndex, endIndex);
            console.log(`📄 Paginação manual: página ${page}, mostrando ${products.length} de ${total}`);
          }

          const totalPages = Math.ceil(total / limit) || 1;

          console.log(`✅ Resultado final: ${products.length} produtos (Total: ${total}, Páginas: ${totalPages})`);

          return {
            products,
            total,
            page,
            limit,
            totalPages,
          } as ProductResponse;
        }),
        tap((response) => {
          this.lastCacheTime = Date.now();
          console.log(`✅ ${response.products.length} produtos carregados (Total: ${response.total})`);
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

  /**
   * 🔥 Busca produtos por Estado (UF)
   */
  getProductsByState(state: string, limit?: number): Observable<Product[]> {
    let params = new HttpParams().set('location_like', state);
    if (limit) {
      params = params.set('_limit', limit.toString());
    }

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(
      map((products) => {
        const stateUF = state.toUpperCase().trim();
        return products.filter((p) => {
          const location = (p.location || '').toUpperCase();
          return location.includes(`- ${stateUF}`) || location.endsWith(stateUF);
        });
      }),
      catchError(this.handleError),
    );
  }

  /**
   * 🔥 Busca produtos por Cidade
   */
  getProductsByCity(city: string, limit?: number): Observable<Product[]> {
    let params = new HttpParams().set('location_like', city);
    if (limit) {
      params = params.set('_limit', limit.toString());
    }

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(
      map((products) => {
        const cityLower = city.toLowerCase().trim();
        return products.filter((p) => {
          const location = (p.location || '').toLowerCase();
          return location.includes(cityLower);
        });
      }),
      catchError(this.handleError),
    );
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
   * 🔥 DELETE PRODUCT
   */
  deleteProduct(id: string): Observable<void> {
    console.log(`🗑️ Excluindo produto com ID: ${id}`);

    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        console.log(`✅ Produto ${id} excluído com sucesso!`);
        this.invalidateCache();
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erro ao excluir produto:', error);

        if (error.status === 404) {
          console.warn('⚠️ Produto já foi excluído anteriormente');
          this.invalidateCache();
          return of(void 0);
        }

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
          this.invalidateCache();
          return of(void 0);
        }),
      );
  }

  /**
   * 🔥 UPDATE CATEGORY PRODUCT COUNT
   */
  private updateCategoryProductCount(categoryName: string, delta: number): void {
    if (!categoryName) {
      console.warn('⚠️ Categoria não informada, pulando atualização');
      return;
    }

    console.log(
      `🔄 Atualizando contador da categoria: ${categoryName} (${delta > 0 ? '+' : ''}${delta})`,
    );

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
