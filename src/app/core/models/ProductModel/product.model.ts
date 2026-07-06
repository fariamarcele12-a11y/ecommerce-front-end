export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  images: string[];
  category: string;
  condition: 'new' | 'used';
  seller: {
    id: number;
    name: string;
    rating: number;
    sales: number;
  };
  location: string;
  stock: number;
  createdAt: string;
  updatedAt?: string;
  isFavorite?: boolean;
  freeShipping?: boolean;
}