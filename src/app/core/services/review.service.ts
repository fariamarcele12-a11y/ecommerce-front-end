// src/app/core/services/review.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, catchError, of, map } from 'rxjs';
import { Review, CreateReview, ReviewSummary } from '../models/review.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root',
})
export class ReviewService {
  private apiUrl = `${environment.apiUrl}/reviews`;

  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // ============================================================
  // GETs (Listar)
  // ============================================================
  getReviewsByProduct(productId: string | number): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.apiUrl}/product/${productId}`).pipe(
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar avaliações:', error);
        return of([]);
      })
    );
  }

  getReviewsBySeller(sellerId: string | number): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.apiUrl}/seller/${sellerId}`).pipe(
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar avaliações do vendedor:', error);
        return of([]);
      })
    );
  }

  getReviewById(reviewId: string): Observable<Review | null> {
    return this.http.get<Review>(`${this.apiUrl}/${reviewId}`).pipe(
      catchError(() => of(null))
    );
  }

  getReviewByOrderAndProduct(orderId: string, productId: string): Observable<Review | null> {
    return this.http.get<Review>(`${this.apiUrl}/check?orderId=${orderId}&productId=${productId}`).pipe(
      catchError((error) => {
        if (error.status === 404) return of(null);
        return of(null);
      })
    );
  }

  // ============================================================
  // RESUMO (média e distribuição)
  // ============================================================
  getReviewSummary(productId: string | number): Observable<ReviewSummary> {
    return this.getReviewsByProduct(productId).pipe(
      map((reviews) => {
        const summary: ReviewSummary = {
          total: reviews.length,
          average: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };

        if (reviews.length === 0) return summary;

        let sum = 0;
        reviews.forEach((r) => {
          const rating = Math.round(r.rating);
          sum += r.rating;
          if (rating >= 1 && rating <= 5) {
            summary.distribution[rating as 1 | 2 | 3 | 4 | 5] += 1;
          }
        });

        summary.average = Math.round((sum / reviews.length) * 10) / 10;
        return summary;
      }),
      catchError(() =>
        of({
          total: 0,
          average: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        })
      )
    );
  }

  // ============================================================
  // Ações (Criar, Editar, Excluir, Responder)
  // ============================================================
  createReview(data: CreateReview): Observable<Review> {
    if (!this.authService.isLoggedIn()) {
      return throwError(() => new Error('Usuário não está logado.'));
    }

    // O backend cria a review, atualiza as notas e notifica o vendedor
    const payload = {
      productId: String(data.productId),
      orderId: String(data.orderId),
      sellerId: String(data.sellerId),
      rating: Math.max(1, Math.min(5, data.rating)),
      comment: data.comment?.trim() || null,
    };

    return this.http.post<Review>(this.apiUrl, payload, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('❌ Erro ao criar avaliação:', error);
        const msg = error?.error?.message || 'Erro ao criar avaliação.';
        return throwError(() => new Error(msg));
      })
    );
  }

  updateReview(reviewId: string, data: { rating?: number; comment?: string }): Observable<Review> {
    if (!this.authService.isLoggedIn()) {
      return throwError(() => new Error('Usuário não está logado.'));
    }

    const payload: any = {};
    if (data.rating !== undefined) payload.rating = Math.max(1, Math.min(5, data.rating));
    if (data.comment !== undefined) payload.comment = data.comment.trim();

    return this.http.patch<Review>(`${this.apiUrl}/${reviewId}`, payload, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('❌ Erro ao editar avaliação:', error);
        const msg = error?.error?.message || 'Erro ao editar avaliação.';
        return throwError(() => new Error(msg));
      })
    );
  }

  deleteReview(reviewId: string): Observable<void> {
    if (!this.authService.isLoggedIn()) {
      return throwError(() => new Error('Usuário não está logado.'));
    }

    return this.http.delete<void>(`${this.apiUrl}/${reviewId}`, { headers: this.authHeaders() }).pipe(
      catchError((error) => {
        console.error('❌ Erro ao excluir avaliação:', error);
        const msg = error?.error?.message || 'Erro ao excluir avaliação.';
        return throwError(() => new Error(msg));
      })
    );
  }

  replyToReview(reviewId: string, content: string): Observable<Review> {
    if (!this.authService.isLoggedIn()) {
      return throwError(() => new Error('Usuário não está logado.'));
    }

    return this.http
      .post<Review>(`${this.apiUrl}/${reviewId}/reply`, { content: content.trim() }, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.error('❌ Erro ao responder avaliação:', error);
          const msg = error?.error?.message || 'Erro ao responder avaliação.';
          return throwError(() => new Error(msg));
        })
      );
  }

  // ============================================================
  // Headers
  // ============================================================
  private authHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }
}
