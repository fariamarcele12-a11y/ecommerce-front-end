// src/app/core/services/comment.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError, catchError, map } from 'rxjs';
import { Comment, CommentReply, CreateComment, CreateReply } from '../models/comment.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root',
})
export class CommentService {
  private apiUrl = `${environment.apiUrl}/comments`;

  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // ============================================================
  // AVATAR FALLBACK
  // ============================================================
  private generateAvatarUrl(
    userName: string,
    userAvatar?: string,
    isSeller = false,
  ): string {
    if (
      userAvatar &&
      userAvatar.trim() !== '' &&
      userAvatar !== 'null' &&
      userAvatar !== 'undefined'
    ) {
      return userAvatar;
    }

    const name = encodeURIComponent(userName || 'Usuário');
    const bgColor = isSeller ? '28a745' : '667eea';
    return `https://ui-avatars.com/api/?name=${name}&background=${bgColor}&color=fff&size=80&bold=true`;
  }

  private applyAvatarFallback(comments: Comment[]): Comment[] {
    return comments.map((comment) => {
      const updated: Comment = {
        ...comment,
        userAvatar: this.generateAvatarUrl(
          comment.userName || 'Usuário',
          comment.userAvatar,
          comment.isFromSeller || false,
        ),
      };

      if (updated.replies && updated.replies.length > 0) {
        updated.replies = updated.replies.map((reply) => ({
          ...reply,
          userAvatar: this.generateAvatarUrl(
            reply.userName || 'Usuário',
            reply.userAvatar,
            reply.isFromSeller || false,
          ),
        }));
      }

      return updated;
    });
  }

  // ============================================================
  // LISTAR COMENTÁRIOS POR PRODUTO
  // ============================================================
  getCommentsByProduct(productId: string): Observable<Comment[]> {
    return this.http
      .get<Comment[]>(`${this.apiUrl}/product/${productId}`)
      .pipe(
        map((comments) => this.applyAvatarFallback(comments)),
        catchError((error) => {
          console.error('❌ Erro ao buscar comentários:', error);
          return of([]);
        }),
      );
  }

  // ============================================================
  // CRIAR COMENTÁRIO
  // ⚠️ O backend cria a notificação para o vendedor automaticamente
  // ============================================================
  createComment(commentData: CreateComment): Observable<Comment> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return throwError(() => new Error('Usuário não autenticado.'));
    }

    return this.http
      .post<Comment>(
        this.apiUrl,
        {
          productId: commentData.productId,
          content: commentData.content,
        },
        { headers: this.authHeaders() },
      )
      .pipe(
        map((comment) => ({
          ...comment,
          userAvatar: this.generateAvatarUrl(
            comment.userName || user.name || 'Usuário',
            comment.userAvatar || (user as any).avatar,
            comment.isFromSeller || false,
          ),
        })),
        catchError((error) => {
          console.error('❌ Erro ao criar comentário:', error);
          const msg = error?.error?.message || 'Erro ao criar comentário. Tente novamente.';
          return throwError(() => new Error(msg));
        }),
      );
  }

  // ============================================================
  // ADICIONAR RESPOSTA
  // ⚠️ O backend cria a notificação para o autor se for o vendedor
  // ⚠️ Não enviamos isFromSeller — o backend calcula pelo SellerId
  // ============================================================
  addReply(commentId: string, replyData: CreateReply): Observable<Comment> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return throwError(() => new Error('Usuário não autenticado.'));
    }

    return this.http
      .post<Comment>(
        `${this.apiUrl}/${commentId}/replies`,
        {
          content: replyData.content,
          // 🔒 isFromSeller NÃO é enviado — backend decide
        },
        { headers: this.authHeaders() },
      )
      .pipe(
        map((comment) => ({
          ...comment,
          userAvatar: this.generateAvatarUrl(
            comment.userName || 'Usuário',
            comment.userAvatar,
            comment.isFromSeller || false,
          ),
          replies: (comment.replies || []).map((reply) => ({
            ...reply,
            userAvatar: this.generateAvatarUrl(
              reply.userName || 'Usuário',
              reply.userAvatar,
              reply.isFromSeller || false,
            ),
          })),
        })),
        catchError((error) => {
          console.error('❌ Erro ao adicionar resposta:', error);
          const msg = error?.error?.message || 'Erro ao adicionar resposta.';
          return throwError(() => new Error(msg));
        }),
      );
  }

  // ============================================================
  // REMOVER RESPOSTA
  // ============================================================
  deleteReply(commentId: string, replyId: string): Observable<void> {
    return this.http
      .delete<void>(
        `${this.apiUrl}/${commentId}/replies/${replyId}`,
        { headers: this.authHeaders() },
      )
      .pipe(
        catchError((error) => {
          console.error('❌ Erro ao remover resposta:', error);
          const msg = error?.error?.message || 'Erro ao remover resposta.';
          return throwError(() => new Error(msg));
        }),
      );
  }

  // ============================================================
  // REMOVER COMENTÁRIO
  // ============================================================
  deleteComment(id: string): Observable<void> {
    if (!id || id === 'null' || id === 'undefined') {
      return throwError(() => new Error('ID do comentário inválido.'));
    }

    return this.http
      .delete<void>(`${this.apiUrl}/${id}`, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          if (error.status === 404) return of(void 0);
          console.error('❌ Erro ao excluir comentário:', error);
          return throwError(() => new Error('Erro ao excluir comentário.'));
        }),
      );
  }

  // ============================================================
  // TOGGLE LIKE
  // ============================================================
  toggleLike(id: string): Observable<Comment> {
    return this.http
      .post<Comment>(`${this.apiUrl}/${id}/like`, {}, { headers: this.authHeaders() })
      .pipe(
        map((comment) => ({
          ...comment,
          userAvatar: this.generateAvatarUrl(
            comment.userName || 'Usuário',
            comment.userAvatar,
            comment.isFromSeller || false,
          ),
          replies: (comment.replies || []).map((reply) => ({
            ...reply,
            userAvatar: this.generateAvatarUrl(
              reply.userName || 'Usuário',
              reply.userAvatar,
              reply.isFromSeller || false,
            ),
          })),
        })),
        catchError((error) => {
          console.error('❌ Erro ao alternar like:', error);
          return throwError(() => new Error('Erro ao alternar like.'));
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