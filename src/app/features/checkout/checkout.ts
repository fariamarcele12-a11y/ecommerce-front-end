import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.scss'],
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
      country: 'Brasil',
    },
    paymentMethod: 'credit',
    installments: 1,
    cpfCnpj: '',
    saveAddress: false,
    termsAccepted: false,
  };

  isProcessing = false;
  orderConfirmed = false;
  orderId = '';
  paymentError = '';

  private subscriptions: Subscription = new Subscription();

  constructor(
    private cartService: CartService,
    private orderService: OrderService,
    private router: Router,
    private alertService: AlertService,
  ) {}

  ngOnInit(): void {
    this.loadCartData();
    this.paymentMethods = this.orderService.getPaymentMethods();
    this.loadSavedAddress();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadCartData(): void {
    this.subscriptions.add(
      this.cartService.getCartItems().subscribe((items) => {
        this.cartItems = items;
        if (items.length === 0) {
          this.alertService.warning(
            'Carrinho vazio',
            'Adicione itens ao carrinho antes de finalizar a compra.'
          );
          this.router.navigate(['/carrinho']);
        }
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

  // ===== MÉTODOS DE ENDEREÇO =====

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
        state: 'SP',
      },
      '20040030': {
        street: 'Avenida Presidente Vargas',
        neighborhood: 'Centro',
        city: 'Rio de Janeiro',
        state: 'RJ',
      },
      '30130010': {
        street: 'Rua da Bahia',
        neighborhood: 'Centro',
        city: 'Belo Horizonte',
        state: 'MG',
      },
    };

    const address = mockAddresses[cep];
    if (address) {
      this.form.address.street = address.street;
      this.form.address.neighborhood = address.neighborhood;
      this.form.address.city = address.city;
      this.form.address.state = address.state;
      this.alertService.toast('CEP encontrado! 📍', 'success', 2000);
    } else {
      this.alertService.warning(
        'CEP não encontrado',
        'Preencha os dados manualmente.'
      );
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

  loadSavedAddress(): void {
    const savedAddress = localStorage.getItem('savedAddress');
    if (savedAddress) {
      try {
        const address = JSON.parse(savedAddress);
        this.form.address = { ...this.form.address, ...address };
        this.form.saveAddress = true;
      } catch (error) {
        console.error('Erro ao carregar endereço salvo:', error);
      }
    }
  }

  // ===== MÉTODOS DE PAGAMENTO =====

  onPaymentMethodChange(methodId: string): void {
    this.selectedPaymentMethod = methodId;
    this.form.paymentMethod = methodId;

    const method = this.paymentMethods.find((m) => m.id === methodId);
    if (method?.installments) {
      this.maxInstallments = method.installments;
    } else {
      this.maxInstallments = 1;
    }
    this.installments = 1;
  }

  // ===== MÉTODOS UTILITÁRIOS =====

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  // ===== VALIDAÇÃO =====

  validateForm(): boolean {
    const address = this.form.address;
    const cepClean = address.cep.replace(/\D/g, '');

    if (!address.cep || cepClean.length < 8) {
      this.alertService.warning('CEP inválido', 'Por favor, informe um CEP válido com 8 dígitos.');
      return false;
    }
    if (!address.street || address.street.trim() === '') {
      this.alertService.warning('Rua inválida', 'Por favor, informe a rua.');
      return false;
    }
    if (!address.number || address.number.trim() === '') {
      this.alertService.warning('Número inválido', 'Por favor, informe o número.');
      return false;
    }
    if (!address.neighborhood || address.neighborhood.trim() === '') {
      this.alertService.warning('Bairro inválido', 'Por favor, informe o bairro.');
      return false;
    }
    if (!address.city || address.city.trim() === '') {
      this.alertService.warning('Cidade inválida', 'Por favor, informe a cidade.');
      return false;
    }
    if (!address.state || address.state.trim() === '') {
      this.alertService.warning('Estado inválido', 'Por favor, selecione o estado.');
      return false;
    }

    const cpfClean = this.form.cpfCnpj.replace(/\D/g, '');
    if (!this.form.cpfCnpj || cpfClean.length < 11) {
      this.alertService.warning('CPF/CNPJ inválido', 'Por favor, informe um CPF/CNPJ válido.');
      return false;
    }
    if (!this.form.termsAccepted) {
      this.alertService.warning('Aceite os termos', 'Você precisa aceitar os termos para continuar.');
      return false;
    }
    return true;
  }

  // ===== FINALIZAR COMPRA =====

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    this.isProcessing = true;
    this.paymentError = '';
    this.alertService.loading('Processando pagamento...', 'Aguarde enquanto processamos sua compra.');

    // Simular processamento
    setTimeout(() => {
      this.alertService.close();
      this.isProcessing = false;
      this.orderConfirmed = true;
      this.orderId = 'ORD-' + Date.now();
      this.cartService.clearCart();

      // Salvar endereço se solicitado
      if (this.form.saveAddress) {
        localStorage.setItem('savedAddress', JSON.stringify(this.form.address));
      }

      this.alertService.success(
        '🎉 Pedido confirmado!',
        `Seu pedido ${this.orderId} foi realizado com sucesso.`,
        5000
      );
    }, 2000);
  }

  // ===== NAVEGAÇÃO =====

  continueShopping(): void {
    this.router.navigate(['/home']);
  }

  viewOrder(): void {
    this.router.navigate(['/pedidos', this.orderId]);
  }

  // ===== MÉTODO PARA CANCELAR =====

  cancelCheckout(): void {
    this.alertService.confirm(
      'Cancelar compra?',
      'Tem certeza que deseja cancelar a compra? Os itens permanecerão no carrinho.',
      'Sim, cancelar',
      'Continuar comprando'
    ).then((result) => {
      if (result.isConfirmed) {
        this.router.navigate(['/carrinho']);
      }
    });
  }
}
