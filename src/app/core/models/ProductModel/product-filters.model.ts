export interface ProductFilters{
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: 'new' | 'used';
    search?: string;
    sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
}