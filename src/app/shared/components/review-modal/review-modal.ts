// src/app/shared/components/review-modal/review-modal.ts
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewService } from '../../../core/services/review.service';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { CreateReview, Review } from '../../../core/models/review.model';
import { OrderItem } from '../../../core/models/checkout.model';

@Component({
  selector: 'app-review-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './review-modal.html',
  styleUrls: ['./review-modal.scss'],
})
export class ReviewModal implements OnInit {
  @Input() item!: OrderItem;
  @Input() orderId!: string;
  @Input() sellerName: string = 'Vendedor';
  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<Review>();

  // 🔥 Formulário
  rating: number = 0;
  hoverRating: number = 0;
  comment: string = '';
  isSubmitting = false;

  // 🔥 Estado
  maxCommentLength = 1000;
  readonly stars = [1, 2, 3, 4, 5];

  constructor(
    private reviewService: ReviewService,
    private alertService: AlertService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    console.log('⭐ ReviewModal aberto para:', this.item.productName);
  }

  /**
   * 🔥 Define a nota pelo clique
   */
  setRating(value: number): void {
    this.rating = value;
  }

  /**
   * 🔥 Feedback visual ao passar o mouse
   */
  setHoverRating(value: number): void {
    this.hoverRating = value;
  }

  clearHoverRating(): void {
    this.hoverRating = 0;
  }

  /**
   * 🔥 Retorna a nota que deve ser exibida (hover ou selecionada)
   */
  getDisplayRating(): number {
    return this.hoverRating || this.rating;
  }

  /**
   * 🔥 Texto descritivo da nota
   */
  getRatingLabel(rating: number): string {
    switch (rating) {
      case 1: return 'Muito ruim';
      case 2: return 'Ruim';
      case 3: return 'Regular';
      case 4: return 'Bom';
      case 5: return 'Excelente';
      default: return 'Selecione uma nota';
    }
  }

  getRatingColor(rating: number): string {
    if (rating >= 4) return 'text-success';
    if (rating >= 3) return 'text-warning';
    if (rating > 0) return 'text-danger';
    return 'text-muted';
  }

  /**
   * 🔥 Fecha o modal
   */
  onClose(): void {
    if (this.isSubmitting) return;
    this.close.emit();
  }

  /**
   * 🔥 Bloqueia o clique dentro do modal de fechar
   */
  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  /**
   * 🔥 Submete a avaliação
   */
  onSubmit(): void {
    if (this.rating === 0) {
      this.alertService.warning(
        'Avaliação incompleta',
        'Selecione uma nota de 1 a 5 estrelas.'
      );
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.alertService.error('Erro', 'Você precisa estar logado para avaliar.');
      return;
    }

    this.isSubmitting = true;

    const createReview: CreateReview = {
      productId: String(this.item.productId),
      productName: this.item.productName,
      productImage: this.item.image,
      userId: String(user.id),
      userName: user.name || 'Usuário',
      userAvatar: (user as any).avatar || '',
      sellerId: String(this.item.sellerId || ''),
      sellerName: this.sellerName || this.item.sellerName || 'Vendedor',
      orderId: this.orderId,
      rating: this.rating,
      comment: this.comment.trim(),
    };

    this.reviewService.createReview(createReview).subscribe({
      next: (review) => {
        this.isSubmitting = false;
        this.alertService.success(
          '⭐ Avaliação enviada!',
          'Obrigado por avaliar este produto!',
          3000
        );
        this.submitted.emit(review);
        this.close.emit();
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('❌ Erro ao enviar avaliação:', error);

        const msg = error?.message || 'Não foi possível enviar sua avaliação.';
        this.alertService.error('Erro', msg);
      },
    });
  }

  /**
   * 🔥 Contador de caracteres restantes
   */
  getRemainingChars(): number {
    return this.maxCommentLength - (this.comment?.length || 0);
  }

  /**
   * 🔥 Evita escrever mais que o limite
   */
  onCommentChange(): void {
    if (this.comment.length > this.maxCommentLength) {
      this.comment = this.comment.substring(0, this.maxCommentLength);
    }
  }
}
