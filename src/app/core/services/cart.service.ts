// src/app/core/services/cart.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, catchError, of, map } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Product } from '../models/ProductModel/product.model';
import { CartItem, CartSummary, CheckoutItem, ApiCartResponse, CouponResult } from '../models/cart.model';
import { AuthService } from './auth.service';
import { CouponService } from './coupon.service';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private apiUrl = `${environment.apiUrl}/carts`;

  private cartItems = new BehaviorSubject<CartItem[]>([]);
  private totalItems = new BehaviorSubject<number>(0);
  private totalPrice = new BehaviorSubject<number>(0);
  private discount = new BehaviorSubject<number>(0);
  private shipping = new BehaviorSubject<number>(0);
  private couponCode = new BehaviorSubject<string>('');
  private isFreeShippingCoupon = new BehaviorSubject<boolean>(false);

  private isBrowser: boolean;

  private readonly COUPON_KEY_PREFIX = 'appliedCoupon_';
  private readonly GUEST_COUPON_KEY = 'appliedCoupon_guest';

  private currentUserId: string | null = null;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly couponService = inject(CouponService);

  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);

    this.authService.currentUser$.subscribe((user) => {
      const newUserId = user?.id ? String(user.id) : null;

      if (this.currentUserId !== newUserId) {
        this.currentUserId = newUserId;

        if (user) {
          this.loadCartFromServer();
        } else {
          this.updateCart([]);
          this.removeDiscount();
        }
      }
    });
  }

  public loadCartFromServer(): void {
    if (!this.isBrowser) return;

    this.http
      .get<ApiCartResponse>(this.apiUrl, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.warn('⚠️ Erro ao carregar carrinho:', error);
          return of({ id: '', userId: '', items: [] } as ApiCartResponse);
        }),
      )
      .subscribe((cart) => {
        this.updateFromServer(cart);
        this.loadCouponFromStorage();
      });
  }

  private updateFromServer(cart: ApiCartResponse): void {
    const items: CartItem[] = (cart.items || [])
      .filter((i) => i.product !== null)
      .map((i) => ({
        product: i.product as Product,
        quantity: i.quantity,
        subtotal: (i.product?.price || 0) * i.quantity,
      }));

    this.updateCart(items);
  }

  getCartItems(): Observable<CartItem[]> { return this.cartItems.asObservable(); }
  getTotalItems(): Observable<number> { return this.totalItems.asObservable(); }
  getTotalPrice(): Observable<number> { return this.totalPrice.asObservable(); }
  getDiscount(): Observable<number> { return this.discount.asObservable(); }
  getShipping(): Observable<number> { return this.shipping.asObservable(); }
  getCouponCode(): Observable<string> { return this.couponCode.asObservable(); }
  getIsFreeShipping(): Observable<boolean> { return this.isFreeShippingCoupon.asObservable(); }

  getCheckoutItems(): CheckoutItem[] {
    return this.cartItems.value.map((item) => {
      const product = item.product;
      const price = product.price || 0;
      const quantity = item.quantity || 1;

      return {
        productId: String(product.id),
        productName: product.name,
        quantity,
        price,
        subtotal: price * quantity,
        image: product.images?.[0] || '',
        sellerId: this.getSellerIdFromProduct(product),
        sellerName: this.getSellerNameFromProduct(product),
      };
    });
  }

  addToCart(product: Product, quantity = 1): Observable<CartItem[]> {
    if (!this.currentUserId) {
      return throwError(
        () => new Error('Você precisa estar logado para adicionar produtos ao carrinho.'),
      );
    }

    const payload = { productId: product.id, quantity };

    return this.http
      .post<ApiCartResponse>(`${this.apiUrl}/items`, payload, { headers: this.authHeaders() })
      .pipe(
        map((cart) => {
          this.updateFromServer(cart);
          return this.cartItems.value;
        }),
        catchError((error) => {
          const msg = error.error?.message || 'Erro ao adicionar item.';
          return throwError(() => new Error(msg));
        }),
      );
  }

  removeFromCart(productId: string): void {
    this.http
      .delete<ApiCartResponse>(`${this.apiUrl}/items/${productId}`, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.error('Erro ao remover', error);
          return throwError(() => error);
        }),
      )
      .subscribe((cart) => this.updateFromServer(cart));
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    this.http
      .patch<ApiCartResponse>(
        `${this.apiUrl}/items/${productId}`,
        { quantity },
        { headers: this.authHeaders() },
      )
      .pipe(
        catchError((error) => {
          console.error('Erro ao atualizar quantidade', error);
          return throwError(() => error);
        }),
      )
      .subscribe((cart) => this.updateFromServer(cart));
  }

  clearCart(): void {
    this.http
      .delete(`${this.apiUrl}`, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.warn('Erro ao limpar carrinho', error);
          return of(null);
        }),
      )
      .subscribe(() => {
        this.updateCart([]);
        this.discount.next(0);
        this.couponCode.next('');
        this.isFreeShippingCoupon.next(false);
        this.removeCouponFromStorage();
      });
  }

  applyCoupon(code: string): Observable<CouponResult> {
    const currentTotal = this.totalPrice.value;
    if (currentTotal === 0) {
      return of({
        valid: false,
        message: 'Carrinho vazio. Adicione produtos para aplicar o cupom.',
      });
    }

    return this.couponService.applyCoupon(code, currentTotal).pipe(
      map((validation: any) => {
        if (validation.valid) {
          this.couponCode.next(code.toUpperCase().trim());

          if (validation.isFreeShipping) {
            this.discount.next(0);
            this.shipping.next(0);
            this.isFreeShippingCoupon.next(true);
          } else {
            this.discount.next(validation.discountAmount || 0);
            this.isFreeShippingCoupon.next(false);
            this.calculateShipping();
          }

          if (this.isBrowser) {
            localStorage.setItem(
              this.getCouponKey(),
              JSON.stringify({
                code: code.toUpperCase().trim(),
                discount: this.discount.value,
                isFreeShipping: validation.isFreeShipping,
              }),
            );
          }

          return {
            valid: true,
            message: validation.message || 'Cupom aplicado com sucesso!',
            discountAmount: validation.discountAmount,
            isFreeShipping: validation.isFreeShipping,
          };
        }

        return {
          valid: false,
          message: validation.message || 'Cupom inválido.',
        };
      }),
      catchError((error) => {
        return of({ valid: false, message: error?.message || 'Erro ao validar cupom.' });
      }),
    );
  }

  removeDiscount(): void {
    this.discount.next(0);
    this.couponCode.next('');
    this.isFreeShippingCoupon.next(false);
    this.removeCouponFromStorage();
    this.calculateShipping();
  }

  hasDiscount(): boolean {
    return this.discount.value > 0 || this.isFreeShippingCoupon.value;
  }

  getAppliedCoupon(): { code: string; discount: number; isFreeShipping: boolean } | null {
    const code = this.couponCode.value;
    if (code) {
      return {
        code,
        discount: this.discount.value,
        isFreeShipping: this.isFreeShippingCoupon.value
      };
    }
    return null;
  }

  // 🔥 REGRA DE FRETE CORRIGIDA
  calculateShipping(): void {
    // 1. Se tem cupom de frete grátis, zera.
    if (this.isFreeShippingCoupon.value) {
      this.shipping.next(0);
      return;
    }

    const items = this.cartItems.value;

    if (items.length === 0) {
      this.shipping.next(0);
      return;
    }

    // 2. Verifica se TODOS os itens do carrinho têm frete grátis
    const allItemsHaveFreeShipping = items.every(item => item.product.freeShipping === true);

    if (allItemsHaveFreeShipping) {
      this.shipping.next(0);
      return;
    }

    // 3. Se algum item NÃO tiver frete grátis, cobra a taxa base.
    // (Você pode ajustar esse valor para o cálculo real dos Correios/Transportadora)
    let shippingCost = 15.90;

    // (Opcional) Se você quiser manter a regra de "Frete grátis para compras acima de X"
    // mas apenas se o produto não for explicitamente "sem frete grátis", descomente abaixo:
    // if (this.totalPrice.value >= 100) shippingCost = 0;

    this.shipping.next(shippingCost);
  }

  getCartSummary(): CartSummary {
    const subtotal = this.totalPrice.value;
    const discount = this.discount.value;
    const shipping = this.shipping.value;
    const total = subtotal - discount + shipping;
    const itemCount = this.totalItems.value;

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

  isEmpty(): boolean { return this.cartItems.value.length === 0; }
  getUniqueItemCount(): number { return this.cartItems.value.length; }

  isProductInCart(productId: string): boolean {
    return this.cartItems.value.some((item) => String(item.product.id) === String(productId));
  }

  getProductQuantity(productId: string): number {
    const item = this.cartItems.value.find((item) => String(item.product.id) === String(productId));
    return item ? item.quantity : 0;
  }

  private getSellerIdFromProduct(product: Product): string {
    const p: any = product || {};
    return String(p.seller?.id || p.sellerId || p.storeId || p.ownerId || p.userId || '1');
  }

  private getSellerNameFromProduct(product: Product): string {
    const p: any = product || {};
    return p.seller?.name || p.sellerName || p.storeName || p.ownerName || 'Vendedor';
  }

  private updateCart(items: CartItem[]): void {
    items.forEach((item) => {
      item.subtotal = item.product.price * item.quantity;
    });

    this.cartItems.next(items);
    this.totalItems.next(items.reduce((sum, item) => sum + item.quantity, 0));
    this.totalPrice.next(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0));

    this.calculateShipping();
  }

  private getCouponKey(): string {
    return this.currentUserId
      ? `${this.COUPON_KEY_PREFIX}${this.currentUserId}`
      : this.GUEST_COUPON_KEY;
  }

  private loadCouponFromStorage(): void {
    if (!this.isBrowser) return;
    const couponData = localStorage.getItem(this.getCouponKey());
    if (couponData) {
      try {
        const coupon = JSON.parse(couponData);
        this.couponCode.next(coupon.code);

        if (coupon.isFreeShipping) {
          this.discount.next(0);
          this.shipping.next(0);
          this.isFreeShippingCoupon.next(true);
        } else {
          this.discount.next(coupon.discount);
          this.isFreeShippingCoupon.next(false);
          this.calculateShipping();
        }
      } catch (e) {
        console.error('Erro ao carregar cupom', e);
      }
    }
  }

  private removeCouponFromStorage(): void {
    if (this.isBrowser) localStorage.removeItem(this.getCouponKey());
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }
}
