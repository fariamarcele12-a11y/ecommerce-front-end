// src/app/core/services/notification.service.ts
import { Injectable, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, catchError, map, tap, forkJoin } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Notification } from '../models/notification.model';
import { IdGeneratorService } from './id-generator.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private apiUrl = 'http://localhost:3000/notifications';

  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private readonly http = inject(HttpClient);
  private readonly idGenerator = inject(IdGeneratorService);
  private readonly authService = inject(AuthService);

  private isBrowser: boolean;
  private pollingInterval: any = null;

  // 🔥 Evita chamadas repetidas desnecessárias
  private isLoading = false;
  private lastLoadTime = 0;
  private readonly MIN_LOAD_INTERVAL = 2000; // 2 segundos entre cargas

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this.loadNotifications();
      this.startPolling();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  // ============================================
  // 🔥 CARREGAR NOTIFICAÇÕES
  // ============================================

  /**
   * 🔥 Carrega notificações do usuário logado
   */
  loadNotifications(force: boolean = false): void {
    const user = this.authService.getCurrentUser();

    if (!user?.id) {
      this.notificationsSubject.next([]);
      this.unreadCountSubject.next(0);
      return;
    }

    // 🔥 Evitar spam de requisições (a menos que force = true)
    const now = Date.now();
    if (!force && (this.isLoading || now - this.lastLoadTime < this.MIN_LOAD_INTERVAL)) {
      return;
    }

    this.isLoading = true;
    this.lastLoadTime = now;

    // 🔥 AJUSTE 1: força String(user.id) para bater com o userId salvo (sempre string)
    this.http
      .get<Notification[]>(
        `${this.apiUrl}?userId=${String(user.id)}&_sort=createdAt&_order=desc&_limit=20`
      )
      .pipe(
        map((notifications) => {
          if (!Array.isArray(notifications)) return [];

          // 🔥 Ordenar: não lidas primeiro, depois por data (mais recentes)
          return notifications.sort((a, b) => {
            if (a.read !== b.read) return a.read ? 1 : -1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }),
        catchError((error) => {
          console.error('❌ Erro ao buscar notificações:', error);
          return of([]);
        })
      )
      .subscribe((notifications) => {
        this.isLoading = false;
        this.notificationsSubject.next(notifications);
        this.unreadCountSubject.next(
          notifications.filter((n) => !n.read).length
        );
      });
  }

  // ============================================
  // 🔥 CRIAR NOTIFICAÇÃO
  // ============================================

  /**
   * 🔥 Cria uma nova notificação
   */
  createNotification(
    userId: string,
    type: 'message' | 'order' | 'sale' | 'review' | 'system',
    title: string,
    message: string,
    link?: string,
    data?: any
  ): Observable<Notification | null> {
    if (!userId) {
      console.warn('⚠️ createNotification: userId inválido');
      return of(null);
    }

    const notification: Notification = {
      id: this.idGenerator.generateMessageId(),
      userId: String(userId),
      type,
      title,
      message,
      link: link || undefined,
      icon: this.getIconByType(type),
      read: false,
      createdAt: new Date().toISOString(),
      data: data || undefined,
    };

    return this.http.post<Notification>(this.apiUrl, notification).pipe(
      tap(() => {

        const currentUser = this.authService.getCurrentUser();
        if (currentUser && String(currentUser.id) === String(userId)) {
          this.loadNotifications(true);
        }
      }),
      catchError((error) => {
        console.error('❌ Erro ao criar notificação:', error);
        return of(null);
      })
    );
  }

  markAsRead(notificationId: string): Observable<Notification | null> {
    return this.http
      .patch<Notification>(`${this.apiUrl}/${notificationId}`, { read: true })
      .pipe(
        tap(() => {
          const current = this.notificationsSubject.value;
          const updated = current.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          );
          this.notificationsSubject.next(updated);
          this.unreadCountSubject.next(updated.filter((n) => !n.read).length);
        }),
        catchError((error) => {
          console.error('❌ Erro ao marcar como lida:', error);
          return of(null);
        })
      );
  }

  markAllAsRead(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.id) return;

    const unread = this.notificationsSubject.value.filter((n) => !n.read);

    if (unread.length === 0) return;

    // 🔥 Atualizar localmente IMEDIATAMENTE (otimista)
    const updated = this.notificationsSubject.value.map((n) => ({
      ...n,
      read: true,
    }));
    this.notificationsSubject.next(updated);
    this.unreadCountSubject.next(0);

    // 🔥 Enviar para a API em paralelo
    const requests = unread.map((n) =>
      this.http.patch(`${this.apiUrl}/${n.id}`, { read: true }).pipe(
        catchError((error) => {
          console.warn(`⚠️ Erro ao marcar notificação ${n.id} como lida:`, error);
          return of(null);
        })
      )
    );

    forkJoin(requests).subscribe({
      next: () => console.log('✅ Todas as notificações marcadas como lidas'),
      error: (error) => console.error('❌ Erro ao marcar todas:', error),
    });
  }

  // ============================================
  // 🔥 REMOVER NOTIFICAÇÃO
  // ============================================

  /**
   * 🔥 Remove uma notificação
   */
  deleteNotification(notificationId: string): Observable<void> {
    // 🔥 Remover localmente IMEDIATAMENTE (otimista)
    const previous = this.notificationsSubject.value;
    const updated = previous.filter((n) => n.id !== notificationId);

    this.notificationsSubject.next(updated);
    this.unreadCountSubject.next(updated.filter((n) => !n.read).length);

    return this.http.delete<void>(`${this.apiUrl}/${notificationId}`).pipe(
      catchError((error) => {
        console.error('❌ Erro ao remover notificação:', error);

        // 🔥 Restaurar em caso de erro (exceto 404)
        if (error.status !== 404) {
          this.notificationsSubject.next(previous);
          this.unreadCountSubject.next(
            previous.filter((n) => !n.read).length
          );
        }
        return of(void 0);
      })
    );
  }

  /**
   * 🔥 Remove todas as notificações
   */
  clearAll(): void {
    const current = this.notificationsSubject.value;
    if (current.length === 0) return;

    // 🔥 Limpar localmente IMEDIATAMENTE
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);

    // 🔥 Enviar deletes em paralelo
    const requests = current.map((n) =>
      this.http.delete(`${this.apiUrl}/${n.id}`).pipe(
        catchError((error) => {
          console.warn(`⚠️ Erro ao remover notificação ${n.id}:`, error);
          return of(null);
        })
      )
    );

    forkJoin(requests).subscribe({
      next: () => console.log('✅ Todas as notificações removidas'),
      error: (error) => console.error('❌ Erro ao limpar todas:', error),
    });
  }

  // ============================================
  // 🔥 MÉTODOS ESPECÍFICOS POR TIPO
  // ============================================

  /**
   * 🔥 Cria notificação de NOVA MENSAGEM
   * @param sellerId - quem VAI RECEBER (dono do produto)
   * @param buyerId - quem ENVIOU
   * @param buyerName - nome de quem enviou
   * @param productName - nome do produto
   * @param messagePreview - prévia da mensagem
   */
  notifyNewMessage(
    sellerId: string,
    buyerId: string,
    buyerName: string,
    productName: string,
    messagePreview: string
  ): void {
    if (!sellerId) {
      console.warn('⚠️ notifyNewMessage: sellerId inválido');
      return;
    }

    // 🔥 Notificar o VENDEDOR
    this.createNotification(
      String(sellerId),
      'message',
      `💬 Nova mensagem de ${buyerName}`,
      `"${messagePreview}" - ${productName}`,
      '/chat',
      { buyerId, productName }
    ).subscribe();
  }

  /**
   * 🔥 Cria notificação de NOVA VENDA (para o vendedor)
   */
  notifyNewSale(
    sellerId: string,
    buyerName: string,
    productName: string,
    orderId: string,
    total: number
  ): void {
    if (!sellerId) {
      console.warn('⚠️ notifyNewSale: sellerId inválido');
      return;
    }

    // 🔥 AJUSTE 2: força String(sellerId) para bater com o userId salvo (sempre string)
    this.createNotification(
      String(sellerId),
      'sale',
      '🎉 Você fez uma venda!',
      `${buyerName} comprou "${productName}" por ${this.formatPrice(total)}`,
      `/pedidos/${orderId}`,
      { orderId, buyerName, productName, total }
    ).subscribe();
  }

  /**
   * 🔥 Cria notificação de COMPRA CONFIRMADA (para o comprador)
   */
  notifyOrderConfirmed(
    buyerId: string,
    productName: string,
    orderId: string,
    total: number
  ): void {
    if (!buyerId) {
      console.warn('⚠️ notifyOrderConfirmed: buyerId inválido');
      return;
    }

    this.createNotification(
      String(buyerId),
      'order',
      '✅ Pedido confirmado!',
      `Seu pedido de "${productName}" foi confirmado. Total: ${this.formatPrice(total)}`,
      `/pedidos/${orderId}`,
      { orderId, productName, total }
    ).subscribe();
  }

  /**
   * 🔥 Cria notificação de NOVA AVALIAÇÃO (para o vendedor)
   */
  notifyNewReview(
    sellerId: string,
    reviewerName: string,
    productName: string,
    rating: number
  ): void {
    if (!sellerId) {
      console.warn('⚠️ notifyNewReview: sellerId inválido');
      return;
    }

    this.createNotification(
      String(sellerId),
      'review',
      `⭐ Nova avaliação de ${reviewerName}`,
      `Avaliou "${productName}" com ${rating} estrela${rating > 1 ? 's' : ''}`,
      undefined,
      { reviewerName, productName, rating }
    ).subscribe();
  }

  /**
   * 🔥 Cria notificação de SISTEMA (mensagens genéricas)
   */
  notifySystem(
    userId: string,
    title: string,
    message: string,
    link?: string
  ): void {
    this.createNotification(String(userId), 'system', title, message, link).subscribe();
  }

  // ============================================
  // 🔥 HELPERS
  // ============================================

  /**
   * 🔥 Retorna o ícone baseado no tipo
   */
  private getIconByType(type: string): string {
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

  /**
   * 🔥 Formata preço
   */
  private formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  /**
   * 🔥 Limpa todas as notificações do subject (útil no logout)
   */
  clearLocal(): void {
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
  }

  // ============================================
  // 🔥 POLLING
  // ============================================

  /**
   * 🔥 Inicia polling para novas notificações (a cada 30s)
   */
  private startPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(() => {
      const user = this.authService.getCurrentUser();
      if (user?.id) {
        this.loadNotifications(true);
      }
    }, 30000); // 30 segundos
  }

  /**
   * 🔥 Para o polling (chamar no ngOnDestroy)
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}
