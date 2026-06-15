import { Seller } from "../seller.model";

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
    seller: Seller;
    location: string;
    stock: number;
    createdAt: Date;
    isFavorite?: boolean;
}