// src/app/core/models/cart.model.ts
import { Product } from './ProductModel/product.model';

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal?: number;
}

export interface CartSummary {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  itemCount: number;
  savings: number;
}

export interface CheckoutItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
  image: string;
  sellerId: string;
  sellerName: string;
}

export interface ApiCartItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product | null;
}

export interface ApiCartResponse {
  id: string;
  userId: string;
  items: ApiCartItem[];
}
