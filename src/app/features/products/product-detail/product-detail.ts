import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductCard } from '../../../shared/components/product-card/product-card';
import { Subscription } from 'rxjs';
import { Product } from '../../../core/models/ProductModel/product.model';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProductCard],
  templateUrl: './product-detail.html',
  styleUrls: ['./product-detail.scss'],
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
    private cartService: CartService,
    private alertService: AlertService,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe((params) => {
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
      },
    });
  }

  loadRelatedProducts(category: string, productId: number): void {
    this.productService.getRelatedProducts(category, productId).subscribe({
      next: (products) => {
        this.relatedProducts = products;
      },
    });
  }

  // ===== MÉTODOS DE EXIBIÇÃO =====

  getConditionClass(): string {
    return this.product?.condition === 'new' ? 'bg-success' : 'bg-warning';
  }

  getConditionText(): string {
    return this.product?.condition === 'new' ? 'Novo' : 'Usado';
  }

  getStars(rating: number): number[] {
    return Array(5)
      .fill(0)
      .map((_, i) => (i < Math.floor(rating) ? 1 : 0));
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

  getDiscountPercentage(): number {
    if (this.product?.oldPrice && this.product.oldPrice > this.product.price) {
      return Math.round(
        ((this.product.oldPrice - this.product.price) / this.product.oldPrice) * 100,
      );
    }
    return 0;
  }

  // ===== MÉTODOS DE AÇÃO =====

  addToCart(): void {
    if (this.product) {
      const maxQuantity = Math.min(this.quantity, this.product.stock);

      this.cartService.addToCart(this.product, maxQuantity);

      this.alertService.success(
        'Produto adicionado!',
        `${this.product.name} (${maxQuantity}x) foi adicionado ao carrinho.`,
        3000
      );
    }
  }

  buyNow(): void {
    if (this.product) {
      const maxQuantity = Math.min(this.quantity, this.product.stock);

      this.alertService.confirm(
        'Comprar agora?',
        `Deseja comprar ${this.product.name} (${maxQuantity}x) imediatamente?`,
        'Sim, comprar',
        'Cancelar'
      ).then((result) => {
        if (result.isConfirmed) {
          this.cartService.addToCart(this.product!, maxQuantity);
          this.router.navigate(['/checkout']);
        }
      });
    }
  }

  toggleFavorite(): void {
    if (this.product) {
      this.isFavorite = !this.isFavorite;

      // Chamar serviço para salvar favorito
      this.productService.toggleFavorite(this.product.id).subscribe({
        next: () => {
          if (this.isFavorite) {
            this.alertService.toast('Adicionado aos favoritos! ❤️', 'success', 2000);
          } else {
            this.alertService.toast('Removido dos favoritos! 💔', 'info', 2000);
          }
        },
        error: () => {
          // Reverter estado em caso de erro
          this.isFavorite = !this.isFavorite;
          this.alertService.error(
            'Erro',
            'Não foi possível atualizar os favoritos. Tente novamente.'
          );
        }
      });
    }
  }

  changeImage(index: number): void {
    this.selectedImage = index;
  }

  increaseQuantity(): void {
    if (this.product && this.quantity < this.product.stock) {
      this.quantity++;
    } else if (this.product) {
      this.alertService.warning(
        'Estoque limitado',
        `Só temos ${this.product.stock} unidades disponíveis.`
      );
    }
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  // ===== MÉTODOS UTILITÁRIOS =====

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  /**
   * Calcula o valor total com base na quantidade
   */
  getTotalPrice(): number {
    if (this.product) {
      return this.product.price * this.quantity;
    }
    return 0;
  }

  /**
   * Calcula o valor com desconto por unidade
   */
  getDiscountPrice(): number {
    if (this.product?.oldPrice) {
      return this.product.price;
    }
    return 0;
  }

  /**
   * Verifica se o produto está em promoção
   */
  isOnSale(): boolean {
    return !!(this.product?.oldPrice && this.product.oldPrice > this.product.price);
  }

  /**
   * Obtém a URL da imagem principal
   */
  getMainImage(): string {
    if (this.product?.images && this.product.images.length > 0) {
      return this.product.images[this.selectedImage] || this.product.images[0];
    }
    return 'https://via.placeholder.com/600x400/667eea/ffffff?text=Sem+Imagem';
  }

  /**
   * Obtém as miniaturas das imagens
   */
  getThumbnails(): string[] {
    if (this.product?.images) {
      return this.product.images;
    }
    return ['https://via.placeholder.com/100x100/667eea/ffffff?text=Sem+Imagem'];
  }
}
