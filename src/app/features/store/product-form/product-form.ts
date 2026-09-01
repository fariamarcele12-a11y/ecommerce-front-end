// src/app/features/store/product-form/product-form.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoreService } from '../../../core/services/store.service';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { CategoryService } from '../../../core/services/category.service';
import { ProductService } from '../../../core/services/product.service';
import { Category } from '../../../core/models/category.model';
import { Product } from '../../../core/models/ProductModel/product.model';

console.log('📦 ProductForm MODULE CARREGADO!');

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './product-form.html',
  styleUrls: ['./product-form.scss'],
})
export class ProductForm implements OnInit {
  storeId: string = '';
  storeName: string = '';
  loading = false;
  isEditing = false;
  productId: number | null = null;

  product = {
    name: '',
    description: '',
    price: 0,
    oldPrice: 0,
    category: '',
    condition: 'new' as 'new' | 'used',
    location: '',
    stock: 1,
    images: [''],
    freeShipping: false,
  };

  categories: Category[] = [];
  imageUrls: string[] = [''];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storeService: StoreService,
    private authService: AuthService,
    private alertService: AlertService,
    private categoryService: CategoryService,
    private productService: ProductService, // 🔥 ADICIONADO
  ) {
    console.log('🏗️ ProductForm CONSTRUTOR chamado!');
    console.log('🔍 StoreId recebido no construtor:', this.route.snapshot.params['storeId']);
  }

  ngOnInit(): void {
    console.log('🚀 ProductForm OnInit iniciado!');
    console.log('📋 Parâmetros da rota:', this.route.snapshot.params);
    console.log('📍 URL atual:', this.router.url);

    this.route.params.subscribe((params) => {
      this.storeId = params['storeId'];
      this.productId = params['id'] ? +params['id'] : null;
      this.isEditing = !!this.productId;

      console.log('📝 ProductForm - storeId da URL:', this.storeId);
      console.log('📝 ProductForm - productId:', this.productId);
      console.log('📝 ProductForm - isEditing:', this.isEditing);

      if (!this.storeId) {
        console.error('❌ StoreId não encontrado!');
        this.alertService.error('Erro', 'Loja não encontrada.');
        this.router.navigate(['/home']);
        return;
      }

      // 🔥 Buscar o nome da loja
      this.loadStoreName();

      // 🔥 Se for edição, carregar os dados do produto
      if (this.isEditing && this.productId) {
        this.loadProductForEdit(this.productId);
      }

      // 🔥 Verificar se o usuário é o dono da loja
      this.checkStoreOwnership();

      this.loadCategories();
    });
  }

  /**
   * 🔥 Carrega o nome da loja
   */
  loadStoreName(): void {
    this.storeService.getStoreById(this.storeId).subscribe({
      next: (store) => {
        if (store) {
          this.storeName = store.storeName;
          console.log('🏪 Nome da loja:', this.storeName);
        }
      },
      error: (error) => {
        console.error('❌ Erro ao buscar nome da loja:', error);
      },
    });
  }

  /**
   * 🔥 CARREGA OS DADOS DO PRODUTO PARA EDIÇÃO
   */
  loadProductForEdit(productId: number): void {
    this.loading = true;
    console.log(`🔍 Buscando produto para edição: ${productId}`);

    this.productService.getProductById(productId).subscribe({
      next: (product) => {
        console.log('📦 Produto carregado para edição:', product);

        if (product) {
          // 🔥 Preencher o formulário com os dados do produto
          this.product = {
            name: product.name,
            description: product.description || '',
            price: product.price,
            oldPrice: product.oldPrice || 0,
            category: product.category || '',
            condition: product.condition || 'new',
            location: product.location || '',
            stock: product.stock || 1,
            images: product.images && product.images.length > 0 ? product.images : [''],
            freeShipping: product.freeShipping || false,
          };

          // 🔥 Atualizar as imagens
          this.imageUrls = product.images && product.images.length > 0 ? [...product.images] : [''];

          console.log('✅ Formulário preenchido:', this.product);
        } else {
          console.error('❌ Produto não encontrado');
          this.alertService.error('Erro', 'Produto não encontrado.');
          this.router.navigate(['/loja', this.storeId]);
        }
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error('❌ Erro ao carregar produto:', error);
        this.alertService.error('Erro', 'Não foi possível carregar os dados do produto.');
        this.router.navigate(['/loja', this.storeId]);
      },
    });
  }

  /**
   * 🔥 Verifica se o usuário é o dono da loja
   */
  checkStoreOwnership(): void {
    const user = this.authService.getCurrentUser();
    console.log('👤 Usuário atual:', user);

    this.storeService.getStoreById(this.storeId).subscribe({
      next: (store) => {
        console.log('🏪 Loja:', store);
        if (store && String(store.userId) !== String(user?.id)) {
          console.error('❌ Usuário não é o dono da loja!');
          this.alertService.error('Acesso negado', 'Você não é o dono desta loja.');
          this.router.navigate(['/loja', this.storeId]);
        } else {
          console.log('✅ Usuário é o dono da loja!');
        }
      },
      error: (error) => {
        console.error('❌ Erro ao verificar propriedade:', error);
      },
    });
  }

  loadCategories(): void {
    console.log('📂 Carregando categorias...');
    this.categoryService.getCategories().subscribe({
      next: (categories: Category[]) => {
        this.categories = categories.filter((cat) => cat.active);
        console.log('📦 Categorias carregadas:', this.categories.length);
      },
      error: (error: any) => {
        console.error('❌ Erro ao carregar categorias:', error);
        this.categories = this.getDefaultCategories();
        this.alertService.warning('Categorias padrão', 'Usando categorias locais.');
      },
    });
  }

  private getDefaultCategories(): Category[] {
    const now = new Date().toISOString();
    return [
      {
        id: 1,
        name: 'Eletrônicos',
        slug: 'eletronicos',
        active: true,
        createdAt: now,
        description: 'Produtos eletrônicos e tecnologia',
        icon: 'bi-phone',
        productCount: 0,
      },
      {
        id: 2,
        name: 'Moda',
        slug: 'moda',
        active: true,
        createdAt: now,
        description: 'Roupas, calçados e acessórios',
        icon: 'bi-bag',
        productCount: 0,
      },
      {
        id: 3,
        name: 'Casa e Decoração',
        slug: 'casa-decoracao',
        active: true,
        createdAt: now,
        description: 'Móveis, decoração e utensílios',
        icon: 'bi-house',
        productCount: 0,
      },
      {
        id: 4,
        name: 'Esportes',
        slug: 'esportes',
        active: true,
        createdAt: now,
        description: 'Equipamentos e acessórios esportivos',
        icon: 'bi-bicycle',
        productCount: 0,
      },
      {
        id: 5,
        name: 'Automóveis',
        slug: 'automoveis',
        active: true,
        createdAt: now,
        description: 'Carros, motos e peças',
        icon: 'bi-car-front',
        productCount: 0,
      },
      {
        id: 6,
        name: 'Imóveis',
        slug: 'imoveis',
        active: true,
        createdAt: now,
        description: 'Casas, apartamentos e terrenos',
        icon: 'bi-building',
        productCount: 0,
      },
    ];
  }

  addImageField(): void {
    if (this.imageUrls.length < 5) {
      this.imageUrls.push('');
    }
  }

  removeImageField(index: number): void {
    if (this.imageUrls.length > 1) {
      this.imageUrls.splice(index, 1);
    }
  }

  /**
   * 🔥 Envia o formulário (CRIAÇÃO OU EDIÇÃO)
   */
  // src/app/features/store/product-form/product-form.ts

  /**
   * 🔥 Envia o formulário (CRIAÇÃO OU EDIÇÃO) - COM ATUALIZAÇÃO DE CONTADOR
   */
  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    const images = this.imageUrls.filter((url: string) => url.trim() !== '');
    const user = this.authService.getCurrentUser();
    const sellerName = this.storeName || 'Vendedor';
    const userId = user?.id ? (typeof user.id === 'string' ? parseInt(user.id, 10) : user.id) : 1;

    const productData: Partial<Product> = {
      name: this.product.name,
      description: this.product.description,
      price: this.product.price,
      oldPrice: this.product.oldPrice || undefined,
      category: this.product.category,
      condition: this.product.condition,
      location: this.product.location,
      stock: this.product.stock,
      images:
        images.length > 0
          ? images
          : ['https://via.placeholder.com/300x300/667eea/ffffff?text=Sem+Imagem'],
      freeShipping: this.product.freeShipping,
      seller: {
        id: userId,
        name: sellerName,
        rating: 0,
        sales: 0,
      },
    };

    this.loading = true;
    console.log(`📤 ${this.isEditing ? 'Atualizando' : 'Criando'} produto:`);
    console.log('📦 Dados:', productData);

    if (this.isEditing && this.productId) {
      // 🔥 EDITAR PRODUTO
      this.productService.updateProduct(this.productId, productData).subscribe({
        next: (product: Product) => {
          this.loading = false;
          console.log('✅ Produto atualizado:', product);
          this.alertService.success(
            'Produto atualizado!',
            'O produto foi atualizado com sucesso! 🎉',
          );
          this.router.navigate(['/loja', this.storeId]);
        },
        error: (error: any) => {
          this.loading = false;
          console.error('❌ Erro ao atualizar produto:', error);
          this.alertService.error('Erro', 'Não foi possível atualizar o produto. Tente novamente.');
        },
      });
    } else {
      // 🔥 CRIAR PRODUTO
      this.storeService.createStoreProduct(this.storeId, productData).subscribe({
        next: (product: Product) => {
          this.loading = false;
          console.log('✅ Produto criado:', product);
          console.log('📂 Categoria do produto:', product.category);

          // 🔥 ATUALIZAR O CONTADOR DA CATEGORIA
          this.updateCategoryProductCount(product.category);

          this.alertService.success(
            'Produto criado!',
            'O produto foi adicionado à sua loja com sucesso! 🎉',
          );
          this.router.navigate(['/loja', this.storeId]);
        },
        error: (error: any) => {
          this.loading = false;
          console.error('❌ Erro ao criar produto:', error);
          this.alertService.error('Erro', 'Não foi possível criar o produto. Tente novamente.');
        },
      });
    }
  }

  /**
   * 🔥 ATUALIZA O CONTADOR DE PRODUTOS DA CATEGORIA
   */
  private updateCategoryProductCount(categorySlug: string): void {
    if (!categorySlug) {
      console.warn('⚠️ Categoria não informada, pulando atualização');
      return;
    }

    console.log(`🔄 Atualizando contador da categoria: ${categorySlug}`);

    this.categoryService.getCategoryBySlug(categorySlug).subscribe({
      next: (category) => {
        console.log('📦 Categoria encontrada:', category);

        if (category) {
          const newCount = (category.productCount || 0) + 1;
          console.log(`📊 Novo contador: ${newCount} (era ${category.productCount})`);

          this.categoryService
            .updateCategory(category.id, {
              productCount: newCount,
            })
            .subscribe({
              next: (updated) => {
                console.log(
                  `✅ Categoria "${updated.name}" atualizada para ${updated.productCount} produtos`,
                );
              },
              error: (error) => {
                console.error('❌ Erro ao atualizar contador da categoria:', error);
              },
            });
        } else {
          console.warn(`⚠️ Categoria não encontrada: ${categorySlug}`);
        }
      },
      error: (error) => {
        console.error('❌ Erro ao buscar categoria:', error);
      },
    });
  }

  validateForm(): boolean {
    if (!this.product.name || this.product.name.trim().length < 3) {
      this.alertService.warning('Nome inválido', 'Digite um nome com pelo menos 3 caracteres.');
      return false;
    }
    if (!this.product.description || this.product.description.trim().length < 10) {
      this.alertService.warning(
        'Descrição inválida',
        'Descreva o produto com pelo menos 10 caracteres.',
      );
      return false;
    }
    if (!this.product.price || this.product.price <= 0) {
      this.alertService.warning('Preço inválido', 'Informe um preço válido.');
      return false;
    }
    if (!this.product.category) {
      this.alertService.warning('Categoria obrigatória', 'Selecione uma categoria.');
      return false;
    }
    if (!this.product.location || this.product.location.trim().length < 3) {
      this.alertService.warning('Localização inválida', 'Informe sua localização.');
      return false;
    }
    if (!this.product.stock || this.product.stock < 0) {
      this.alertService.warning('Estoque inválido', 'Informe uma quantidade de estoque.');
      return false;
    }
    const validImages = this.imageUrls.filter((url: string) => url.trim() !== '');
    if (validImages.length === 0) {
      this.alertService.warning('Imagem obrigatória', 'Adicione pelo menos uma imagem do produto.');
      return false;
    }
    return true;
  }

  getCategoryName(slug: string): string {
    const category = this.categories.find((cat) => cat.slug === slug);
    return category ? category.name : slug;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }
}
