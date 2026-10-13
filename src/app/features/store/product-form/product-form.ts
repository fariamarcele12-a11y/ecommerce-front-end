// src/app/features/store/product-form/product-form.ts
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoreService } from '../../../core/services/store.service';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { CategoryService } from '../../../core/services/category.service';
import { ProductService } from '../../../core/services/product.service';
import { CepService, Estado, Cidade } from '../../../core/services/cep.service';
import { Category } from '../../../core/models/category.model';
import { Product } from '../../../core/models/ProductModel/product.model';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './product-form.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrls: ['./product-form.scss'],
})
export class ProductForm implements OnInit {
  storeId = '';
  storeName = '';
  loading = false;
  isEditing = false;
  productId: string | null = null;

  // Upload de imagens
  uploadingImages = false;
  imageUrls: string[] = [];

  // Localização (IBGE)
  states: Estado[] = [];
  cities: Cidade[] = [];
  selectedState = '';
  selectedCity = '';
  loadingStates = false;
  loadingCities = false;

  // Formulário
  product = {
    name: '',
    description: '',
    price: 0,
    oldPrice: 0,
    category: '',
    categorySlug: '',
    condition: 'new' as 'new' | 'used',
    location: '',
    stock: 1,
    freeShipping: false,
  };

  categories: Category[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storeService: StoreService,
    private authService: AuthService,
    private alertService: AlertService,
    private categoryService: CategoryService,
    private productService: ProductService,
    private cepService: CepService,
  ) {}

  ngOnInit(): void {
    this.loadStates();

    this.route.params.subscribe((params) => {
      this.storeId = params['storeId'];
      this.productId = params['id'] ? String(params['id']) : null;
      this.isEditing = !!this.productId;

      if (!this.storeId) {
        this.alertService.error('Erro', 'Loja não encontrada.');
        this.router.navigate(['/home']);
        return;
      }

      this.loadStoreName();
      this.checkStoreOwnership();
      this.loadCategories();

      if (this.isEditing && this.productId) {
        this.loadProductForEdit(this.productId);
      }
    });
  }

  // ============================================================
  // ESTADOS / CIDADES (IBGE)
  // ============================================================
  loadStates(): void {
    this.loadingStates = true;
    this.cepService.buscarEstados().subscribe({
      next: (states) => {
        this.states = states;
        this.loadingStates = false;
      },
      error: () => {
        this.loadingStates = false;
        this.alertService.warning('Erro', 'Não foi possível carregar os estados.');
      },
    });
  }

  onStateChange(): void {
    this.selectedCity = '';
    this.cities = [];
    this.updateLocation();

    if (!this.selectedState) return;

    this.loadingCities = true;
    this.cepService.buscarCidadesPorUF(this.selectedState).subscribe({
      next: (cities) => {
        this.cities = cities;
        this.loadingCities = false;
      },
      error: () => {
        this.loadingCities = false;
        this.alertService.warning('Erro', 'Não foi possível carregar as cidades.');
      },
    });
  }

  onCityChange(): void {
    this.updateLocation();
  }

  private updateLocation(): void {
    if (this.selectedCity && this.selectedState) {
      this.product.location = `${this.selectedCity} - ${this.selectedState}`;
    } else if (this.selectedState) {
      this.product.location = this.selectedState;
    } else {
      this.product.location = '';
    }
  }

  private parseLocation(location: string): void {
    if (!location) return;

    const match = location.match(/^(.+?)\s*-\s*([A-Z]{2})$/);
    if (match) {
      const city = match[1].trim();
      const uf = match[2].trim();

      this.selectedState = uf;

      this.cepService.buscarCidadesPorUF(uf).subscribe({
        next: (cities) => {
          this.cities = cities;
          this.selectedCity = city;
        },
      });
    } else if (location.length === 2) {
      this.selectedState = location;
    }
  }

  // ============================================================
  // CARREGAMENTOS
  // ============================================================
  loadStoreName(): void {
    this.storeService.getStoreById(this.storeId).subscribe({
      next: (store) => {
        if (store) this.storeName = store.storeName;
      },
      error: (error) => console.error('❌ Erro ao buscar loja:', error),
    });
  }

  loadProductForEdit(productId: string): void {
    this.loading = true;

    this.productService.getProductById(productId).subscribe({
      next: (product) => {
        if (product) {
          this.product = {
            name: product.name,
            description: product.description || '',
            price: product.price,
            oldPrice: product.originalPrice || product.oldPrice || 0,
            category: product.category || '',
            categorySlug: '',
            condition: (product.condition as 'new' | 'used') || 'new',
            location: product.location || '',
            stock: product.stock || 1,
            freeShipping: product.freeShipping || false,
          };

          this.parseLocation(product.location || '');

          // Localiza a categoria pelo NOME (o backend retorna apenas o nome)
          const category = this.categories.find((c) => c.name === product.category);
          if (category) this.product.categorySlug = category.slug;

          this.imageUrls =
            product.images && product.images.length > 0 ? [...product.images] : [];
        } else {
          this.alertService.error('Erro', 'Produto não encontrado.');
          this.router.navigate(['/loja', this.storeId]);
        }
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error('❌ Erro ao carregar produto:', error);
        this.alertService.error('Erro', 'Não foi possível carregar os dados.');
        this.router.navigate(['/loja', this.storeId]);
      },
    });
  }

  checkStoreOwnership(): void {
    const user = this.authService.getCurrentUser();

    this.storeService.getStoreById(this.storeId).subscribe({
      next: (store) => {
        if (store && String(store.userId) !== String(user?.id)) {
          this.alertService.error('Acesso negado', 'Você não é o dono desta loja.');
          this.router.navigate(['/loja', this.storeId]);
        }
      },
    });
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories: Category[]) => {
        // 🔥 Filtra apenas as ativas E as que NÃO têm parentId (categorias raiz)
        this.categories = categories.filter((cat) => cat.active && !cat.parentId);

        // Se está editando, tenta casar a categoria do produto com uma da lista
        if (this.isEditing && this.product.category) {
          const category = this.categories.find((c) => c.name === this.product.category);
          if (category) this.product.categorySlug = category.slug;
        }
      },
      error: (err) => {
        console.warn('⚠️ Erro ao carregar categorias, usando fallback local:', err);
        this.categories = this.getDefaultCategories();
      },
    });
  }

  private getDefaultCategories(): Category[] {
    const now = new Date().toISOString();
    return [
      { id: '1', name: 'Eletrônicos', slug: 'eletronicos', active: true, createdAt: now, description: '', icon: 'bi-phone', productCount: 0, subcategories: [], parentId: null },
      { id: '2', name: 'Moda', slug: 'moda', active: true, createdAt: now, description: '', icon: 'bi-bag', productCount: 0, subcategories: [], parentId: null },
      { id: '3', name: 'Casa e Decoração', slug: 'casa-decoracao', active: true, createdAt: now, description: '', icon: 'bi-house', productCount: 0, subcategories: [], parentId: null },
      { id: '4', name: 'Esportes', slug: 'esportes', active: true, createdAt: now, description: '', icon: 'bi-bicycle', productCount: 0, subcategories: [], parentId: null },
      { id: '5', name: 'Automóveis', slug: 'automoveis', active: true, createdAt: now, description: '', icon: 'bi-car-front', productCount: 0, subcategories: [], parentId: null },
      { id: '6', name: 'Imóveis', slug: 'imoveis', active: true, createdAt: now, description: '', icon: 'bi-building', productCount: 0, subcategories: [], parentId: null },
    ];
  }

  // ============================================================
  // 🔥 UPLOAD DE IMAGENS
  // ============================================================
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    if (this.imageUrls.length >= 5) {
      this.alertService.warning('Limite atingido', 'Máximo de 5 imagens.');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.alertService.warning('Imagem muito grande', 'Máximo 5MB.');
      input.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.alertService.warning('Formato inválido', 'Use JPG, PNG ou WEBP.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.uploadImage(base64);
    };
    reader.onerror = () =>
      this.alertService.error('Erro', 'Não foi possível ler o arquivo.');
    reader.readAsDataURL(file);

    input.value = '';
  }

  private uploadImage(base64: string): void {
    this.uploadingImages = true;

    this.productService.uploadProductImage(base64).subscribe({
      next: (res: { imageUrl: string }) => {
        this.uploadingImages = false;
        this.imageUrls.push(res.imageUrl);
        this.alertService.toast('Imagem enviada! 📸', 'success', 2000);
      },
      error: (err: any) => {
        this.uploadingImages = false;
        console.error('❌ Erro ao enviar imagem:', err);
        this.alertService.error('Erro', err?.message || 'Falha ao enviar imagem.');
      },
    });
  }

  removeImage(index: number): void {
    if (index < 0 || index >= this.imageUrls.length) return;
    this.imageUrls.splice(index, 1);
  }

  moveImage(index: number, direction: -1 | 1): void {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.imageUrls.length) return;
    [this.imageUrls[index], this.imageUrls[newIndex]] = [
      this.imageUrls[newIndex],
      this.imageUrls[index],
    ];
  }

  // Aliases para compatibilidade com HTML antigo (input de URL)
  addImageField(): void {
    if (this.imageUrls.length < 5) {
      this.imageUrls.push('');
    }
  }

  removeImageField(index: number): void {
    this.removeImage(index);
  }

  // ============================================================
  // CATEGORIA
  // ============================================================
  onCategorySelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const slug = select.value;
    const category = this.categories.find((c) => c.slug === slug);
    if (category) {
      this.product.category = category.name;
      this.product.categorySlug = slug;
    } else {
      this.product.category = '';
      this.product.categorySlug = '';
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================
  isOnSale(): boolean {
    return this.product.oldPrice > 0 && this.product.oldPrice > this.product.price;
  }

  getDiscountPercentage(): number {
    if (this.isOnSale()) {
      return Math.round(
        ((this.product.oldPrice - this.product.price) / this.product.oldPrice) * 100
      );
    }
    return 0;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  // ============================================================
  // SUBMIT
  // ============================================================
  onSubmit(): void {
    if (!this.validateForm()) return;

    const productData: Partial<Product> = {
      name: this.product.name,
      description: this.product.description,
      price: this.product.price,
      oldPrice: this.isOnSale() ? this.product.oldPrice : undefined,
      category: this.product.category,
      condition: this.product.condition,
      location: this.product.location,
      stock: this.product.stock,
      images: this.imageUrls.filter((u) => u.trim() !== ''),
      freeShipping: this.product.freeShipping,
      storeId: this.storeId,
    };

    this.loading = true;

    if (this.isEditing && this.productId) {
      this.productService.updateProduct(this.productId, productData).subscribe({
        next: () => {
          this.loading = false;
          this.alertService.success('Produto atualizado!', 'Alterações salvas! 🎉');
          this.router.navigate(['/loja', this.storeId]);
        },
        error: (error: any) => {
          this.loading = false;
          this.alertService.error(
            'Erro',
            error?.message || 'Não foi possível atualizar.'
          );
        },
      });
    } else {
      this.storeService.createStoreProduct(this.storeId, productData).subscribe({
        next: () => {
          this.loading = false;
          this.alertService.success('Produto criado!', 'Produto adicionado! 🎉');
          this.router.navigate(['/loja', this.storeId]);
        },
        error: (error: any) => {
          this.loading = false;
          this.alertService.error('Erro', error?.message || 'Não foi possível criar.');
        },
      });
    }
  }

  validateForm(): boolean {
    if (!this.product.name || this.product.name.trim().length < 3) {
      this.alertService.warning('Nome inválido', 'Mínimo 3 caracteres.');
      return false;
    }
    if (!this.product.description || this.product.description.trim().length < 10) {
      this.alertService.warning('Descrição inválida', 'Mínimo 10 caracteres.');
      return false;
    }
    if (!this.product.price || this.product.price <= 0) {
      this.alertService.warning('Preço inválido', 'Informe um preço válido.');
      return false;
    }
    if (this.product.oldPrice > 0 && this.product.oldPrice <= this.product.price) {
      this.alertService.warning('Preço antigo inválido', 'Deve ser maior que o atual.');
      return false;
    }
    if (!this.product.category) {
      this.alertService.warning('Categoria obrigatória', 'Selecione uma categoria.');
      return false;
    }
    if (!this.selectedState) {
      this.alertService.warning('Estado obrigatório', 'Selecione o estado.');
      return false;
    }
    if (!this.selectedCity) {
      this.alertService.warning('Cidade obrigatória', 'Selecione a cidade.');
      return false;
    }
    if (!this.product.stock || this.product.stock < 0) {
      this.alertService.warning('Estoque inválido', 'Informe a quantidade.');
      return false;
    }
    if (this.imageUrls.filter((u) => u.trim() !== '').length === 0) {
      this.alertService.warning('Imagem obrigatória', 'Adicione pelo menos uma imagem.');
      return false;
    }
    return true;
  }

  getCategoryName(slug: string): string {
    const category = this.categories.find((cat) => cat.slug === slug);
    return category ? category.name : slug;
  }
}