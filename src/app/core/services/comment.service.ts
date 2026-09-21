// src/app/core/services/comment.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, catchError, tap, map, switchMap, forkJoin } from 'rxjs';
import { Comment, CommentReply, CreateComment, CreateReply } from '../models/comment.model';
import { IdGeneratorService } from './id-generator.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class CommentService {
  private apiUrl = 'http://localhost:3000/comments';
  private productsApiUrl = 'http://localhost:3000/products';

  private readonly http = inject(HttpClient);
  private readonly idGenerator = inject(IdGeneratorService);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly notificationService = inject(NotificationService);

  private generateAvatarUrl(userName: string, userAvatar?: string, isSeller = false): string {
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

  getCommentsByProduct(productId: string): Observable<Comment[]> {
    return this.http
      .get<Comment[]>(`${this.apiUrl}?productId=${productId}&_sort=createdAt&_order=desc`)
      .pipe(
        switchMap((comments) => {
          if (comments.length === 0) {
            return of([]);
          }

          const userIds = new Set<string>();

          comments.forEach((comment) => {
            if (comment.userId) userIds.add(String(comment.userId));

            if (comment.replies && comment.replies.length > 0) {
              comment.replies.forEach((reply) => {
                if (reply.userId) userIds.add(String(reply.userId));
              });
            }
          });

          if (userIds.size === 0) {
            return of(this.applyAvatarFallback(comments, {}, {}));
          }

          const userRequests = Array.from(userIds).map((userId) =>
            this.userService.getUserById(userId).pipe(catchError(() => of(null))),
          );

          return forkJoin(userRequests).pipe(
            map((users) => {
              const userAvatarMap: { [key: string]: string } = {};
              const userNameMap: { [key: string]: string } = {};

              users.forEach((user) => {
                if (user) {
                  const userId = String(user.id);
                  userAvatarMap[userId] = (user as any).avatar || '';
                  userNameMap[userId] = user.name || 'Usuário';
                }
              });

              return this.applyAvatarFallback(comments, userAvatarMap, userNameMap);
            }),
          );
        }),
        catchError((error) => {
          console.error('❌ Erro ao buscar comentários:', error);
          return of([]);
        }),
      );
  }

  private applyAvatarFallback(
    comments: Comment[],
    userAvatarMap: { [key: string]: string },
    userNameMap: { [key: string]: string },
  ): Comment[] {
    return comments.map((comment) => {
      const updatedComment = { ...comment };
      const commentUserId = String(comment.userId);

      if (userNameMap[commentUserId]) {
        updatedComment.userName = userNameMap[commentUserId];
      }

      const commentAvatar = userAvatarMap[commentUserId] || comment.userAvatar || '';
      updatedComment.userAvatar = this.generateAvatarUrl(
        updatedComment.userName || 'Usuário',
        commentAvatar,
        false,
      );

      if (updatedComment.replies && updatedComment.replies.length > 0) {
        updatedComment.replies = updatedComment.replies.map((reply) => {
          const updatedReply = { ...reply };
          const replyUserId = String(reply.userId);

          if (userNameMap[replyUserId]) {
            updatedReply.userName = userNameMap[replyUserId];
          }

          const replyAvatar = userAvatarMap[replyUserId] || reply.userAvatar || '';
          updatedReply.userAvatar = this.generateAvatarUrl(
            updatedReply.userName || 'Usuário',
            replyAvatar,
            updatedReply.isFromSeller || false,
          );

          return updatedReply;
        });
      }

      return updatedComment;
    });
  }

  /**
   * 🔥 CRIA COMENTÁRIO E NOTIFICA O VENDEDOR
   */
  createComment(commentData: CreateComment): Observable<Comment> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return throwError(() => new Error('Usuário não autenticado.'));
    }

    const commentId = this.idGenerator.generateMessageId();
    const userName = user.name || 'Usuário';
    const userAvatar = (user as any).avatar || '';
    const finalAvatar = this.generateAvatarUrl(userName, userAvatar, false);

    const newComment: Comment = {
      id: commentId,
      productId: commentData.productId,
      userId: String(user.id),
      userName: userName,
      userAvatar: finalAvatar,
      content: commentData.content,
      createdAt: new Date().toISOString(),
      likes: 0,
      isLiked: false,
      isFromSeller: false,
      replies: [],
    };

    return this.http.post<Comment>(this.apiUrl, newComment).pipe(
      tap((createdComment) => {
        // 🔥 NOTIFICAR O VENDEDOR sobre o novo comentário
        this.notifySellerAboutComment(createdComment);
      }),
      catchError((error) => {
        console.error('❌ Erro ao criar comentário:', error);
        return throwError(() => new Error('Erro ao criar comentário. Tente novamente.'));
      }),
    );
  }

  /**
   * 🔥 Busca o vendedor do produto e o notifica sobre o novo comentário
   */
  private notifySellerAboutComment(comment: Comment): void {
    this.http
      .get<any>(`${this.productsApiUrl}/${comment.productId}`)
      .pipe(catchError(() => of(null)))
      .subscribe((product) => {
        if (!product) {
          console.warn('⚠️ Produto não encontrado para notificar vendedor');
          return;
        }

        const sellerId =
          product.seller?.id || product.sellerId || product.storeId || product.userId;

        if (!sellerId) {
          console.warn('⚠️ sellerId não encontrado no produto:', comment.productId);
          return;
        }

        // Não notificar se o vendedor for o próprio autor do comentário
        if (String(sellerId) === String(comment.userId)) {
          console.log('ℹ️ Vendedor comentou no próprio produto, não notificar');
          return;
        }

        const productName = product.name || 'Produto';

        this.notificationService.notifyNewComment(
          String(sellerId),
          String(comment.userId),
          comment.userName,
          String(comment.productId),
          productName,
          comment.content,
        );

        console.log('✅ Vendedor notificado sobre novo comentário:', sellerId);
      });
  }

  /**
   * 🔥 ADICIONA RESPOSTA E NOTIFICA O AUTOR DO COMENTÁRIO (se for o vendedor)
   */
  addReply(commentId: string, replyData: CreateReply): Observable<Comment> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return throwError(() => new Error('Usuário não autenticado.'));
    }

    const replyId = this.idGenerator.generateMessageId();
    const isFromSeller = replyData.isFromSeller || false;

    const userName = user.name || 'Usuário';
    const userAvatar = (user as any).avatar || '';
    const finalAvatar = this.generateAvatarUrl(userName, userAvatar, isFromSeller);

    const newReply: CommentReply = {
      id: replyId,
      commentId: commentId,
      userId: String(user.id),
      userName: userName,
      userAvatar: finalAvatar,
      content: replyData.content,
      isFromSeller: isFromSeller,
      createdAt: new Date().toISOString(),
    };

    return this.http.get<Comment>(`${this.apiUrl}/${commentId}`).pipe(
      switchMap((comment) => {
        if (!comment) {
          return throwError(() => new Error('Comentário não encontrado.'));
        }

        const currentReplies = comment.replies || [];
        const updatedReplies = [...currentReplies, newReply];

        return this.http
          .patch<Comment>(`${this.apiUrl}/${commentId}`, {
            replies: updatedReplies,
          })
          .pipe(
            tap((updatedComment) => {
              // 🔥 Notificar o autor do comentário APENAS quando for o vendedor respondendo
              if (isFromSeller && String(comment.userId) !== String(user.id)) {
                this.notifyCommentAuthorAboutReply(comment, newReply, userName);
              }
            }),
          );
      }),
      catchError((error) => {
        console.error('❌ Erro ao adicionar resposta:', error);
        return throwError(() => new Error('Erro ao adicionar resposta.'));
      }),
    );
  }

  /**
   * 🔥 Notifica o autor do comentário sobre a resposta do vendedor
   */
  private notifyCommentAuthorAboutReply(
    originalComment: Comment,
    reply: CommentReply,
    sellerName: string,
  ): void {
    this.http
      .get<any>(`${this.productsApiUrl}/${originalComment.productId}`)
      .pipe(catchError(() => of(null)))
      .subscribe((product) => {
        const productName = product?.name || 'Produto';

        this.notificationService.notifyCommentReply(
          String(originalComment.userId),
          String(reply.userId),
          sellerName || 'Vendedor',
          String(originalComment.productId),
          productName,
          reply.content,
        );

        console.log(
          '✅ Autor do comentário notificado sobre resposta do vendedor:',
          originalComment.userId,
        );
      });
  }

  deleteReply(commentId: string, replyId: string): Observable<Comment> {
    return this.http.get<Comment>(`${this.apiUrl}/${commentId}`).pipe(
      switchMap((comment) => {
        if (!comment) {
          return throwError(() => new Error('Comentário não encontrado.'));
        }

        const currentReplies = comment.replies || [];
        const updatedReplies = currentReplies.filter((r) => r.id !== replyId);

        return this.http.patch<Comment>(`${this.apiUrl}/${commentId}`, {
          replies: updatedReplies,
        });
      }),
      catchError((error) => {
        console.error('❌ Erro ao remover resposta:', error);
        return throwError(() => new Error('Erro ao remover resposta.'));
      }),
    );
  }

  deleteComment(id: string): Observable<void> {
    if (!id || id === 'null' || id === 'undefined') {
      return throwError(() => new Error('ID do comentário inválido.'));
    }

    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of(void 0);
        }
        if (error.status === 500) {
          return this.deactivateComment(id);
        }
        return throwError(() => new Error('Erro ao excluir comentário.'));
      }),
    );
  }

  private deactivateComment(id: string): Observable<void> {
    return this.http
      .patch<Comment>(`${this.apiUrl}/${id}`, {
        active: false,
        deletedAt: new Date().toISOString(),
      })
      .pipe(
        map(() => void 0),
        catchError(() => of(void 0)),
      );
  }

  toggleLike(id: string): Observable<Comment> {
    return this.http.get<Comment>(`${this.apiUrl}/${id}`).pipe(
      switchMap((comment) => {
        if (!comment) {
          return throwError(() => new Error('Comentário não encontrado.'));
        }

        const updatedLikes = comment.isLiked ? comment.likes - 1 : comment.likes + 1;
        const isLiked = !comment.isLiked;

        return this.http.patch<Comment>(`${this.apiUrl}/${id}`, {
          likes: updatedLikes,
          isLiked: isLiked,
        });
      }),
      catchError((error) => {
        console.error('❌ Erro ao alternar like:', error);
        return throwError(() => new Error('Erro ao alternar like.'));
      }),
    );
  }
}