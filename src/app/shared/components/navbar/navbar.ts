import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService } from '../../../core/services/cart.service';
import { SearchBar } from '../search-bar/search-bar';
import { Subscription } from 'rxjs';

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

  private cartSubscription: Subscription = new Subscription();

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cartSubscription = this.cartService.getTotalItems().subscribe(total => {
      this.cartCount = total;
    });

    // Carregar favoritos do localStorage
    const favoritesData = localStorage.getItem('favorites');
    if (favoritesData) {
      try {
        const favorites = JSON.parse(favoritesData);
        this.favoritesCount = favorites.length;
      } catch (error) {
        console.error('Erro ao carregar favoritos:', error);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
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
}
