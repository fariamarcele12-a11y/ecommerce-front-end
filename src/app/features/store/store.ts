// src/app/features/store/store.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoreService } from '../../core/services/store.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../../core/services/product.service';
import { Store as StoreModel } from '../../core/models/store.model';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { Product } from '../../core/models/ProductModel/product.model';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCard],
  templateUrl: './store.html',
  styleUrls: ['./store.scss'],
})
export class Store implements OnInit {
  store: StoreModel | null = null;
  products: Product[] = [];
  loading = true;
  isOwner = false;
  storeId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storeService: StoreService,
    private authService: AuthService,
    private productService: ProductService,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const id = params['id'];
      console.log('🔍 ID da loja na rota:', id);

      if (id) {
        this.storeId = id;
        this.loadStore(id);
      } else {
        this.loadUserStore();
      }
    });
  }

  loadUserStore(): void {
    const user = this.authService.getCurrentUser();
    console.log('👤 Usuário atual:', user);

    if (user?.storeId) {
      this.storeId = String(user.storeId);
      this.loadStore(this.storeId);
    } else {
      this.loading = false;
      console.log('❌ Usuário não tem loja, redirecionando para criar');
      this.router.navigate(['/criar-loja']);
    }
  }

  loadStore(id: string): void {
    this.loading = true;
    console.log(`🔍 Buscando loja com ID: ${id}`);

    this.storeService.getStoreById(id).subscribe({
      next: (store) => {
        console.log('📦 Resposta da loja:', store);

        if (store) {
          this.store = store;
          this.checkOwnership(store.userId);
          this.loadProducts(store.id);
        } else {
          console.log('❌ Loja não encontrada');
          this.router.navigate(['/home']);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Erro ao carregar loja:', error);
        this.loading = false;
        this.router.navigate(['/home']);
      },
    });
  }

  loadProducts(storeId: number): void {
    console.log(`🔍 Buscando produtos da loja ${storeId}`);
    this.storeService.getStoreProducts(storeId).subscribe({
      next: (products) => {
        console.log(`📦 ${products.length} produtos encontrados`);
        this.products = products;
      },
      error: (error) => {
        console.error('❌ Erro ao carregar produtos:', error);
      },
    });
  }

  checkOwnership(userId: number): void {
    const user = this.authService.getCurrentUser();
    this.isOwner = user?.id === userId;
    console.log('👤 É o dono da loja?', this.isOwner);
  }

  /**
   * 🔥 Retorna as iniciais do nome da loja
   */
  getInitials(name: string): string {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * 🔥 Formata uma data para exibição
   */
  formatDate(date: string | Date): string {
    if (!date) return 'Data não disponível';

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(dateObj);
  }

  goToCreateProduct(): void {
    if (this.store?.id) {
      const storeId = this.store.id;
      console.log('🔗 Navegando para criar produto com storeId:', storeId);
      this.router.navigate([`/loja/${storeId}/produto/novo`]);
    } else {
      console.error('❌ ID da loja não disponível');
    }
  }

  testNavigate(): void {
    if (this.store?.id) {
      const storeId = String(this.store.id);
      console.log('🧪 TESTE: Navegando para /loja/' + storeId + '/produto/novo');
      this.router.navigate(['/loja', storeId, 'produto/novo']);
    }
  }

  /**
   * 🔥 Formata preço para exibição
   */
  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  /**
   * 🔥 Alterna favorito do produto
   */
  onFavoriteToggle(productId: number): void {
    console.log('⭐ Toggle favorito para produto:', productId);
    this.productService.toggleFavorite(productId);
    const product = this.products.find((p) => p.id === productId);
    if (product) {
      product.isFavorite = !product.isFavorite;
    }
  }
}
