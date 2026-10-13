// src/app/core/services/category.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, catchError, shareReplay, tap, map, of } from 'rxjs';
import { Category, CategoryFilter } from '../models/category.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private apiUrl = `${environment.apiUrl}/categories`;

  private categoriesCache$: Observable<Category[]> | null = null;
  private cacheDuration = 5 * 60 * 1000; // 5 minutos
  private lastCacheTime = 0;

  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // ============================================================
  // GET CATEGORIES (com cache opcional)
  // ============================================================
  getCategories(useCache = true): Observable<Category[]> {
    if (useCache && this.categoriesCache$ && Date.now() - this.lastCacheTime < this.cacheDuration) {
      return this.categoriesCache$;
    }

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

  // ============================================================
  // GET COM FILTROS
  // ============================================================
  getCategoriesWithFilters(filters?: CategoryFilter): Observable<Category[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.limit) params = params.set('limit', String(filters.limit));
      if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
      if (filters.order) params = params.set('order', filters.order);
      if (filters.active !== undefined) params = params.set('active', String(filters.active));
      if (filters.search) params = params.set('search', filters.search);
    }

    return this.http.get<Category[]>(this.apiUrl, { params }).pipe(catchError(this.handleError));
  }

  // ============================================================
  // GET BY ID
  // ============================================================
  getCategoryById(id: string | number): Observable<Category> {
    return this.http
      .get<Category>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  // ============================================================
  // GET BY SLUG
  // ============================================================
  getCategoryBySlug(slug: string): Observable<Category | null> {
    return this.http.get<Category>(`${this.apiUrl}/slug/${slug}`).pipe(
      catchError((error) => {
        if (error.status === 404) return of(null);
        console.error('❌ Erro ao buscar categoria por slug:', error);
        return of(null);
      }),
    );
  }

  // ============================================================
  // SUBCATEGORIAS
  // ============================================================
  getSubcategories(parentId: string | number): Observable<Category[]> {
    return this.http
      .get<Category[]>(`${this.apiUrl}/${parentId}/subcategories`)
      .pipe(catchError(this.handleError));
  }

  // ============================================================
  // POPULARES
  // ============================================================
  getPopularCategories(limit = 6): Observable<Category[]> {
    return this.http
      .get<Category[]>(`${this.apiUrl}/popular`, {
        params: new HttpParams().set('limit', String(limit)),
      })
      .pipe(catchError(this.handleError));
  }

  // ============================================================
  // COM ÍCONE
  // ============================================================
  getCategoriesWithIcons(): Observable<Category[]> {
    return this.http
      .get<Category[]>(`${this.apiUrl}/with-icons`)
      .pipe(catchError(this.handleError));
  }

  // ============================================================
  // ATIVAS
  // ============================================================
  getActiveCategories(): Observable<Category[]> {
    return this.http
      .get<Category[]>(this.apiUrl, {
        params: new HttpParams().set('active', 'true'),
      })
      .pipe(catchError(this.handleError));
  }

  // ============================================================
  // CREATE
  // ============================================================
  createCategory(category: Partial<Category>): Observable<Category> {
    return this.http
      .post<Category>(this.apiUrl, category, { headers: this.authHeaders() })
      .pipe(
        tap(() => this.invalidateCache()),
        catchError(this.handleError),
      );
  }

  // ============================================================
  // UPDATE
  // ============================================================
  updateCategory(id: string | number, category: Partial<Category>): Observable<Category> {
    return this.http
      .patch<Category>(`${this.apiUrl}/${id}`, category, { headers: this.authHeaders() })
      .pipe(
        tap(() => this.invalidateCache()),
        catchError((error) => {
          console.error('❌ Erro ao atualizar categoria:', error);
          return throwError(() => new Error('Erro ao atualizar categoria.'));
        }),
      );
  }

  // ============================================================
  // DELETE
  // ============================================================
  deleteCategory(id: string | number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${id}`, { headers: this.authHeaders() })
      .pipe(
        tap(() => this.invalidateCache()),
        catchError(this.handleError),
      );
  }

  // ============================================================
  // SEARCH
  // ============================================================
  searchCategories(searchTerm: string): Observable<Category[]> {
    return this.http
      .get<Category[]>(this.apiUrl, {
        params: new HttpParams().set('search', searchTerm),
      })
      .pipe(catchError(this.handleError));
  }

  // ============================================================
  // CACHE
  // ============================================================
  invalidateCache(): void {
    this.categoriesCache$ = null;
    this.lastCacheTime = 0;
  }

  refreshCategories(): Observable<Category[]> {
    this.invalidateCache();
    return this.getCategories(false);
  }

  // ============================================================
  // HEALTH CHECK
  // ============================================================
  checkApiHealth(): Observable<{ status: string; timestamp: string }> {
    return this.http.get(`${environment.apiUrl.replace('/api', '')}/swagger/index.html`).pipe(
      map(() => ({ status: 'online', timestamp: new Date().toISOString() })),
      catchError(() => of({ status: 'offline', timestamp: new Date().toISOString() })),
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

  // ============================================================
  // ERROR
  // ============================================================
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocorreu um erro ao processar sua requisição.';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 0:
          errorMessage = 'Não foi possível conectar ao servidor.';
          break;
        case 401:
          errorMessage = 'Sessão expirada. Faça login novamente.';
          break;
        case 403:
          errorMessage = 'Você não tem permissão para esta ação.';
          break;
        case 404:
          errorMessage = 'Categoria não encontrada.';
          break;
        case 500:
          errorMessage = error?.error?.message || 'Erro interno do servidor.';
          break;
        default:
          errorMessage = `Código: ${error.status}, Mensagem: ${error.message}`;
      }
    }

    console.error('❌ Erro no CategoryService:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}