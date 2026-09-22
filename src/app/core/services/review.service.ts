// src/app/core/services/review.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, catchError, tap, map, switchMap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Review, CreateReview, ReviewReply, ReviewSummary } from '../models/review.model';
import { IdGeneratorService } from './id-generator.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class ReviewService {
  private apiUrl = 'http://localhost:3000/reviews';
  private productsApiUrl = 'http://localhost:3000/products';

  private isBrowser: boolean;
  private readonly http = inject(HttpClient);
  private readonly idGenerator = inject(IdGeneratorService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /**
   * 🔥 Lista todas as avaliações de um produto
   * Ordenadas da mais recente para a mais antiga
   */
  getReviewsByProduct(productId: string | number): Observable<Review[]> {
    const productIdStr = String(productId);

    return this.http.get<Review[]>(`${this.apiUrl}?productId=${productIdStr}`).pipe(
      map((reviews) => {
        if (!Array.isArray(reviews)) return [];

        // 🔥 Ordenar no cliente (mais confiável que o json-server)
        return reviews.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
      }),
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar avaliações:', error);
        return of([]);
      }),
    );
  }

  /**
   * 🔥 Lista todas as avaliações de um vendedor (para o vendedor ver)
   */
  getReviewsBySeller(sellerId: string | number): Observable<Review[]> {
    const sellerIdStr = String(sellerId);

    return this.http.get<Review[]>(`${this.apiUrl}?sellerId=${sellerIdStr}`).pipe(
      map((reviews) => {
        if (!Array.isArray(reviews)) return [];

        return reviews.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
      }),
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar avaliações do vendedor:', error);
        return of([]);
      }),
    );
  }

  /**
   * 🔥 Busca uma avaliação específica pelo ID
   */
  getReviewById(reviewId: string): Observable<Review | null> {
    return this.http.get<Review>(`${this.apiUrl}/${reviewId}`).pipe(catchError(() => of(null)));
  }

  /**
   * 🔥 Verifica se um pedido específico já foi avaliado
   * (para não pedir avaliação 2x)
   */
  getReviewByOrderAndProduct(orderId: string, productId: string): Observable<Review | null> {
    return this.http.get<Review[]>(`${this.apiUrl}?orderId=${orderId}&productId=${productId}`).pipe(
      map((reviews) => (reviews && reviews.length > 0 ? reviews[0] : null)),
      catchError(() => of(null)),
    );
  }

  /**
   * 🔥 Calcula o resumo das avaliações (média + distribuição)
   */
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
    );
  }

  /**
   * 🔥 Cria uma nova avaliação
   * - Valida se o cliente está logado
   * - Salva no backend
   * - Notifica o vendedor
   * - Atualiza a nota do produto/vendedor
   */
  createReview(data: CreateReview): Observable<Review> {
    const user = this.authService.getCurrentUser();

    if (!user) {
      return throwError(() => new Error('Usuário não está logado.'));
    }

    // 🔥 Valida se o pedido já foi avaliado
    return this.getReviewByOrderAndProduct(data.orderId, data.productId).pipe(
      switchMap((existing) => {
        if (existing) {
          return throwError(() => new Error('Você já avaliou este produto neste pedido.'));
        }

        const newReview: Review = {
          id: this.idGenerator.generateMessageId(),
          productId: String(data.productId),
          productName: data.productName,
          productImage: data.productImage || '',
          userId: String(user.id),
          userName: user.name || 'Usuário',
          userAvatar: (user as any).avatar || '',
          sellerId: String(data.sellerId),
          sellerName: data.sellerName,
          orderId: data.orderId,
          rating: Math.max(1, Math.min(5, data.rating)),
          comment: data.comment?.trim() || '',
          createdAt: new Date().toISOString(),
          isEdited: false,
        };

        return this.http.post<Review>(this.apiUrl, newReview).pipe(
          tap((createdReview) => {
            console.log('⭐ Avaliação criada:', createdReview);

            // 🔥 Notifica o vendedor
            this.notificationService.notifyNewReview(
              String(data.sellerId),
              createdReview.userName,
              data.productName,
              data.rating,
            );

            // 🔥 Atualiza a nota média do vendedor/produto
            this.updateSellerRating(String(data.sellerId));
          }),
          catchError((error) => {
            console.error('❌ Erro ao criar avaliação:', error);
            return throwError(() => new Error('Erro ao criar avaliação.'));
          }),
        );
      }),
    );
  }

  /**
   * 🔥 Atualiza a nota média do vendedor no produto
   * (chamado após criar/editar/excluir avaliação)
   */
  private updateSellerRating(sellerId: string): void {
    console.log('⭐ Recalculando nota do vendedor:', sellerId);

    this.getReviewsBySeller(sellerId).subscribe((reviews) => {
      if (reviews.length === 0) {
        console.log('⚠️ Sem avaliações para calcular média');
        return;
      }

      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      const average = Math.round((sum / reviews.length) * 10) / 10;
      console.log(
        `⭐ Nova média do vendedor ${sellerId}: ${average} (${reviews.length} avaliações)`,
      );

      // 🔥 Buscar TODOS os produtos do vendedor para atualizar a nota
      this.http
        .get<any[]>(`${this.productsApiUrl}?seller.id=${sellerId}`)
        .pipe(catchError(() => of([])))
        .subscribe((products) => {
          console.log(`📦 Atualizando ${products.length} produtos do vendedor`);

          products.forEach((product) => {
            // 🔥 CORREÇÃO: substituir todo o objeto seller
            const updatedSeller = {
              ...product.seller,
              rating: average,
            };

            this.http
              .patch(`${this.productsApiUrl}/${product.id}`, {
                seller: updatedSeller,
              })
              .pipe(catchError(() => of(null)))
              .subscribe({
                next: () => console.log(`✅ Produto ${product.id} atualizado com nota ${average}`),
                error: (err) => console.warn(`⚠️ Erro ao atualizar produto ${product.id}:`, err),
              });
          });
        });
    });
  }

  /**
   * 🔥 Edita uma avaliação existente
   * (só o próprio autor pode editar)
   */
  updateReview(reviewId: string, data: { rating?: number; comment?: string }): Observable<Review> {
    const user = this.authService.getCurrentUser();

    if (!user) {
      return throwError(() => new Error('Usuário não está logado.'));
    }

    return this.http.get<Review>(`${this.apiUrl}/${reviewId}`).pipe(
      switchMap((review) => {
        if (!review) {
          return throwError(() => new Error('Avaliação não encontrada.'));
        }

        if (String(review.userId) !== String(user.id)) {
          return throwError(() => new Error('Você só pode editar suas próprias avaliações.'));
        }

        const updates: Partial<Review> = {
          updatedAt: new Date().toISOString(),
          isEdited: true,
        };

        if (data.rating !== undefined) {
          updates.rating = Math.max(1, Math.min(5, data.rating));
        }

        if (data.comment !== undefined) {
          updates.comment = data.comment.trim();
        }

        return this.http.patch<Review>(`${this.apiUrl}/${reviewId}`, updates).pipe(
          tap(() => {
            // 🔥 Recalcula nota após edição
            this.updateSellerRating(String(review.sellerId));
          }),
        );
      }),
      catchError((error) => {
        console.error('❌ Erro ao editar avaliação:', error);
        return throwError(() => new Error('Erro ao editar avaliação.'));
      }),
    );
  }

  /**
   * 🔥 Exclui uma avaliação
   * (só o próprio autor pode excluir)
   */
  deleteReview(reviewId: string): Observable<void> {
    const user = this.authService.getCurrentUser();

    if (!user) {
      return throwError(() => new Error('Usuário não está logado.'));
    }

    return this.http.get<Review>(`${this.apiUrl}/${reviewId}`).pipe(
      switchMap((review) => {
        if (!review) {
          return of(void 0);
        }

        if (String(review.userId) !== String(user.id)) {
          return throwError(() => new Error('Você só pode excluir suas próprias avaliações.'));
        }

        return this.http.delete<void>(`${this.apiUrl}/${reviewId}`).pipe(
          tap(() => {
            // 🔥 Recalcula nota após exclusão
            this.updateSellerRating(String(review.sellerId));
          }),
        );
      }),
      catchError((error) => {
        console.error('❌ Erro ao excluir avaliação:', error);
        return throwError(() => new Error('Erro ao excluir avaliação.'));
      }),
    );
  }

  /**
   * 🔥 Vendedor responde uma avaliação
   */
  replyToReview(reviewId: string, content: string): Observable<Review> {
    const user = this.authService.getCurrentUser();

    if (!user) {
      return throwError(() => new Error('Usuário não está logado.'));
    }

    return this.http.get<Review>(`${this.apiUrl}/${reviewId}`).pipe(
      switchMap((review) => {
        if (!review) {
          return throwError(() => new Error('Avaliação não encontrada.'));
        }

        if (String(review.sellerId) !== String(user.id)) {
          return throwError(
            () => new Error('Você só pode responder avaliações dos seus produtos.'),
          );
        }

        const reply: ReviewReply = {
          id: this.idGenerator.generateMessageId(),
          content: content.trim(),
          sellerId: String(user.id),
          sellerName: user.name || 'Vendedor',
          createdAt: new Date().toISOString(),
        };

        return this.http.patch<Review>(`${this.apiUrl}/${reviewId}`, {
          sellerReply: reply,
          updatedAt: new Date().toISOString(),
        });
      }),
      catchError((error) => {
        console.error('❌ Erro ao responder avaliação:', error);
        return throwError(() => new Error('Erro ao responder avaliação.'));
      }),
    );
  }
}
