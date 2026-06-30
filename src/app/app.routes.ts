import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { ProductDetail } from './features/products/product-detail/product-detail';
import { Cart } from './features/cart/cart';
import { Checkout } from './features/checkout/checkout';

export const routes: Routes = [
  // Rotas principais
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'produto/:id', component: ProductDetail },
  { path: 'carrinho', component: Cart },
  { path: 'checkout', component: Checkout },

  // Categorias
  {
    path: 'categoria/:slug',
    loadComponent: () =>
      import('./features/categories/category-detail/category-detail').then((m) => m.CategoryDetail),
  },
  {
    path: 'categorias',
    loadComponent: () =>
      import('./features/categories/categories-list/categories-list').then((m) => m.CategoriesList),
  },

  // Busca
  {
    path: 'busca',
    loadComponent: () =>
      import('./features/search/search-results/search-results').then((m) => m.SearchResults),
  },

  // Rotas futuras (redirecionam para home)
  { path: 'vender', redirectTo: '/home' },
  { path: 'favoritos', redirectTo: '/home' },
  { path: 'perfil', redirectTo: '/home' },
  { path: 'pedidos', redirectTo: '/home' },
  { path: 'produtos', redirectTo: '/home' },
  { path: 'sobre', redirectTo: '/home' },
  { path: 'contato', redirectTo: '/home' },

  // Catch-all - redireciona para home
  { path: '**', redirectTo: '/home' },
];
