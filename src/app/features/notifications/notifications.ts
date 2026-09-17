// src/app/features/notifications/notifications.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { Notification } from '../../core/models/notification.model';

type FilterType = 'all' | 'unread' | 'order' | 'sale' | 'message' | 'review' | 'system';

interface GroupedNotifications {
  label: string;
  icon: string;
  notifications: Notification[];
}

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './notifications.html',
  styleUrls: ['./notifications.scss'],
})
export class NotificationsPageComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  filteredNotifications: Notification[] = [];
  groupedNotifications: GroupedNotifications[] = [];

  unreadCount = 0;
  totalCount = 0;
  loading = false;

  // 🔥 Filtros
  activeFilter: FilterType = 'all';
  searchTerm: string = '';

  // 🔥 Opções de filtro
  filterOptions: { value: FilterType; label: string; icon: string; count?: number }[] = [
    { value: 'all', label: 'Todas', icon: 'bi-bell-fill' },
    { value: 'unread', label: 'Não lidas', icon: 'bi-envelope-fill' },
    { value: 'order', label: 'Pedidos', icon: 'bi-box-seam-fill' },
    { value: 'sale', label: 'Vendas', icon: 'bi-cash-coin' },
    { value: 'message', label: 'Mensagens', icon: 'bi-chat-dots-fill' },
    { value: 'review', label: 'Avaliações', icon: 'bi-star-fill' },
    { value: 'system', label: 'Sistema', icon: 'bi-info-circle-fill' },
  ];

  private subs = new Subscription();

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private alertService: AlertService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.alertService.warning('Login necessário', 'Faça login para ver suas notificações.');
      this.router.navigate(['/login']);
      return;
    }

    // 🔥 Carrega com força (ignora cache)
    this.loading = true;
    this.notificationService.loadNotifications(true);

    // 🔥 Assina as notificações e o contador
    this.subs.add(
      combineLatest([
        this.notificationService.notifications$,
        this.notificationService.unreadCount$,
      ])
        .pipe(
          map(([notifications, unread]) => {
            this.notifications = notifications;
            this.unreadCount = unread;
            this.totalCount = notifications.length;
            this.applyFilters();
            this.loading = false;
          })
        )
        .subscribe()
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ============================================
  // 🔥 FILTROS
  // ============================================

  setFilter(filter: FilterType): void {
    this.activeFilter = filter;
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  private applyFilters(): void {
    let filtered = [...this.notifications];

    // 🔥 Filtro por tipo / status
    switch (this.activeFilter) {
      case 'unread':
        filtered = filtered.filter((n) => !n.read);
        break;
      case 'order':
      case 'sale':
      case 'message':
      case 'review':
      case 'system':
        filtered = filtered.filter((n) => n.type === this.activeFilter);
        break;
      case 'all':
      default:
        // sem filtro
        break;
    }

    // 🔥 Busca por texto
    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(term) ||
          n.message.toLowerCase().includes(term)
      );
    }

    this.filteredNotifications = filtered;
    this.groupedNotifications = this.groupByDate(filtered);
  }

  private groupByDate(notifications: Notification[]): GroupedNotifications[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: GroupedNotifications[] = [
      { label: 'Hoje', icon: 'bi-sun-fill', notifications: [] },
      { label: 'Ontem', icon: 'bi-moon-fill', notifications: [] },
      { label: 'Esta semana', icon: 'bi-calendar-week-fill', notifications: [] },
      { label: 'Mais antigas', icon: 'bi-archive-fill', notifications: [] },
    ];

    notifications.forEach((n) => {
      const date = new Date(n.createdAt);
      if (date >= today) {
        groups[0].notifications.push(n);
      } else if (date >= yesterday) {
        groups[1].notifications.push(n);
      } else if (date >= weekAgo) {
        groups[2].notifications.push(n);
      } else {
        groups[3].notifications.push(n);
      }
    });

    return groups.filter((g) => g.notifications.length > 0);
  }

  // ============================================
  // 🔥 AÇÕES
  // ============================================

  markAsRead(notification: Notification, event?: Event): void {
    if (event) event.stopPropagation();
    if (notification.read) return;

    this.notificationService.markAsRead(notification.id).subscribe();
  }

  markAllAsRead(): void {
    if (this.unreadCount === 0) return;

    this.alertService
      .confirm(
        'Marcar todas como lidas?',
        `Você tem ${this.unreadCount} notificação(ões) não lida(s).`,
        'Sim, marcar todas',
        'Cancelar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.notificationService.markAllAsRead();
          this.alertService.success(
            'Pronto!',
            'Todas as notificações foram marcadas como lidas.'
          );
        }
      });
  }

  deleteNotification(notification: Notification, event: Event): void {
    event.stopPropagation();

    this.alertService
      .confirm(
        'Remover notificação?',
        'Tem certeza que deseja remover esta notificação?',
        'Sim, remover',
        'Cancelar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.notificationService.deleteNotification(notification.id).subscribe();
        }
      });
  }

  clearAll(): void {
    if (this.notifications.length === 0) return;

    this.alertService
      .confirm(
        'Limpar todas as notificações?',
        'Esta ação não pode ser desfeita.',
        'Sim, limpar tudo',
        'Cancelar'
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.notificationService.clearAll();
          this.alertService.success('Pronto!', 'Todas as notificações foram removidas.');
        }
      });
  }

  /**
   * 🔥 Navega para o link da notificação (ex: /pedidos/ORD-123)
   */
  openNotification(notification: Notification): void {
    // Marca como lida automaticamente
    if (!notification.read) {
      this.notificationService.markAsRead(notification.id).subscribe();
    }

    // Navega se tiver link
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  // ============================================
  // 🔥 HELPERS DE UI
  // ============================================

  getIcon(type: string): string {
    switch (type) {
      case 'message':
        return 'bi-chat-dots-fill';
      case 'order':
        return 'bi-box-seam-fill';
      case 'sale':
        return 'bi-cash-coin';
      case 'review':
        return 'bi-star-fill';
      case 'system':
        return 'bi-info-circle-fill';
      default:
        return 'bi-bell-fill';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'message':
        return 'Mensagem';
      case 'order':
        return 'Pedido';
      case 'sale':
        return 'Venda';
      case 'review':
        return 'Avaliação';
      case 'system':
        return 'Sistema';
      default:
        return 'Notificação';
    }
  }

  getTypeClass(type: string): string {
    return `type-${type}`;
  }

  getRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `${diffMin} min atrás`;
    if (diffHour < 24) return `${diffHour}h atrás`;
    if (diffDay < 7) return `${diffDay}d atrás`;

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: diffDay > 365 ? 'numeric' : undefined,
    }).format(date);
  }

  getCountByType(type: FilterType): number {
    if (type === 'all') return this.notifications.length;
    if (type === 'unread') return this.unreadCount;
    return this.notifications.filter((n) => n.type === type).length;
  }

  // 🔥 trackBy para os GRUPOS (item: GroupedNotifications)
  trackByGroup(index: number, group: GroupedNotifications): string {
    return group.label;
  }

  // 🔥 trackBy para as NOTIFICAÇÕES (item: Notification)
  trackByNotificationId(index: number, item: Notification): string {
    return item.id;
  }
}
