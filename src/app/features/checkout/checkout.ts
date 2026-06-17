import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Address, PaymentMethod, CheckoutForm } from '../../core/models/checkout.model';
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

  paymentMethods: PaymentMethod[] = [];
  selectedPaymentMethod: string = 'credit';
  installments: number = 1;
  maxInstallments: number = 12;

  form: CheckoutForm = {
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
    this.loadUserData();
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

  loadUserData(): void {
    // Simular carregamento de dados do usuário
    const savedAddress = localStorage.getItem('savedAddress');
    if (savedAddress) {
      try {
        const address = JSON.parse(savedAddress);
        this.form.address = { ...this.form.address, ...address };
      } catch (error) {
        console.error('Erro ao carregar endereço salvo:', error);
      }
    }
  }

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

  onCepBlur(): void {
    const cep = this.form.address.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      this.searchCep(cep);
    }
  }

  searchCep(cep: string): void {
    // Simulação de busca de CEP (em produção, use uma API real)
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
    } else {
      // Para demonstração, preencher com dados de exemplo
      this.form.address.street = 'Rua Exemplo';
      this.form.address.neighborhood = 'Centro';
      this.form.address.city = 'São Paulo';
      this.form.address.state = 'SP';
    }
  }

  validateForm(): boolean {
    const address = this.form.address;

    if (!address.cep || address.cep.length < 8) {
      alert('Por favor, informe um CEP válido.');
      return false;
    }

    if (!address.street) {
      alert('Por favor, informe a rua.');
      return false;
    }

    if (!address.number) {
      alert('Por favor, informe o número.');
      return false;
    }

    if (!address.neighborhood) {
      alert('Por favor, informe o bairro.');
      return false;
    }

    if (!address.city) {
      alert('Por favor, informe a cidade.');
      return false;
    }

    if (!address.state) {
      alert('Por favor, informe o estado.');
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

    if (this.cartItems.length === 0) {
      alert('Seu carrinho está vazio!');
      return;
    }

    this.isProcessing = true;
    this.paymentError = '';

    // Preparar dados do pedido
    const orderItems = this.cartItems.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      price: item.product.price,
      subtotal: item.product.price * item.quantity,
      image: item.product.images[0]
    }));

    const paymentMethod = this.paymentMethods.find(m => m.id === this.selectedPaymentMethod)!;

    const orderData = {
      items: orderItems,
      address: this.form.address,
      paymentMethod: paymentMethod,
      subtotal: this.subtotal,
      discount: this.discount,
      shipping: this.shipping,
      total: this.total,
      installments: this.installments
    };

    // Processar pagamento
    this.orderService.processPayment(orderData as any).subscribe({
      next: (result) => {
        if (result.success) {
          // Criar pedido
          this.orderService.createOrder(orderData).subscribe({
            next: (order) => {
              this.orderConfirmed = true;
              this.orderId = order.id!;
              this.isProcessing = false;
              this.cartService.clearCart();

              if (this.form.saveAddress) {
                localStorage.setItem('savedAddress', JSON.stringify(this.form.address));
              }
            },
            error: (error) => {
              this.paymentError = 'Erro ao criar pedido. Tente novamente.';
              this.isProcessing = false;
              console.error('Erro ao criar pedido:', error);
            }
          });
        } else {
          this.paymentError = result.message;
          this.isProcessing = false;
        }
      },
      error: (error) => {
        this.paymentError = 'Erro ao processar pagamento. Tente novamente.';
        this.isProcessing = false;
        console.error('Erro no pagamento:', error);
      }
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  formatCpfCnpj(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      // CPF
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      // CNPJ
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
  }

  formatCep(value: string): string {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
  }

  continueShopping(): void {
    this.router.navigate(['/home']);
  }

  viewOrder(): void {
    this.router.navigate(['/pedidos', this.orderId]);
  }
}
