import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { Order } from '../../../core/models/checkout.model';
import { AlertService } from '../../../core/services/alert.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sales-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sales-history.html',
  styleUrls: ['./sales-history.scss']
})
export class SalesHistory implements OnInit, OnDestroy {
  orders: Order[] = [];
  loading = true;
  filterStatus: string = 'all';
  totalSales = 0;
  totalRevenue = 0;
  private subscriptions: Subscription = new Subscription();

  statusOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'pending', label: 'Pendente' },
    { value: 'processing', label: 'Processando' },
    { value: 'shipped', label: 'Enviado' },
    { value: 'delivered', label: 'Entregue' },
    { value: 'cancelled', label: 'Cancelado' }
  ];

  statusColors: { [key: string]: string } = {
    pending: 'warning',
    processing: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'danger'
  };

  constructor(
    private orderService: OrderService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loadSales();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadSales(): void {
    this.loading = true;
    this.subscriptions.add(
      this.orderService.getOrders().subscribe({
        next: (orders) => {
          this.orders = orders;
          this.calculateStats();
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Erro ao carregar vendas:', error);
          this.loading = false;
          this.orders = [];
          this.alertService.error('Erro', 'Não foi possível carregar seu histórico de vendas.');
        }
      })
    );
  }

  calculateStats(): void {
    const delivered = this.orders.filter(o => o.status === 'delivered');
    this.totalSales = delivered.length;
    this.totalRevenue = delivered.reduce((sum, o) => sum + o.total, 0);
  }

  getFilteredOrders(): Order[] {
    if (this.filterStatus === 'all') return this.orders;
    return this.orders.filter(o => o.status === this.filterStatus);
  }

  getStatusLabel(status: string): string {
    const option = this.statusOptions.find(o => o.value === status);
    return option ? option.label : status;
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] || 'secondary';
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

  getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      pending: 'bi-clock-history',
      processing: 'bi-arrow-repeat',
      shipped: 'bi-truck',
      delivered: 'bi-check-circle',
      cancelled: 'bi-x-circle'
    };
    return icons[status] || 'bi-question-circle';
  }

  getTotalItems(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }
}
