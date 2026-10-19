// src/app/core/services/order.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Order, OrderFilter, PaymentMethod, CardData } from '../models/checkout.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private apiUrl = `${environment.apiUrl}/orders`;

  private orders = new BehaviorSubject<Order[]>([]);
  private currentOrder = new BehaviorSubject<Order | null>(null);
  private readonly isBrowser: boolean;
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this.loadOrdersFromStorage();
    }
  }

  // ============================================================
  // GET ORDERS (lista com filtros)
  // ============================================================
  getOrders(filters?: OrderFilter): Observable<Order[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.status) params = params.set('status', filters.status);
      if (filters.limit) params = params.set('limit', String(filters.limit));
      if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
    }

    return this.http
      .get<{ orders: Order[]; total: number }>(this.apiUrl, {
        params,
        headers: this.authHeaders(),
      })
      .pipe(
        map((res) => res.orders || []),
        tap((orders) => {
          this.orders.next(orders);
          if (this.isBrowser) this.saveOrdersToStorage(orders);
        }),
        catchError(this.handleError),
      );
  }

  // ============================================================
  // MEUS PEDIDOS (comprador) — o backend filtra pelo JWT
  // ============================================================
  getMyOrders(userId: string): Observable<Order[]> {
    return this.http
      .get<Order[]>(`${this.apiUrl}/my`, { headers: this.authHeaders() })
      .pipe(
        tap((orders) => {
          this.orders.next(orders);
          if (this.isBrowser) this.saveOrdersToStorage(orders);
        }),
        catchError(this.handleError),
      );
  }

  // ============================================================
  // MINHAS VENDAS (vendedor)
  // ============================================================
  getSellerOrders(sellerId: string): Observable<Order[]> {
    return this.http
      .get<Order[]>(`${this.apiUrl}/seller`, { headers: this.authHeaders() })
      .pipe(catchError(this.handleError));
  }

  // ============================================================
  // GET BY ID
  // ============================================================
  getOrderById(orderId: string): Observable<Order | undefined> {
    const cachedOrder = this.orders.value.find((o) => o.id === orderId);
    if (cachedOrder) return of(cachedOrder);

    return this.http
      .get<Order>(`${this.apiUrl}/${orderId}`, { headers: this.authHeaders() })
      .pipe(
        tap((order) => {
          const currentOrders = this.orders.value;
          const index = currentOrders.findIndex((o) => o.id === orderId);
          if (index !== -1) {
            currentOrders[index] = order;
          } else {
            currentOrders.push(order);
          }
          this.orders.next(currentOrders);
          if (this.isBrowser) this.saveOrdersToStorage(currentOrders);
        }),
        catchError(this.handleError),
      );
  }

  // ============================================================
  // CREATE ORDER
  // ⚠️ O backend cria as notificações para comprador e vendedores
  // ============================================================
  createOrder(orderData: Partial<Order>): Observable<Order> {
    const payload = {
      items: (orderData.items || []).map((item) => ({
        productId: String(item.productId),
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        image: item.image,
      })),
      address: {
        cep: orderData.address?.cep || '',
        street: orderData.address?.street || '',
        number: orderData.address?.number || '',
        complement: orderData.address?.complement || '',
        neighborhood: orderData.address?.neighborhood || '',
        city: orderData.address?.city || '',
        state: orderData.address?.state || '',
        country: orderData.address?.country || 'Brasil',
      },
      paymentMethod: {
        id: orderData.paymentMethod?.id || '',
        name: orderData.paymentMethod?.name || '',
        type: orderData.paymentMethod?.type || '',
      },
      subtotal: orderData.subtotal || 0,
      discount: orderData.discount || 0,
      shipping: orderData.shipping || 0,
      total: orderData.total || 0,
      buyerName: orderData.buyerName,
      buyerEmail: (orderData as any).buyerEmail,
      buyerPhone: (orderData as any).buyerPhone,
    };

    return this.http
      .post<Order>(this.apiUrl, payload, { headers: this.authHeaders() })
      .pipe(
        tap((createdOrder) => {
          const currentOrders = this.orders.value;
          this.orders.next([createdOrder, ...currentOrders]);
          this.currentOrder.next(createdOrder);

          if (this.isBrowser) {
            this.saveOrdersToStorage([createdOrder, ...currentOrders]);
          }
          // ⚠️ Notificações são criadas pelo backend
        }),
        catchError(this.handleError),
      );
  }

  // ============================================================
  // UPDATE STATUS
  // ⚠️ O backend cria as notificações de status automaticamente
  // ============================================================
  updateOrderStatus(orderId: string, status: Order['status']): Observable<Order> {
    return this.http
      .patch<Order>(
        `${this.apiUrl}/${orderId}/status`,
        { status },
        { headers: this.authHeaders() },
      )
      .pipe(
        tap((updatedOrder) => {
          const currentOrders = this.orders.value;
          const index = currentOrders.findIndex((o) => o.id === orderId);
          if (index !== -1) {
            currentOrders[index] = updatedOrder;
            this.orders.next(currentOrders);
            if (this.isBrowser) this.saveOrdersToStorage(currentOrders);
          }
        }),
        catchError(this.handleError),
      );
  }

  // ============================================================
  // TRACKING
  // ============================================================
  addTrackingCode(orderId: string, trackingCode: string): Observable<Order> {
    return this.http
      .patch<Order>(
        `${this.apiUrl}/${orderId}/tracking`,
        { trackingCode },
        { headers: this.authHeaders() },
      )
      .pipe(catchError(this.handleError));
  }

  // ============================================================
  // CANCEL
  // ============================================================
  cancelOrder(orderId: string): Observable<Order> {
    return this.updateOrderStatus(orderId, 'cancelled');
  }

  // ============================================================
  // CURRENT ORDER
  // ============================================================
  getCurrentOrder(): Observable<Order | null> {
    return this.currentOrder.asObservable();
  }

  clearCurrentOrder(): void {
    this.currentOrder.next(null);
  }

  // ============================================================
  // DELETE
  // ============================================================
  deleteOrder(orderId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${orderId}`, { headers: this.authHeaders() })
      .pipe(
        tap(() => {
          const currentOrders = this.orders.value.filter((o) => o.id !== orderId);
          this.orders.next(currentOrders);
          if (this.isBrowser) this.saveOrdersToStorage(currentOrders);
        }),
        catchError(this.handleError),
      );
  }

  // ============================================================
  // MÉTODOS DE PAGAMENTO (fixo no frontend)
  // ============================================================
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

  // ============================================================
  // PAGAMENTO SIMULADO
  // ============================================================
  processPayment(
    order: Order,
  ): Observable<{ success: boolean; message: string; transactionId?: string }> {
    return new Observable((observer) => {
      setTimeout(() => {
        const success = Math.random() > 0.1;
        if (success) {
          observer.next({
            success: true,
            message: 'Pagamento aprovado com sucesso!',
            transactionId: `TXN-${Date.now()}`,
          });

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

  processCardPayment(
    order: Order,
    cardData: CardData,
  ): Observable<{ success: boolean; message: string; transactionId?: string }> {
    if (!cardData.cardNumber || cardData.cardNumber.length < 16) {
      return of({ success: false, message: 'Número do cartão inválido.' });
    }
    if (!cardData.expiryDate) {
      return of({ success: false, message: 'Data de expiração inválida.' });
    }
    if (!cardData.cvv || cardData.cvv.length < 3) {
      return of({ success: false, message: 'CVV inválido.' });
    }
    return this.processPayment(order);
  }

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

  // ============================================================
  // STATS
  // ============================================================
  getOrderStats(
    userId?: string,
  ): Observable<{
    total: number;
    pending: number;
    delivered: number;
    cancelled: number;
    totalSpent: number;
  }> {
    return this.http
      .get<{
        total: number;
        pending: number;
        processing: number;
        shipped: number;
        delivered: number;
        cancelled: number;
        totalSpent: number;
      }>(`${this.apiUrl}/stats`, { headers: this.authHeaders() })
      .pipe(
        map((stats) => ({
          total: stats.total,
          pending: stats.pending + stats.processing + stats.shipped,
          delivered: stats.delivered,
          cancelled: stats.cancelled,
          totalSpent: stats.totalSpent,
        })),
        catchError(this.handleError),
      );
  }

  // ============================================================
  // LOCAL STORAGE
  // ============================================================
  private saveOrdersToStorage(orders: Order[]): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem('orders', JSON.stringify(orders));
    } catch (error) {
      console.error('Erro ao salvar pedidos:', error);
    }
  }

  private loadOrdersFromStorage(): void {
    if (!this.isBrowser) return;
    try {
      const ordersData = localStorage.getItem('orders');
      if (ordersData) {
        this.orders.next(JSON.parse(ordersData));
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
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

  // ============================================================
  // ERROR
  // ============================================================
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocorreu um erro ao processar sua requisição.';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 0:
          errorMessage = 'Não foi possível conectar ao servidor.';
          break;
        case 401:
          errorMessage = 'Sessão expirada. Faça login novamente.';
          break;
        case 403:
          errorMessage = 'Você não tem permissão para esta ação.';
          break;
        case 404:
          errorMessage = 'Pedido não encontrado.';
          break;
        case 409:
          errorMessage = 'Conflito ao processar o pedido.';
          break;
        case 500:
          errorMessage = error?.error?.message || 'Erro interno do servidor.';
          break;
        default:
          errorMessage = `Código: ${error.status}, Mensagem: ${error.message}`;
      }
    }

    console.error('❌ Erro no OrderService:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
