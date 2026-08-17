import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Product } from '../../core/models/ProductModel/product.model';
import { ProductService } from '../../core/services/product.service';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { AlertService } from '../../core/services/alert.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCard],
  templateUrl: './store.html',
  styleUrls: ['./store.scss']
})
export class Store implements OnInit, OnDestroy {
  sellerId: number = 0;
  sellerName: string = '';
  products: Product[] = [];
  loading = true;
  totalProducts = 0;
  averageRating = 0;
  totalSales = 0;
  memberSince = '';
  sellerInfo: any = null;

  private routeSub: Subscription = new Subscription();
  private productsSub: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe(params => {
      this.sellerId = +params['id'];
      if (this.sellerId) {
        this.loadStoreData();
      } else {
        this.router.navigate(['/home']);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
    this.productsSub.unsubscribe();
  }

  loadStoreData(): void {
    this.loading = true;
    
    // 🔥 Buscar produtos do vendedor usando sellerId
    this.productsSub = this.productService.getProducts({ 
      sellerId: this.sellerId,
      limit: 100,
      sortBy: 'newest'
    }).subscribe({
      next: (response) => {
        console.log('📦 Produtos da loja:', response);
        this.products = response.products;
        this.totalProducts = response.total;
        
        // 🔥 Verificar se encontrou produtos
        if (this.products.length > 0) {
          // Pegar informações do primeiro produto
          const firstProduct = this.products[0];
          this.sellerInfo = firstProduct.seller;
          this.sellerName = firstProduct.seller.name;
          this.totalSales = this.products.reduce((sum, p) => sum + (p.seller.sales || 0), 0);
          
          // Calcular média de avaliação
          const totalRatings = this.products.reduce((sum, p) => sum + (p.seller.rating || 0), 0);
          this.averageRating = totalRatings / this.products.length;
          
          // Data de criação do primeiro produto
          const firstCreated = this.products.reduce((oldest, p) => 
            new Date(p.createdAt) < new Date(oldest.createdAt) ? p : oldest
          );
          this.memberSince = new Date(firstCreated.createdAt).toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric'
          });
        } else {
          // 🔥 Se não encontrou produtos, tentar buscar informações do vendedor de outra forma
          this.sellerName = `Vendedor #${this.sellerId}`;
          this.totalSales = 0;
          this.averageRating = 0;
          this.memberSince = 'recentemente';
        }
        
        this.loading = false;
        console.log(`🏪 Loja carregada: ${this.sellerName} - ${this.totalProducts} produtos`);
      },
      error: (error) => {
        console.error('❌ Erro ao carregar loja:', error);
        this.loading = false;
        this.alertService.error('Erro', 'Não foi possível carregar a loja.');
        this.router.navigate(['/home']);
      }
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  getStars(rating: number): number[] {
    return Array(5).fill(0).map((_, i) => i < Math.floor(rating) ? 1 : 0);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  onFavoriteToggle(): void {
    this.loadStoreData();
  }
}