// src/app/core/models/coupon.model.ts

export interface Coupon {
  id: string; // Guid no backend
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  maxUses?: number;
  currentUses: number;
  validFrom?: string;
  validUntil?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CouponValidation {
  valid: boolean;
  message?: string;
  discountAmount?: number;
  coupon?: Coupon;
}

export interface CouponFilter {
  code?: string;
  activeOnly?: boolean;
}

// DTO para criação
export interface CreateCouponDTO {
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  maxUses?: number;
  validFrom?: string;
  validUntil?: string;
}

// DTO para atualização
export interface UpdateCouponDTO {
  description?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  maxUses?: number;
  validFrom?: string;
  validUntil?: string;
  active?: boolean;
}
