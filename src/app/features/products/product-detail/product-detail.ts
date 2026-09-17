// src/app/features/products/product-detail/product-detail.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductCard } from '../../../shared/components/product-card/product-card';
import { Comments } from '../../../shared/components/comments/comments';
import { Subscription } from 'rxjs';
import { Product } from '../../../core/models/ProductModel/product.model';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { AlertService } from '../../../core/services/alert.service';
import { StoreService } from '../../../core/services/store.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { CategoryService } from '../../../core/services/category.service';
import { Store as StoreModel } from '../../../core/models/store.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProductCard, Comments],
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
  sellerMemberSince: string = 'Carregando...';
  categorySlug: string = '';
  sellerId: string = '';

  // 🔥 Armazenar a loja do vendedor para obter logo/banner
  store: StoreModel | null = null;
  storeLogo: string = '';
  storeBanner: string = '';

  private routeSub: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private cartService: CartService,
    private alertService: AlertService,
    private storeService: StoreService,
    private authService: AuthService,
    private userService: UserService,
    private categoryService: CategoryService,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUserId = String(user.id);
    }

    this.routeSub = this.route.params.subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.loadProduct(String(id));
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  loadProduct(id: string): void {
    this.loading = true;

    this.productService.getProductById(id).subscribe({
      next: (product: Product) => {
        if (product) {
          this.product = product;
          this.isFavorite = product.isFavorite || false;

          if (product.seller) {
            this.sellerId = String(product.seller.id);
          }

          this.loadCategorySlug(product.category);
          this.loadSellerInfo(product);
          this.loadRelatedProducts(product.category, String(product.id));
          this.checkOwnership(product);
        } else {
          this.router.navigate(['/home']);
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.error('❌ Erro ao carregar produto:', error);
        this.loading = false;
        this.router.navigate(['/home']);
      },
    });
  }

  loadCategorySlug(categoryName: string): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        const category = categories.find(c => c.name === categoryName);
        if (category && category.slug) {
          this.categorySlug = category.slug;
        } else {
          this.categorySlug = categoryName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-');
        }
      },
      error: (error) => {
        console.error('❌ Erro ao buscar categorias:', error);
        this.categorySlug = categoryName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-');
      }
    });
  }

  loadSellerInfo(product: Product): void {
    if (product.storeId) {
      this.storeService.getStoreById(product.storeId).subscribe({
        next: (store) => {
          if (store) {
            this.store = store;
            this.storeLogo = store.logo || '';
            this.storeBanner = store.banner || '';
            this.sellerName = store.storeName || 'Vendedor';

            const storeUserId = String(store.userId);
            this.isOwner = storeUserId === this.currentUserId;

            if (store.createdAt) {
              const date = new Date(store.createdAt);
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const year = date.getFullYear();
              this.sellerMemberSince = `${month}/${year}`;
            } else {
              this.loadSellerMemberSince(storeUserId);
            }
          }
        },
        error: (error) => {
          console.error('❌ Erro ao buscar loja:', error);
          this.loadSellerFallback(product);
        },
      });
    } else {
      this.loadSellerFallback(product);
    }
  }

  private loadSellerFallback(product: Product): void {
    if (product.seller) {
      const sellerId = String(product.seller.id);
      this.isOwner = sellerId === this.currentUserId;
      this.sellerName = product.seller.name || 'Vendedor';

      if (product.seller.memberSince) {
        const date = new Date(product.seller.memberSince);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        this.sellerMemberSince = `${month}/${year}`;
      } else {
        this.loadSellerMemberSince(sellerId);
      }
    } else {
      this.sellerName = 'Vendedor';
      this.isOwner = false;
      this.sellerMemberSince = '2024';
    }
  }

  loadSellerMemberSince(userId: string): void {
    this.userService.getUserById(userId).subscribe({
      next: (user) => {
        if (user?.createdAt) {
          const date = new Date(user.createdAt);
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          this.sellerMemberSince = `${month}/${year}`;
        } else {
          this.loadMemberSinceFromStore(userId);
        }
      },
      error: (error) => {
        console.error('❌ Erro ao buscar data de cadastro:', error);
        this.loadMemberSinceFromStore(userId);
      }
    });
  }

  private loadMemberSinceFromStore(userId: string): void {
    this.storeService.getStoreByUser(userId).subscribe({
      next: (store) => {
        if (store?.createdAt) {
          const date = new Date(store.createdAt);
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          this.sellerMemberSince = `${month}/${year}`;
        } else {
          this.sellerMemberSince = '2024';
        }
      },
      error: () => {
        this.sellerMemberSince = '2024';
      }
    });
  }

  checkOwnership(product: Product): void {
    const user = this.authService.getCurrentUser();
    if (user && product.seller) {
      const userId = String(user.id);
      const sellerId = String(product.seller.id);
      this.isOwner = userId === sellerId;
    } else {
      this.isOwner = false;
    }
  }

  loadRelatedProducts(category: string, productId: string): void {
    this.productService.getRelatedProducts(category, productId).subscribe({
      next: (products: Product[]) => {
        this.relatedProducts = products;
      },
      error: (error: any) => {
        console.error('❌ Erro ao carregar produtos relacionados:', error);
      },
    });
  }

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

  isOnSale(): boolean {
    return !!(this.product?.oldPrice && this.product.oldPrice > this.product.price);
  }

  hasFreeShipping(): boolean {
    return this.product?.freeShipping || (this.product?.price ?? 0) > 100;
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

  getSellerMemberSince(): string {
    return this.sellerMemberSince || '2024';
  }

  getCategorySlug(): string {
    return this.categorySlug || this.product?.category || '';
  }

  getStoreId(): string {
    if (this.product?.storeId) {
      return String(this.product.storeId);
    }
    return '';
  }

  goToStore(): void {
    const storeId = this.getStoreId();
    if (storeId) {
      this.router.navigate(['/loja', storeId]);
    } else {
      this.alertService.warning('Loja não encontrada', 'Não foi possível encontrar a loja do vendedor.');
    }
  }

  getStoreLogo(): string {
    return this.storeLogo || '';
  }

  hasLogo(): boolean {
    return !!this.storeLogo;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  }

  onLogoError(): void {
    console.warn('⚠️ Erro ao carregar logo da loja');
    this.storeLogo = '';
  }

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
      this.productService.toggleFavorite(String(this.product.id)).subscribe({
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
