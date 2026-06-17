import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { ProductDetail } from './features/products/product-detail/product-detail';
import { Cart } from './features/cart/cart';
import { Checkout } from './features/checkout/checkout';

export const routes: Routes = [
  // Rota principal
  { path: '', redirectTo: '/home', pathMatch: 'full' },

  // Home
  { path: 'home', component: Home },

  // Detalhe do Produto
  { path: 'produto/:id', component: ProductDetail },

  // Carrinho
  { path: 'carrinho', component: Cart },

  // Checkout
  { path: 'checkout', component: Checkout },

  // Categoria (redireciona para home com filtro - implementar depois)
  { path: 'categoria/:id', component: Home },

  // Vender (feature futura)
  { path: 'vender', redirectTo: '/home' },

  // Favoritos (feature futura)
  { path: 'favoritos', redirectTo: '/home' },

  // Perfil (feature futura)
  { path: 'perfil', redirectTo: '/home' },

  // Pedidos (feature futura)
  { path: 'pedidos', redirectTo: '/home' },

  // Produtos (lista geral - opcional)
  { path: 'produtos', redirectTo: '/home' },

  // Sobre (opcional)
  { path: 'sobre', redirectTo: '/home' },

  // Contato (opcional)
  { path: 'contato', redirectTo: '/home' },

  // Qualquer rota não encontrada redireciona para home
  { path: '**', redirectTo: '/home' }
];
