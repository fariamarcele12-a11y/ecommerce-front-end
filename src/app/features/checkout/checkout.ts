import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { AlertService } from '../../core/services/alert.service';
import { OnlyNumbersDirective } from '../../shared/directives/only-numbers.directive';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, OnlyNumbersDirective],
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

  // 🔥 FORMATADORES
  formatCep(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length === 0) return '';
    if (numbers.length <= 5) {
      return numbers;
    }
    return numbers.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
  }

  formatCpfCnpj(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length === 0) return '';
    
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .slice(0, 14);
    } else {
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
        .slice(0, 18);
    }
  }

  // 🔥 VALIDAÇÕES
  isValidCep(cep: string): boolean {
    const numbers = cep.replace(/\D/g, '');
    return numbers.length === 8;
  }

  isValidCpf(cpf: string): boolean {
    const numbers = cpf.replace(/\D/g, '');
    if (numbers.length !== 11) return false;
    
    if (/^(\d)\1{10}$/.test(numbers)) return false;
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(numbers.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(numbers.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers.substring(10, 11))) return false;
    
    return true;
  }

  isValidCnpj(cnpj: string): boolean {
    const numbers = cnpj.replace(/\D/g, '');
    if (numbers.length !== 14) return false;
    
    if (/^(\d)\1{13}$/.test(numbers)) return false;
    
    let length = numbers.length - 2;
    let numbersArray = numbers.split('');
    let sum = 0;
    let pos = length - 7;
    
    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbersArray[length - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(numbersArray[length])) return false;
    
    length = length + 1;
    numbersArray = numbers.split('');
    sum = 0;
    pos = length - 7;
    
    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbersArray[length - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(numbersArray[length])) return false;
    
    return true;
  }

  isValidDocument(document: string): boolean {
    const numbers = document.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return this.isValidCpf(document);
    } else {
      return this.isValidCnpj(document);
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

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  validateForm(): boolean {
    const address = this.form.address;
    const cepClean = address.cep.replace(/\D/g, '');

    if (!address.cep || !this.isValidCep(address.cep)) {
      this.alertService.warning('CEP inválido', 'Por favor, informe um CEP válido com 8 dígitos (ex: 01001-000).');
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
    
    if (!this.isValidDocument(this.form.cpfCnpj)) {
      this.alertService.warning('Documento inválido', 'Por favor, informe um CPF ou CNPJ válido.');
      return false;
    }
    
    if (!this.form.termsAccepted) {
      this.alertService.warning('Aceite os termos', 'Você precisa aceitar os termos para continuar.');
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
    this.alertService.loading('Processando pagamento...', 'Aguarde enquanto processamos sua compra.');

    setTimeout(() => {
      this.alertService.close();
      this.isProcessing = false;
      this.orderConfirmed = true;
      this.orderId = 'ORD-' + Date.now();
      this.cartService.clearCart();

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

  continueShopping(): void {
    this.router.navigate(['/home']);
  }

  viewOrder(): void {
    this.router.navigate(['/pedidos', this.orderId]);
  }

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