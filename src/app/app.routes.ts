import { Routes } from '@angular/router';

export const routes: Routes = [
  // Rota principal
  { path: '', redirectTo: '/home', pathMatch: 'full' },

  // Home
  {
    path: 'home',
    loadComponent: () => import('./features/home/home').then(m => m.Home)
  },

  // Detalhe do Produto
  {
    path: 'produto/:id',
    loadComponent: () => import('./features/products/product-detail/product-detail').then(m => m.ProductDetail)
  },

  // Carrinho
  {
    path: 'carrinho',
    loadComponent: () => import('./features/cart/cart').then(m => m.Cart)
  },

  // Checkout
  {
    path: 'checkout',
    loadComponent: () => import('./features/checkout/checkout').then(m => m.Checkout)
  },

  // Categoria (redireciona para home com filtro - implementar depois)
  {
    path: 'categoria/:id',
    loadComponent: () => import('./features/home/home').then(m => m.Home)
  },

  // Qualquer rota não encontrada redireciona para home
  { path: '**', redirectTo: '/home' }
];
