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

  private isLoading = false;
  private lastLoadTime = 0;
  private readonly MIN_LOAD_INTERVAL = 2000;

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

  /**
   * 🔥 Valida se um ID é utilizável (não é null, undefined, '', 'null', 'undefined', 'NaN')
   */
  private isValidId(id: any): boolean {
    if (id === null || id === undefined) return false;
    const str = String(id).trim();
    if (str === '' || str === 'null' || str === 'undefined' || str === 'NaN') return false;
    return true;
  }

  loadNotifications(force: boolean = false): void {
    const user = this.authService.getCurrentUser();

    if (!user?.id) {
      this.notificationsSubject.next([]);
      this.unreadCountSubject.next(0);
      return;
    }

    const now = Date.now();
    if (!force && (this.isLoading || now - this.lastLoadTime < this.MIN_LOAD_INTERVAL)) {
      return;
    }

    this.isLoading = true;
    this.lastLoadTime = now;

    this.http
      .get<Notification[]>(
        `${this.apiUrl}?userId=${String(user.id)}&_sort=createdAt&_order=desc&_limit=20`
      )
      .pipe(
        map((notifications) => {
          if (!Array.isArray(notifications)) return [];

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

  createNotification(
    userId: string,
    type: 'message' | 'order' | 'sale' | 'review' | 'system',
    title: string,
    message: string,
    link?: string,
    data?: any
  ): Observable<Notification | null> {
    // 🔥 VALIDAÇÃO: não cria notificação se userId for inválido
    if (!this.isValidId(userId)) {
      console.warn('⚠️ createNotification: userId inválido, notificação NÃO criada:', userId);
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

    console.log('🔔 Criando notificação:', {
      to: userId,
      type,
      title,
      link,
    });

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

    const updated = this.notificationsSubject.value.map((n) => ({
      ...n,
      read: true,
    }));
    this.notificationsSubject.next(updated);
    this.unreadCountSubject.next(0);

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

  deleteNotification(notificationId: string): Observable<void> {
    const previous = this.notificationsSubject.value;
    const updated = previous.filter((n) => n.id !== notificationId);

    this.notificationsSubject.next(updated);
    this.unreadCountSubject.next(updated.filter((n) => !n.read).length);

    return this.http.delete<void>(`${this.apiUrl}/${notificationId}`).pipe(
      catchError((error) => {
        console.error('❌ Erro ao remover notificação:', error);

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

  clearAll(): void {
    const current = this.notificationsSubject.value;
    if (current.length === 0) return;

    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);

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

  /**
   * 🔥 NOTIFICAR VENDEDOR (cliente enviou mensagem)
   */
  notifyNewMessageToSeller(
    sellerId: string,
    buyerId: string,
    buyerName: string,
    productName: string,
    messagePreview: string,
    productId?: string
  ): void {
    if (!this.isValidId(sellerId)) {
      console.warn('⚠️ notifyNewMessageToSeller: sellerId inválido:', sellerId);
      return;
    }

    // 🔥 Monta o link apenas com parâmetros válidos
    const linkParams: string[] = [];
    if (this.isValidId(productId)) linkParams.push(`productId=${productId}`);
    if (this.isValidId(buyerId)) linkParams.push(`userId=${buyerId}`);

    const link = linkParams.length > 0
      ? `/chat?${linkParams.join('&')}`
      : '/chat';

    this.createNotification(
      String(sellerId),
      'message',
      `💬 Nova mensagem de ${buyerName}`,
      `"${messagePreview}" - ${productName}`,
      link,
      {
        buyerId: this.isValidId(buyerId) ? String(buyerId) : null,
        buyerName,
        productName,
        productId,
        senderType: 'buyer',
      }
    ).subscribe();
  }

  /**
   * 🔥 NOTIFICAR CLIENTE (vendedor respondeu)
   */
  notifyNewMessageToBuyer(
    buyerId: string,
    sellerId: string,
    sellerName: string,
    productName: string,
    messagePreview: string,
    productId?: string
  ): void {
    if (!this.isValidId(buyerId)) {
      console.warn('⚠️ notifyNewMessageToBuyer: buyerId inválido:', buyerId);
      return;
    }

    const linkParams: string[] = [];
    if (this.isValidId(productId)) linkParams.push(`productId=${productId}`);
    if (this.isValidId(sellerId)) linkParams.push(`sellerId=${sellerId}`);

    const link = linkParams.length > 0
      ? `/chat?${linkParams.join('&')}`
      : '/chat';

    this.createNotification(
      String(buyerId),
      'message',
      `💬 Nova resposta de ${sellerName}`,
      `"${messagePreview}" - ${productName}`,
      link,
      {
        sellerId: this.isValidId(sellerId) ? String(sellerId) : null,
        sellerName,
        productName,
        productId,
        senderType: 'seller',
      }
    ).subscribe();
  }

  notifyNewMessage(
    sellerId: string,
    buyerId: string,
    buyerName: string,
    productName: string,
    messagePreview: string
  ): void {
    this.notifyNewMessageToSeller(sellerId, buyerId, buyerName, productName, messagePreview);
  }

  notifyNewSale(
    sellerId: string,
    buyerName: string,
    productName: string,
    orderId: string,
    total: number
  ): void {
    if (!this.isValidId(sellerId)) {
      console.warn('⚠️ notifyNewSale: sellerId inválido');
      return;
    }

    this.createNotification(
      String(sellerId),
      'sale',
      '🎉 Você fez uma venda!',
      `${buyerName} comprou "${productName}" por ${this.formatPrice(total)}`,
      `/pedidos/${orderId}`,
      { orderId, buyerName, productName, total }
    ).subscribe();
  }

  notifyOrderConfirmed(
    buyerId: string,
    productName: string,
    orderId: string,
    total: number
  ): void {
    if (!this.isValidId(buyerId)) {
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

  notifyNewReview(
    sellerId: string,
    reviewerName: string,
    productName: string,
    rating: number
  ): void {
    if (!this.isValidId(sellerId)) {
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

  notifySystem(
    userId: string,
    title: string,
    message: string,
    link?: string
  ): void {
    if (!this.isValidId(userId)) {
      console.warn('⚠️ notifySystem: userId inválido');
      return;
    }
    this.createNotification(String(userId), 'system', title, message, link).subscribe();
  }

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

  private formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  clearLocal(): void {
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
  }

  private startPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(() => {
      const user = this.authService.getCurrentUser();
      if (user?.id) {
        this.loadNotifications(true);
      }
    }, 30000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}
