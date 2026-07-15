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
  @Output() favoriteToggle = new EventEmitter<number>();

  /**
   * Formata o preço para moeda brasileira
   */
  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  /**
   * Evento de clique no botão de favorito
   */
  onFavoriteClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.favoriteToggle.emit(this.product.id);
  }

  /**
   * Calcula a porcentagem de desconto
   */
  getDiscountPercentage(): number {
    if (this.product.oldPrice && this.product.oldPrice > this.product.price) {
      return Math.round(
        ((this.product.oldPrice - this.product.price) / this.product.oldPrice) * 100,
      );
    }
    return 0;
  }

  /**
   * Retorna o texto da condição do produto
   */
  getConditionBadge(): string {
    return this.product.condition === 'new' ? 'Novo' : 'Usado';
  }

  /**
   * Retorna a classe CSS da condição
   */
  getConditionClass(): string {
    return this.product.condition === 'new' ? 'bg-success' : 'bg-warning';
  }

  /**
   * Verifica se o produto está em estoque
   */
  isInStock(): boolean {
    return this.product.stock > 0;
  }

  /**
   * Verifica se o produto está com estoque baixo
   */
  isLowStock(): boolean {
    return this.product.stock > 0 && this.product.stock <= 5;
  }

  /**
   * Retorna o texto do status do estoque
   */
  getStockStatus(): string {
    if (this.product.stock === 0) return 'Esgotado';
    if (this.product.stock <= 5) return `Últimas ${this.product.stock} unidades`;
    return 'Em estoque';
  }

  /**
   * Retorna a classe do status do estoque
   */
  getStockClass(): string {
    if (this.product.stock === 0) return 'bg-danger';
    if (this.product.stock <= 5) return 'bg-warning text-dark';
    return 'bg-success';
  }

  /**
   * Verifica se tem frete grátis
   */
  hasFreeShipping(): boolean {
    return this.product.price > 100;
  }

  /**
   * Retorna a URL da imagem com fallback
   */
  getImageUrl(): string {
    if (this.product.images && this.product.images.length > 0) {
      return this.product.images[0];
    }
    return 'https://via.placeholder.com/300x300/667eea/ffffff?text=Sem+Imagem';
  }
}
