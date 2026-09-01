// src/app/core/models/password-reset.model.ts
export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  token?: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string | number;
  token: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface PasswordResetState {
  step: 'request' | 'sent' | 'confirm' | 'success';
  email: string;
  token?: string;
  isLoading: boolean;
  error?: string;
}
