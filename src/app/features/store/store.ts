// src/app/features/store/store.ts
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoreService } from '../../core/services/store.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { AlertService } from '../../core/services/alert.service';
import { CepService } from '../../core/services/cep.service';
import { Store as StoreModel } from '../../core/models/store.model';
import { Product } from '../../core/models/ProductModel/product.model';
import { ImageUpload } from '../../shared/components/image-upload/image-upload';

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ImageUpload],
  templateUrl: './store.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrls: ['./store.scss'],
})
export class Store implements OnInit {
  store: StoreModel | null = null;
  products: Product[] = [];
  loading = true;
  isOwner = false;
  isVisitor = false;
  storeId: string | null = null;
  deletingProduct = false;

  showEditModal = false;
  saving = false;
  isSearchingCep = false;

  // 🔥 NOVO: flags de upload em andamento
  uploadingLogo = false;
  uploadingBanner = false;

  logoRemoved = false;
  bannerRemoved = false;

  editForm: any = {
    storeName: '',
    description: '',
    category: '',
    logo: '',
    banner: '',
    phone: '',
    email: '',
    website: '',
    socialMedia: {
      instagram: '',
      facebook: '',
      youtube: '',
    },
    address: {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      cep: '',
      country: 'Brasil',
    },
  };

  categories: string[] = [
    'Eletrônicos',
    'Moda',
    'Casa e Decoração',
    'Esportes',
    'Automóveis',
    'Imóveis',
    'Livros',
    'Beleza',
    'Alimentação',
    'Brinquedos',
    'Ferramentas',
    'Saúde',
    'Pet Shop',
    'Papelaria',
    'Outros',
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storeService: StoreService,
    private authService: AuthService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private alertService: AlertService,
    private cepService: CepService,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const id = params['id'];

      if (id) {
        this.storeId = id;
        this.loadStore(id);
      } else {
        this.loadUserStore();
      }
    });
  }

  loadUserStore(): void {
    const user = this.authService.getCurrentUser();
    if (user?.storeId) {
      this.storeId = String(user.storeId);
      this.loadStore(this.storeId);
    } else {
      this.loading = false;
      this.router.navigate(['/criar-loja']);
    }
  }

  loadStore(id: string): void {
    this.loading = true;
    this.storeService.getStoreById(id).subscribe({
      next: (store) => {
        if (store) {
          this.store = store;
          this.checkOwnership(String(store.userId));
          this.loadProducts(String(store.id));
          this.checkVisitor();
        } else {
          this.router.navigate(['/home']);
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/home']);
      },
    });
  }

  loadProducts(storeId: string): void {
    this.storeService.getStoreProducts(storeId).subscribe({
      next: (products) => {
        this.products = products;
      },
      error: (error) => {
        console.error('❌ Erro ao carregar produtos:', error);
      },
    });
  }

  checkOwnership(userId: string): void {
    const user = this.authService.getCurrentUser();
    this.isOwner = String(user?.id) === userId;
  }

  checkVisitor(): void {
    this.isVisitor = !this.isOwner && this.authService.isLoggedIn();
  }

  contactStore(): void {
    if (this.store) {
      this.router.navigate(['/chat'], {
        queryParams: {
          sellerId: this.store.userId,
          sellerName: this.store.storeName,
          store: 'true',
        },
      });
    }
  }

  openEditModal(): void {
    if (!this.store) return;

    this.logoRemoved = false;
    this.bannerRemoved = false;

    this.editForm = {
      storeName: this.store.storeName || '',
      description: this.store.description || '',
      category: this.store.category || '',
      logo: this.store.logo || '',
      banner: this.store.banner || '',
      phone: this.store.phone || '',
      email: this.store.email || '',
      website: this.store.website || '',
      socialMedia: {
        instagram: this.store.socialMedia?.instagram || '',
        facebook: this.store.socialMedia?.facebook || '',
        youtube: this.store.socialMedia?.youtube || '',
      },
      address: {
        street: this.store.address?.street || '',
        number: this.store.address?.number || '',
        complement: this.store.address?.complement || '',
        neighborhood: this.store.address?.neighborhood || '',
        city: this.store.address?.city || '',
        state: this.store.address?.state || '',
        cep: this.store.address?.cep || '',
        country: this.store.address?.country || 'Brasil',
      },
    };
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.logoRemoved = false;
    this.bannerRemoved = false;
  }

  // ============================================================
  // 🔥 LOGO — upload imediato ao Cloudinary via backend
  // ============================================================
  onLogoUploaded(base64: string): void {
    if (!this.storeId) return;

    // Preview local enquanto o upload acontece
    this.editForm.logo = base64;
    this.logoRemoved = false;
    this.uploadingLogo = true;

    this.storeService.uploadStoreLogo(this.storeId, base64).subscribe({
      next: (res) => {
        this.uploadingLogo = false;
        this.editForm.logo = res.logoUrl;

        if (this.store) {
          this.store.logo = res.logoUrl;
        }

        this.alertService.toast('Logo atualizada! 🎨', 'success', 2000);
      },
      error: (err) => {
        this.uploadingLogo = false;
        console.error('❌ Erro ao enviar logo:', err);
        this.alertService.error(
          'Erro',
          err?.error?.message || 'Não foi possível enviar a logo.',
        );
        // Reverte o preview
        this.editForm.logo = this.store?.logo || '';
      },
    });
  }

  onLogoRemoved(): void {
    if (!this.storeId) return;

    this.uploadingLogo = true;

    this.storeService.updateStore(this.storeId, { logo: '' } as any).subscribe({
      next: () => {
        this.uploadingLogo = false;
        this.editForm.logo = '';
        this.logoRemoved = true;
        if (this.store) this.store.logo = '';
        this.alertService.toast('Logo removida.', 'success', 2000);
      },
      error: (err) => {
        this.uploadingLogo = false;
        console.error('❌ Erro ao remover logo:', err);
        this.alertService.error('Erro', 'Não foi possível remover a logo.');
        this.editForm.logo = this.store?.logo || '';
      },
    });
  }

  // ============================================================
  // 🔥 BANNER — upload imediato ao Cloudinary via backend
  // ============================================================
  onBannerUploaded(base64: string): void {
    if (!this.storeId) return;

    this.editForm.banner = base64;
    this.bannerRemoved = false;
    this.uploadingBanner = true;

    this.storeService.uploadStoreBanner(this.storeId, base64).subscribe({
      next: (res) => {
        this.uploadingBanner = false;
        this.editForm.banner = res.bannerUrl;

        if (this.store) {
          this.store.banner = res.bannerUrl;
        }

        this.alertService.toast('Banner atualizado! 🖼️', 'success', 2000);
      },
      error: (err) => {
        this.uploadingBanner = false;
        console.error('❌ Erro ao enviar banner:', err);
        this.alertService.error(
          'Erro',
          err?.error?.message || 'Não foi possível enviar o banner.',
        );
        this.editForm.banner = this.store?.banner || '';
      },
    });
  }

  onBannerRemoved(): void {
    if (!this.storeId) return;

    this.uploadingBanner = true;

    this.storeService.updateStore(this.storeId, { banner: '' } as any).subscribe({
      next: () => {
        this.uploadingBanner = false;
        this.editForm.banner = '';
        this.bannerRemoved = true;
        if (this.store) this.store.banner = '';
        this.alertService.toast('Banner removido.', 'success', 2000);
      },
      error: (err) => {
        this.uploadingBanner = false;
        console.error('❌ Erro ao remover banner:', err);
        this.alertService.error('Erro', 'Não foi possível remover o banner.');
        this.editForm.banner = this.store?.banner || '';
      },
    });
  }

  // ============================================================
  // SALVAR — só campos textuais (logo/banner já foram)
  // ============================================================
  saveStore(): void {
    if (!this.store || !this.storeId) return;

    if (!this.editForm.storeName || this.editForm.storeName.trim().length < 3) {
      this.alertService.warning('Nome inválido', 'Digite o nome da loja.');
      return;
    }

    this.saving = true;

    const updateData: any = {
      storeName: this.editForm.storeName,
      description: this.editForm.description,
      category: this.editForm.category,
      phone: this.editForm.phone,
      email: this.editForm.email,
      website: this.editForm.website,
      socialMedia: this.editForm.socialMedia,
      address: this.editForm.address,
    };

    // ⚠️ NÃO envia logo/banner — já são salvos via uploadStoreLogo/Banner

    this.storeService.updateStore(this.storeId, updateData).subscribe({
      next: (updatedStore) => {
        this.saving = false;
        this.store = updatedStore;
        this.logoRemoved = false;
        this.bannerRemoved = false;
        this.alertService.success(
          'Loja atualizada!',
          'Suas alterações foram salvas com sucesso. 🎉',
        );
        this.closeEditModal();
      },
      error: (error) => {
        this.saving = false;
        console.error('❌ Erro ao atualizar loja:', error);
        this.alertService.error('Erro', 'Não foi possível salvar as alterações.');
      },
    });
  }

  onCepBlur(): void {
    const cep = this.editForm.address.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      this.isSearchingCep = true;
      this.cepService.buscarCep(cep).subscribe({
        next: (endereco) => {
          this.editForm.address.street = endereco.logradouro || '';
          this.editForm.address.neighborhood = endereco.bairro || '';
          this.editForm.address.city = endereco.localidade || '';
          this.editForm.address.state = endereco.uf || '';
          this.isSearchingCep = false;
        },
        error: () => {
          this.isSearchingCep = false;
        },
      });
    }
  }

  formatCep(value: string): string {
    return this.cepService.formatarCep(value);
  }

  formatPhone(value: string): string {
    const numbers = value.replace(/\D/g, '').slice(0, 11);

    if (numbers.length === 0) return '';
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 6) {
      return numbers.replace(/(\d{2})(\d{1,4})/, '($1) $2');
    }
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{1,4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{1,4})/, '($1) $2-$3');
  }

  deleteProduct(productId: string, productName: string, categorySlug: string): void {
    this.alertService
      .confirm(
        `Excluir "${productName}"?`,
        'Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.',
        'Sim, excluir',
        'Cancelar',
      )
      .then((result) => {
        if (result.isConfirmed) {
          this.deletingProduct = true;
          this.productService.deleteProduct(productId).subscribe({
            next: () => {
              this.deletingProduct = false;
              this.updateCategoryProductCount(categorySlug, -1);
              this.alertService.success('Produto excluído!', 'O produto foi removido com sucesso.');
              if (this.store?.id) {
                this.loadProducts(String(this.store.id));
              }
            },
            error: () => {
              this.deletingProduct = false;
              this.alertService.error('Erro', 'Não foi possível excluir o produto.');
            },
          });
        }
      });
  }

  private updateCategoryProductCount(categorySlug: string, increment: number): void {
    if (!categorySlug) return;

    this.categoryService.getCategoryBySlug(categorySlug).subscribe({
      next: (category) => {
        if (category) {
          const newCount = Math.max(0, (category.productCount || 0) + increment);
          this.categoryService.updateCategory(category.id, { productCount: newCount }).subscribe();
        }
      },
    });
  }

  editProduct(productId: string): void {
    if (!this.store?.id || !productId) return;
    const storeId = String(this.store.id);
    this.router.navigate([`/loja/${storeId}/produto/${productId}/editar`]);
  }

  editStore(): void {
    this.openEditModal();
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  }

  formatDate(date: string | Date): string {
    if (!date) return 'Data não disponível';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(dateObj);
  }

  goToCreateProduct(): void {
    if (this.store?.id) {
      const storeId = String(this.store.id);
      this.router.navigate(['/loja', storeId, 'produto', 'novo']);
    }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  onFavoriteToggle(productId: string): void {
    this.productService.toggleFavorite(productId);
    const product = this.products.find((p) => String(p.id) === productId);
    if (product) {
      product.isFavorite = !product.isFavorite;
    }
  }

  getStoreLogo(): string {
    return this.editForm.logo || (this.store as any)?.logo || '';
  }

  getStoreBanner(): string {
    return this.editForm.banner || (this.store as any)?.banner || '';
  }

  hasLogo(): boolean {
    if (this.logoRemoved) return false;
    return !!(this.editForm.logo || (this.store as any)?.logo);
  }

  hasBanner(): boolean {
    if (this.bannerRemoved) return false;
    return !!(this.editForm.banner || (this.store as any)?.banner);
  }

  onLogoError(): void {
    console.warn('⚠️ Erro ao carregar logo');
    if (this.store) {
      (this.store as any).logo = '';
    }
    this.editForm.logo = '';
  }

  onBannerError(): void {
    console.warn('⚠️ Erro ao carregar banner');
    if (this.store) {
      (this.store as any).banner = '';
    }
    this.editForm.banner = '';
  }
}
