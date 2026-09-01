// src/app/features/auth/confirm-reset/confirm-reset.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PasswordResetService } from '../../../core/services/password-reset.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-confirm-reset',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './confirm-reset.html',
  styleUrls: ['../auth.scss'] // 🔥 Usando estilo compartilhado
})
export class ConfirmReset implements OnInit {
  token = '';
  newPassword = '';
  confirmPassword = '';
  loading = false;
  validating = true;
  tokenValid = false;
  success = false;
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private passwordResetService: PasswordResetService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (this.token) {
        this.validateToken();
      } else {
        this.validating = false;
        this.tokenValid = false;
        this.alertService.error('Token inválido', 'Nenhum token de redefinição foi fornecido.');
      }
    });
  }

  validateToken(): void {
    this.validating = true;
    this.passwordResetService.validateToken(this.token).subscribe({
      next: (result) => {
        this.validating = false;
        this.tokenValid = result.valid;
        if (!result.valid) {
          this.alertService.error('Token inválido', result.message);
          setTimeout(() => {
            this.router.navigate(['/solicitar-redefinicao']);
          }, 3000);
        }
      },
      error: (error) => {
        this.validating = false;
        this.tokenValid = false;
        console.error('❌ Erro ao validar token:', error);
        this.alertService.error('Erro', 'Não foi possível validar o token.');
      }
    });
  }

  onSubmit(): void {
    if (!this.tokenValid) {
      this.alertService.error('Token inválido', 'O token de redefinição não é válido.');
      return;
    }

    if (!this.newPassword || this.newPassword.length < 6) {
      this.alertService.warning('Senha inválida', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.alertService.warning('Senhas não conferem', 'As senhas digitadas não são iguais.');
      return;
    }

    this.loading = true;

    this.passwordResetService.confirmReset({
      token: this.token,
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.success = true;
          this.alertService.success('Senha redefinida!', response.message);
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 3000);
        } else {
          this.alertService.error('Erro', response.message);
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('❌ Erro ao redefinir senha:', error);
        this.alertService.error('Erro', 'Não foi possível redefinir sua senha.');
      }
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}
