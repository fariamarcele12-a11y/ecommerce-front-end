// src/app/core/services/order.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Order, OrderFilter, PaymentMethod, CardData } from '../models/checkout.model';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  // 🔥 URL da API local apenas
  private apiUrl = 'http://localhost:3000/orders';
  //private apiUrl = 'https://ecommerce-api-mf.vercel.app/orders';

  // Estado local
  private orders = new BehaviorSubject<Order[]>([]);
  private currentOrder = new BehaviorSubject<Order | null>(null);
  private readonly isBrowser: boolean;
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService); // 🔥

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);

    // Carregar pedidos do localStorage apenas no navegador
    if (this.isBrowser) {
      this.loadOrdersFromStorage();
    }
  }

  /**
   * Busca todos os pedidos do usuário
   */
  getOrders(filters?: OrderFilter): Observable<Order[]> {
    let url = this.apiUrl;
    const params: string[] = [];

    if (filters) {
      if (filters.status) {
        params.push(`status=${filters.status}`);
      }
      if (filters.userId) {
        params.push(`userId=${filters.userId}`);
      }
      if (filters.limit) {
        params.push(`_limit=${filters.limit}`);
      }
      if (filters.sortBy === 'newest') {
        params.push('_sort=createdAt&_order=desc');
      }
      if (filters.sortBy === 'oldest') {
        params.push('_sort=createdAt&_order=asc');
      }
      if (filters.sortBy === 'total') {
        params.push('_sort=total&_order=desc');
      }
    }

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    return this.http.get<Order[]>(url).pipe(
      tap((orders) => {
        this.orders.next(orders);
        if (this.isBrowser) {
          this.saveOrdersToStorage(orders);
        }
      }),
      catchError(this.handleError),
    );
  }

  /**
   * Busca pedidos do usuário atual
   */
  getMyOrders(userId: string): Observable<Order[]> {
    return this.http
      .get<Order[]>(`${this.apiUrl}?userId=${userId}&_sort=createdAt&_order=desc`)
      .pipe(
        tap((orders) => {
          this.orders.next(orders);
          if (this.isBrowser) {
            this.saveOrdersToStorage(orders);
          }
        }),
        catchError(this.handleError),
      );
  }

  /**
   * 🔥 Busca pedidos onde o usuário é VENDEDOR (para tela "Minhas Vendas")
   */
  getSellerOrders(sellerId: string): Observable<Order[]> {
    // JSON Server não faz query aninhada em arrays, então filtramos no cliente
    return this.http.get<Order[]>(`${this.apiUrl}?_sort=createdAt&_order=desc`).pipe(
      map((orders) =>
        orders.filter((order: any) =>
          (order.items || []).some(
            (item: any) => String(item.sellerId || item.storeId) === String(sellerId)
          )
        )
      ),
      catchError(this.handleError),
    );
  }

  /**
   * Busca pedido por ID
   */
  getOrderById(orderId: string): Observable<Order | undefined> {
    const cachedOrder = this.orders.value.find((o) => o.id === orderId);
    if (cachedOrder) {
      return of(cachedOrder);
    }

    return this.http.get<Order>(`${this.apiUrl}/${orderId}`).pipe(
      tap((order) => {
        const currentOrders = this.orders.value;
        const index = currentOrders.findIndex((o) => o.id === orderId);
        if (index !== -1) {
          currentOrders[index] = order;
        } else {
          currentOrders.push(order);
        }
        this.orders.next(currentOrders);
        if (this.isBrowser) {
          this.saveOrdersToStorage(currentOrders);
        }
      }),
      catchError(this.handleError),
    );
  }

  /**
   * 🔥 Cria um novo pedido E dispara notificações para comprador e vendedor
   */
  createOrder(orderData: Partial<Order>): Observable<Order> {
    const newOrder: Order = {
      id: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      items: orderData.items || [],
      address: orderData.address!,
      paymentMethod: orderData.paymentMethod!,
      subtotal: orderData.subtotal || 0,
      discount: orderData.discount || 0,
      shipping: orderData.shipping || 0,
      total: orderData.total || 0,
      status: 'pending',
      createdAt: new Date(),
      userId: orderData.userId || '1',
      buyerName: orderData.buyerName,
      ...orderData,
    };

    return this.http.post<Order>(this.apiUrl, newOrder).pipe(
      tap((createdOrder) => {
        const currentOrders = this.orders.value;
        this.orders.next([createdOrder, ...currentOrders]);
        this.currentOrder.next(createdOrder);

        if (this.isBrowser) {
          this.saveOrdersToStorage([createdOrder, ...currentOrders]);
        }

        // 🔥 DISPARA NOTIFICAÇÕES PARA COMPRADOR E VENDEDOR
        this.dispatchOrderNotifications(createdOrder);
      }),
      catchError(this.handleError),
    );
  }

  /**
   * 🔔 Dispara notificações de compra/venda usando o NotificationService
   */
  private dispatchOrderNotifications(order: Order): void {
    const items: any[] = order.items || [];

    if (items.length === 0) {
      console.warn('⚠️ Pedido sem itens — notificações não disparadas');
      return;
    }

    const buyerId = String(order.userId || '1');
    const buyerName = (order as any).buyerName || 'Cliente';

    const bySeller = new Map<string, any[]>();
    items.forEach((item) => {
      const sellerId = String(item.sellerId || item.storeId || item.ownerId || '1');

      if (!bySeller.has(sellerId)) bySeller.set(sellerId, []);
      bySeller.get(sellerId)!.push(item);
    });

    bySeller.forEach((sellerItems, sellerId) => {
      const firstItem = sellerItems[0];
      const productName =
        sellerItems.length > 1
          ? `${firstItem.productName || firstItem.name} (+${sellerItems.length - 1})`
          : firstItem.productName || firstItem.name;

      const sellerTotal = sellerItems.reduce(
        (sum, it) => sum + (it.subtotal || it.price * it.quantity || 0),
        0
      );

      this.notificationService.notifyOrderConfirmed(
        buyerId,
        productName,
        order.id,
        sellerTotal
      );

      // 🔔 Notifica VENDEDOR
      this.notificationService.notifyNewSale(
        sellerId,
        buyerName,
        productName,
        order.id,
        sellerTotal
      );
    });
  }

  updateOrderStatus(orderId: string, status: Order['status']): Observable<Order> {
    const updates = {
      status,
      updatedAt: new Date(),
    };

    return this.http.patch<Order>(`${this.apiUrl}/${orderId}`, updates).pipe(
      tap((updatedOrder) => {
        const currentOrders = this.orders.value;
        const index = currentOrders.findIndex((o) => o.id === orderId);
        if (index !== -1) {
          currentOrders[index] = updatedOrder;
          this.orders.next(currentOrders);
          if (this.isBrowser) {
            this.saveOrdersToStorage(currentOrders);
          }
        }

        this.dispatchStatusNotifications(updatedOrder, status);
      }),
      catchError(this.handleError),
    );
  }

  private dispatchStatusNotifications(order: Order, status: Order['status']): void {
    if (!['shipped', 'delivered', 'cancelled', 'processing'].includes(status)) {
      return;
    }

    const items: any[] = order.items || [];
    if (items.length === 0) return;

    const firstItem = items[0];
    const buyerId = String(order.userId || '1');
    const buyerName = (order as any).buyerName || 'Cliente';
    const sellerId = String(firstItem.sellerId || firstItem.storeId || '1');
    const sellerName = firstItem.sellerName || firstItem.storeName || 'Vendedor';
    const productName = firstItem.productName || firstItem.name || 'Produto';

    const statusMessages: Record<
      string,
      { buyerTitle: string; buyer: string; sellerTitle: string; seller: string }
    > = {
      shipped: {
        buyerTitle: '📦 Pedido enviado',
        buyer: `Seu pedido "${productName}" foi enviado e está a caminho!`,
        sellerTitle: '📦 Pedido enviado',
        seller: `Você enviou "${productName}" para ${buyerName}.`,
      },
      delivered: {
        buyerTitle: '🎉 Pedido entregue',
        buyer: `Seu pedido "${productName}" foi entregue com sucesso!`,
        sellerTitle: '✅ Entrega confirmada',
        seller: `"${productName}" foi entregue para ${buyerName}.`,
      },
      cancelled: {
        buyerTitle: '❌ Pedido cancelado',
        buyer: `Seu pedido "${productName}" foi cancelado.`,
        sellerTitle: '❌ Venda cancelada',
        seller: `A venda de "${productName}" para ${buyerName} foi cancelada.`,
      },
      processing: {
        buyerTitle: '⏳ Pagamento aprovado',
        buyer: `Seu pedido "${productName}" está sendo processado.`,
        sellerTitle: '⏳ Pedido em processamento',
        seller: `O pedido de "${productName}" para ${buyerName} está em processamento.`,
      },
    };

    const msgs = statusMessages[status];

    // 🔔 Comprador
    this.notificationService
      .createNotification(
        buyerId,
        'order',
        msgs.buyerTitle,
        msgs.buyer,
        `/pedidos/${order.id}`,
        { orderId: order.id, status, role: 'buyer' }
      )
      .subscribe();

    // 🔔 Vendedor
    this.notificationService
      .createNotification(
        sellerId,
        status === 'cancelled' ? 'order' : 'sale',
        msgs.sellerTitle,
        msgs.seller,
        `/pedidos/${order.id}`,
        { orderId: order.id, status, role: 'seller', buyerName, sellerName }
      )
      .subscribe();
  }

  /**
   * Adiciona número de rastreio ao pedido
   */
  addTrackingCode(orderId: string, trackingCode: string): Observable<Order> {
    return this.http
      .patch<Order>(`${this.apiUrl}/${orderId}`, {
        trackingCode,
        updatedAt: new Date(),
      })
      .pipe(catchError(this.handleError));
  }

  /**
   * Cancela um pedido
   */
  cancelOrder(orderId: string): Observable<Order> {
    return this.updateOrderStatus(orderId, 'cancelled');
  }

  /**
   * Busca o pedido atual
   */
  getCurrentOrder(): Observable<Order | null> {
    return this.currentOrder.asObservable();
  }

  /**
   * Limpa o pedido atual
   */
  clearCurrentOrder(): void {
    this.currentOrder.next(null);
  }

  /**
   * Remove um pedido (apenas admin)
   */
  deleteOrder(orderId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${orderId}`).pipe(
      tap(() => {
        const currentOrders = this.orders.value.filter((o) => o.id !== orderId);
        this.orders.next(currentOrders);
        if (this.isBrowser) {
          this.saveOrdersToStorage(currentOrders);
        }
      }),
      catchError(this.handleError),
    );
  }

  /**
   * Retorna os métodos de pagamento disponíveis
   */
  getPaymentMethods(): PaymentMethod[] {
    return [
      {
        id: 'credit',
        name: 'Cartão de Crédito',
        icon: 'bi-credit-card',
        type: 'credit_card',
        installments: 12,
      },
      {
        id: 'debit',
        name: 'Cartão de Débito',
        icon: 'bi-bank',
        type: 'debit_card',
      },
      {
        id: 'pix',
        name: 'PIX',
        icon: 'bi-qr-code',
        type: 'pix',
      },
      {
        id: 'boleto',
        name: 'Boleto Bancário',
        icon: 'bi-receipt',
        type: 'boleto',
      },
    ];
  }

  /**
   * Processa o pagamento (simulação)
   */
  processPayment(
    order: Order,
  ): Observable<{ success: boolean; message: string; transactionId?: string }> {
    return new Observable((observer) => {
      setTimeout(() => {
        const success = Math.random() > 0.1; // 90% de chance de sucesso
        if (success) {
          observer.next({
            success: true,
            message: 'Pagamento aprovado com sucesso!',
            transactionId: `TXN-${Date.now()}`,
          });

          // Atualizar status do pedido (isso já dispara notificações)
          this.updateOrderStatus(order.id, 'processing').subscribe();
        } else {
          observer.next({
            success: false,
            message: 'Falha no processamento do pagamento. Tente novamente.',
          });
        }
        observer.complete();
      }, 2000);
    });
  }

  /**
   * Simula pagamento com cartão
   */
  processCardPayment(
    order: Order,
    cardData: CardData,
  ): Observable<{ success: boolean; message: string; transactionId?: string }> {
    if (!cardData.cardNumber || cardData.cardNumber.length < 16) {
      return of({
        success: false,
        message: 'Número do cartão inválido.',
      });
    }

    if (!cardData.expiryDate) {
      return of({
        success: false,
        message: 'Data de expiração inválida.',
      });
    }

    if (!cardData.cvv || cardData.cvv.length < 3) {
      return of({
        success: false,
        message: 'CVV inválido.',
      });
    }

    return this.processPayment(order);
  }

  /**
   * Simula pagamento com PIX
   */
  processPixPayment(
    order: Order,
  ): Observable<{ success: boolean; message: string; qrCode?: string; transactionId?: string }> {
    const result = {
      success: true,
      message: 'Pagamento PIX gerado com sucesso!',
      qrCode:
        '00020126410014br.gov.bcb.pix0123email@empresa.com520400005303986540510.005802BR5913EmpresaTeste6009SAOPAULO62070503***6304F9A3',
      transactionId: `PIX-${Date.now()}`,
    };

    this.updateOrderStatus(order.id, 'processing').subscribe();

    return of(result);
  }

  /**
   * Simula pagamento com Boleto
   */
  processBoletoPayment(
    order: Order,
  ): Observable<{ success: boolean; message: string; boletoUrl?: string; transactionId?: string }> {
    const result = {
      success: true,
      message: 'Boleto gerado com sucesso!',
      boletoUrl: 'https://exemplo.com/boleto/123456789',
      transactionId: `BOL-${Date.now()}`,
    };

    this.updateOrderStatus(order.id, 'processing').subscribe();

    return of(result);
  }

  /**
   * Salva pedidos no localStorage
   */
  private saveOrdersToStorage(orders: Order[]): void {
    if (!this.isBrowser) return;

    try {
      localStorage.setItem('orders', JSON.stringify(orders));
    } catch (error) {
      console.error('Erro ao salvar pedidos:', error);
    }
  }

  /**
   * Carrega pedidos do localStorage
   */
  private loadOrdersFromStorage(): void {
    if (!this.isBrowser) return;

    try {
      const ordersData = localStorage.getItem('orders');
      if (ordersData) {
        const orders = JSON.parse(ordersData);
        this.orders.next(orders);
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    }
  }

  /**
   * Tratamento de erros
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocorreu um erro ao processar sua requisição.';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 0:
          errorMessage = 'Não foi possível conectar ao servidor local. Verifique se o JSON Server está rodando.';
          break;
        case 404:
          errorMessage = 'Pedido não encontrado.';
          break;
        case 409:
          errorMessage = 'Conflito ao processar o pedido.';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
          break;
        default:
          errorMessage = `Código: ${error.status}, Mensagem: ${error.message}`;
      }
    }

    console.error('❌ Erro no OrderService:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Obtém estatísticas dos pedidos
   */
  getOrderStats(
    userId?: string,
  ): Observable<{
    total: number;
    pending: number;
    delivered: number;
    cancelled: number;
    totalSpent: number;
  }> {
    const url = userId ? `${this.apiUrl}?userId=${userId}` : this.apiUrl;

    return this.http.get<Order[]>(url).pipe(
      map((orders) => {
        const total = orders.length;
        const pending = orders.filter(
          (o) => o.status === 'pending' || o.status === 'processing',
        ).length;
        const delivered = orders.filter((o) => o.status === 'delivered').length;
        const cancelled = orders.filter((o) => o.status === 'cancelled').length;
        const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);

        return { total, pending, delivered, cancelled, totalSpent };
      }),
      catchError(this.handleError),
    );
  }

  /**
   * 🔥 Verifica o status da API local
   */
  checkApiHealth(): Observable<{ status: string; timestamp: string }> {
    return this.http
      .get<{ status: string; timestamp: string }>(`http://localhost:3000/`)
      .pipe(
        map(() => ({
          status: 'online',
          timestamp: new Date().toISOString(),
        })),
        catchError((error) => {
          console.error('❌ API local não está respondendo:', error);
          return throwError(() => new Error('API local indisponível. Execute: json-server --watch db.json --port 3000'));
        }),
      );
  }
}
