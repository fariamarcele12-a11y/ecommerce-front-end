// src/app/shared/components/comments/comments.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommentService } from '../../../core/services/comment.service';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { Comment } from '../../../core/models/comment.model';

@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comments.html',
  styleUrls: ['./comments.scss']
})
export class Comments implements OnInit {
  @Input() productId!: string;

  comments: Comment[] = [];
  loading = false;
  newComment = '';
  rating = 0;
  hoverRating = 0;
  isSubmitting = false;
  currentUserId: string | null = null;
  editingCommentId: string | null = null;
  editingContent = '';
  showReplyForm: string | null = null;
  replyContent = '';

  readonly stars = [1, 2, 3, 4, 5];

  constructor(
    private commentService: CommentService,
    private authService: AuthService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.currentUserId = user ? String(user.id) : null;
    this.loadComments();
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

    if (this.rating === 0) {
      this.alertService.warning('Avaliação necessária', 'Selecione uma avaliação para o produto.');
      return;
    }

    this.isSubmitting = true;

    this.commentService.createComment({
      productId: this.productId,
      content: this.newComment,
      rating: this.rating
    }).subscribe({
      next: (comment) => {
        this.comments.unshift(comment);
        this.newComment = '';
        this.rating = 0;
        this.hoverRating = 0;
        this.isSubmitting = false;
        this.alertService.success('Comentário adicionado!', 'Seu comentário foi publicado. 🎉');
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('❌ Erro ao criar comentário:', error);
        this.alertService.error('Erro', 'Não foi possível publicar seu comentário.');
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

    this.commentService.updateComment(commentId, this.editingContent).subscribe({
      next: (updated) => {
        const index = this.comments.findIndex(c => c.id === commentId);
        if (index !== -1) {
          this.comments[index] = updated;
        }
        this.cancelEdit();
        this.alertService.success('Comentário atualizado!', 'Seu comentário foi atualizado.');
      },
      error: () => {
        this.alertService.error('Erro', 'Não foi possível atualizar o comentário.');
      }
    });
  }

  /**
   * 🔥 DELETE COMENTÁRIO - COM REMOÇÃO OTIMISTA
   */
  deleteComment(commentId: string): void {
    console.log(`🗑️ Solicitando exclusão do comentário: ${commentId}`);

    // Encontrar o comentário para exibir no confirm
    const commentToDelete = this.comments.find(c => c.id === commentId);
    if (!commentToDelete) {
      this.alertService.warning('Comentário não encontrado', 'Este comentário não está mais disponível.');
      return;
    }

    this.alertService.confirm(
      'Excluir comentário?',
      'Tem certeza que deseja excluir este comentário? Esta ação não pode ser desfeita.',
      'Sim, excluir',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        // 🔥 Remover da lista IMEDIATAMENTE (otimista)
        const previousComments = [...this.comments];
        this.comments = this.comments.filter(c => c.id !== commentId);

        console.log('📝 Comentário removido da lista localmente');

        this.commentService.deleteComment(commentId).subscribe({
          next: () => {
            console.log('✅ Comentário excluído com sucesso!');
            this.alertService.success(
              'Comentário removido!',
              'O comentário foi removido com sucesso. 🎉'
            );
          },
          error: (error: any) => {
            console.error('❌ Erro ao excluir comentário:', error);

            // 🔥 Se for erro 404, o comentário já foi excluído
            if (error.status === 404) {
              this.alertService.info(
                'Comentário removido',
                'Este comentário já foi removido anteriormente.'
              );
              return;
            }

            // 🔥 Restaurar a lista se houver erro (exceto 404)
            this.comments = previousComments;
            this.alertService.error(
              'Erro ao excluir comentário',
              'Não foi possível excluir o comentário. Tente novamente.'
            );
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
}
