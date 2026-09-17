// src/app/shared/components/product-card/product-card.ts
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../../core/models/ProductModel/product.model';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCard {
  @Input() product!: Product;
  @Output() favoriteToggle = new EventEmitter<string>();

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  onFavoriteClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.favoriteToggle.emit(String(this.product.id));
  }

  getDiscountPercentage(): number {
    if (this.product.oldPrice && this.product.oldPrice > this.product.price) {
      return Math.round(
        ((this.product.oldPrice - this.product.price) / this.product.oldPrice) * 100,
      );
    }
    return 0;
  }

  isOnSale(): boolean {
    return !!(this.product.oldPrice && this.product.oldPrice > this.product.price);
  }

  getConditionBadge(): string {
    return this.product.condition === 'new' ? 'Novo' : 'Usado';
  }

  getConditionClass(): string {
    return this.product.condition === 'new' ? 'bg-success' : 'bg-warning';
  }

  isInStock(): boolean {
    return this.product.stock > 0;
  }

  isLowStock(): boolean {
    return this.product.stock > 0 && this.product.stock <= 5;
  }

  getStockStatus(): string {
    if (this.product.stock === 0) return 'Esgotado';
    if (this.product.stock <= 5) return `Últimas ${this.product.stock} unidades`;
    return 'Em estoque';
  }

  getStockClass(): string {
    if (this.product.stock === 0) return 'bg-danger';
    if (this.product.stock <= 5) return 'bg-warning text-dark';
    return 'bg-success';
  }

  hasFreeShipping(): boolean {
    return this.product.freeShipping || this.product.price > 100;
  }

  getImageUrl(): string {
    if (this.product.images && this.product.images.length > 0) {
      return this.product.images[0];
    }
    return 'https://via.placeholder.com/300x300/667eea/ffffff?text=Sem+Imagem';
  }

  getSellerName(): string {
    return this.product.seller?.name || 'Vendedor';
  }

  getSellerRating(): number {
    return this.product.seller?.rating || 0;
  }

  getSellerSales(): number {
    return this.product.seller?.sales || 0;
  }
}
