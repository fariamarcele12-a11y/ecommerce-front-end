export interface Coupon {
  id: number;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase?: number;
  maxDiscount?: number;
  startDate: Date;
  endDate: Date;
  usageLimit?: number;
  usedCount: number;
  active: boolean;
  applicableCategories?: string[];
  applicableProducts?: number[];
  excludedProducts?: number[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface CouponValidation {
  valid: boolean;
  message?: string;
  discountAmount?: number;
  coupon?: Coupon;
}

export interface CouponFilter {
  code?: string;
  active?: boolean;
  minPurchase?: number;
  category?: string;
  productId?: number;
}
