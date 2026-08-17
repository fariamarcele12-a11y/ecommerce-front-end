export interface ProductFilters {
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: 'new' | 'used';
  search?: string;
  location?: string;
  sellerId?: number;
  sellerName?: string;
  minRating?: number;
  hasDiscount?: boolean;
  freeShipping?: boolean;
  inStock?: boolean;
  isFavorite?: boolean;
  brands?: string[];
  limit?: number;
  page?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular' | 'rating' | 'sales';
}