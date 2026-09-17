// src/app/features/store/create-store/create-store.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StoreService } from '../../../core/services/store.service';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { CepService } from '../../../core/services/cep.service';
import { StoreForm, StoreSocialMedia } from '../../../core/models/store.model';
import { User } from '../../../core/models/user.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-create-store',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './create-store.html',
  styleUrls: ['./create-store.scss']
})
export class CreateStore implements OnInit, OnDestroy {
  user: User | null = null;
  loading = false;
  isSearchingCep = false;
  hasExistingStore = false;
  existingStoreId: string | null = null;
  checkingStore = true;

  private subscriptions: Subscription = new Subscription();

  storeData: StoreForm = {
    storeName: '',
    description: '',
    category: 'Outros',
    logo: '',
    banner: '',
    phone: '',
    email: '',
    website: '',
    socialMedia: {
      instagram: '',
      facebook: '',
      youtube: ''
    },
    address: {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      cep: '',
      country: 'Brasil'
    }
  };

  constructor(
    private storeService: StoreService,
    private authService: AuthService,
    private router: Router,
    private alertService: AlertService,
    private cepService: CepService
  ) {}

  /**
   * 🔥 Getter que GARANTE que socialMedia sempre existe (para o template)
   */
  get socialMedia(): StoreSocialMedia {
    if (!this.storeData.socialMedia) {
      this.storeData.socialMedia = {
        instagram: '',
        facebook: '',
        youtube: ''
      };
    }
    return this.storeData.socialMedia;
  }

  /**
   * 🔥 Getter que GARANTE que address sempre existe (para o template)
   */
  get address() {
    return this.storeData.address;
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        if (user) {
          this.user = user;
          const userId = String(user.id);
          this.checkExistingStore(userId);
          this.preencherDadosUsuario(user);
        } else {
          this.router.navigate(['/login']);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  checkExistingStore(userId: string): void {
    this.checkingStore = true;

    this.storeService.hasStore(userId).subscribe({
      next: (hasStore) => {
        if (hasStore) {
          this.hasExistingStore = true;

          this.storeService.getStoreByUser(userId).subscribe({
            next: (store) => {
              this.checkingStore = false;
              if (store) {
                this.existingStoreId = String(store.id);
                this.showStoreExistsAlert();
              }
            },
            error: (error) => {
              this.checkingStore = false;
              console.error('❌ Erro ao buscar loja existente:', error);
            }
          });
        } else {
          this.checkingStore = false;
          this.hasExistingStore = false;
        }
      },
      error: (error) => {
        this.checkingStore = false;
        console.error('❌ Erro ao verificar loja:', error);
        this.hasExistingStore = false;
      }
    });
  }

  showStoreExistsAlert(): void {
    this.alertService.warning(
      'Loja já existente',
      'Você já possui uma loja cadastrada. Acesse o painel da sua loja.'
    );
  }

  preencherDadosUsuario(user: User): void {
    if (user) {
      this.storeData.phone = user.phone || '';
      this.storeData.email = user.email || '';

      if (user.address) {
        this.storeData.address = {
          ...this.storeData.address,
          ...user.address
        };
      }

      if (user.documentType === 'pf') {
        this.storeData.storeName = `Loja de ${user.name}`;
      } else {
        this.storeData.storeName = user.companyName || user.name || '';
      }
    }
  }

  onCepBlur(): void {
    const cep = this.storeData.address.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      this.buscarEndereco(cep);
    }
  }

  buscarEndereco(cep: string): void {
    this.isSearchingCep = true;

    this.cepService.buscarCep(cep).subscribe({
      next: (endereco) => {
        this.storeData.address.street = endereco.logradouro || '';
        this.storeData.address.neighborhood = endereco.bairro || '';
        this.storeData.address.city = endereco.localidade || '';
        this.storeData.address.state = endereco.uf || '';
        this.storeData.address.complement = endereco.complemento || '';
        this.isSearchingCep = false;
        this.alertService.toast('CEP encontrado! 📍', 'success', 2000);
      },
      error: (error) => {
        this.isSearchingCep = false;
        console.error('❌ Erro ao buscar CEP:', error);
        this.alertService.warning('CEP não encontrado', 'Preencha os dados manualmente.');
      }
    });
  }

  formatCep(value: string): string {
    return this.cepService.formatarCep(value);
  }

  onSubmit(): void {
    if (!this.user) {
      this.alertService.error('Erro', 'Usuário não autenticado.');
      return;
    }

    if (this.hasExistingStore) {
      this.alertService.warning('Loja existente', 'Você já possui uma loja cadastrada.');
      if (this.existingStoreId) {
        this.router.navigate([`/loja/${this.existingStoreId}`]);
      }
      return;
    }

    if (!this.storeData.storeName || this.storeData.storeName.trim().length < 3) {
      this.alertService.warning('Nome da loja inválido', 'Digite um nome para sua loja (mínimo 3 caracteres).');
      return;
    }

    if (!this.storeData.description || this.storeData.description.trim().length < 10) {
      this.alertService.warning('Descrição inválida', 'Descreva sua loja (mínimo 10 caracteres).');
      return;
    }

    if (!this.storeData.email || !this.storeData.email.includes('@')) {
      this.alertService.warning('E-mail inválido', 'Digite um e-mail válido.');
      return;
    }

    if (!this.storeData.phone || this.storeData.phone.replace(/\D/g, '').length < 10) {
      this.alertService.warning('Telefone inválido', 'Digite um telefone válido com DDD.');
      return;
    }

    this.loading = true;
    this.alertService.info('Criando loja...', 'Por favor, aguarde um momento.');

    // 🔥 Garantir que socialMedia tem valores e category padrão
    const storeDataWithDefaults: StoreForm = {
      ...this.storeData,
      category: this.storeData.category || 'Outros',
      socialMedia: {
        instagram: this.socialMedia.instagram || '',
        facebook: this.socialMedia.facebook || '',
        youtube: this.socialMedia.youtube || ''
      }
    };

    this.storeService.createStore(storeDataWithDefaults, this.user).subscribe({
      next: (store) => {
        this.loading = false;
        this.alertService.success(
          '🎉 Loja criada com sucesso!',
          `A loja "${store.storeName}" foi criada e está pronta para vender.`
        );
        this.router.navigate(['/loja', store.id]);
      },
      error: (error) => {
        this.loading = false;
        console.error('❌ Erro ao criar loja:', error);

        if (error.message?.includes('já possui uma loja')) {
          this.alertService.warning('Loja já existente', 'Você já possui uma loja cadastrada.');
          if (this.user) {
            const userId = String(this.user.id);
            this.storeService.getStoreByUser(userId).subscribe({
              next: (store) => {
                if (store) {
                  this.router.navigate(['/loja', store.id]);
                }
              }
            });
          }
        } else {
          this.alertService.error('Erro', error.message || 'Não foi possível criar a loja. Tente novamente.');
        }
      }
    });
  }

  goToExistingStore(): void {
    if (this.existingStoreId) {
      this.router.navigate(['/loja', this.existingStoreId]);
    } else if (this.user) {
      const userId = String(this.user.id);
      this.storeService.getStoreByUser(userId).subscribe({
        next: (store) => {
          if (store) {
            this.router.navigate(['/loja', store.id]);
          }
        }
      });
    }
  }

  getDocumentLabel(): string {
    if (!this.user) return '';
    return this.user.documentType === 'pf' ? 'CPF' : 'CNPJ';
  }

  getDocumentValue(): string {
    if (!this.user) return '';
    return this.user.document || '';
  }

  getUserTypeLabel(): string {
    if (!this.user) return '';
    return this.user.documentType === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica';
  }
}
