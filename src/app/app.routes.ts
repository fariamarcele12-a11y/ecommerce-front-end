import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { ProductDetail } from './features/products/product-detail/product-detail';
import { Cart } from './features/cart/cart';
import { Checkout } from './features/checkout/checkout';

export const routes: Routes = [
  // ============================================
  // ROTAS PRINCIPAIS
  // ============================================
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'produto/:id', component: ProductDetail },
  { path: 'carrinho', component: Cart },
  { path: 'checkout', component: Checkout },

  // ============================================
  // CATEGORIAS
  // ============================================
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

  // ============================================
  // BUSCA
  // ============================================
  {
    path: 'busca',
    loadComponent: () =>
      import('./features/search/search-results/search-results').then((m) => m.SearchResults),
  },

  // ============================================
  // VENDER
  // ============================================
  {
    path: 'vender',
    loadComponent: () => import('./features/vender/vender').then((m) => m.Vender),
  },

  // ============================================
  // FAVORITOS
  // ============================================
  {
    path: 'favoritos',
    loadComponent: () => import('./features/favorites/favorites').then((m) => m.Favorites),
  },

  // ============================================
  // MEUS PEDIDOS
  // ============================================
  {
    path: 'pedidos',
    loadComponent: () => import('./features/orders/my-orders/my-orders').then((m) => m.MyOrders),
  },

  // ============================================
  // HISTÓRICO DE VENDAS
  // ============================================
  {
    path: 'vendas',
    loadComponent: () =>
      import('./features/orders/sales-history/sales-history').then((m) => m.SalesHistory),
  },

  // ============================================
  // DETALHE DO PEDIDO
  // ============================================
  {
    path: 'pedido/:id',
    loadComponent: () =>
      import('./features/orders/order-detail/order-detail').then((m) => m.OrderDetail),
  },

  { 
    path: 'chat',
    loadComponent: () =>
      import('./features/chat/chat').then((m) => m.Chat),
  },

  {
    path: 'loja/:id',
    loadComponent: () =>
      import('./features/store/store').then((m) => m.Store),
  },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.Login),
  },

  {
    path: 'registrar',
    loadComponent: () =>
      import('./features/auth/register/register').then((m) => m.Register),
  },

  // ============================================
  // TERMOS E POLÍTICAS
  // ============================================
  {
    path: 'termos-de-uso',
    loadComponent: () => import('./features/terms/terms').then((m) => m.Terms),
  },
  {
    path: 'politica-de-privacidade',
    loadComponent: () => import('./features/privacy/privacy').then((m) => m.Privacy),
  },

  // ============================================
  // ROTAS FUTURAS (REDIRECIONAM PARA HOME)
  // ============================================
  { path: 'perfil', redirectTo: '/home' },
  { path: 'produtos', redirectTo: '/home' },
  { path: 'sobre', redirectTo: '/home' },
  { path: 'contato', redirectTo: '/home' },

  // ============================================
  // CATCH-ALL - REDIRECIONA PARA HOME
  // ============================================
  { path: '**', redirectTo: '/home' },
];
