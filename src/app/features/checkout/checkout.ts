// src/app/features/checkout/checkout.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { CartItem, CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { AlertService } from '../../core/services/alert.service';
import { CepService, Endereco } from '../../core/services/cep.service';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { DocumentValidator } from '../../core/utils/validators';
import { User, UserAddress } from '../../core/models/user.model';
import { Order, OrderItem, PaymentMethod } from '../../core/models/checkout.model';

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

  paymentMethods: PaymentMethod[] = [];
  selectedPaymentMethod: string = 'credit';
  installments: number = 1;
  maxInstallments: number = 12;

  currentUser: User | null = null;
  userAddresses: UserAddress[] = [];
  selectedAddressId: string | null = null;
  showAddressModal = false;
  editingAddress: UserAddress | null = null;

  form: any = {
    address: {
      id: '',
      label: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      cep: '',
      country: 'Brasil',
      isDefault: false,
    },
    paymentMethod: 'credit',
    installments: 1,
    cpfCnpj: '',
    saveAddress: false,
    updateAsMainAddress: false,
    termsAccepted: false,
  };

  isProcessing = false;
  orderConfirmed = false;
  orderId = '';
  paymentError = '';
  isSearchingCep = false;
  documentError: string = '';

  private subscriptions: Subscription = new Subscription();

  constructor(
    private cartService: CartService,
    private orderService: OrderService,
    private router: Router,
    private alertService: AlertService,
    private cepService: CepService,
    private authService: AuthService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadCartData();
    this.paymentMethods = this.orderService.getPaymentMethods();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get selectedAddress(): UserAddress | null {
    if (!this.selectedAddressId) return null;
    return this.userAddresses.find((a) => a.id === this.selectedAddressId) || null;
  }

  isDocumentValid(): boolean {
    if (!this.form.cpfCnpj) return false;
    const numbers = this.form.cpfCnpj.replace(/\D/g, '');

    if (numbers.length === 11) {
      return DocumentValidator.isValidCPF(numbers);
    } else if (numbers.length === 14) {
      return DocumentValidator.isValidCNPJ(numbers);
    }
    return false;
  }

  loadUserData(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.alertService.warning('Login necessário', 'Faça login para continuar.');
      this.router.navigate(['/login']);
      return;
    }

    this.currentUser = user;

    if (user.document) {
      this.form.cpfCnpj = this.formatCpfCnpj(user.document);
    }

    this.loadUserAddresses(user);
  }

  loadUserAddresses(user: User): void {
    if (user.addresses && user.addresses.length > 0) {
      this.userAddresses = user.addresses.map((addr) => ({
        ...addr,
        id: addr.id || this.generateAddressId(),
      }));

      const mainAddress = this.userAddresses.find((a) => a.isDefault) || this.userAddresses[0];
      if (mainAddress && mainAddress.id) {
        this.selectedAddressId = mainAddress.id;
        this.form.address = { ...mainAddress };
      }
    } else if (user.address) {
      const newId = this.generateAddressId();
      const migratedAddress: UserAddress = {
        id: newId,
        label: 'Principal',
        street: user.address.street || '',
        number: user.address.number || '',
        complement: user.address.complement || '',
        neighborhood: user.address.neighborhood || '',
        city: user.address.city || '',
        state: user.address.state || '',
        cep: user.address.cep || '',
        country: user.address.country || 'Brasil',
        isDefault: true,
        createdAt: new Date().toISOString(),
      };

      this.userAddresses = [migratedAddress];
      this.selectedAddressId = newId;
      this.form.address = { ...migratedAddress };
    } else {
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
  }

  private generateAddressId(): string {
    return 'ADDR-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
  }

  selectAddress(addressId: string): void {
    const address = this.userAddresses.find((a) => a.id === addressId);
    if (address) {
      this.selectedAddressId = addressId;
      this.form.address = { ...address };
    }
  }

  openNewAddressModal(): void {
    this.editingAddress = null;
    this.form.address = {
      id: this.generateAddressId(),
      label: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      cep: '',
      country: 'Brasil',
      isDefault: this.userAddresses.length === 0,
    };
    this.showAddressModal = true;
  }

  editAddress(address: UserAddress, event: Event): void {
    event.stopPropagation();
    this.editingAddress = { ...address };
    this.form.address = { ...address };
    this.showAddressModal = true;
  }

  closeAddressModal(): void {
    this.showAddressModal = false;
    this.editingAddress = null;
  }

  saveAddress(): void {
    const address = this.form.address;

    if (!address.cep || address.cep.replace(/\D/g, '').length !== 8) {
      this.alertService.warning('CEP inválido', 'Informe um CEP válido.');
      return;
    }
    if (
      !address.street ||
      !address.number ||
      !address.neighborhood ||
      !address.city ||
      !address.state
    ) {
      this.alertService.warning('Campos obrigatórios', 'Preencha todos os campos obrigatórios.');
      return;
    }

    if (!address.id) {
      address.id = this.generateAddressId();
    }

    if (address.isDefault) {
      this.userAddresses.forEach((a) => (a.isDefault = false));
    }

    if (this.editingAddress) {
      const index = this.userAddresses.findIndex((a) => a.id === address.id);
      if (index !== -1) {
        this.userAddresses[index] = { ...address };
      }
    } else {
      this.userAddresses.push({ ...address, createdAt: new Date().toISOString() });
    }

    this.selectedAddressId = address.id;
    this.saveAddressesToUser();
    this.closeAddressModal();
    this.alertService.success('Endereço salvo!', 'O endereço foi salvo com sucesso.');
  }

  removeAddress(addressId: string, event: Event): void {
    event.stopPropagation();

    if (this.userAddresses.length <= 1) {
      this.alertService.warning('Ação não permitida', 'Você precisa ter pelo menos um endereço.');
      return;
    }

    this.alertService
      .confirm(
        'Remover endereço?',
        'Tem certeza que deseja remover este endereço?',
        'Sim, remover',
        'Cancelar',
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.userAddresses = this.userAddresses.filter((a) => a.id !== addressId);

          if (this.selectedAddressId === addressId) {
            const firstAddress = this.userAddresses[0];
            if (firstAddress && firstAddress.id) {
              this.selectedAddressId = firstAddress.id;
              this.form.address = { ...firstAddress };
            }
          }

          this.saveAddressesToUser();
          this.alertService.success('Endereço removido!', 'O endereço foi removido.');
        }
      });
  }

  private saveAddressesToUser(): void {
    if (!this.currentUser) return;

    const mainAddress = this.userAddresses.find((a) => a.isDefault) || this.userAddresses[0];

    const updateData = {
      addresses: this.userAddresses,
      address: mainAddress,
    };

    this.userService.updateUser(this.currentUser.id, updateData).subscribe({
      next: (updatedUser) => {
        this.currentUser = {
          ...this.currentUser,
          ...updatedUser,
          id: this.currentUser?.id || updatedUser.id,
          name: this.currentUser?.name || updatedUser.name,
          email: this.currentUser?.email || updatedUser.email,
          document: this.currentUser?.document || updatedUser.document,
          documentType: this.currentUser?.documentType || updatedUser.documentType,
          phone: this.currentUser?.phone || updatedUser.phone,
          avatar: this.currentUser?.avatar || updatedUser.avatar,
          hasStore: this.currentUser?.hasStore ?? updatedUser.hasStore,
          storeId: this.currentUser?.storeId ?? updatedUser.storeId,
        } as User;

        this.authService.forceUpdateUser(this.currentUser);
      },
      error: (error) => {
        console.error('❌ Erro ao salvar endereços:', error);

        if (this.currentUser) {
          const updatedUser = {
            ...this.currentUser,
            addresses: this.userAddresses,
            address: mainAddress,
          };
          this.currentUser = updatedUser as User;
          this.authService.forceUpdateUser(updatedUser as User);
        }
      },
    });
  }

  setAsMainAddress(addressId: string, event: Event): void {
    event.stopPropagation();

    this.userAddresses.forEach((a) => (a.isDefault = a.id === addressId));

    const mainAddress = this.userAddresses.find((a) => a.id === addressId);
    if (mainAddress) {
      this.form.address = { ...mainAddress };
    }

    this.saveAddressesToUser();
    this.alertService.success(
      'Endereço principal atualizado!',
      'Este endereço agora é o principal.',
    );
  }

  loadCartData(): void {
    this.subscriptions.add(
      this.cartService.getCartItems().subscribe((items: CartItem[]) => {
        this.cartItems = items;
        if (items.length === 0) {
          this.alertService.warning('Carrinho vazio', 'Adicione itens ao carrinho.');
          this.router.navigate(['/carrinho']);
        } else {
          items.forEach((item) => {
            console.log({
              produto: item.product.name,
            });
          });
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
      this.alertService.warning('CEP incompleto', 'O CEP deve ter 8 dígitos.');
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
        this.alertService.warning('CEP não encontrado', 'Preencha os dados manualmente.');
      },
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

  onCpfCnpjChange(value: string): void {
    this.form.cpfCnpj = this.formatCpfCnpj(value);

    const numbers = value.replace(/\D/g, '');

    if (numbers.length === 11) {
      this.documentError = DocumentValidator.isValidCPF(numbers)
        ? ''
        : 'CPF inválido. Verifique os dígitos.';
    } else if (numbers.length === 14) {
      this.documentError = DocumentValidator.isValidCNPJ(numbers)
        ? ''
        : 'CNPJ inválido. Verifique os dígitos.';
    } else {
      this.documentError = '';
    }
  }

  isValidCep(cep: string): boolean {
    return this.cepService.validarCep(cep);
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
    const address = this.selectedAddress;

    if (!address) {
      this.alertService.warning('Endereço obrigatório', 'Selecione um endereço para entrega.');
      return false;
    }

    if (!address.cep || !this.isValidCep(address.cep)) {
      this.alertService.warning('CEP inválido', 'Informe um CEP válido.');
      return false;
    }
    if (!address.street?.trim()) {
      this.alertService.warning('Rua inválida', 'Informe a rua.');
      return false;
    }
    if (!address.number?.trim()) {
      this.alertService.warning('Número inválido', 'Informe o número.');
      return false;
    }
    if (!address.neighborhood?.trim()) {
      this.alertService.warning('Bairro inválido', 'Informe o bairro.');
      return false;
    }
    if (!address.city?.trim()) {
      this.alertService.warning('Cidade inválida', 'Informe a cidade.');
      return false;
    }
    if (!address.state?.trim()) {
      this.alertService.warning('Estado inválido', 'Selecione o estado.');
      return false;
    }

    if (!this.isDocumentValid()) {
      this.alertService.error('CPF/CNPJ inválido', 'O documento cadastrado não é válido.');
      return false;
    }

    if (!this.form.termsAccepted) {
      this.alertService.warning('Aceite os termos', 'Você precisa aceitar os termos.');
      return false;
    }
    return true;
  }

  async onSubmit(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }
    if (!this.currentUser) {
      this.alertService.error('Erro', 'Usuário não autenticado.');
      return;
    }

    this.isProcessing = true;
    this.paymentError = '';
    this.alertService.loading(
      'Processando pagamento...',
      'Aguarde enquanto processamos sua compra.',
    );

    try {
      // 🔥 Atualiza endereço principal se solicitado
      if (this.form.updateAsMainAddress && this.selectedAddressId) {
        this.userAddresses.forEach((a) => (a.isDefault = a.id === this.selectedAddressId));
        this.saveAddressesToUser();
      }

      const selectedAddress = this.selectedAddress;
      if (!selectedAddress) throw new Error('Endereço não selecionado');

      const checkoutItems = this.cartService.getCheckoutItems();

      const mappedItems: OrderItem[] = checkoutItems.map((item) => ({
        productId: Number(item.productId) || 0,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        image: item.image,
        sellerId: item.sellerId,
        sellerName: item.sellerName,
      }));

      const orderData: Partial<Order> = {
        userId: String(this.currentUser.id),
        buyerName: this.currentUser.name,
        items: mappedItems,
        address: {
          cep: selectedAddress.cep,
          street: selectedAddress.street,
          number: selectedAddress.number,
          complement: selectedAddress.complement,
          neighborhood: selectedAddress.neighborhood,
          city: selectedAddress.city,
          state: selectedAddress.state,
          country: selectedAddress.country || 'Brasil',
        },
        paymentMethod: {
          id: this.form.paymentMethod,
          name:
            this.paymentMethods.find((m) => m.id === this.form.paymentMethod)?.name ||
            'Pagamento',
          icon: '',
          type: (this.paymentMethods.find((m) => m.id === this.form.paymentMethod)?.type ||
            'pix') as any,
        },
        subtotal: this.subtotal,
        discount: this.discount,
        shipping: this.shipping,
        total: this.total,
        status: 'pending',
        createdAt: new Date(),
      };

      const createdOrder = await firstValueFrom(
        this.orderService.createOrder(orderData)
      );
      await firstValueFrom(this.orderService.processPayment(createdOrder));

      this.alertService.close();
      this.isProcessing = false;
      this.orderConfirmed = true;
      this.orderId = createdOrder.id;
      this.cartService.clearCart();

      this.alertService.success(
        '🎉 Pedido confirmado!',
        `Seu pedido ${createdOrder.id} foi realizado. Você e o vendedor foram notificados.`,
        5000,
      );

    } catch (error: any) {
      console.error('❌ Erro no checkout:', error);
      this.alertService.close();
      this.isProcessing = false;
      this.paymentError = error?.message || 'Erro ao processar pedido.';
      this.alertService.error('Falha no pagamento', this.paymentError);
    }
  }

  continueShopping(): void {
    this.router.navigate(['/home']);
  }

  viewOrder(): void {
    this.router.navigate(['/pedidos', this.orderId]);
  }

  cancelCheckout(): void {
    this.alertService
      .confirm(
        'Cancelar compra?',
        'Tem certeza que deseja cancelar a compra?',
        'Sim, cancelar',
        'Continuar comprando',
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.router.navigate(['/carrinho']);
        }
      });
  }
}
