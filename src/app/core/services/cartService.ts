import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product } from '../models/ProductModel/product.model';

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItems = new BehaviorSubject<CartItem[]>([]);
  private totalItems = new BehaviorSubject<number>(0);
  private totalPrice = new BehaviorSubject<number>(0);
  private discount = new BehaviorSubject<number>(0);
  private shipping = new BehaviorSubject<number>(0);

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

  addToCart(product: Product, quantity: number = 1): void {
    const currentItems = this.cartItems.value;
    const existingItem = currentItems.find(item => item.product.id === product.id);

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity <= product.stock) {
        existingItem.quantity = newQuantity;
      } else {
        existingItem.quantity = product.stock;
        alert(`Desculpe, só temos ${product.stock} unidades disponíveis.`);
      }
    } else {
      if (quantity <= product.stock) {
        currentItems.push({
          product,
          quantity: Math.min(quantity, product.stock),
          subtotal: product.price * quantity
        });
      } else {
        alert(`Desculpe, só temos ${product.stock} unidades disponíveis.`);
        return;
      }
    }

    this.updateCart(currentItems);
    this.saveCartToStorage(currentItems);
  }

  removeFromCart(productId: number): void {
    const currentItems = this.cartItems.value.filter(item => item.product.id !== productId);
    this.updateCart(currentItems);
    this.saveCartToStorage(currentItems);
  }

  updateQuantity(productId: number, quantity: number): void {
    const currentItems = this.cartItems.value;
    const item = currentItems.find(item => item.product.id === productId);

    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else if (quantity <= item.product.stock) {
        item.quantity = quantity;
        this.updateCart(currentItems);
        this.saveCartToStorage(currentItems);
      } else {
        alert(`Desculpe, só temos ${item.product.stock} unidades disponíveis.`);
      }
    }
  }

  clearCart(): void {
    this.updateCart([]);
    this.saveCartToStorage([]);
  }

  applyDiscount(code: string): boolean {
    // Simulação de cupom de desconto
    const validCoupons: { [key: string]: number } = {
      'PROMO10': 10,
      'PROMO20': 20,
      'PROMO30': 30,
      'BLACKFRIDAY': 50
    };

    if (validCoupons[code.toUpperCase()]) {
      const discountValue = validCoupons[code.toUpperCase()];
      const currentTotal = this.totalPrice.value;
      const discountAmount = (currentTotal * discountValue) / 100;
      this.discount.next(discountAmount);
      return true;
    }
    return false;
  }

  calculateShipping(): void {
    const total = this.totalPrice.value;
    let shippingCost = 0;

    if (total > 0) {
      if (total >= 100) {
        shippingCost = 0; // Frete grátis
      } else if (total >= 50) {
        shippingCost = 15.90;
      } else {
        shippingCost = 25.90;
      }
    }

    this.shipping.next(shippingCost);
  }

  getCartSummary(): {
    subtotal: number;
    discount: number;
    shipping: number;
    total: number
  } {
    const subtotal = this.totalPrice.value;
    const discount = this.discount.value;
    const shipping = this.shipping.value;
    const total = subtotal - discount + shipping;

    return {
      subtotal,
      discount,
      shipping,
      total: Math.max(total, 0)
    };
  }

  private updateCart(items: CartItem[]): void {
    // Calcular subtotal de cada item
    items.forEach(item => {
      item.subtotal = item.product.price * item.quantity;
    });

    this.cartItems.next(items);

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    this.totalItems.next(totalItems);

    const totalPrice = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    this.totalPrice.next(totalPrice);

    this.calculateShipping();
  }

  // Persistir carrinho no localStorage
  private saveCartToStorage(items: CartItem[]): void {
    try {
      const cartData = items.map(item => ({
        productId: item.product.id,
        quantity: item.quantity
      }));
      localStorage.setItem('cart', JSON.stringify(cartData));
    } catch (error) {
      console.error('Erro ao salvar carrinho:', error);
    }
  }

  loadCartFromStorage(): void {
    try {
      const cartData = localStorage.getItem('cart');
      if (cartData) {
        const parsedData = JSON.parse(cartData);
        // Aqui você precisaria buscar os produtos novamente
        // Por simplicidade, vamos apenas limpar
      }
    } catch (error) {
      console.error('Erro ao carregar carrinho:', error);
    }
  }
}
