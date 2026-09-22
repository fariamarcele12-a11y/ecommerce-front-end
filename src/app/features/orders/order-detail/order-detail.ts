// src/app/features/orders/order-detail/order-detail.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { Order } from '../../../core/models/checkout.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { ReviewService } from '../../../core/services/review.service';
import { Review } from '../../../core/models/review.model';
import { ReviewModal } from '../../../shared/components/review-modal/review-modal';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ReviewModal],
  templateUrl: './order-detail.html',
  styleUrls: ['./order-detail.scss'],
})
export class OrderDetail implements OnInit, OnDestroy {
  order: Order | null = null;
  loading = true;
  private routeSub: Subscription = new Subscription();

  // 🔥 Avaliação
  reviewModalOpen = false;
  selectedItemForReview: any = null;
  reviewedItems: { [key: string]: Review } = {};

  // 🔥 CONTROLE: é o comprador? é o vendedor?
  isBuyer = false;
  isSeller = false;

  statusColors: { [key: string]: string } = {
    pending: 'warning',
    processing: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'danger',
  };

  statusIcons: { [key: string]: string } = {
    pending: 'bi-clock-history',
    processing: 'bi-arrow-repeat',
    shipped: 'bi-truck',
    delivered: 'bi-check-circle',
    cancelled: 'bi-x-circle',
  };

  statusLabels: { [key: string]: string } = {
    pending: 'Pendente',
    processing: 'Processando',
    shipped: 'Enviado',
    delivered: 'Entregue',
    cancelled: 'Cancelado',
  };

  statusSteps = [
    { key: 'pending', label: 'Pedido Confirmado' },
    { key: 'processing', label: 'Em Processamento' },
    { key: 'shipped', label: 'Enviado' },
    { key: 'delivered', label: 'Entregue' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private alertService: AlertService,
    private authService: AuthService,
    private reviewService: ReviewService,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.loadOrder(id);
      } else {
        this.router.navigate(['/pedidos']);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  loadOrder(orderId: string): void {
    this.loading = true;
    this.orderService.getOrderById(orderId).subscribe({
      next: (order) => {
        if (order) {
          const currentUser = this.authService.getCurrentUser();
          const userId = String(currentUser?.id);

          // 🔥 Define explicitamente quem é comprador e quem é vendedor
          this.isBuyer = String(order.userId) === userId;
          this.isSeller = (order.items || []).some(
            (item: any) => String(item.sellerId) === userId,
          );

          if (!this.isBuyer && !this.isSeller) {
            this.alertService.error(
              'Acesso negado',
              'Você não tem permissão para ver este pedido.',
            );
            this.router.navigate(['/pedidos']);
            return;
          }

          this.order = order;
          this.loading = false;

          // 🔥 Só carrega avaliações se for comprador
          if (this.isBuyer) {
            this.loadExistingReviews(order.id);
          }
        } else {
          this.alertService.error(
            'Pedido não encontrado',
            'O pedido solicitado não foi encontrado.',
          );
          this.router.navigate(['/pedidos']);
        }
      },
      error: (error) => {
        console.error('❌ Erro ao carregar pedido:', error);
        this.loading = false;
        this.alertService.error('Erro', 'Não foi possível carregar os detalhes do pedido.');
        this.router.navigate(['/pedidos']);
      },
    });
  }

  loadExistingReviews(orderId: string): void {
    if (!this.order) return;

    this.order.items.forEach((item) => {
      this.reviewService
        .getReviewByOrderAndProduct(orderId, String(item.productId))
        .subscribe((review) => {
          if (review) {
            this.reviewedItems[String(item.productId)] = review;
          }
        });
    });
  }

  isItemReviewed(productId: string | number): boolean {
    return !!this.reviewedItems[String(productId)];
  }

  getReviewForItem(productId: string | number): Review | undefined {
    return this.reviewedItems[String(productId)];
  }

  /**
   * 🔥 REGRA: só o COMPRADOR pode avaliar
   * - Se não for comprador (é vendedor), NÃO mostra o botão
   * - Se já avaliou, NÃO mostra o botão
   * - Se o pedido não foi entregue, NÃO mostra o botão
   */
  canReviewItem(item: any): boolean {
    return (
      this.isBuyer &&
      !this.isSeller &&
      this.order?.status === 'delivered' &&
      !this.isItemReviewed(item.productId)
    );
  }

  openReviewModal(item: any): void {
    if (!this.canReviewItem(item)) {
      // Bloqueio de segurança
      if (this.isSeller) {
        this.alertService.info(
          'Ação não permitida',
          'Você não pode avaliar um produto que você mesmo vende.'
        );
      } else if (this.order?.status !== 'delivered') {
        this.alertService.warning(
          'Aguarde a entrega',
          'Você só pode avaliar produtos após recebê-los.'
        );
      } else if (this.isItemReviewed(item.productId)) {
        this.alertService.info(
          'Já avaliado',
          'Você já avaliou este produto. Obrigado!'
        );
      }
      return;
    }

    this.selectedItemForReview = item;
    this.reviewModalOpen = true;
  }

  closeReviewModal(): void {
    this.reviewModalOpen = false;
    this.selectedItemForReview = null;
  }

  onReviewSubmitted(review: Review): void {
    this.reviewedItems[review.productId] = review;
    this.closeReviewModal();

    // 🔥 Recarrega o pedido para atualizar a interface
    if (this.order) {
      this.loadOrder(this.order.id);
    }
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] || 'secondary';
  }

  getStatusIcon(status: string): string {
    return this.statusIcons[status] || 'bi-question-circle';
  }

  getStatusLabel(status: string): string {
    return this.statusLabels[status] || status;
  }

  getCurrentStepIndex(): number {
    if (!this.order) return 0;
    const index = this.statusSteps.findIndex((s) => s.key === this.order?.status);
    return index !== -1 ? index : 0;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  cancelOrder(): void {
    if (!this.order) return;

    this.alertService
      .confirm(
        'Cancelar pedido?',
        'Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.',
        'Sim, cancelar',
        'Não',
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.orderService.cancelOrder(this.order!.id).subscribe({
            next: () => {
              this.alertService.success('Pedido cancelado!', 'O pedido foi cancelado com sucesso.');
              this.loadOrder(this.order!.id);
            },
            error: () => {
              this.alertService.error('Erro', 'Não foi possível cancelar o pedido.');
            },
          });
        }
      });
  }

  canCancel(): boolean {
    return (
      this.isBuyer &&
      (this.order?.status === 'pending' || this.order?.status === 'processing')
    );
  }

  getTotalItems(): number {
    if (!this.order) return 0;
    return this.order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getShippingAddress(): string {
    if (!this.order) return '';
    const address = this.order.address;
    return `${address.street}, ${address.number}${address.complement ? ', ' + address.complement : ''}, ${address.neighborhood}, ${address.city} - ${address.state}, ${address.cep}`;
  }
}
