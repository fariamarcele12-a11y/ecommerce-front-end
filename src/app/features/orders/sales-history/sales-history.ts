// src/app/features/orders/sales-history/sales-history.ts
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { Order } from '../../../core/models/checkout.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sales-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sales-history.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrls: ['./sales-history.scss'],
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
    { value: 'cancelled', label: 'Cancelado' },
  ];

  statusColors: { [key: string]: string } = {
    pending: 'warning',
    processing: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'danger',
  };

  constructor(
    private orderService: OrderService,
    private alertService: AlertService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadSales();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadSales(): void {
    this.loading = true;

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      this.loading = false;
      this.orders = [];
      this.alertService.warning('Login necessário', 'Faça login para ver suas vendas.');
      return;
    }

    if (!currentUser.hasStore) {
      this.loading = false;
      this.orders = [];
      this.alertService.info('Você ainda não é vendedor', 'Crie uma loja para começar a vender.');
      return;
    }

    const sellerId = String(currentUser.id);

    this.subscriptions.add(
      this.orderService.getSellerOrders(sellerId).subscribe({
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
        },
      }),
    );
  }

  calculateStats(): void {
    const delivered = this.orders.filter((o) => o.status === 'delivered');
    this.totalSales = delivered.length;
    this.totalRevenue = delivered.reduce((sum, o) => sum + o.total, 0);
  }

  getFilteredOrders(): Order[] {
    if (this.filterStatus === 'all') return this.orders;
    return this.orders.filter((o) => o.status === this.filterStatus);
  }

  getStatusLabel(status: string): string {
    const option = this.statusOptions.find((o) => o.value === status);
    return option ? option.label : status;
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] || 'secondary';
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  // ============================================================
  // 🔥 FORMATAÇÃO DE DATA/HORA — infalível
  // ============================================================

  /**
   * Converte qualquer string de data para um objeto Date garantindo que seja UTC.
   */
  private parseDate(date: string | Date): Date {
    if (!date) return new Date();
    if (date instanceof Date) return date;

    // Se a string NÃO termina com 'Z' e NÃO tem fuso horário explícito (ex: +03:00),
    // significa que o backend mandou o UTC cru sem o 'Z'. Nós adicionamos o 'Z'.
    let dateStr = String(date);
    if (!dateStr.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(dateStr)) {
      dateStr += 'Z';
    }

    return new Date(dateStr);
  }

  /**
   * Formata data + hora completa: "19/10/2026 às 19:49"
   */
  formatDate(date: string | Date): string {
    if (!date) return '';

    const d = this.parseDate(date);

    if (isNaN(d.getTime())) return '';

    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(',', ' às');
  }

  /**
   * Formata só a data: "19/10/2026"
   */
  formatDateOnly(date: string | Date): string {
    if (!date) return '';
    const d = this.parseDate(date);
    if (isNaN(d.getTime())) return '';

    return d.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Formata só a hora: "19:49"
   */
  formatTime(date: string | Date): string {
    if (!date) return '';
    const d = this.parseDate(date);
    if (isNaN(d.getTime())) return '';

    return d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      pending: 'bi-clock-history',
      processing: 'bi-arrow-repeat',
      shipped: 'bi-truck',
      delivered: 'bi-check-circle',
      cancelled: 'bi-x-circle',
    };
    return icons[status] || 'bi-question-circle';
  }

  getTotalItems(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }
}