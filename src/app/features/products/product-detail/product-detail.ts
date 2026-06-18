import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductCard } from '../../../shared/components/product-card/product-card';
import { Subscription } from 'rxjs';
import { Product } from '../../../core/models/ProductModel/product.model';
import { ProductService } from '../../../core/services/productService';
import { CartService } from '../../../core/services/cartService';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProductCard],
  templateUrl: './product-detail.html',
  styleUrls: ['./product-detail.scss']
})
export class ProductDetail implements OnInit, OnDestroy {
  product: Product | null = null;
  relatedProducts: Product[] = [];
  loading = true;
  quantity = 1;
  selectedImage = 0;
  isFavorite = false;
  showFullDescription = false;
  Math = Math;

  private routeSub: Subscription = new Subscription();

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
      error: () => {
        this.loading = false;
        this.router.navigate(['/home']);
      }
    });
  }

  loadRelatedProducts(category: string, productId: number): void {
    this.productService.getRelatedProducts(category, productId).subscribe({
      next: (products) => {
        this.relatedProducts = products;
      }
    });
  }

  // ===== MÉTODOS ADICIONADOS =====

  getConditionClass(): string {
    return this.product?.condition === 'new' ? 'bg-success' : 'bg-warning';
  }

  getConditionText(): string {
    return this.product?.condition === 'new' ? 'Novo' : 'Usado';
  }

  getStars(rating: number): number[] {
    return Array(5).fill(0).map((_, i) => i < Math.floor(rating) ? 1 : 0);
  }

  getStockClass(): string {
    if (!this.product) return '';
    if (this.product.stock > 10) return 'text-success';
    if (this.product.stock > 0) return 'text-warning';
    return 'text-danger';
  }

  getStockStatus(): string {
    if (!this.product) return '';
    if (this.product.stock > 10) return 'Em estoque';
    if (this.product.stock > 0) return 'Últimas unidades';
    return 'Esgotado';
  }

  // ===== FIM DOS MÉTODOS ADICIONADOS =====

  addToCart(): void {
    if (this.product) {
      this.cartService.addToCart(this.product, this.quantity);
      alert(`Produto adicionado ao carrinho! (${this.quantity}x)`);
    }
  }

  buyNow(): void {
    if (this.product) {
      this.cartService.addToCart(this.product, this.quantity);
      this.router.navigate(['/checkout']);
    }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  toggleFavorite(): void {
    this.isFavorite = !this.isFavorite;
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

  getDiscountPercentage(): number {
    if (this.product?.oldPrice && this.product.oldPrice > this.product.price) {
      return Math.round(((this.product.oldPrice - this.product.price) / this.product.oldPrice) * 100);
    }
    return 0;
  }
}
