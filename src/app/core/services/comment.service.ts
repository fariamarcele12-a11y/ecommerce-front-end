// src/app/core/services/comment.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, catchError, tap, map, switchMap } from 'rxjs';
import { Comment, CommentReply, CreateComment, CreateReply } from '../models/comment.model';
import { IdGeneratorService } from './id-generator.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private apiUrl = 'http://localhost:3000/comments';

  private readonly http = inject(HttpClient);
  private readonly idGenerator = inject(IdGeneratorService);
  private readonly authService = inject(AuthService);

  /**
   * 🔥 Busca comentários de um produto
   */
  getCommentsByProduct(productId: string): Observable<Comment[]> {
    console.log(`🔍 Buscando comentários do produto ${productId}...`);
    return this.http.get<Comment[]>(`${this.apiUrl}?productId=${productId}&_sort=createdAt&_order=desc`).pipe(
      map((comments) => {
        console.log(`📦 ${comments.length} comentários encontrados`);
        return comments;
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar comentários:', error);
        return of([]);
      })
    );
  }

  /**
   * 🔥 Cria um novo comentário (sem estrelas)
   */
  createComment(commentData: CreateComment): Observable<Comment> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return throwError(() => new Error('Usuário não autenticado.'));
    }

    const commentId = this.idGenerator.generateMessageId();
    console.log('🔑 ID único gerado para o comentário:', commentId);

    const newComment: Comment = {
      id: commentId,
      productId: commentData.productId,
      userId: String(user.id),
      userName: user.name || 'Usuário',
      userAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=667eea&color=fff&size=40`,
      content: commentData.content,
      createdAt: new Date().toISOString(),
      likes: 0,
      isLiked: false,
      isFromSeller: false,
      replies: []
    };

    console.log('📤 Enviando comentário:', newComment);

    return this.http.post<Comment>(this.apiUrl, newComment).pipe(
      tap((comment) => {
        console.log('✅ Comentário criado com ID:', comment.id);
      }),
      catchError((error) => {
        console.error('❌ Erro ao criar comentário:', error);
        return throwError(() => new Error('Erro ao criar comentário. Tente novamente.'));
      })
    );
  }

  /**
   * 🔥 Adiciona uma resposta a um comentário
   */
  addReply(commentId: string, replyData: CreateReply): Observable<Comment> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return throwError(() => new Error('Usuário não autenticado.'));
    }

    console.log(`📝 Adicionando resposta ao comentário ${commentId}...`);

    const replyId = this.idGenerator.generateMessageId();
    const isFromSeller = replyData.isFromSeller || false;

    const newReply: CommentReply = {
      id: replyId,
      commentId: commentId,
      userId: String(user.id),
      userName: isFromSeller ? 'Vendedor' : (user.name || 'Usuário'),
      userAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(isFromSeller ? 'Vendedor' : user.name)}&background=${isFromSeller ? '28a745' : '667eea'}&color=fff&size=40`,
      content: replyData.content,
      isFromSeller: isFromSeller,
      createdAt: new Date().toISOString()
    };

    // 🔥 Buscar o comentário atual
    return this.http.get<Comment>(`${this.apiUrl}/${commentId}`).pipe(
      switchMap((comment) => {
        if (!comment) {
          return throwError(() => new Error('Comentário não encontrado.'));
        }

        const currentReplies = comment.replies || [];
        const updatedReplies = [...currentReplies, newReply];

        return this.http.patch<Comment>(`${this.apiUrl}/${commentId}`, {
          replies: updatedReplies
        }).pipe(
          tap(() => {
            console.log('✅ Resposta adicionada com sucesso!');
          }),
          catchError((error) => {
            console.error('❌ Erro ao adicionar resposta:', error);
            return throwError(() => new Error('Erro ao adicionar resposta.'));
          })
        );
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar comentário:', error);
        return throwError(() => new Error('Erro ao buscar comentário.'));
      })
    );
  }

  /**
   * 🔥 Remove uma resposta
   */
  deleteReply(commentId: string, replyId: string): Observable<Comment> {
    console.log(`🗑️ Removendo resposta ${replyId} do comentário ${commentId}...`);

    return this.http.get<Comment>(`${this.apiUrl}/${commentId}`).pipe(
      switchMap((comment) => {
        if (!comment) {
          return throwError(() => new Error('Comentário não encontrado.'));
        }

        const currentReplies = comment.replies || [];
        const updatedReplies = currentReplies.filter(r => r.id !== replyId);

        return this.http.patch<Comment>(`${this.apiUrl}/${commentId}`, {
          replies: updatedReplies
        }).pipe(
          tap(() => {
            console.log('✅ Resposta removida com sucesso!');
          }),
          catchError((error) => {
            console.error('❌ Erro ao remover resposta:', error);
            return throwError(() => new Error('Erro ao remover resposta.'));
          })
        );
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar comentário:', error);
        return throwError(() => new Error('Erro ao buscar comentário.'));
      })
    );
  }

  /**
   * 🔥 Remove um comentário
   */
  deleteComment(id: string): Observable<void> {
    console.log(`🗑️ Excluindo comentário com ID: ${id}`);

    if (!id || id === 'null' || id === 'undefined') {
      console.error('❌ ID do comentário inválido:', id);
      return throwError(() => new Error('ID do comentário inválido.'));
    }

    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        console.log(`✅ Comentário ${id} excluído com sucesso!`);
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erro ao excluir comentário:', error);

        if (error.status === 404) {
          console.warn('⚠️ Comentário já foi excluído anteriormente');
          return of(void 0);
        }

        if (error.status === 500) {
          console.warn('⚠️ Erro 500, tentando desativar comentário...');
          return this.deactivateComment(id);
        }

        return throwError(() => new Error('Erro ao excluir comentário.'));
      })
    );
  }

  /**
   * 🔥 Desativa um comentário (fallback)
   */
  private deactivateComment(id: string): Observable<void> {
    console.log(`🔄 Desativando comentário ${id}...`);

    return this.http.patch<Comment>(`${this.apiUrl}/${id}`, {
      active: false,
      deletedAt: new Date().toISOString()
    }).pipe(
      tap(() => {
        console.log(`✅ Comentário ${id} desativado com sucesso!`);
      }),
      map(() => void 0),
      catchError((error) => {
        console.error('❌ Falha ao desativar comentário:', error);
        return of(void 0);
      })
    );
  }

  /**
   * 🔥 Alterna like em um comentário
   */
  toggleLike(id: string): Observable<Comment> {
    console.log(`🔄 Toggle like no comentário ${id}...`);

    return this.http.get<Comment>(`${this.apiUrl}/${id}`).pipe(
      switchMap((comment) => {
        if (!comment) {
          console.warn(`⚠️ Comentário ${id} não encontrado`);
          return throwError(() => new Error('Comentário não encontrado.'));
        }

        const updatedLikes = comment.isLiked ? (comment.likes - 1) : (comment.likes + 1);
        const isLiked = !comment.isLiked;

        return this.http.patch<Comment>(`${this.apiUrl}/${id}`, {
          likes: updatedLikes,
          isLiked: isLiked
        }).pipe(
          tap(() => console.log(`✅ Like ${isLiked ? 'adicionado' : 'removido'}`))
        );
      }),
      catchError((error) => {
        console.error('❌ Erro ao alternar like:', error);
        return throwError(() => new Error('Erro ao alternar like.'));
      })
    );
  }
}
