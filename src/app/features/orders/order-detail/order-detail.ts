import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { Order } from '../../../core/models/checkout.model';
import { AlertService } from '../../../core/services/alert.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-detail.html',
  styleUrls: ['./order-detail.scss']
})
export class OrderDetail implements OnInit, OnDestroy {
  order: Order | null = null;
  loading = true;
  private routeSub: Subscription = new Subscription();

  statusColors: { [key: string]: string } = {
    pending: 'warning',
    processing: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'danger'
  };

  statusIcons: { [key: string]: string } = {
    pending: 'bi-clock-history',
    processing: 'bi-arrow-repeat',
    shipped: 'bi-truck',
    delivered: 'bi-check-circle',
    cancelled: 'bi-x-circle'
  };

  statusLabels: { [key: string]: string } = {
    pending: 'Pendente',
    processing: 'Processando',
    shipped: 'Enviado',
    delivered: 'Entregue',
    cancelled: 'Cancelado'
  };

  statusSteps = [
    { key: 'pending', label: 'Pedido Confirmado' },
    { key: 'processing', label: 'Em Processamento' },
    { key: 'shipped', label: 'Enviado' },
    { key: 'delivered', label: 'Entregue' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe(params => {
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
          this.order = order;
          this.loading = false;
        } else {
          this.alertService.error('Pedido não encontrado', 'O pedido solicitado não foi encontrado.');
          this.router.navigate(['/pedidos']);
        }
      },
      error: (error) => {
        console.error('❌ Erro ao carregar pedido:', error);
        this.loading = false;
        this.alertService.error('Erro', 'Não foi possível carregar os detalhes do pedido.');
        this.router.navigate(['/pedidos']);
      }
    });
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
    const index = this.statusSteps.findIndex(s => s.key === this.order?.status);
    return index !== -1 ? index : 0;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  cancelOrder(): void {
    if (!this.order) return;

    this.alertService.confirm(
      'Cancelar pedido?',
      'Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.',
      'Sim, cancelar',
      'Não'
    ).then((result) => {
      if (result.isConfirmed) {
        this.orderService.cancelOrder(this.order!.id).subscribe({
          next: () => {
            this.alertService.success('Pedido cancelado!', 'O pedido foi cancelado com sucesso.');
            this.loadOrder(this.order!.id);
          },
          error: () => {
            this.alertService.error('Erro', 'Não foi possível cancelar o pedido.');
          }
        });
      }
    });
  }

  canCancel(): boolean {
    return this.order?.status === 'pending' || this.order?.status === 'processing';
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
