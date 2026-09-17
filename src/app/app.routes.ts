// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { ProductDetail } from './features/products/product-detail/product-detail';
import { Cart } from './features/cart/cart';
import { Checkout } from './features/checkout/checkout';
import { DebugGuard } from './core/guards/debug.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'produto/:id', component: ProductDetail },
  { path: 'carrinho', component: Cart },
  { path: 'checkout', component: Checkout },
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
  {
    path: 'busca',
    loadComponent: () =>
      import('./features/search/search-results/search-results').then((m) => m.SearchResults),
  },
  {
    path: 'vender',
    loadComponent: () => import('./features/vender/vender').then((m) => m.Vender),
  },
  {
    path: 'favoritos',
    loadComponent: () => import('./features/favorites/favorites').then((m) => m.Favorites),
  },
  {
    path: 'pedidos',
    loadComponent: () => import('./features/orders/my-orders/my-orders').then((m) => m.MyOrders),
  },
  {
    path: 'vendas',
    loadComponent: () =>
      import('./features/orders/sales-history/sales-history').then((m) => m.SalesHistory),
  },
  {
    path: 'pedido/:id',
    loadComponent: () =>
      import('./features/orders/order-detail/order-detail').then((m) => m.OrderDetail),
  },
  {
    path: 'chat',
    loadComponent: () => import('./features/chat/chat').then((m) => m.Chat),
  },
  {
    path: 'loja/:id',
    loadComponent: () => import('./features/store/store').then((m) => m.Store),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'registrar',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },

  {
    path: 'solicitar-redefinicao',
    loadComponent: () =>
      import('./features/auth/request-reset/request-reset').then((m) => m.RequestReset),
  },
  {
    path: 'redefinir-senha',
    loadComponent: () =>
      import('./features/auth/confirm-reset/confirm-reset').then((m) => m.ConfirmReset),
  },
  {
    path: 'criar-loja',
    loadComponent: () =>
      import('./features/store/create-store/create-store').then((m) => m.CreateStore),
  },
  {
    path: 'loja/:storeId/produto/novo',
    canActivate: [DebugGuard],
    loadComponent: () =>
      import('./features/store/product-form/product-form').then((m) => {
        return m.ProductForm;
      }),
  },
  {
    path: 'loja/:storeId/produto/:id/editar',
    canActivate: [DebugGuard],
    loadComponent: () =>
      import('./features/store/product-form/product-form').then((m) => {
        return m.ProductForm;
      }),
  },
  {
    path: 'notificacoes',
    loadComponent: () =>
      import('./features/notifications/notifications').then(
        (m) => m.NotificationsPageComponent
      ),
    title: 'Notificações',
  },
  {
    path: 'perfil',
    loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
  },
  {
    path: 'termos-de-uso',
    loadComponent: () => import('./features/terms/terms').then((m) => m.Terms),
  },
  {
    path: 'politica-de-privacidade',
    loadComponent: () => import('./features/privacy/privacy').then((m) => m.Privacy),
  },
  { path: 'produtos', redirectTo: '/home' },
  { path: 'sobre', redirectTo: '/home' },
  { path: 'contato', redirectTo: '/home' },
  { path: '**', redirectTo: '/home' },
];
