// src/app/features/auth/request-reset/request-reset.ts
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PasswordResetService } from '../../../core/services/password-reset.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-request-reset',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './request-reset.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrls: ['../auth.scss'],
})
export class RequestReset {
  email = '';
  loading = false;
  submitted = false;
  success = false;

  constructor(
    private passwordResetService: PasswordResetService,
    private alertService: AlertService,
  ) {}

  onSubmit(): void {
    if (!this.email || !this.isValidEmail(this.email)) {
      this.alertService.warning(
        'E-mail inválido',
        'Digite um e-mail válido para redefinir sua senha.'
      );
      return;
    }

    this.loading = true;
    this.submitted = true;

    this.passwordResetService.requestReset(this.email).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.success = true;
          this.alertService.success('Solicitação enviada!', response.message);
        } else {
          this.alertService.error('Erro', response.message);
        }
      },
      error: (error) => {
        this.loading = false;
        this.submitted = false;
        console.error('❌ Erro ao solicitar reset:', error);
        const message =
          error?.error?.message ??
          'Não foi possível processar sua solicitação. Tente novamente.';
        this.alertService.error('Erro', message);
      },
    });
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}