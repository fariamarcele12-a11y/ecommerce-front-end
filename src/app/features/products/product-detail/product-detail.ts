// src/app/features/products/product-detail/product-detail.ts
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
import { StoreService } from '../../../core/services/store.service';
import { AuthService } from '../../../core/services/auth.service';

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
  sellerName: string = 'Carregando...';
  isOwner: boolean = false;
  currentUserId: string | null = null;

  private routeSub: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private cartService: CartService,
    private alertService: AlertService,
    private storeService: StoreService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // 🔥 PEGAR ID DO USUÁRIO LOGADO
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUserId = String(user.id);
      console.log('👤 ID do usuário logado:', this.currentUserId);
    }

    this.routeSub = this.route.params.subscribe((params) => {
      const id = params['id'];
      console.log('🔍 ID do produto na rota:', id);

      if (id) {
        this.loadProduct(id);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  loadProduct(id: string | number): void {
    this.loading = true;
    console.log(`🔍 Buscando produto com ID: ${id}`);

    this.productService.getProductById(id).subscribe({
      next: (product) => {
        if (product) {
          this.product = product;
          this.isFavorite = product.isFavorite || false;

          // 🔥 BUSCAR O SELLER ID
          this.loadSellerInfo(product);

          this.loadRelatedProducts(product.category, product.id);
        } else {
          console.log('❌ Produto não encontrado');
          this.router.navigate(['/home']);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Erro ao carregar produto:', error);
        this.loading = false;
        this.router.navigate(['/home']);
      },
    });
  }

  /**
   * 🔥 CARREGA INFORMAÇÕES DO VENDEDOR E VERIFICA PROPRIEDADE
   */
  loadSellerInfo(product: Product): void {
    console.log('🔍 Carregando informações do vendedor...');
    console.log('📦 Produto:', product);
    console.log('👤 Seller atual:', product.seller);

    // 🔥 SE O PRODUTO JÁ TEM SELLER, USAR ELE
    if (product.seller) {
      const sellerId = String(product.seller.id);
      console.log('🆔 Seller ID do produto:', sellerId);
      console.log('👤 Current User ID:', this.currentUserId);

      this.isOwner = sellerId === this.currentUserId;
      console.log('👤 É o dono?', this.isOwner);
      this.sellerName = product.seller.name || 'Vendedor';
      return;
    }

    // 🔥 SE NÃO TEM SELLER, BUSCAR PELA LOJA
    if (product.storeId) {
      console.log('🔍 Buscando loja para storeId:', product.storeId);
      this.storeService.getStoreById(product.storeId).subscribe({
        next: (store) => {
          console.log('🏪 Loja encontrada:', store);
          if (store) {
            this.sellerName = store.storeName;

            // 🔥 Verificar se o usuário é o dono da loja
            const storeUserId = String(store.userId);
            this.isOwner = storeUserId === this.currentUserId;
            console.log('👤 É o dono da loja?', this.isOwner);
            console.log('🆔 Store User ID:', storeUserId);
            console.log('👤 Current User ID:', this.currentUserId);
          }
        },
        error: (error) => {
          console.error('❌ Erro ao buscar loja:', error);
          this.sellerName = 'Vendedor';
        }
      });
    } else {
      this.sellerName = 'Vendedor';
      this.isOwner = false;
    }
  }

  loadRelatedProducts(category: string, productId: number): void {
    this.productService.getRelatedProducts(category, productId).subscribe({
      next: (products) => {
        this.relatedProducts = products;
      },
      error: (error) => {
        console.error('❌ Erro ao carregar produtos relacionados:', error);
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

  getSellerName(): string {
    return this.sellerName || 'Vendedor';
  }

  getSellerRating(): number {
    return this.product?.seller?.rating || 0;
  }

  getSellerSales(): number {
    return this.product?.seller?.sales || 0;
  }

  // ===== MÉTODOS DE AÇÃO =====

  addToCart(): void {
    if (this.product) {
      const maxQuantity = Math.min(this.quantity, this.product.stock);

      this.cartService.addToCart(this.product, maxQuantity);

      this.alertService.success(
        'Produto adicionado!',
        `${this.product.name} (${maxQuantity}x) foi adicionado ao carrinho.`,
        3000,
      );
    }
  }

  buyNow(): void {
    if (this.product) {
      const maxQuantity = Math.min(this.quantity, this.product.stock);

      this.alertService
        .confirm(
          'Comprar agora?',
          `Deseja comprar ${this.product.name} (${maxQuantity}x) imediatamente?`,
          'Sim, comprar',
          'Cancelar',
        )
        .then((result) => {
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

      this.productService.toggleFavorite(this.product.id).subscribe({
        next: () => {
          if (this.isFavorite) {
            this.alertService.toast('Adicionado aos favoritos! ❤️', 'success', 2000);
          } else {
            this.alertService.toast('Removido dos favoritos! 💔', 'info', 2000);
          }
        },
        error: () => {
          this.isFavorite = !this.isFavorite;
          this.alertService.error(
            'Erro',
            'Não foi possível atualizar os favoritos. Tente novamente.',
          );
        },
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
        `Só temos ${this.product.stock} unidades disponíveis.`,
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

  getTotalPrice(): number {
    if (this.product) {
      return this.product.price * this.quantity;
    }
    return 0;
  }

  getDiscountPrice(): number {
    if (this.product?.oldPrice) {
      return this.product.price;
    }
    return 0;
  }

  isOnSale(): boolean {
    return !!(this.product?.oldPrice && this.product.oldPrice > this.product.price);
  }

  getMainImage(): string {
    if (this.product?.images && this.product.images.length > 0) {
      return this.product.images[this.selectedImage] || this.product.images[0];
    }
    return 'https://via.placeholder.com/600x400/667eea/ffffff?text=Sem+Imagem';
  }

  getThumbnails(): string[] {
    if (this.product?.images) {
      return this.product.images;
    }
    return ['https://via.placeholder.com/100x100/667eea/ffffff?text=Sem+Imagem'];
  }
}
