// src/app/core/models/ProductModel/product.model.ts
export interface Product {
  id: string; // 🔥 Mudado para string
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  images: string[];
  category: string;
  condition: 'new' | 'used';
  seller: {
    id: number | string;
    name: string;
    rating: number;
    sales: number;
  };
  storeId?: string; // 🔥 Mudado para string
  location: string;
  stock: number;
  freeShipping?: boolean;
  createdAt: string;
  updatedAt?: string;
  isFavorite?: boolean;
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: 'new' | 'used';
  search?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  page?: number;
  limit?: number;
  sellerId?: number | string;
  location?: string;
  hasDiscount?: boolean;
  freeShipping?: boolean;
  inStock?: boolean;
}

export interface ProductResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
