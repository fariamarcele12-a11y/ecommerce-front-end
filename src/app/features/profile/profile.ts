// src/app/features/profile/profile.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { CepService } from '../../core/services/cep.service';
import { User } from '../../core/models/user.model';
import { StoreService } from '../../core/services/store.service';
import { Store } from '../../core/models/store.model';
import { ImageUpload } from '../../shared/components/image-upload/image-upload';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ImageUpload],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss'],
})
export class Profile implements OnInit {
  user: User | null = null;
  store: Store | null = null;
  loading = true;
  saving = false;
  isSearchingCep = false;
  hasStore = false;

  // 🔥 Dados do formulário
  profileData = {
    name: '',
    email: '',
    phone: '',
    document: '',
    documentType: 'pf' as 'pf' | 'pj',
    avatar: '', // 🔥 NOVO: Avatar do usuário
    address: {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      cep: '',
      country: 'Brasil',
    },
  };

  // 🔥 Dados específicos
  birthDate = '';
  companyName = '';
  tradeName = '';

  constructor(
    private authService: AuthService,
    private storeService: StoreService,
    private router: Router,
    private alertService: AlertService,
    private cepService: CepService,
  ) {}

  ngOnInit(): void {
    this.loadUserData();
  }

  /**
   * 🔥 Carrega os dados do usuário
   */
  loadUserData(): void {
    this.loading = true;
    const user = this.authService.getCurrentUser();

    if (!user) {
      this.alertService.warning('Login necessário', 'Faça login para acessar seu perfil.');
      this.router.navigate(['/login']);
      this.loading = false;
      return;
    }

    this.user = user;
    this.hasStore = user.hasStore || false;

    // 🔥 Preencher o formulário
    this.profileData = {
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      document: user.document || '',
      documentType: user.documentType || 'pf',
      avatar: (user as any).avatar || '', // 🔥 Carregar avatar
      address: {
        street: user.address?.street || '',
        number: user.address?.number || '',
        complement: user.address?.complement || '',
        neighborhood: user.address?.neighborhood || '',
        city: user.address?.city || '',
        state: user.address?.state || '',
        cep: user.address?.cep || '',
        country: user.address?.country || 'Brasil',
      },
    };

    // 🔥 Dados específicos
    if (user.documentType === 'pf') {
      this.birthDate = user.birthDate || '';
      this.companyName = '';
      this.tradeName = '';
    } else {
      this.tradeName = user.tradeName || '';
      this.companyName = user.companyName || '';
      this.birthDate = '';
      this.profileData.name = user.name || user.companyName || '';
    }

    // 🔥 Buscar dados da loja se tiver
    if (this.hasStore && user.storeId) {
      this.storeService.getStoreById(user.storeId).subscribe({
        next: (store) => {
          this.store = store;
        },
        error: (error) => {
          console.error('❌ Erro ao carregar loja:', error);
          if (error.status === 404) {
            this.hasStore = false;
            this.store = null;
            this.authService.updateUser({ hasStore: false, storeId: null }).subscribe();
          }
        },
      });
    }

    this.loading = false;
  }

  onAvatarUploaded(base64: string): void {
    this.profileData.avatar = base64;

    this.saveAvatar(base64);
  }

  onAvatarRemoved(): void {
    this.profileData.avatar = '';
    this.saveAvatar('');
  }

  private saveAvatar(avatar: string): void {
    if (!this.user) return;

    const updateData: Partial<User> = {
      ...(avatar ? { avatar } : { avatar: null }) as any
    };

    this.authService.updateUser(updateData).subscribe({
      next: (response) => {
        if (response.success) {
          this.user = this.authService.getCurrentUser();
        }
      },
      error: (error) => {
        console.error('❌ Erro ao salvar avatar:', error);
        this.alertService.error('Erro', 'Não foi possível salvar a foto de perfil.');
      }
    });
  }

  onCepBlur(): void {
    const cep = this.profileData.address.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      this.buscarEndereco(cep);
    }
  }

  buscarEndereco(cep: string): void {
    this.isSearchingCep = true;

    this.cepService.buscarCep(cep).subscribe({
      next: (endereco) => {
        this.profileData.address.street = endereco.logradouro || '';
        this.profileData.address.neighborhood = endereco.bairro || '';
        this.profileData.address.city = endereco.localidade || '';
        this.profileData.address.state = endereco.uf || '';
        this.profileData.address.complement = endereco.complemento || '';
        this.isSearchingCep = false;
        this.alertService.toast('CEP encontrado! 📍', 'success', 2000);
      },
      error: (error) => {
        this.isSearchingCep = false;
        console.error('❌ Erro ao buscar CEP:', error);
        this.alertService.warning('CEP não encontrado', 'Preencha os dados manualmente.');
      },
    });
  }

  formatCep(value: string): string {
    return this.cepService.formatarCep(value);
  }

  saveProfile(): void {
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;
    this.alertService.info('Salvando...', 'Atualizando seus dados.');

    const updateData: Partial<User> = {
      name: this.profileData.name,
      email: this.profileData.email,
      phone: this.profileData.phone,
      address: this.profileData.address,
      documentType: this.profileData.documentType,
      ...(this.profileData.avatar ? { avatar: this.profileData.avatar } as any : {})
    };

    if (this.profileData.documentType === 'pf') {
      updateData.birthDate = this.birthDate;
      updateData.companyName = undefined;
      updateData.tradeName = undefined;
    } else {
      updateData.companyName = this.profileData.name;
      updateData.tradeName = this.tradeName;
      updateData.birthDate = undefined;
    }

    this.authService.updateUser(updateData).subscribe({
      next: (response) => {
        this.saving = false;
        if (response.success) {
          this.alertService.success(
            'Perfil atualizado!',
            'Suas informações foram atualizadas com sucesso. 🎉',
          );
          this.loadUserData();
        } else {
          this.alertService.error('Erro', response.message || 'Erro ao atualizar perfil.');
        }
      },
      error: (error) => {
        this.saving = false;
        console.error('❌ Erro ao atualizar perfil:', error);
        this.alertService.error('Erro', 'Não foi possível atualizar o perfil. Tente novamente.');
      },
    });
  }

  validateForm(): boolean {
    if (!this.profileData.name || this.profileData.name.trim().length < 3) {
      this.alertService.warning('Nome inválido', 'Digite seu nome completo (mínimo 3 caracteres).');
      return false;
    }

    if (!this.profileData.email || !this.profileData.email.includes('@')) {
      this.alertService.warning('E-mail inválido', 'Digite um e-mail válido.');
      return false;
    }

    if (!this.profileData.phone || this.profileData.phone.replace(/\D/g, '').length < 10) {
      this.alertService.warning('Telefone inválido', 'Digite um telefone válido com DDD.');
      return false;
    }

    const cepClean = this.profileData.address.cep.replace(/\D/g, '');
    if (cepClean.length > 0 && cepClean.length !== 8) {
      this.alertService.warning('CEP inválido', 'Digite um CEP válido com 8 dígitos.');
      return false;
    }

    return true;
  }

  formatDocument(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (this.profileData.documentType === 'pf') {
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return numbers.replace(/(\d{3})(\d{1,3})/, '$1.$2');
      if (numbers.length <= 9) return numbers.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    } else {
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 5) return numbers.replace(/(\d{2})(\d{1,3})/, '$1.$2');
      if (numbers.length <= 8) return numbers.replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
      if (numbers.length <= 12)
        return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
    }
  }

  formatPhone(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return numbers.replace(/(\d{2})(\d{1,5})/, '($1) $2');
    if (numbers.length <= 10) return numbers.replace(/(\d{2})(\d{4})(\d{1,4})/, '($1) $2-$3');
    return numbers.replace(/(\d{2})(\d{5})(\d{1,4})/, '($1) $2-$3');
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  }

  formatDate(date: string | Date): string {
    if (!date) return 'Data não disponível';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(dateObj);
  }

  getUserTypeLabel(): string {
    return this.profileData.documentType === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica';
  }

  getStoreId(): string {
    return this.store?.id ? String(this.store.id) : '';
  }

  getStoreName(): string {
    return this.store?.storeName || 'Minha Loja';
  }
}
