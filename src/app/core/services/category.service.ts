import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { map, Observable, throwError, catchError, shareReplay, tap } from 'rxjs';
import { Category, CategoryFilter } from '../models/category.model';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  // URLs da API
  private apiUrl = 'https://ecommerce-api-mf.vercel.app/categories';
  private localApiUrl = 'http://localhost:3000/categories';

  // Cache para categorias
  private categoriesCache$: Observable<Category[]> | null = null;
  private cacheDuration = 5 * 60 * 1000; // 5 minutos
  private lastCacheTime = 0;

  constructor(private http: HttpClient) {}

  /**
   * Busca todas as categorias com opção de usar cache
   */
  getCategories(useCache: boolean = true): Observable<Category[]> {
    // Se usar cache e tiver cache válido
    if (useCache && this.categoriesCache$ && Date.now() - this.lastCacheTime < this.cacheDuration) {
      return this.categoriesCache$;
    }

    // Buscar do servidor
    const request = this.http.get<Category[]>(this.apiUrl).pipe(
      tap(() => {
        this.lastCacheTime = Date.now();
      }),
      shareReplay(1),
      catchError(this.handleError),
    );

    this.categoriesCache$ = request;
    return request;
  }

  /**
   * Busca categorias com filtros
   */
  getCategoriesWithFilters(filters?: CategoryFilter): Observable<Category[]> {
    let url = this.apiUrl;
    const params: string[] = [];

    if (filters) {
      if (filters.limit) {
        params.push(`_limit=${filters.limit}`);
      }
      if (filters.sortBy === 'name') {
        params.push('_sort=name');
        params.push(`_order=${filters.order || 'asc'}`);
      }
      if (filters.sortBy === 'productCount') {
        params.push('_sort=productCount');
        params.push(`_order=${filters.order || 'desc'}`);
      }
      if (filters.categoryId) {
        params.push(`id=${filters.categoryId}`);
      }
    }

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    return this.http.get<Category[]>(url).pipe(catchError(this.handleError));
  }

  /**
   * Busca categoria por ID
   */
  getCategoryById(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.apiUrl}/${id}`).pipe(catchError(this.handleError));
  }

  /**
   * Busca categoria por slug
   */
  getCategoryBySlug(slug: string): Observable<Category | null> {
    return this.http.get<Category[]>(`${this.apiUrl}?slug=${slug}`).pipe(
      map((categories) => (categories.length ? categories[0] : null)),
      catchError(this.handleError),
    );
  }

  /**
   * Busca subcategorias de uma categoria pai
   */
  getSubcategories(parentId: number): Observable<Category[]> {
    return this.http
      .get<Category[]>(`${this.apiUrl}?parentId=${parentId}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Busca categorias populares (com mais produtos)
   */
  getPopularCategories(limit = 6): Observable<Category[]> {
    return this.http
      .get<Category[]>(`${this.apiUrl}?_sort=productCount&_order=desc&_limit=${limit}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Busca categorias com ícones
   */
  getCategoriesWithIcons(): Observable<Category[]> {
    return this.http
      .get<Category[]>(`${this.apiUrl}?icon_ne=&icon_nnull=true`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Busca categorias ativas
   */
  getActiveCategories(): Observable<Category[]> {
    return this.http
      .get<Category[]>(`${this.apiUrl}?active=true`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Cria uma nova categoria
   */
  createCategory(category: Partial<Category>): Observable<Category> {
    return this.http
      .post<Category>(this.apiUrl, {
        ...category,
        active: true,
        createdAt: new Date().toISOString(),
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
   * Atualiza uma categoria
   */
  updateCategory(id: number, category: Partial<Category>): Observable<Category> {
    return this.http
      .put<Category>(`${this.apiUrl}/${id}`, {
        ...category,
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
   * Remove uma categoria
   */
  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        // Invalidar cache
        this.invalidateCache();
      }),
      catchError(this.handleError),
    );
  }

  /**
   * Busca categorias por nome (busca textual)
   */
  searchCategories(searchTerm: string): Observable<Category[]> {
    return this.http
      .get<Category[]>(`${this.apiUrl}?q=${searchTerm}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Invalida o cache de categorias
   */
  invalidateCache(): void {
    this.categoriesCache$ = null;
    this.lastCacheTime = 0;
  }

  /**
   * Força a atualização do cache
   */
  refreshCategories(): Observable<Category[]> {
    this.invalidateCache();
    return this.getCategories(false);
  }

  /**
   * Tratamento de erros
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocorreu um erro ao processar sua requisição.';

    if (error.error instanceof ErrorEvent) {
      // Erro do lado do cliente
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      // Erro do lado do servidor
      switch (error.status) {
        case 0:
          errorMessage =
            'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.';
          break;
        case 404:
          errorMessage = 'Recurso não encontrado. Verifique a URL.';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
          break;
        default:
          errorMessage = `Código do erro: ${error.status}, Mensagem: ${error.message}`;
      }
    }

    console.error('❌ Erro no CategoryService:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Alterna entre ambiente local e produção (útil para desenvolvimento)
   */
  setEnvironment(environment: 'local' | 'production'): void {
    if (environment === 'local') {
      this.apiUrl = this.localApiUrl;
    } else {
      this.apiUrl = 'https://ecommerce-api-mf.vercel.app/categories';
    }
    this.invalidateCache();
  }

  /**
   * Verifica o status da API
   */
  checkApiHealth(): Observable<{ status: string; timestamp: string }> {
    const baseUrl = this.apiUrl.replace('/categories', '');
    return this.http.get<{ status: string; timestamp: string }>(`${baseUrl}/health`).pipe(
      catchError((error) => {
        console.error('❌ API não está respondendo:', error);
        return throwError(() => new Error('API indisponível'));
      }),
    );
  }
}
