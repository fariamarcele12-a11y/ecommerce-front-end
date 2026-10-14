// src/app/core/services/notification.service.ts
import { Injectable, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, catchError, map, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Notification, ShippingAddress, OrderItemSummary } from '../models/notification.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private apiUrl = `${environment.apiUrl}/notifications`;

  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private readonly http = inject(HttpClient);
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
      // Escuta login/logout
      this.authService.currentUser$.subscribe((user) => {
        if (user?.id) {
          this.loadNotifications(true);
        } else {
          this.notificationsSubject.next([]);
          this.unreadCountSubject.next(0);
        }
      });

      this.startPolling();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  /**
   * 🔥 Valida se um ID é utilizável
   */
  private isValidId(id: any): boolean {
    if (id === null || id === undefined) return false;
    const str = String(id).trim();
    if (str === '' || str === 'null' || str === 'undefined' || str === 'NaN') return false;
    return true;
  }

  // ============================================================
  // CARREGAR NOTIFICAÇÕES
  // ============================================================
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
      .get<Notification[]>(`${this.apiUrl}?limit=20`, { headers: this.authHeaders() })
      .pipe(
        map((notifications) => {
          if (!Array.isArray(notifications)) return [];
          // Backend já ordena: não lidas primeiro, depois CreatedAt desc
          return notifications;
        }),
        catchError((error) => {
          console.error('❌ Erro ao buscar notificações:', error);
          return of([]);
        }),
      )
      .subscribe((notifications) => {
        this.isLoading = false;
        this.notificationsSubject.next(notifications);
        this.unreadCountSubject.next(notifications.filter((n) => !n.read).length);
      });
  }

  // ============================================================
  // CRIAR NOTIFICAÇÃO
  // ============================================================
  createNotification(
    userId: string,
    type: 'message' | 'order' | 'sale' | 'review' | 'system',
    title: string,
    message: string,
    link?: string,
    data?: any,
  ): Observable<Notification | null> {
    if (!this.isValidId(userId)) {
      console.warn('⚠️ createNotification: userId inválido:', userId);
      return of(null);
    }

    const payload = {
      userId,
      type,
      title,
      message,
      link: link || null,
      icon: this.getIconByType(type),
      data: data || null,
    };

    return this.http
      .post<Notification>(this.apiUrl, payload, { headers: this.authHeaders() })
      .pipe(
        tap(() => {
          const currentUser = this.authService.getCurrentUser();
          if (currentUser && String(currentUser.id) === String(userId)) {
            this.loadNotifications(true);
          }
        }),
        catchError((error) => {
          console.error('❌ Erro ao criar notificação:', error);
          return of(null);
        }),
      );
  }

  // ============================================================
  // MARCAR COMO LIDA
  // ============================================================
  markAsRead(notificationId: string): Observable<Notification | null> {
    return this.http
      .patch<Notification>(
        `${this.apiUrl}/${notificationId}/read`,
        {},
        { headers: this.authHeaders() },
      )
      .pipe(
        tap(() => {
          const current = this.notificationsSubject.value;
          const updated = current.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n,
          );
          this.notificationsSubject.next(updated);
          this.unreadCountSubject.next(updated.filter((n) => !n.read).length);
        }),
        catchError((error) => {
          console.error('❌ Erro ao marcar como lida:', error);
          return of(null);
        }),
      );
  }

  // ============================================================
  // MARCAR TODAS COMO LIDAS
  // ============================================================
  markAllAsRead(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.id) return;

    const current = this.notificationsSubject.value;
    if (current.length === 0) return;

    const hasUnread = current.some((n) => !n.read);
    if (!hasUnread) return;

    // Otimista: marca todas como lidas imediatamente
    const updated = current.map((n) => ({ ...n, read: true }));
    this.notificationsSubject.next(updated);
    this.unreadCountSubject.next(0);

    this.http
      .post(`${this.apiUrl}/mark-all-read`, {}, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.error('❌ Erro ao marcar todas como lidas:', error);
          // Reverte em caso de erro
          this.notificationsSubject.next(current);
          this.unreadCountSubject.next(current.filter((n) => !n.read).length);
          return of(null);
        }),
      )
      .subscribe({
        next: () => console.log('✅ Todas as notificações marcadas como lidas'),
      });
  }

  // ============================================================
  // DELETE
  // ============================================================
  deleteNotification(notificationId: string): Observable<void> {
    const previous = this.notificationsSubject.value;
    const updated = previous.filter((n) => n.id !== notificationId);

    // Otimista
    this.notificationsSubject.next(updated);
    this.unreadCountSubject.next(updated.filter((n) => !n.read).length);

    return this.http
      .delete<void>(`${this.apiUrl}/${notificationId}`, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.error('❌ Erro ao remover notificação:', error);
          if (error.status !== 404) {
            this.notificationsSubject.next(previous);
            this.unreadCountSubject.next(previous.filter((n) => !n.read).length);
          }
          return of(void 0);
        }),
      );
  }

  // ============================================================
  // LIMPAR TODAS
  // ============================================================
  clearAll(): void {
    const current = this.notificationsSubject.value;
    if (current.length === 0) return;

    // Otimista
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);

    this.http
      .delete(`${this.apiUrl}/clear-all`, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.error('❌ Erro ao limpar notificações:', error);
          // Reverte em caso de erro
          this.notificationsSubject.next(current);
          this.unreadCountSubject.next(current.filter((n) => !n.read).length);
          return of(null);
        }),
      )
      .subscribe({
        next: () => console.log('✅ Todas as notificações removidas'),
      });
  }

  // ============================================================
  // 🔔 NOTIFICAÇÕES DE ALTO NÍVEL
  // ============================================================

  /**
   * 🔥 NOTIFICAR VENDEDOR (cliente enviou mensagem)
   */
  notifyNewMessageToSeller(
    sellerId: string,
    buyerId: string,
    buyerName: string,
    productName: string,
    messagePreview: string,
    productId?: string,
  ): void {
    if (!this.isValidId(sellerId)) {
      console.warn('⚠️ notifyNewMessageToSeller: sellerId inválido:', sellerId);
      return;
    }

    const linkParams: string[] = [];
    if (this.isValidId(productId)) linkParams.push(`productId=${productId}`);
    if (this.isValidId(buyerId)) linkParams.push(`userId=${buyerId}`);

    const link = linkParams.length > 0 ? `/chat?${linkParams.join('&')}` : '/chat';

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
      },
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
    productId?: string,
  ): void {
    if (!this.isValidId(buyerId)) {
      console.warn('⚠️ notifyNewMessageToBuyer: buyerId inválido:', buyerId);
      return;
    }

    const linkParams: string[] = [];
    if (this.isValidId(productId)) linkParams.push(`productId=${productId}`);
    if (this.isValidId(sellerId)) linkParams.push(`sellerId=${sellerId}`);

    const link = linkParams.length > 0 ? `/chat?${linkParams.join('&')}` : '/chat';

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
      },
    ).subscribe();
  }

  /**
   * 🔥 NOTIFICAR VENDEDOR sobre um NOVO COMENTÁRIO no produto dele
   */
  notifyNewComment(
    sellerId: string,
    commenterId: string,
    commenterName: string,
    productId: string,
    productName: string,
    commentPreview: string,
  ): void {
    if (!this.isValidId(sellerId)) {
      console.warn('⚠️ notifyNewComment: sellerId inválido:', sellerId);
      return;
    }

    const preview =
      commentPreview.length > 60 ? commentPreview.substring(0, 60) + '...' : commentPreview;

    const link = this.isValidId(productId) ? `/produto/${productId}#comments` : '/home';

    this.createNotification(
      String(sellerId),
      'review',
      `💬 Novo comentário de ${commenterName}`,
      `"${preview}" - ${productName}`,
      link,
      {
        commenterId: this.isValidId(commenterId) ? String(commenterId) : null,
        commenterName,
        productId,
        productName,
        type: 'comment',
      },
    ).subscribe();
  }

  /**
   * 🔥 NOTIFICAR CLIENTE sobre uma RESPOSTA do vendedor em um comentário
   */
  notifyCommentReply(
    commenterId: string,
    sellerId: string,
    sellerName: string,
    productId: string,
    productName: string,
    replyPreview: string,
  ): void {
    if (!this.isValidId(commenterId)) {
      console.warn('⚠️ notifyCommentReply: commenterId inválido:', commenterId);
      return;
    }

    const preview =
      replyPreview.length > 60 ? replyPreview.substring(0, 60) + '...' : replyPreview;

    const link = this.isValidId(productId) ? `/produto/${productId}#comments` : '/home';

    this.createNotification(
      String(commenterId),
      'message',
      `💬 ${sellerName} respondeu seu comentário`,
      `"${preview}" - ${productName}`,
      link,
      {
        sellerId: this.isValidId(sellerId) ? String(sellerId) : null,
        sellerName,
        productId,
        productName,
        type: 'comment-reply',
        isFromSeller: true,
      },
    ).subscribe();
  }

  notifyNewMessage(
    sellerId: string,
    buyerId: string,
    buyerName: string,
    productName: string,
    messagePreview: string,
  ): void {
    this.notifyNewMessageToSeller(sellerId, buyerId, buyerName, productName, messagePreview);
  }

  /**
   * 🔥 NOTIFICA O VENDEDOR sobre uma VENDA
   */
  notifyNewSale(
    sellerId: string,
    buyerName: string,
    productName: string,
    orderId: string,
    total: number,
    shippingAddress?: ShippingAddress,
    buyerContact?: { email?: string; phone?: string },
    items?: OrderItemSummary[],
    paymentMethod?: { id: string; name: string; type: string },
  ): void {
    if (!this.isValidId(sellerId)) {
      console.warn('⚠️ notifyNewSale: sellerId inválido');
      return;
    }

    let message = `${buyerName} comprou "${productName}" por ${this.formatPrice(total)}`;

    if (shippingAddress?.city && shippingAddress?.state) {
      message += `\n📍 Enviar para: ${shippingAddress.city} - ${shippingAddress.state}`;
    }

    if (items && items.length > 1) {
      message += `\n📦 ${items.length} itens no pedido`;
    }

    this.createNotification(
      String(sellerId),
      'sale',
      '🎉 Você fez uma venda!',
      message,
      `/pedidos/${orderId}`,
      {
        orderId,
        buyerName,
        productName,
        total,
        status: 'processing',
        role: 'seller',
        shippingAddress: shippingAddress || undefined,
        items: items || undefined,
        paymentMethod: paymentMethod || undefined,
        buyerEmail: buyerContact?.email,
        buyerPhone: buyerContact?.phone,
        type: 'sale',
      },
    ).subscribe();
  }

  notifyOrderConfirmed(
    buyerId: string,
    productName: string,
    orderId: string,
    total: number,
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
      { orderId, productName, total },
    ).subscribe();
  }

  notifyNewReview(
    sellerId: string,
    reviewerName: string,
    productName: string,
    rating: number,
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
      { reviewerName, productName, rating },
    ).subscribe();
  }

  notifySystem(userId: string, title: string, message: string, link?: string): void {
    if (!this.isValidId(userId)) {
      console.warn('⚠️ notifySystem: userId inválido');
      return;
    }
    this.createNotification(String(userId), 'system', title, message, link).subscribe();
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private getIconByType(type: string): string {
    switch (type) {
      case 'message': return 'bi-chat-dots-fill';
      case 'order': return 'bi-box-seam-fill';
      case 'sale': return 'bi-cash-coin';
      case 'review': return 'bi-star-fill';
      case 'system': return 'bi-info-circle-fill';
      default: return 'bi-bell-fill';
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

  // ============================================================
  // POLLING
  // ============================================================
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

  // ============================================================
  // HEADERS
  // ============================================================
  private authHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }
}