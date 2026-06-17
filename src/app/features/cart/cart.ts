import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../../core/services/cartService';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart.html',
  styleUrls: ['./cart.scss']
})
export class Cart implements OnInit, OnDestroy {
  cartItems: CartItem[] = [];
  totalItems = 0;
  subtotal = 0;
  discount = 0;
  shipping = 0;
  total = 0;
  couponCode = '';
  couponApplied = false;
  couponMessage = '';
  isLoading = false;

  private subscriptions: Subscription = new Subscription();

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCart();
    this.cartService.loadCartFromStorage();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadCart(): void {
    this.isLoading = true;

    this.subscriptions.add(
      this.cartService.getCartItems().subscribe(items => {
        this.cartItems = items;
        this.isLoading = false;
      })
    );

    this.subscriptions.add(
      this.cartService.getTotalItems().subscribe(total => {
        this.totalItems = total;
      })
    );

    this.subscriptions.add(
      this.cartService.getTotalPrice().subscribe(total => {
        this.subtotal = total;
        this.updateTotals();
      })
    );

    this.subscriptions.add(
      this.cartService.getDiscount().subscribe(discount => {
        this.discount = discount;
        this.updateTotals();
      })
    );

    this.subscriptions.add(
      this.cartService.getShipping().subscribe(shipping => {
        this.shipping = shipping;
        this.updateTotals();
      })
    );
  }

  updateTotals(): void {
    const summary = this.cartService.getCartSummary();
    this.subtotal = summary.subtotal;
    this.discount = summary.discount;
    this.shipping = summary.shipping;
    this.total = summary.total;
  }

  updateQuantity(productId: number, quantity: number): void {
    if (quantity >= 0) {
      this.cartService.updateQuantity(productId, quantity);
    }
  }

  removeItem(productId: number): void {
    if (confirm('Tem certeza que deseja remover este item do carrinho?')) {
      this.cartService.removeFromCart(productId);
    }
  }

  clearCart(): void {
    if (confirm('Tem certeza que deseja esvaziar o carrinho?')) {
      this.cartService.clearCart();
    }
  }

  applyCoupon(): void {
    if (!this.couponCode.trim()) {
      this.couponMessage = 'Digite um cupom válido.';
      this.couponApplied = false;
      return;
    }

    const success = this.cartService.applyDiscount(this.couponCode);
    if (success) {
      this.couponMessage = `Cupom ${this.couponCode} aplicado com sucesso!`;
      this.couponApplied = true;
      this.couponCode = '';
    } else {
      this.couponMessage = 'Cupom inválido. Tente novamente.';
      this.couponApplied = false;
    }

    setTimeout(() => {
      this.couponMessage = '';
    }, 5000);
  }

  removeCoupon(): void {
    this.cartService.applyDiscount('');
    this.couponApplied = false;
    this.couponMessage = 'Cupom removido.';
    setTimeout(() => {
      this.couponMessage = '';
    }, 3000);
  }

  proceedToCheckout(): void {
    if (this.cartItems.length === 0) {
      alert('Seu carrinho está vazio!');
      return;
    }
    this.router.navigate(['/checkout']);
  }

  continueShopping(): void {
    this.router.navigate(['/home']);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  getTotalSavings(): number {
    const totalOriginal = this.cartItems.reduce(
      (sum, item) => sum + ((item.product.oldPrice || item.product.price) * item.quantity),
      0
    );
    return totalOriginal - this.subtotal;
  }
}
