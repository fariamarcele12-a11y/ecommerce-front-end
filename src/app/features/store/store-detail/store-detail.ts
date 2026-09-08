// src/app/features/store/store-detail/store-detail.ts
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
      // 🔥 CORRIGIDO: storeId como string
      this.loadStore(String(storeId));
    }
  }

  // 🔥 CORRIGIDO: storeId como string
  loadStore(storeId: string): void {
    this.loading = true;
    this.storeService.getStoreById(storeId).subscribe({
      next: (store) => {
        this.store = store;
        if (store) {
          // 🔥 CORRIGIDO: store.id como string
          this.loadProducts(String(store.id));
          // 🔥 CORRIGIDO: store.userId como string
          this.checkOwnership(String(store.userId));
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar loja:', error);
        this.loading = false;
      }
    });
  }

  // 🔥 CORRIGIDO: storeId como string
  loadProducts(storeId: string): void {
    this.storeService.getStoreProducts(storeId).subscribe({
      next: (products) => {
        this.products = products;
      },
      error: (error) => {
        console.error('Erro ao carregar produtos da loja:', error);
      }
    });
  }

  // 🔥 CORRIGIDO: userId como string
  checkOwnership(userId: string): void {
    this.authService.currentUser$.subscribe(user => {
      this.isOwner = String(user?.id) === userId;
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }
}
