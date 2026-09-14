// src/app/features/checkout/checkout.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { AlertService } from '../../core/services/alert.service';
import { CepService, Endereco } from '../../core/services/cep.service';
import { OnlyNumbersDirective } from '../../shared/directives/only-numbers.directive';
import { DocumentValidator } from '../../core/utils/validators';

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
  isSearchingCep = false;

  // 🔥 Controle de validação do documento
  documentError: string = '';

  private subscriptions: Subscription = new Subscription();

  constructor(
    private cartService: CartService,
    private orderService: OrderService,
    private router: Router,
    private alertService: AlertService,
    private cepService: CepService,
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
      this.cartService.getCartItems().subscribe((items: CartItem[]) => {
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
      this.cartService.getTotalPrice().subscribe((total: number) => {
        this.subtotal = total;
        this.updateTotals();
      }),
    );

    this.subscriptions.add(
      this.cartService.getDiscount().subscribe((discount: number) => {
        this.discount = discount;
        this.updateTotals();
      }),
    );

    this.subscriptions.add(
      this.cartService.getShipping().subscribe((shipping: number) => {
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

  onCepBlur(): void {
    const cep = this.form.address.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      this.buscarEndereco(cep);
    } else if (cep.length > 0 && cep.length < 8) {
      this.alertService.warning(
        'CEP incompleto',
        'O CEP deve ter 8 dígitos. Verifique e tente novamente.'
      );
    }
  }

  buscarEndereco(cep: string): void {
    this.isSearchingCep = true;

    this.cepService.buscarCep(cep).subscribe({
      next: (endereco: Endereco) => {
        this.form.address.street = endereco.logradouro || '';
        this.form.address.neighborhood = endereco.bairro || '';
        this.form.address.city = endereco.localidade || '';
        this.form.address.state = endereco.uf || '';
        this.form.address.complement = endereco.complemento || '';
        this.isSearchingCep = false;
        this.alertService.toast('CEP encontrado! 📍', 'success', 2000);
      },
      error: (error: any) => {
        this.isSearchingCep = false;
        console.error('❌ Erro ao buscar CEP:', error);
        this.form.address.street = '';
        this.form.address.neighborhood = '';
        this.form.address.city = '';
        this.form.address.state = '';
        this.form.address.complement = '';
        this.alertService.warning(
          'CEP não encontrado',
          'Não foi possível encontrar o endereço para este CEP. Preencha os dados manualmente.'
        );
      }
    });
  }

  onCepInput(): void {
    const cep = this.form.address.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      this.buscarEndereco(cep);
    }
  }

  formatCep(value: string): string {
    return this.cepService.formatarCep(value);
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

  /**
   * 🔥 Valida CPF/CNPJ em tempo real enquanto o usuário digita
   */
  onCpfCnpjChange(value: string): void {
    this.form.cpfCnpj = this.formatCpfCnpj(value);

    const numbers = value.replace(/\D/g, '');

    if (numbers.length === 11) {
      // Validar CPF
      if (!DocumentValidator.isValidCPF(numbers)) {
        this.documentError = 'CPF inválido. Verifique os dígitos.';
      } else {
        this.documentError = '';
      }
    } else if (numbers.length === 14) {
      // Validar CNPJ
      if (!DocumentValidator.isValidCNPJ(numbers)) {
        this.documentError = 'CNPJ inválido. Verifique os dígitos.';
      } else {
        this.documentError = '';
      }
    } else if (numbers.length > 0 && numbers.length < 11) {
      this.documentError = ''; // Ainda não tem tamanho suficiente para validar
    } else if (numbers.length > 11 && numbers.length < 14) {
      this.documentError = ''; // Ainda não tem tamanho suficiente para validar CNPJ
    } else {
      this.documentError = '';
    }
  }

  isValidCep(cep: string): boolean {
    return this.cepService.validarCep(cep);
  }

  /**
   * 🔥 Valida CPF usando o DocumentValidator
   */
  isValidCpf(cpf: string): boolean {
    return DocumentValidator.isValidCPF(cpf);
  }

  /**
   * 🔥 Valida CNPJ usando o DocumentValidator
   */
  isValidCnpj(cnpj: string): boolean {
    return DocumentValidator.isValidCNPJ(cnpj);
  }

  /**
   * 🔥 Valida documento (CPF ou CNPJ) automaticamente
   */
  isValidDocument(document: string): boolean {
    return DocumentValidator.isValidDocument(document, this.getDocumentType(document));
  }

  /**
   * 🔥 Retorna o tipo do documento baseado no tamanho
   */
  private getDocumentType(document: string): 'pf' | 'pj' {
    const numbers = document.replace(/\D/g, '');
    return numbers.length <= 11 ? 'pf' : 'pj';
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

    // 🔥 VALIDAÇÃO COMPLETA DO CPF/CNPJ
    const cpfClean = this.form.cpfCnpj.replace(/\D/g, '');

    if (!this.form.cpfCnpj || cpfClean.length < 11) {
      this.alertService.warning('CPF/CNPJ inválido', 'Por favor, informe um CPF/CNPJ válido.');
      return false;
    }

    // 🔥 Validar CPF ou CNPJ com base no tamanho
    if (cpfClean.length === 11) {
      if (!DocumentValidator.isValidCPF(cpfClean)) {
        this.alertService.error(
          'CPF inválido',
          'O CPF informado não é válido. Verifique os dígitos e tente novamente.'
        );
        return false;
      }
    } else if (cpfClean.length === 14) {
      if (!DocumentValidator.isValidCNPJ(cpfClean)) {
        this.alertService.error(
          'CNPJ inválido',
          'O CNPJ informado não é válido. Verifique os dígitos e tente novamente.'
        );
        return false;
      }
    } else {
      this.alertService.warning(
        'Documento inválido',
        'O documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ).'
      );
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
