import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class Login {
  credentials = {
    email: '',
    password: ''
  };
  loading = false;
  showPassword = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private alertService: AlertService
  ) {}

  onSubmit(): void {
    if (!this.credentials.email || !this.credentials.password) {
      this.alertService.warning('Campos obrigatórios', 'Preencha todos os campos.');
      return;
    }

    this.loading = true;
    this.authService.login(this.credentials).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.alertService.success('Login realizado!', 'Bem-vindo de volta!');
          this.router.navigate(['/home']);
        } else {
          this.alertService.error('Erro no login', response.message);
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('❌ Erro no login:', error);
        this.alertService.error('Erro', 'Não foi possível realizar o login.');
      }
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }
}

