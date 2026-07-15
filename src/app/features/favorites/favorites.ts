import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Product } from '../../core/models/ProductModel/product.model';
import { ProductService } from '../../core/services/product.service';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { AlertService } from '../../core/services/alert.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCard],
  templateUrl: './favorites.html',
  styleUrls: ['./favorites.scss'],
})
export class Favorites implements OnInit, OnDestroy {
  products: Product[] = [];
  loading = true;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private productService: ProductService,
    private alertService: AlertService,
     private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadFavorites();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadFavorites(): void {
    this.loading = true;

    this.subscriptions.add(
      this.productService.getFavoriteProducts().subscribe({
        next: (products) => {
          this.products = products;
          this.loading = false;
          console.log(`❤️ ${products.length} produtos favoritos carregados`);
        },
        error: (error) => {
          console.error('❌ Erro ao carregar favoritos:', error);
          this.loading = false;
          this.products = [];
          this.alertService.error(
            'Erro',
            'Não foi possível carregar seus favoritos. Tente novamente.',
          );
        },
      }),
    );
  }

  removeFavorite(productId: number): void {
    this.productService.toggleFavorite(productId).subscribe({
      next: () => {
        this.products = this.products.filter((p) => p.id !== productId);
        this.alertService.toast('Removido dos favoritos! 💔', 'info', 2000);
      },
      error: () => {
        this.alertService.error('Erro', 'Não foi possível remover dos favoritos.');
      },
    });
  }

  onFavoriteToggle(productId: number): void {
    const product = this.products.find((p) => p.id === productId);
    if (product) {
      product.isFavorite = !product.isFavorite;
      if (!product.isFavorite) {
        this.removeFavorite(productId);
      }
    }
  }

  exploreProducts(): void {
    this.router.navigate(['/home']);
  }

  clearAllFavorites(): void {
    if (this.products.length === 0) return;

    this.alertService
      .confirm(
        'Remover todos os favoritos?',
        'Tem certeza que deseja remover todos os produtos dos favoritos?',
        'Sim, remover todos',
        'Cancelar',
      )
      .then((result) => {
        if (result.isConfirmed) {
          const productIds = this.products.map((p) => p.id);
          let removed = 0;

          productIds.forEach((id) => {
            this.productService.toggleFavorite(id).subscribe({
              next: () => {
                removed++;
                if (removed === productIds.length) {
                  this.products = [];
                  this.alertService.success(
                    'Todos removidos!',
                    'Todos os produtos foram removidos dos favoritos.',
                    3000,
                  );
                }
              },
              error: () => {
                this.alertService.error('Erro', 'Não foi possível remover todos os favoritos.');
              },
            });
          });
        }
      });
  }
}
