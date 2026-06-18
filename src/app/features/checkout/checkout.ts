import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../../core/services/cartService';
import { OrderService } from '../../core/services/orderService';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.scss']
})
export class Checkout implements OnInit, OnDestroy {
  cartItems: CartItem[] = [];
  subtotal = 0;
  discount = 0;
  shipping = 0;
  total = 0;

  paymentMethods: any[] = [];
  selectedPaymentMethod: string = 'credit';
  installments: number = 1;
  maxInstallments: number = 12;

  form: any = {
    address: {
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      country: 'Brasil'
    },
    paymentMethod: 'credit',
    installments: 1,
    cpfCnpj: '',
    saveAddress: false,
    termsAccepted: false
  };

  isProcessing = false;
  orderConfirmed = false;
  orderId = '';
  paymentError = '';

  private subscriptions: Subscription = new Subscription();

  constructor(
    private cartService: CartService,
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCartData();
    this.paymentMethods = this.orderService.getPaymentMethods();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadCartData(): void {
    this.subscriptions.add(
      this.cartService.getCartItems().subscribe(items => {
        this.cartItems = items;
        if (items.length === 0) {
          this.router.navigate(['/carrinho']);
        }
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

  // ===== MÉTODOS ADICIONADOS =====

  onCepBlur(): void {
    const cep = this.form.address.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      this.searchCep(cep);
    }
  }

  searchCep(cep: string): void {
    // Simulação de busca de CEP
    const mockAddresses: { [key: string]: any } = {
      '01001000': {
        street: 'Praça da Sé',
        neighborhood: 'Sé',
        city: 'São Paulo',
        state: 'SP'
      },
      '20040030': {
        street: 'Avenida Presidente Vargas',
        neighborhood: 'Centro',
        city: 'Rio de Janeiro',
        state: 'RJ'
      },
      '30130010': {
        street: 'Rua da Bahia',
        neighborhood: 'Centro',
        city: 'Belo Horizonte',
        state: 'MG'
      }
    };

    const address = mockAddresses[cep];
    if (address) {
      this.form.address.street = address.street;
      this.form.address.neighborhood = address.neighborhood;
      this.form.address.city = address.city;
      this.form.address.state = address.state;
    }
  }

  formatCep(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 5) {
      return numbers;
    }
    return numbers.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
  }

  formatCpfCnpj(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      // CPF: 000.000.000-00
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      // CNPJ: 00.000.000/0000-00
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
  }

  // ===== FIM DOS MÉTODOS ADICIONADOS =====

  onPaymentMethodChange(methodId: string): void {
    this.selectedPaymentMethod = methodId;
    this.form.paymentMethod = methodId;

    const method = this.paymentMethods.find(m => m.id === methodId);
    if (method?.installments) {
      this.maxInstallments = method.installments;
    } else {
      this.maxInstallments = 1;
    }
    this.installments = 1;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  validateForm(): boolean {
    if (!this.form.address.cep || this.form.address.cep.length < 8) {
      alert('Por favor, informe um CEP válido.');
      return false;
    }
    if (!this.form.address.street) {
      alert('Por favor, informe a rua.');
      return false;
    }
    if (!this.form.address.number) {
      alert('Por favor, informe o número.');
      return false;
    }
    if (!this.form.cpfCnpj || this.form.cpfCnpj.length < 11) {
      alert('Por favor, informe seu CPF/CNPJ.');
      return false;
    }
    if (!this.form.termsAccepted) {
      alert('Você precisa aceitar os termos para continuar.');
      return false;
    }
    return true;
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    this.isProcessing = true;
    this.paymentError = '';

    setTimeout(() => {
      this.isProcessing = false;
      this.orderConfirmed = true;
      this.orderId = 'ORD-' + Date.now();
      this.cartService.clearCart();
    }, 2000);
  }

  continueShopping(): void {
    this.router.navigate(['/home']);
  }

  viewOrder(): void {
    this.router.navigate(['/pedidos', this.orderId]);
  }
}
