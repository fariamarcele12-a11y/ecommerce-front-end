import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, catchError, tap, map, switchMap, of } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Product } from '../models/ProductModel/product.model';

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal?: number;
}

export interface CartSummary {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  itemCount: number;
  savings: number;
}

export interface ServerCart {
  id: number;
  items: {
    productId: number;
    quantity: number;
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class CartService {
  // URLs da API
  private apiUrl = 'https://ecommerce-api-mf.vercel.app/cart';
  private localApiUrl = 'http://localhost:3000/cart';

  // Estado do carrinho
  private cartItems = new BehaviorSubject<CartItem[]>([]);
  private totalItems = new BehaviorSubject<number>(0);
  private totalPrice = new BehaviorSubject<number>(0);
  private discount = new BehaviorSubject<number>(0);
  private shipping = new BehaviorSubject<number>(0);
  private couponCode = new BehaviorSubject<string>('');

  private isBrowser: boolean;
  private isSyncing = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Carregar carrinho do localStorage e sincronizar com servidor
    if (this.isBrowser) {
      this.loadCartFromStorage();
      this.syncCartWithServer();
    }
  }

  /**
   * Observables públicos
   */
  getCartItems(): Observable<CartItem[]> {
    return this.cartItems.asObservable();
  }

  getTotalItems(): Observable<number> {
    return this.totalItems.asObservable();
  }

  getTotalPrice(): Observable<number> {
    return this.totalPrice.asObservable();
  }

  getDiscount(): Observable<number> {
    return this.discount.asObservable();
  }

  getShipping(): Observable<number> {
    return this.shipping.asObservable();
  }

  getCouponCode(): Observable<string> {
    return this.couponCode.asObservable();
  }

  /**
   * Adiciona produto ao carrinho
   */
  addToCart(product: Product, quantity: number = 1): void {
    const currentItems = this.cartItems.value;
    const existingItem = currentItems.find((item) => item.product.id === product.id);

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity <= product.stock) {
        existingItem.quantity = newQuantity;
      } else {
        existingItem.quantity = product.stock;
        if (this.isBrowser) {
          alert(`Desculpe, só temos ${product.stock} unidades disponíveis.`);
        }
      }
    } else {
      if (quantity <= product.stock) {
        currentItems.push({
          product,
          quantity: Math.min(quantity, product.stock),
          subtotal: product.price * quantity,
        });
      } else {
        if (this.isBrowser) {
          alert(`Desculpe, só temos ${product.stock} unidades disponíveis.`);
        }
        return;
      }
    }

    this.updateCart(currentItems);
    this.saveToStorageAndServer(currentItems);
  }

  /**
   * Remove produto do carrinho
   */
  removeFromCart(productId: number): void {
    const currentItems = this.cartItems.value.filter((item) => item.product.id !== productId);
    this.updateCart(currentItems);
    this.saveToStorageAndServer(currentItems);
  }

  /**
   * Atualiza quantidade de um produto
   */
  updateQuantity(productId: number, quantity: number): void {
    const currentItems = this.cartItems.value;
    const item = currentItems.find((item) => item.product.id === productId);

    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else if (quantity <= item.product.stock) {
        item.quantity = quantity;
        this.updateCart(currentItems);
        this.saveToStorageAndServer(currentItems);
      } else {
        if (this.isBrowser) {
          alert(`Desculpe, só temos ${item.product.stock} unidades disponíveis.`);
        }
      }
    }
  }

  /**
   * Limpa o carrinho
   */
  clearCart(): void {
    this.updateCart([]);
    this.discount.next(0);
    this.couponCode.next('');
    this.saveToStorageAndServer([]);
  }

  /**
   * Aplica cupom de desconto
   */
  applyDiscount(code: string): boolean {
    const validCoupons: { [key: string]: number } = {
      PROMO10: 10,
      PROMO20: 20,
      PROMO30: 30,
      BLACKFRIDAY: 50,
      FREEGIFT: 0,
      WELCOME10: 10,
      VIP20: 20,
    };

    const upperCode = code.toUpperCase().trim();

    if (validCoupons.hasOwnProperty(upperCode)) {
      const discountValue = validCoupons[upperCode];
      const currentTotal = this.totalPrice.value;

      // Desconto máximo de 50% do total
      const maxDiscount = currentTotal * 0.5;
      const discountAmount = Math.min((currentTotal * discountValue) / 100, maxDiscount);

      this.discount.next(discountAmount);
      this.couponCode.next(upperCode);

      // Salvar cupom aplicado
      if (this.isBrowser) {
        localStorage.setItem(
          'appliedCoupon',
          JSON.stringify({
            code: upperCode,
            discount: discountAmount,
          }),
        );
      }

      return true;
    }
    return false;
  }

  /**
   * Remove cupom de desconto
   */
  removeDiscount(): void {
    this.discount.next(0);
    this.couponCode.next('');
    if (this.isBrowser) {
      localStorage.removeItem('appliedCoupon');
    }
  }

  /**
   * Verifica se há cupom aplicado
   */
  hasDiscount(): boolean {
    return this.discount.value > 0;
  }

  /**
   * Calcula o frete
   */
  calculateShipping(): void {
    const total = this.totalPrice.value;
    let shippingCost = 0;

    if (total > 0) {
      if (total >= 100) {
        shippingCost = 0; // Frete grátis
      } else if (total >= 50) {
        shippingCost = 15.9;
      } else {
        shippingCost = 25.9;
      }
    }

    this.shipping.next(shippingCost);
  }

  /**
   * Obtém o resumo completo do carrinho
   */
  getCartSummary(): CartSummary {
    const subtotal = this.totalPrice.value;
    const discount = this.discount.value;
    const shipping = this.shipping.value;
    const total = subtotal - discount + shipping;
    const itemCount = this.totalItems.value;

    // Calcular economia total (preços originais vs atuais)
    const originalTotal = this.cartItems.value.reduce(
      (sum, item) => sum + (item.product.oldPrice || item.product.price) * item.quantity,
      0,
    );
    const savings = originalTotal - subtotal;

    return {
      subtotal,
      discount,
      shipping,
      total: Math.max(total, 0),
      itemCount,
      savings: Math.max(savings, 0),
    };
  }

  /**
   * Verifica se o carrinho está vazio
   */
  isEmpty(): boolean {
    return this.cartItems.value.length === 0;
  }

  /**
   * Obtém o número total de itens únicos
   */
  getUniqueItemCount(): number {
    return this.cartItems.value.length;
  }

  /**
   * Verifica se um produto está no carrinho
   */
  isProductInCart(productId: number): boolean {
    return this.cartItems.value.some((item) => item.product.id === productId);
  }

  /**
   * Obtém a quantidade de um produto no carrinho
   */
  getProductQuantity(productId: number): number {
    const item = this.cartItems.value.find((item) => item.product.id === productId);
    return item ? item.quantity : 0;
  }

  /**
   * Atualiza o estado do carrinho
   */
  private updateCart(items: CartItem[]): void {
    items.forEach((item) => {
      item.subtotal = item.product.price * item.quantity;
    });

    this.cartItems.next(items);

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    this.totalItems.next(totalItems);

    const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    this.totalPrice.next(totalPrice);

    this.calculateShipping();
  }

  /**
   * Salva no localStorage e sincroniza com o servidor
   */
  private saveToStorageAndServer(items: CartItem[]): void {
    if (this.isBrowser) {
      this.saveCartToStorage(items);
    }
    this.saveCartToServer(items);
  }

  /**
   * Salva carrinho no localStorage
   */
  private saveCartToStorage(items: CartItem[]): void {
    try {
      const cartData = items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }));
      localStorage.setItem('cart', JSON.stringify(cartData));
    } catch (error) {
      console.error('Erro ao salvar carrinho:', error);
    }
  }

  /**
   * Salva carrinho no servidor
   */
  private saveCartToServer(items: CartItem[]): void {
    if (this.isSyncing) return;

    const cartData = items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }));

    // Como json-server não tem um endpoint de carrinho simples,
    // vamos simular salvando em um recurso "cart"
    this.http
      .put(`${this.apiUrl}/1`, { items: cartData })
      .pipe(
        catchError((error) => {
          console.warn('Erro ao sincronizar carrinho com servidor:', error);
          return of(null);
        }),
      )
      .subscribe();
  }

  /**
   * Carrega carrinho do localStorage
   */
  private loadCartFromStorage(): void {
    if (!this.isBrowser) return;

    try {
      const cartData = localStorage.getItem('cart');
      if (cartData) {
        const parsedData = JSON.parse(cartData);

        // Se tiver dados no localStorage, tentar buscar os produtos
        if (parsedData && parsedData.length > 0) {
          this.loadProductsForCart(parsedData);
        }
      }

      // Recuperar cupom aplicado
      const couponData = localStorage.getItem('appliedCoupon');
      if (couponData) {
        const coupon = JSON.parse(couponData);
        this.discount.next(coupon.discount);
        this.couponCode.next(coupon.code);
      }
    } catch (error) {
      console.error('Erro ao carregar carrinho do localStorage:', error);
    }
  }

  /**
   * Carrega produtos para o carrinho a partir do localStorage
   */
  private loadProductsForCart(cartData: { productId: number; quantity: number }[]): void {
    // Buscar produtos individualmente
    const productIds = cartData.map((item) => item.productId);
    // Nota: Isso seria idealmente feito com um endpoint de busca em lote
    // Por enquanto, vamos apenas limpar o carrinho para evitar dados inconsistentes
    console.log('🛒 Carrinho carregado do localStorage:', cartData);
  }

  /**
   * Sincroniza carrinho com o servidor
   */
  private syncCartWithServer(): void {
    if (!this.isBrowser) return;

    this.isSyncing = true;

    this.http
      .get<ServerCart>(`${this.apiUrl}/1`)
      .pipe(
        catchError((error) => {
          if (error.status === 404) {
            // Criar recurso de carrinho se não existir
            return this.http.post<ServerCart>(this.apiUrl, {
              id: 1,
              items: [],
            });
          }
          return throwError(() => error);
        }),
        catchError((error) => {
          console.warn('Erro ao sincronizar carrinho com servidor:', error);
          this.isSyncing = false;
          return of(null);
        }),
      )
      .subscribe((serverCart) => {
        this.isSyncing = false;

        if (serverCart && serverCart.items) {
          // Carregar produtos do servidor (seria necessário buscar os produtos)
          console.log('📦 Carrinho carregado do servidor:', serverCart.items);
        }
      });
  }

  /**
   * Força a sincronização com o servidor
   */
  syncCart(): void {
    this.syncCartWithServer();
  }

  /**
   * Alterna entre ambiente local e produção
   */
  setEnvironment(environment: 'local' | 'production'): void {
    if (environment === 'local') {
      this.apiUrl = this.localApiUrl;
    } else {
      this.apiUrl = 'https://ecommerce-api-mf.vercel.app/cart';
    }
  }

  /**
   * Log do carrinho para debug
   */
  debugCart(): void {
    console.log('🛒 Estado atual do carrinho:');
    console.log('  - Itens:', this.cartItems.value);
    console.log('  - Total de itens:', this.totalItems.value);
    console.log('  - Preço total:', this.totalPrice.value);
    console.log('  - Desconto:', this.discount.value);
    console.log('  - Frete:', this.shipping.value);
    console.log('  - Cupom:', this.couponCode.value);
  }
}
