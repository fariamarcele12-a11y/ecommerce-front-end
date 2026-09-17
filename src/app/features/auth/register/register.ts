// src/app/features/auth/register/register.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { CepService } from '../../../core/services/cep.service';
import { RegisterCredentials } from '../../../core/models/user.model';
import { DocumentValidator } from '../../../core/utils/validators';

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

  // 🔥 Controle de validação do documento
  documentError: string = '';

  // 🔥 Getter com asserção de não-nulo
  get address() {
    return this.credentials.address!;
  }

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
    this.documentError = '';
    if (type === 'pf') {
      this.companyName = '';
      this.tradeName = '';
    } else {
      this.birthDate = '';
    }
  }

  /**
   * 🔥 Valida o documento enquanto o usuário digita
   */
  onDocumentChange(value: string): void {
    this.credentials.document = this.formatDocument(value);

    const cleanDoc = value.replace(/\D/g, '');

    // Só valida quando tiver o tamanho completo
    if (this.documentType === 'pf' && cleanDoc.length === 11) {
      const isValid = DocumentValidator.isValidCPF(cleanDoc);
      if (!isValid) {
        this.documentError = 'CPF inválido. Verifique os dígitos.';
      } else {
        this.documentError = '';
      }
    } else if (this.documentType === 'pj' && cleanDoc.length === 14) {
      const isValid = DocumentValidator.isValidCNPJ(cleanDoc);
      if (!isValid) {
        this.documentError = 'CNPJ inválido. Verifique os dígitos.';
      } else {
        this.documentError = '';
      }
    } else {
      this.documentError = '';
    }
  }

  onCepBlur(): void {
    const cep = this.address.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      this.buscarEndereco(cep);
    }
  }

  buscarEndereco(cep: string): void {
    this.isSearchingCep = true;

    this.cepService.buscarCep(cep).subscribe({
      next: (endereco) => {
        this.address.street = endereco.logradouro || '';
        this.address.neighborhood = endereco.bairro || '';
        this.address.city = endereco.localidade || '';
        this.address.state = endereco.uf || '';
        this.address.complement = endereco.complemento || '';
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.credentials.email || !emailRegex.test(this.credentials.email)) {
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

    if (this.documentType === 'pf') {
      if (docClean.length !== 11) {
        this.alertService.warning('CPF inválido', 'Digite um CPF válido com 11 dígitos.');
        return false;
      }

      if (!DocumentValidator.isValidCPF(docClean)) {
        this.alertService.error(
          'CPF inválido',
          'O CPF informado não é válido. Verifique os dígitos e tente novamente.'
        );
        return false;
      }
    } else {
      if (docClean.length !== 14) {
        this.alertService.warning('CNPJ inválido', 'Digite um CNPJ válido com 14 dígitos.');
        return false;
      }

      if (!DocumentValidator.isValidCNPJ(docClean)) {
        this.alertService.error(
          'CNPJ inválido',
          'O CNPJ informado não é válido. Verifique os dígitos e tente novamente.'
        );
        return false;
      }
    }

    const cepClean = this.address.cep.replace(/\D/g, '');
    if (cepClean.length !== 8) {
      this.alertService.warning('CEP inválido', 'Digite um CEP válido com 8 dígitos.');
      return false;
    }

    const phoneClean = this.credentials.phone.replace(/\D/g, '');
    if (phoneClean.length < 10 || phoneClean.length > 11) {
      this.alertService.warning('Telefone inválido', 'Digite um telefone válido com DDD.');
      return false;
    }

    if (!this.address.street || this.address.street.trim().length < 3) {
      this.alertService.warning('Endereço inválido', 'Informe o nome da rua.');
      return false;
    }

    if (!this.address.number || this.address.number.trim().length === 0) {
      this.alertService.warning('Número inválido', 'Informe o número do endereço.');
      return false;
    }

    if (!this.address.neighborhood || this.address.neighborhood.trim().length < 2) {
      this.alertService.warning('Bairro inválido', 'Informe o bairro.');
      return false;
    }

    if (!this.address.city || this.address.city.trim().length < 2) {
      this.alertService.warning('Cidade inválida', 'Informe a cidade.');
      return false;
    }

    if (!this.address.state || this.address.state.length !== 2) {
      this.alertService.warning('Estado inválido', 'Selecione o estado.');
      return false;
    }

    if (this.documentType === 'pf' && !this.birthDate) {
      this.alertService.warning('Data de nascimento', 'Informe sua data de nascimento.');
      return false;
    }

    if (!this.termsAccepted) {
      this.alertService.warning(
        'Aceite os termos',
        'Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.'
      );
      return false;
    }

    return true;
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

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
    if (numbers.length <= 10) return numbers.replace(/(\d{2})(\d{4})(\d{1,4})/, '($1) $2-$3');
    return numbers.replace(/(\d{2})(\d{5})(\d{1,4})/, '($1) $2-$3');
  }

  formatCep(value: string): string {
    return this.cepService.formatarCep(value);
  }
}
