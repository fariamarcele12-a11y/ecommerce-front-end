import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../../core/services/cart.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart.html',
  styleUrls: ['./cart.scss'],
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
    private router: Router,
    private alertService: AlertService,
  ) {}

  ngOnInit(): void {
    this.loadCart();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadCart(): void {
    this.isLoading = true;

    this.subscriptions.add(
      this.cartService.getCartItems().subscribe((items) => {
        this.cartItems = items;
        this.isLoading = false;
      }),
    );

    this.subscriptions.add(
      this.cartService.getTotalItems().subscribe((total) => {
        this.totalItems = total;
      }),
    );

    this.subscriptions.add(
      this.cartService.getTotalPrice().subscribe((total) => {
        this.subtotal = total;
        this.updateTotals();
      }),
    );

    this.subscriptions.add(
      this.cartService.getDiscount().subscribe((discount) => {
        this.discount = discount;
        this.updateTotals();
      }),
    );

    this.subscriptions.add(
      this.cartService.getShipping().subscribe((shipping) => {
        this.shipping = shipping;
        this.updateTotals();
      }),
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
    const product = this.cartItems.find(item => item.product.id === productId);
    const productName = product?.product.name || 'Produto';

    this.alertService.confirm(
      `Remover "${productName}"?`,
      'Tem certeza que deseja remover este item do carrinho?',
      'Sim, remover',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.cartService.removeFromCart(productId);
        this.alertService.toast('Item removido do carrinho!', 'success');
      }
    });
  }

  clearCart(): void {
    if (this.cartItems.length === 0) {
      this.alertService.warning('Carrinho vazio', 'Não há itens para remover.');
      return;
    }

    this.alertService.confirm(
      'Esvaziar Carrinho?',
      'Tem certeza que deseja remover todos os itens do carrinho? Esta ação não pode ser desfeita.',
      'Sim, esvaziar',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.cartService.clearCart();
        this.couponApplied = false;
        this.couponCode = '';
        this.alertService.success(
          'Carrinho esvaziado!',
          'Todos os itens foram removidos do seu carrinho.'
        );
      }
    });
  }

  applyCoupon(): void {
    if (!this.couponCode.trim()) {
      this.couponMessage = 'Digite um cupom válido.';
      this.couponApplied = false;
      this.alertService.warning('Cupom inválido', 'Por favor, digite um código de cupom.');
      return;
    }

    const success = this.cartService.applyDiscount(this.couponCode);
    if (success) {
      this.couponMessage = `Cupom ${this.couponCode} aplicado com sucesso!`;
      this.couponApplied = true;
      this.alertService.success(
        'Cupom aplicado!',
        `O cupom ${this.couponCode} foi aplicado com sucesso.`
      );
      this.couponCode = '';
    } else {
      this.couponMessage = 'Cupom inválido. Tente novamente.';
      this.couponApplied = false;
      this.alertService.error(
        'Cupom inválido',
        'O código informado não é válido. Verifique e tente novamente.'
      );
    }

    setTimeout(() => {
      this.couponMessage = '';
    }, 5000);
  }

  removeCoupon(): void {
    this.cartService.removeDiscount();
    this.couponApplied = false;
    this.couponMessage = 'Cupom removido.';
    this.alertService.info('Cupom removido', 'O cupom de desconto foi removido.');
    setTimeout(() => {
      this.couponMessage = '';
    }, 3000);
  }

  proceedToCheckout(): void {
    if (this.cartItems.length === 0) {
      this.alertService.warning(
        'Carrinho vazio',
        'Adicione itens ao carrinho antes de finalizar a compra.'
      );
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
      currency: 'BRL',
    }).format(price);
  }

  getTotalSavings(): number {
    const totalOriginal = this.cartItems.reduce(
      (sum, item) => sum + (item.product.oldPrice || item.product.price) * item.quantity,
      0,
    );
    return totalOriginal - this.subtotal;
  }
}
