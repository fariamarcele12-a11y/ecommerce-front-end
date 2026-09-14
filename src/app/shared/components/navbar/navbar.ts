// src/app/shared/components/navbar/navbar.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../../core/services/product.service';
import { AuthService } from '../../../core/services/auth.service';
import { StoreService } from '../../../core/services/store.service';
import { SearchBar } from '../search-bar/search-bar';
import { Subscription } from 'rxjs';
import { Store } from '../../../core/models/store.model';
import { CartService } from '../../../core/services/cart.service';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchBar],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss']
})
export class Navbar implements OnInit, OnDestroy {
  cartCount = 0;
  favoritesCount = 0;
  isLoggedIn = false;
  isScrolled = false;
  userName = '';
  userAvatar = ''; // 🔥 NOVO: Avatar do usuário
  hasStore = false;
  storeId: string | null = null;

  private cartSubscription: Subscription = new Subscription();
  private favoritesSubscription: Subscription = new Subscription();
  private userSubscription: Subscription = new Subscription();
  private storeSubscription: Subscription = new Subscription();

  constructor(
    private cartService: CartService,
    private productService: ProductService,
    private authService: AuthService,
    private storeService: StoreService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Carrinho
    this.cartSubscription = this.cartService.getTotalItems().subscribe((total: number) => {
      this.cartCount = total;
    });

    // Favoritos
    this.favoritesSubscription = this.productService.favorites$.subscribe((favorites: any[]) => {
      this.favoritesCount = favorites.length;
    });

    // Usuário
    this.userSubscription = this.authService.currentUser$.subscribe((user: User | null) => {
      this.isLoggedIn = !!user;
      this.userName = user?.name || '';
      this.userAvatar = (user as any)?.avatar || ''; // 🔥 Carregar avatar

      console.log('👤 Usuário logado:', user);
      console.log('📸 Avatar:', this.userAvatar ? 'Sim' : 'Não');
      console.log('📦 hasStore no user:', user?.hasStore);
      console.log('🆔 storeId no user:', user?.storeId);

      if (this.isLoggedIn && user?.id) {
        this.checkUserStore(user.id);
      } else {
        this.hasStore = false;
        this.storeId = null;
        this.userAvatar = '';
      }
    });
  }

  ngOnDestroy(): void {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
    if (this.favoritesSubscription) {
      this.favoritesSubscription.unsubscribe();
    }
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.storeSubscription) {
      this.storeSubscription.unsubscribe();
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }

  onSearch(searchTerm: string): void {
    if (searchTerm.trim()) {
      this.router.navigate(['/busca'], {
        queryParams: { q: searchTerm }
      });
    }
  }

  logout(): void {
    this.authService.logout();
    this.hasStore = false;
    this.storeId = null;
    this.userAvatar = '';
    this.router.navigate(['/home']);
  }

  /**
   * 🔥 Obtém as iniciais do nome para o avatar
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
   * 🔥 Remove o avatar em caso de erro
   */
  onAvatarError(): void {
    console.warn('⚠️ Erro ao carregar avatar, removendo...');
    this.userAvatar = '';
  }

  /**
   * Verifica se o usuário possui uma loja
   */
  private checkUserStore(userId: number | string): void {
    if (this.storeSubscription) {
      this.storeSubscription.unsubscribe();
    }

    console.log('🔍 Verificando loja para userId:', userId);

    this.storeSubscription = this.storeService.getStoreByUser(userId).subscribe({
      next: (store: Store | null) => {
        console.log('📦 Resposta da loja:', store);

        if (store) {
          this.hasStore = true;
          this.storeId = String(store.id);
          console.log('🏪 Loja encontrada:', store.storeName);
          console.log('🆔 storeId (string):', this.storeId);
        } else {
          this.hasStore = false;
          this.storeId = null;
          console.log('ℹ️ Usuário não possui loja');
        }
      },
      error: (error: any) => {
        console.error('❌ Erro ao verificar loja do usuário:', error);
        this.hasStore = false;
        this.storeId = null;
      }
    });
  }
}
