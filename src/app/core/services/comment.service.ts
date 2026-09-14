// src/app/core/services/comment.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, catchError, tap, map, switchMap, forkJoin } from 'rxjs';
import { Comment, CommentReply, CreateComment, CreateReply } from '../models/comment.model';
import { IdGeneratorService } from './id-generator.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private apiUrl = 'http://localhost:3000/comments';

  private readonly http = inject(HttpClient);
  private readonly idGenerator = inject(IdGeneratorService);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);

  /**
   * 🔥 Gera URL do avatar (SEMPRE usa avatar real ou fallback com iniciais)
   */
  private generateAvatarUrl(userName: string, userAvatar?: string, isSeller = false): string {
    // Se tem avatar real, usar
    if (userAvatar && userAvatar.trim() !== '' && userAvatar !== 'null' && userAvatar !== 'undefined') {
      return userAvatar;
    }

    // Fallback: ui-avatars.com com iniciais do nome
    const name = encodeURIComponent(userName || 'Usuário');
    const bgColor = isSeller ? '28a745' : '667eea';
    return `https://ui-avatars.com/api/?name=${name}&background=${bgColor}&color=fff&size=80&bold=true`;
  }

  /**
   * 🔥 Busca comentários de um produto COM AVATARES DOS USUÁRIOS
   */
  getCommentsByProduct(productId: string): Observable<Comment[]> {
    console.log(`🔍 Buscando comentários do produto ${productId}...`);

    return this.http.get<Comment[]>(`${this.apiUrl}?productId=${productId}&_sort=createdAt&_order=desc`).pipe(
      switchMap((comments) => {
        console.log(`📦 ${comments.length} comentários encontrados`);

        if (comments.length === 0) {
          return of([]);
        }

        // 🔥 Coletar todos os IDs de usuários (comentários + respostas)
        const userIds = new Set<string>();

        comments.forEach(comment => {
          if (comment.userId) userIds.add(String(comment.userId));

          if (comment.replies && comment.replies.length > 0) {
            comment.replies.forEach(reply => {
              if (reply.userId) userIds.add(String(reply.userId));
            });
          }
        });

        console.log(`👥 ${userIds.size} usuários únicos encontrados`);

        if (userIds.size === 0) {
          return of(this.applyAvatarFallback(comments, {}, {}));
        }

        // 🔥 Buscar TODOS os usuários (cliente E vendedor)
        const userRequests = Array.from(userIds).map(userId =>
          this.userService.getUserById(userId).pipe(
            catchError(() => of(null))
          )
        );

        return forkJoin(userRequests).pipe(
          map((users) => {
            const userAvatarMap: { [key: string]: string } = {};
            const userNameMap: { [key: string]: string } = {};

            users.forEach(user => {
              if (user) {
                const userId = String(user.id);
                // 🔥 SEMPRE usar o avatar do USUÁRIO (nunca da loja)
                userAvatarMap[userId] = (user as any).avatar || '';
                userNameMap[userId] = user.name || 'Usuário';
              }
            });

            console.log('📸 Avatares encontrados:', Object.keys(userAvatarMap).length);

            return this.applyAvatarFallback(comments, userAvatarMap, userNameMap);
          })
        );
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar comentários:', error);
        return of([]);
      })
    );
  }

  /**
   * 🔥 Aplica avatar do USUÁRIO em comentários e respostas
   */
  private applyAvatarFallback(
    comments: Comment[],
    userAvatarMap: { [key: string]: string },
    userNameMap: { [key: string]: string }
  ): Comment[] {
    return comments.map(comment => {
      const updatedComment = { ...comment };
      const commentUserId = String(comment.userId);

      // 🔥 Nome do usuário
      if (userNameMap[commentUserId]) {
        updatedComment.userName = userNameMap[commentUserId];
      }

      // 🔥 Avatar do USUÁRIO (não da loja)
      const commentAvatar = userAvatarMap[commentUserId] || comment.userAvatar || '';
      updatedComment.userAvatar = this.generateAvatarUrl(
        updatedComment.userName || 'Usuário',
        commentAvatar,
        false
      );

      // 🔥 Atualizar respostas
      if (updatedComment.replies && updatedComment.replies.length > 0) {
        updatedComment.replies = updatedComment.replies.map(reply => {
          const updatedReply = { ...reply };
          const replyUserId = String(reply.userId);

          // 🔥 IMPORTANTE: SEMPRE usar nome/avatar do USUÁRIO
          // O badge "Vendedor" é controlado pela flag isFromSeller
          if (userNameMap[replyUserId]) {
            updatedReply.userName = userNameMap[replyUserId];
          }

          const replyAvatar = userAvatarMap[replyUserId] || reply.userAvatar || '';
          updatedReply.userAvatar = this.generateAvatarUrl(
            updatedReply.userName || 'Usuário',
            replyAvatar,
            updatedReply.isFromSeller || false // 🔥 Só afeta a cor do fallback
          );

          return updatedReply;
        });
      }

      return updatedComment;
    });
  }

  /**
   * 🔥 Cria um novo comentário
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
      replies: []
    };

    return this.http.post<Comment>(this.apiUrl, newComment).pipe(
      catchError((error) => {
        console.error('❌ Erro ao criar comentário:', error);
        return throwError(() => new Error('Erro ao criar comentário. Tente novamente.'));
      })
    );
  }

  /**
   * 🔥 Adiciona uma resposta - USA AVATAR DO USUÁRIO (não da loja)
   */
  addReply(commentId: string, replyData: CreateReply): Observable<Comment> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return throwError(() => new Error('Usuário não autenticado.'));
    }

    console.log(`📝 Adicionando resposta ao comentário ${commentId}...`);
    console.log('👤 Usuário:', user.name);
    console.log('📸 Avatar do usuário:', (user as any).avatar ? 'Sim' : 'Não');

    const replyId = this.idGenerator.generateMessageId();
    const isFromSeller = replyData.isFromSeller || false;

    // 🔥 SEMPRE usar o avatar/nome do USUÁRIO
    const userName = user.name || 'Usuário';
    const userAvatar = (user as any).avatar || '';
    const finalAvatar = this.generateAvatarUrl(userName, userAvatar, isFromSeller);

    const newReply: CommentReply = {
      id: replyId,
      commentId: commentId,
      userId: String(user.id),
      userName: userName, // 🔥 Nome REAL do usuário
      userAvatar: finalAvatar, // 🔥 Avatar REAL do usuário
      content: replyData.content,
      isFromSeller: isFromSeller, // 🔥 Só a flag
      createdAt: new Date().toISOString()
    };

    return this.http.get<Comment>(`${this.apiUrl}/${commentId}`).pipe(
      switchMap((comment) => {
        if (!comment) {
          return throwError(() => new Error('Comentário não encontrado.'));
        }

        const currentReplies = comment.replies || [];
        const updatedReplies = [...currentReplies, newReply];

        return this.http.patch<Comment>(`${this.apiUrl}/${commentId}`, {
          replies: updatedReplies
        });
      }),
      catchError((error) => {
        console.error('❌ Erro ao adicionar resposta:', error);
        return throwError(() => new Error('Erro ao adicionar resposta.'));
      })
    );
  }

  /**
   * 🔥 Remove uma resposta
   */
  deleteReply(commentId: string, replyId: string): Observable<Comment> {
    return this.http.get<Comment>(`${this.apiUrl}/${commentId}`).pipe(
      switchMap((comment) => {
        if (!comment) {
          return throwError(() => new Error('Comentário não encontrado.'));
        }

        const currentReplies = comment.replies || [];
        const updatedReplies = currentReplies.filter(r => r.id !== replyId);

        return this.http.patch<Comment>(`${this.apiUrl}/${commentId}`, {
          replies: updatedReplies
        });
      }),
      catchError((error) => {
        console.error('❌ Erro ao remover resposta:', error);
        return throwError(() => new Error('Erro ao remover resposta.'));
      })
    );
  }

  /**
   * 🔥 Remove um comentário
   */
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
      })
    );
  }

  private deactivateComment(id: string): Observable<void> {
    return this.http.patch<Comment>(`${this.apiUrl}/${id}`, {
      active: false,
      deletedAt: new Date().toISOString()
    }).pipe(
      map(() => void 0),
      catchError(() => of(void 0))
    );
  }

  /**
   * 🔥 Alterna like
   */
  toggleLike(id: string): Observable<Comment> {
    return this.http.get<Comment>(`${this.apiUrl}/${id}`).pipe(
      switchMap((comment) => {
        if (!comment) {
          return throwError(() => new Error('Comentário não encontrado.'));
        }

        const updatedLikes = comment.isLiked ? (comment.likes - 1) : (comment.likes + 1);
        const isLiked = !comment.isLiked;

        return this.http.patch<Comment>(`${this.apiUrl}/${id}`, {
          likes: updatedLikes,
          isLiked: isLiked
        });
      }),
      catchError((error) => {
        console.error('❌ Erro ao alternar like:', error);
        return throwError(() => new Error('Erro ao alternar like.'));
      })
    );
  }
}