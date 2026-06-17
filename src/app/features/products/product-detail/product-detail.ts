import { Component, OnDestroy, OnInit } from '@angular/core';
import { Product } from '../../../core/models/ProductModel/product.model';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../../core/services/productService';
import { CartService } from '../../../core/services/cartService';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductCard } from '../../../shared/components/product-card/product-card';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProductCard],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetail implements OnInit, OnDestroy {
  Math = Math;
  product: Product | null = null;
  relatedProducts: Product[] = [];
  loading = true;
  quantity = 1;
  selectedImage = 0;
  isFavorite = false;
  showFullDescription = false;

  private routeSub: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.loadProduct(+id);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  loadProduct(id: number): void {
    this.loading = true;
    this.productService.getProductById(id).subscribe({
      next: (product) => {
        if (product) {
          this.product = product;
          this.isFavorite = product.isFavorite || false;
          this.loadRelatedProducts(product.category, product.id);
        } else {
          this.router.navigate(['/home']);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar produto:', error);
        this.loading = false;
        this.router.navigate(['/home']);
      }
    });
  }

  loadRelatedProducts(category: string, productId: number): void {
    this.productService.getRelatedProducts(category, productId).subscribe({
      next: (products) => {
        this.relatedProducts = products;
      },
      error: (error) => {
        console.error('Erro ao carregar produtos relacionados:', error);
      }
    });
  }

  changeImage(index: number): void {
    this.selectedImage = index;
  }

  increaseQuantity(): void {
    if (this.product && this.quantity < this.product.stock) {
      this.quantity++;
    }
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  addToCart(): void {
    if (this.product) {
      this.cartService.addToCart(this.product, this.quantity);
      // Feedback visual (você pode adicionar um toast depois)
      alert(`Produto adicionado ao carrinho! (${this.quantity}x)`);
    }
  }

  buyNow(): void {
    if (this.product) {
      this.cartService.addToCart(this.product, this.quantity);
      this.router.navigate(['/checkout']);
    }
  }

  toggleFavorite(): void {
    if (this.product) {
      this.isFavorite = !this.isFavorite;
      this.productService.toggleFavorite(this.product.id);
    }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  getDiscountPercentage(): number {
    if (this.product?.oldPrice && this.product.oldPrice > this.product.price) {
      return Math.round(((this.product.oldPrice - this.product.price) / this.product.oldPrice) * 100);
    }
    return 0;
  }

  getConditionText(): string {
    return this.product?.condition === 'new' ? 'Novo' : 'Usado';
  }

  getConditionClass(): string {
    return this.product?.condition === 'new' ? 'bg-success' : 'bg-warning';
  }

  getStockStatus(): string {
    if (!this.product) return '';
    if (this.product.stock > 10) return 'Em estoque';
    if (this.product.stock > 0) return 'Últimas unidades';
    return 'Esgotado';
  }

  getStockClass(): string {
    if (!this.product) return '';
    if (this.product.stock > 10) return 'text-success';
    if (this.product.stock > 0) return 'text-warning';
    return 'text-danger';
  }

  getStars(rating: number): number[] {
    return Array(5).fill(0).map((_, i) => i < Math.floor(rating) ? 1 : 0);
  }
}
