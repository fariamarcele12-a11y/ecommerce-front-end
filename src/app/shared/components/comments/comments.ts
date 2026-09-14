// src/app/shared/components/comments/comments.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommentService } from '../../../core/services/comment.service';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { Comment, CommentReply } from '../../../core/models/comment.model';
import { StoreService } from '../../../core/services/store.service';

@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comments.html',
  styleUrls: ['./comments.scss']
})
export class Comments implements OnInit {
  @Input() productId!: string;
  @Input() storeId!: string;

  comments: Comment[] = [];
  loading = false;
  newComment = '';
  isSubmitting = false;
  currentUserId: string | null = null;
  currentUser: any = null;
  currentUserAvatar: string = '';
  currentUserName: string = '';
  editingCommentId: string | null = null;
  editingContent = '';
  showReplyForm: string | null = null;
  replyContent = '';
  isVendor = false;

  constructor(
    private commentService: CommentService,
    private authService: AuthService,
    private alertService: AlertService,
    private storeService: StoreService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.currentUserId = user ? String(user.id) : null;
    this.currentUser = user;
    this.currentUserName = user?.name || 'Usuário';

    // 🔥 Avatar do USUÁRIO (não da loja)
    const realAvatar = (user as any)?.avatar || '';
    this.currentUserAvatar = this.getAvatarUrl(this.currentUserName, realAvatar);

    console.log('👤 Usuário:', this.currentUserName);
    console.log('📸 Avatar:', this.currentUserAvatar);

    this.checkIfVendor();
    this.loadComments();
  }

  /**
   * 🔥 Gera URL do avatar (SEMPRE com fallback)
   */
  getAvatarUrl(userName: string, userAvatar?: string, isSeller = false): string {
    if (userAvatar && userAvatar.trim() !== '' && userAvatar !== 'null' && userAvatar !== 'undefined') {
      return userAvatar;
    }
    const name = encodeURIComponent(userName || 'Usuário');
    const bgColor = isSeller ? '28a745' : '667eea';
    return `https://ui-avatars.com/api/?name=${name}&background=${bgColor}&color=fff&size=80&bold=true`;
  }

  checkIfVendor(): void {
    if (this.currentUserId && this.storeId) {
      this.storeService.getStoreById(this.storeId).subscribe({
        next: (store) => {
          if (store && String(store.userId) === this.currentUserId) {
            this.isVendor = true;
            console.log('🏪 Usuário é o vendedor!');
          }
        },
        error: () => {
          this.isVendor = false;
        }
      });
    }
  }

  loadComments(): void {
    this.loading = true;
    this.commentService.getCommentsByProduct(this.productId).subscribe({
      next: (comments) => {
        this.comments = comments;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.comments = [];
      }
    });
  }

  submitComment(): void {
    if (!this.authService.isLoggedIn()) {
      this.alertService.warning('Faça login', 'Você precisa estar logado para comentar.');
      return;
    }

    if (!this.newComment.trim()) {
      this.alertService.warning('Comentário vazio', 'Digite um comentário.');
      return;
    }

    this.isSubmitting = true;

    this.commentService.createComment({
      productId: this.productId,
      content: this.newComment
    }).subscribe({
      next: (comment) => {
        const commentWithAvatar = {
          ...comment,
          userAvatar: comment.userAvatar || this.getAvatarUrl(comment.userName, '', false)
        };
        this.comments.unshift(commentWithAvatar);
        this.newComment = '';
        this.isSubmitting = false;
        this.alertService.success('Comentário adicionado!', 'Publicado com sucesso! 🎉');
      },
      error: () => {
        this.isSubmitting = false;
        this.alertService.error('Erro', 'Não foi possível publicar.');
      }
    });
  }

  submitReply(commentId: string): void {
    if (!this.authService.isLoggedIn()) {
      this.alertService.warning('Faça login', 'Você precisa estar logado para responder.');
      return;
    }

    if (!this.replyContent.trim()) {
      this.alertService.warning('Resposta vazia', 'Digite uma resposta.');
      return;
    }

    const isFromSeller = this.isVendor;

    this.commentService.addReply(commentId, {
      commentId: commentId,
      content: this.replyContent,
      isFromSeller: isFromSeller
    }).subscribe({
      next: (updatedComment) => {
        const processedComment = this.ensureAvatars(updatedComment);
        const index = this.comments.findIndex(c => c.id === commentId);
        if (index !== -1) {
          this.comments[index] = processedComment;
        }
        this.replyContent = '';
        this.showReplyForm = null;
        this.alertService.success('Resposta adicionada!', 'Publicada com sucesso! 🎉');
      },
      error: () => {
        this.alertService.error('Erro', 'Não foi possível adicionar a resposta.');
      }
    });
  }

  /**
   * 🔥 Garante avatares em TODOS os lugares
   */
  private ensureAvatars(comment: Comment): Comment {
    const updatedComment = { ...comment };

    updatedComment.userAvatar = this.getAvatarUrl(
      updatedComment.userName,
      updatedComment.userAvatar,
      false
    );

    if (updatedComment.replies && updatedComment.replies.length > 0) {
      updatedComment.replies = updatedComment.replies.map(reply => ({
        ...reply,
        userAvatar: this.getAvatarUrl(
          reply.userName,
          reply.userAvatar,
          reply.isFromSeller || false
        )
      }));
    }

    return updatedComment;
  }

  deleteReply(commentId: string, replyId: string): void {
    this.alertService.confirm(
      'Excluir resposta?',
      'Tem certeza que deseja excluir esta resposta?',
      'Sim, excluir',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.commentService.deleteReply(commentId, replyId).subscribe({
          next: (updatedComment) => {
            const index = this.comments.findIndex(c => c.id === commentId);
            if (index !== -1) {
              this.comments[index] = this.ensureAvatars(updatedComment);
            }
            this.alertService.success('Resposta removida!', 'Excluída com sucesso.');
          },
          error: () => {
            this.alertService.error('Erro', 'Não foi possível excluir.');
          }
        });
      }
    });
  }

  deleteComment(commentId: string): void {
    this.alertService.confirm(
      'Excluir comentário?',
      'Tem certeza que deseja excluir este comentário?',
      'Sim, excluir',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        const previousComments = [...this.comments];
        this.comments = this.comments.filter(c => c.id !== commentId);

        this.commentService.deleteComment(commentId).subscribe({
          next: () => {
            this.alertService.success('Comentário removido!', 'Excluído com sucesso.');
          },
          error: (error) => {
            if (error.status !== 404) {
              this.comments = previousComments;
              this.alertService.error('Erro', 'Não foi possível excluir.');
            }
          }
        });
      }
    });
  }

  toggleLike(commentId: string): void {
    if (!this.authService.isLoggedIn()) {
      this.alertService.warning('Faça login', 'Você precisa estar logado.');
      return;
    }

    this.commentService.toggleLike(commentId).subscribe({
      next: (updated) => {
        const index = this.comments.findIndex(c => c.id === commentId);
        if (index !== -1) {
          this.comments[index] = this.ensureAvatars(updated);
        }
      },
      error: () => {
        this.alertService.error('Erro', 'Não foi possível curtir.');
      }
    });
  }

  isOwner(comment: Comment): boolean {
    return this.currentUserId === comment.userId;
  }

  isReplyOwner(reply: CommentReply): boolean {
    return this.currentUserId === reply.userId;
  }

  getUserAvatar(userAvatar: string | undefined, userName: string): string {
    return this.getAvatarUrl(userName, userAvatar, false);
  }

  formatDate(date: string): string {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  toggleReplyForm(commentId: string): void {
    if (!this.authService.isLoggedIn()) {
      this.alertService.warning('Faça login', 'Você precisa estar logado para responder.');
      return;
    }
    this.showReplyForm = this.showReplyForm === commentId ? null : commentId;
    this.replyContent = '';
  }

  onAvatarError(event: any, userName: string): void {
    const target = event.target as HTMLImageElement;
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'Usuário')}&background=667eea&color=fff&size=80&bold=true`;

    if (target.src !== fallbackUrl) {
      console.warn('⚠️ Erro ao carregar avatar, usando fallback');
      target.src = fallbackUrl;
    }
  }
}