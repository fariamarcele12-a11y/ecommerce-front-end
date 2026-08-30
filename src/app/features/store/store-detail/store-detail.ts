import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StoreService } from '../../../core/services/store.service';
import { AuthService } from '../../../core/services/auth.service';
import { Store } from '../../../core/models/store.model';
import { Product } from '../../../core/models/ProductModel/product.model';

@Component({
  selector: 'app-store-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './store-detail.html',
  styleUrls: ['./store-detail.scss']
})
export class StoreDetailComponent implements OnInit {
  store: Store | null = null;
  products: Product[] = [];
  loading = true;
  isOwner = false;

  constructor(
    private route: ActivatedRoute,
    private storeService: StoreService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const storeId = this.route.snapshot.params['id'];
    if (storeId) {
      this.loadStore(+storeId);
    }
  }

  loadStore(storeId: number): void {
    this.loading = true;
    this.storeService.getStoreById(storeId).subscribe({
      next: (store) => {
        this.store = store;
        if (store) {
          this.loadProducts(store.id);
          this.checkOwnership(store.userId);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar loja:', error);
        this.loading = false;
      }
    });
  }

  loadProducts(storeId: number): void {
    this.storeService.getStoreProducts(storeId).subscribe({
      next: (products) => {
        this.products = products;
      },
      error: (error) => {
        console.error('Erro ao carregar produtos da loja:', error);
      }
    });
  }

  checkOwnership(userId: number): void {
    this.authService.currentUser$.subscribe(user => {
      this.isOwner = user?.id === userId;
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }
}
