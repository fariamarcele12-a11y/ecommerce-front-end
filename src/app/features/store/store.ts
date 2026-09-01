// src/app/features/store/store.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoreService } from '../../core/services/store.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../../core/services/product.service';
import { AlertService } from '../../core/services/alert.service';
import { Store as StoreModel } from '../../core/models/store.model';
import { Product } from '../../core/models/ProductModel/product.model';
import { ProductCard } from '../../shared/components/product-card/product-card';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './store.html',
  styleUrls: ['./store.scss'],
})
export class Store implements OnInit {
  store: StoreModel | null = null;
  products: Product[] = [];
  loading = true;
  isOwner = false;
  storeId: string | null = null;
  deletingProduct = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storeService: StoreService,
    private authService: AuthService,
    private productService: ProductService,
    private alertService: AlertService,
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
          // 🔥 CORRIGIDO: Converter userId para string
          this.checkOwnership(String(store.userId));
          // 🔥 CORRIGIDO: Converter store.id para string
          this.loadProducts(String(store.id));
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

  loadProducts(storeId: string): void {
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

  checkOwnership(userId: string): void {
    const user = this.authService.getCurrentUser();
    // 🔥 CORRIGIDO: Converter user.id para string para comparação
    this.isOwner = String(user?.id) === userId;
    console.log('👤 É o dono da loja?', this.isOwner);
  }

  /**
   * 🔥 EXCLUIR PRODUTO
   */
  deleteProduct(productId: number, productName: string): void {
    this.alertService.confirm(
      `Excluir "${productName}"?`,
      'Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.',
      'Sim, excluir',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.deletingProduct = true;
        console.log(`🗑️ Excluindo produto ID: ${productId}`);

        this.productService.deleteProduct(productId).subscribe({
          next: () => {
            this.deletingProduct = false;
            console.log('✅ Produto excluído com sucesso');
            this.alertService.success(
              'Produto excluído!',
              'O produto foi removido da sua loja com sucesso.'
            );
            // 🔥 CORRIGIDO: Recarregar a lista de produtos
            if (this.store?.id) {
              this.loadProducts(String(this.store.id));
            }
          },
          error: (error) => {
            this.deletingProduct = false;
            console.error('❌ Erro ao excluir produto:', error);
            this.alertService.error(
              'Erro',
              'Não foi possível excluir o produto. Tente novamente.'
            );
          }
        });
      }
    });
  }

  /**
   * 🔥 Navega para editar produto
   */
  editProduct(productId: number): void {
    if (this.store?.id) {
      this.router.navigate(['/loja', this.store.id, 'produto', productId, 'editar']);
    }
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
      const storeId = String(this.store.id);
      console.log('🔗 Navegando para criar produto com storeId:', storeId);
      this.router.navigate(['/loja', storeId, 'produto/novo']);
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
