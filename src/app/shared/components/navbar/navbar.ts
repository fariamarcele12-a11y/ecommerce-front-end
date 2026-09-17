// src/app/shared/components/navbar/navbar.ts
import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../../core/services/product.service';
import { AuthService } from '../../../core/services/auth.service';
import { StoreService } from '../../../core/services/store.service';
import { CartService } from '../../../core/services/cart.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SearchBar } from '../search-bar/search-bar';
import { Subscription } from 'rxjs';
import { Store } from '../../../core/models/store.model';
import { User } from '../../../core/models/user.model';
import { Notification } from '../../../core/models/notification.model';

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
  userAvatar = '';
  hasStore = false;
  storeId: string | null = null;

  notifications: Notification[] = [];
  unreadCount = 0;
  showNotifications = false;

  private cartSubscription: Subscription = new Subscription();
  private favoritesSubscription: Subscription = new Subscription();
  private userSubscription: Subscription = new Subscription();
  private storeSubscription: Subscription = new Subscription();
  private notificationsSubscription: Subscription = new Subscription();
  private unreadCountSubscription: Subscription = new Subscription();

  private readonly notificationService = inject(NotificationService);

  constructor(
    private cartService: CartService,
    private productService: ProductService,
    private authService: AuthService,
    private storeService: StoreService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cartSubscription = this.cartService.getTotalItems().subscribe((total: number) => {
      this.cartCount = total;
    });

    this.favoritesSubscription = this.productService.favorites$.subscribe((favorites: any[]) => {
      this.favoritesCount = favorites.length;
    });

    this.notificationsSubscription = this.notificationService.notifications$.subscribe(
      (notifications) => {
        this.notifications = notifications;
      }
    );

    this.unreadCountSubscription = this.notificationService.unreadCount$.subscribe(
      (count) => {
        this.unreadCount = count;
      }
    );

    this.userSubscription = this.authService.currentUser$.subscribe((user: User | null) => {
      this.isLoggedIn = !!user;
      this.userName = user?.name || '';
      this.userAvatar = (user as any)?.avatar || '';

      if (this.isLoggedIn && user?.id) {
        this.checkUserStore(user.id);
        this.notificationService.loadNotifications(true);
      } else {
        this.hasStore = false;
        this.storeId = null;
        this.userAvatar = '';
        this.notifications = [];
        this.unreadCount = 0;
      }
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('click', this.onDocumentClick.bind(this));
    }
  }

  ngOnDestroy(): void {
    this.cartSubscription?.unsubscribe();
    this.favoritesSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
    this.storeSubscription?.unsubscribe();
    this.notificationsSubscription?.unsubscribe();
    this.unreadCountSubscription?.unsubscribe();

    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.onDocumentClick.bind(this));
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }

  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notifications-dropdown')) {
      this.showNotifications = false;
    }
  }

  toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.showNotifications = !this.showNotifications;

    if (this.showNotifications) {
      this.notificationService.loadNotifications(true);
    }
  }

  onNotificationClick(notification: Notification, event: Event): void {
    event.stopPropagation();

    if (!notification.read) {
      this.notificationService.markAsRead(notification.id).subscribe();
    }

    this.showNotifications = false;

    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  markAllAsRead(event: Event): void {
    event.stopPropagation();
    this.notificationService.markAllAsRead();
  }

  deleteNotification(notificationId: string, event: Event): void {
    event.stopPropagation();
    this.notificationService.deleteNotification(notificationId).subscribe();
  }

  clearAllNotifications(event: Event): void {
    event.stopPropagation();
    this.notificationService.clearAll();
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'message': return 'bi-chat-dots-fill';
      case 'order': return 'bi-box-seam-fill';
      case 'sale': return 'bi-cash-coin';
      case 'review': return 'bi-star-fill';
      case 'system': return 'bi-info-circle-fill';
      default: return 'bi-bell-fill';
    }
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'message': return 'text-primary';
      case 'order': return 'text-info';
      case 'sale': return 'text-success';
      case 'review': return 'text-warning';
      case 'system': return 'text-secondary';
      default: return 'text-primary';
    }
  }

  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin}min`;
    if (diffHour < 24) return `${diffHour}h`;
    if (diffDay < 7) return `${diffDay}d`;

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  onSearch(searchTerm: string): void {
    if (searchTerm.trim()) {
      this.router.navigate(['/busca'], { queryParams: { q: searchTerm } });
    }
  }

  logout(): void {
    this.notificationService.clearLocal();

    this.authService.logout();
    this.hasStore = false;
    this.storeId = null;
    this.userAvatar = '';
    this.notifications = [];
    this.unreadCount = 0;
    this.router.navigate(['/home']);
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  }

  onAvatarError(): void {
    console.warn('⚠️ Erro ao carregar avatar, removendo...');
    this.userAvatar = '';
  }

  private checkUserStore(userId: number | string): void {
    if (this.storeSubscription) {
      this.storeSubscription.unsubscribe();
    }

    this.storeSubscription = this.storeService.getStoreByUser(userId).subscribe({
      next: (store: Store | null) => {
        if (store) {
          this.hasStore = true;
          this.storeId = String(store.id);
        } else {
          this.hasStore = false;
          this.storeId = null;
        }
      },
      error: () => {
        this.hasStore = false;
        this.storeId = null;
      }
    });
  }
}
