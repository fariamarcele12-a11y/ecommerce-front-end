export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: 'new' | 'used';
  search?: string;
  location?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  limit?: number;
  page?: number;
  sellerId?: number;
  minRating?: number;
  hasDiscount?: boolean;
  freeShipping?: boolean;
  inStock?: boolean;
  brands?: string[];
  subcategory?: string;
}
