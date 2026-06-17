import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Order, OrderItem, Address, PaymentMethod } from '../models/checkout.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private orders = new BehaviorSubject<Order[]>([]);
  private currentOrder = new BehaviorSubject<Order | null>(null);

  getOrders(): Observable<Order[]> {
    return this.orders.asObservable();
  }

  getCurrentOrder(): Observable<Order | null> {
    return this.currentOrder.asObservable();
  }

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
      ...orderData
    };

    const currentOrders = this.orders.value;
    this.orders.next([newOrder, ...currentOrders]);
    this.currentOrder.next(newOrder);

    // Salvar no localStorage
    this.saveOrdersToStorage();

    return of(newOrder);
  }

  updateOrderStatus(orderId: string, status: Order['status']): void {
    const currentOrders = this.orders.value;
    const order = currentOrders.find(o => o.id === orderId);
    if (order) {
      order.status = status;
      order.updatedAt = new Date();
      this.orders.next(currentOrders);
      this.saveOrdersToStorage();
    }
  }

  getOrderById(orderId: string): Observable<Order | undefined> {
    const order = this.orders.value.find(o => o.id === orderId);
    return of(order);
  }

  private saveOrdersToStorage(): void {
    try {
      localStorage.setItem('orders', JSON.stringify(this.orders.value));
    } catch (error) {
      console.error('Erro ao salvar pedidos:', error);
    }
  }

  loadOrdersFromStorage(): void {
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

  // Métodos de pagamento disponíveis
  getPaymentMethods(): PaymentMethod[] {
    return [
      {
        id: 'credit',
        name: 'Cartão de Crédito',
        icon: 'bi-credit-card',
        type: 'credit_card',
        installments: 12
      },
      {
        id: 'debit',
        name: 'Cartão de Débito',
        icon: 'bi-bank',
        type: 'debit_card'
      },
      {
        id: 'pix',
        name: 'PIX',
        icon: 'bi-qr-code',
        type: 'pix'
      },
      {
        id: 'boleto',
        name: 'Boleto Bancário',
        icon: 'bi-receipt',
        type: 'boleto'
      }
    ];
  }

  // Simular processamento de pagamento
  processPayment(order: Order): Observable<{ success: boolean; message: string; transactionId?: string }> {
    // Simular delay de processamento
    return new Observable(observer => {
      setTimeout(() => {
        const success = Math.random() > 0.1; // 90% de chance de sucesso
        if (success) {
          observer.next({
            success: true,
            message: 'Pagamento aprovado com sucesso!',
            transactionId: `TXN-${Date.now()}`
          });
        } else {
          observer.next({
            success: false,
            message: 'Falha no processamento do pagamento. Tente novamente.'
          });
        }
        observer.complete();
      }, 2000);
    });
  }
}
