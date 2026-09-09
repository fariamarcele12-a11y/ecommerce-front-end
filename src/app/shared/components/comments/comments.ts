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
    this.checkIfVendor();
    this.loadComments();
  }

  checkIfVendor(): void {
    if (this.currentUserId && this.storeId) {
      this.storeService.getStoreById(this.storeId).subscribe({
        next: (store) => {
          if (store && String(store.userId) === this.currentUserId) {
            this.isVendor = true;
            console.log('🏪 Usuário é o vendedor da loja!');
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
        this.comments.unshift(comment);
        this.newComment = '';
        this.isSubmitting = false;
        this.alertService.success('Comentário adicionado!', 'Seu comentário foi publicado. 🎉');
      },
      error: () => {
        this.isSubmitting = false;
        this.alertService.error('Erro', 'Não foi possível publicar seu comentário.');
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
        const index = this.comments.findIndex(c => c.id === commentId);
        if (index !== -1) {
          this.comments[index] = updatedComment;
        }
        this.replyContent = '';
        this.showReplyForm = null;
        this.alertService.success('Resposta adicionada!', 'Sua resposta foi publicada. 🎉');
      },
      error: () => {
        this.alertService.error('Erro', 'Não foi possível adicionar a resposta.');
      }
    });
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
              this.comments[index] = updatedComment;
            }
            this.alertService.success('Resposta removida!', 'Resposta excluída com sucesso.');
          },
          error: () => {
            this.alertService.error('Erro', 'Não foi possível excluir a resposta.');
          }
        });
      }
    });
  }

  startEdit(comment: Comment): void {
    this.editingCommentId = comment.id;
    this.editingContent = comment.content;
  }

  cancelEdit(): void {
    this.editingCommentId = null;
    this.editingContent = '';
  }

  saveEdit(commentId: string): void {
    if (!this.editingContent.trim()) {
      this.alertService.warning('Conteúdo vazio', 'Digite um conteúdo para o comentário.');
      return;
    }

    // ComentárioService.updateComment precisa ser implementado
    this.alertService.warning('Em breve', 'Edição de comentários estará disponível em breve.');
    this.cancelEdit();
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
            this.alertService.success('Comentário removido!', 'Comentário excluído com sucesso.');
          },
          error: (error) => {
            if (error.status !== 404) {
              this.comments = previousComments;
              this.alertService.error('Erro', 'Não foi possível excluir o comentário.');
            } else {
              this.alertService.info('Comentário removido', 'Este comentário já foi removido anteriormente.');
            }
          }
        });
      }
    });
  }

  toggleLike(commentId: string): void {
    if (!this.authService.isLoggedIn()) {
      this.alertService.warning('Faça login', 'Você precisa estar logado para curtir.');
      return;
    }

    this.commentService.toggleLike(commentId).subscribe({
      next: (updated) => {
        const index = this.comments.findIndex(c => c.id === commentId);
        if (index !== -1) {
          this.comments[index] = updated;
        }
      },
      error: () => {
        this.alertService.error('Erro', 'Não foi possível curtir o comentário.');
      }
    });
  }

  isOwner(comment: Comment): boolean {
    return this.currentUserId === comment.userId;
  }

  isReplyOwner(reply: CommentReply): boolean {
    return this.currentUserId === reply.userId;
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
}
