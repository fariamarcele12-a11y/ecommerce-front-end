import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { CepService } from '../../../core/services/cep.service';
import { RegisterCredentials } from '../../../core/models/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.scss']
})
export class Register {
  documentType: 'pf' | 'pj' = 'pf';
  isSearchingCep = false;
  
  credentials: RegisterCredentials = {
    documentType: 'pf',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    document: '',
    phone: '',
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

  // Campos específicos PF
  birthDate = '';

  // Campos específicos PJ
  companyName = '';
  tradeName = '';

  termsAccepted = false;
  loading = false;
  showPassword = false;
  showConfirmPassword = false;
  formSubmitted = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private alertService: AlertService,
    private cepService: CepService
  ) {}

  onDocumentTypeChange(type: 'pf' | 'pj'): void {
    this.documentType = type;
    this.credentials.documentType = type;
    this.credentials.document = '';
    if (type === 'pf') {
      this.companyName = '';
      this.tradeName = '';
    } else {
      this.birthDate = '';
    }
  }

  onCepBlur(): void {
    const cep = this.credentials.address.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      this.buscarEndereco(cep);
    }
  }

  buscarEndereco(cep: string): void {
    this.isSearchingCep = true;
    
    this.cepService.buscarCep(cep).subscribe({
      next: (endereco) => {
        this.credentials.address.street = endereco.logradouro || '';
        this.credentials.address.neighborhood = endereco.bairro || '';
        this.credentials.address.city = endereco.localidade || '';
        this.credentials.address.state = endereco.uf || '';
        this.credentials.address.complement = endereco.complemento || '';
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

  validateForm(): boolean {
    this.formSubmitted = true;

    if (!this.credentials.name || this.credentials.name.trim().length < 3) {
      this.alertService.warning('Nome inválido', 'Digite seu nome completo (mínimo 3 caracteres).');
      return false;
    }

    if (!this.credentials.email || !this.credentials.email.includes('@')) {
      this.alertService.warning('E-mail inválido', 'Digite um e-mail válido.');
      return false;
    }

    if (!this.credentials.password || this.credentials.password.length < 6) {
      this.alertService.warning('Senha inválida', 'A senha deve ter pelo menos 6 caracteres.');
      return false;
    }

    if (this.credentials.password !== this.credentials.confirmPassword) {
      this.alertService.warning('Senhas não conferem', 'As senhas digitadas não são iguais.');
      return false;
    }

    const docClean = this.credentials.document.replace(/\D/g, '');
    if (this.documentType === 'pf' && docClean.length !== 11) {
      this.alertService.warning('CPF inválido', 'Digite um CPF válido com 11 dígitos.');
      return false;
    }
    if (this.documentType === 'pj' && docClean.length !== 14) {
      this.alertService.warning('CNPJ inválido', 'Digite um CNPJ válido com 14 dígitos.');
      return false;
    }

    const cepClean = this.credentials.address.cep.replace(/\D/g, '');
    if (cepClean.length !== 8) {
      this.alertService.warning('CEP inválido', 'Digite um CEP válido com 8 dígitos.');
      return false;
    }

    const phoneClean = this.credentials.phone.replace(/\D/g, '');
    if (phoneClean.length < 10) {
      this.alertService.warning('Telefone inválido', 'Digite um telefone válido com DDD.');
      return false;
    }

    return true;
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    // Adicionar campos específicos
    if (this.documentType === 'pf') {
      this.credentials.birthDate = this.birthDate;
      this.credentials.companyName = undefined;
      this.credentials.tradeName = undefined;
    } else {
      this.credentials.companyName = this.companyName;
      this.credentials.tradeName = this.tradeName;
      this.credentials.birthDate = undefined;
    }

    this.loading = true;
    this.authService.register(this.credentials).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.alertService.success('Cadastro realizado!', 'Bem-vindo ao MarketHub! 🎉');
          this.router.navigate(['/home']);
        } else {
          this.alertService.error('Erro no cadastro', response.message);
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('❌ Erro no cadastro:', error);
        this.alertService.error('Erro', 'Não foi possível realizar o cadastro.');
      }
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  formatDocument(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (this.documentType === 'pf') {
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return numbers.replace(/(\d{3})(\d{1,3})/, '$1.$2');
      if (numbers.length <= 9) return numbers.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    } else {
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 5) return numbers.replace(/(\d{2})(\d{1,3})/, '$1.$2');
      if (numbers.length <= 8) return numbers.replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
      if (numbers.length <= 12) return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
    }
  }

  formatPhone(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return numbers.replace(/(\d{2})(\d{1,5})/, '($1) $2');
    return numbers.replace(/(\d{2})(\d{5})(\d{1,4})/, '($1) $2-$3');
  }

  formatCep(value: string): string {
    return this.cepService.formatarCep(value);
  }
}