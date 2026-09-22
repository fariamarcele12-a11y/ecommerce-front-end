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

interface BrazilianState {
  uf: string;
  name: string;
  cities: string[];
}

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
  productId: string | null = null;
  uploadingImages = false;

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
    images: [''],
    freeShipping: false,
  };

  categories: Category[] = [];
  imageUrls: string[] = [''];
  imageFiles: (File | null)[] = [null];

  // Localização - Estados e Cidades
  selectedState: string = '';
  selectedCity: string = '';
  availableCities: string[] = [];

  // Lista de estados brasileiros com algumas cidades principais
  brazilianStates: BrazilianState[] = [
    {
      uf: 'AC', name: 'Acre', cities: ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá', 'Feijó']
    },
    {
      uf: 'AL', name: 'Alagoas', cities: ['Maceió', 'Arapiraca', 'Palmeira dos Índios', 'Rio Largo', 'Penedo']
    },
    {
      uf: 'AP', name: 'Amapá', cities: ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque', 'Mazagão']
    },
    {
      uf: 'AM', name: 'Amazonas', cities: ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari']
    },
    {
      uf: 'BA', name: 'Bahia', cities: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Itabuna', 'Ilhéus', 'Juazeiro', 'Lauro de Freitas', 'Barreiras', 'Porto Seguro']
    },
    {
      uf: 'CE', name: 'Ceará', cities: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato', 'Itapipoca', 'Maranguape', 'Iguatu', 'Quixadá']
    },
    {
      uf: 'DF', name: 'Distrito Federal', cities: ['Brasília', 'Ceilândia', 'Taguatinga', 'Samambaia', 'Planaltina', 'Águas Claras', 'Gama', 'Guará', 'Sobradinho', 'Recanto das Emas']
    },
    {
      uf: 'ES', name: 'Espírito Santo', cities: ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Linhares', 'São Mateus', 'Colatina', 'Guarapari', 'Cachoeiro de Itapemirim', 'Aracruz']
    },
    {
      uf: 'GO', name: 'Goiás', cities: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia', 'Águas Lindas de Goiás', 'Valparaíso de Goiás', 'Trindade', 'Formosa', 'Novo Gama']
    },
    {
      uf: 'MA', name: 'Maranhão', cities: ['São Luís', 'Imperatriz', 'Timon', 'Caxias', 'Codó', 'Paço do Lumiar', 'Açailândia', 'Bacabal', 'Balsas', 'Santa Inês']
    },
    {
      uf: 'MT', name: 'Mato Grosso', cities: ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra', 'Cáceres', 'Sorriso', 'Lucas do Rio Verde', 'Primavera do Leste', 'Barra do Garças']
    },
    {
      uf: 'MS', name: 'Mato Grosso do Sul', cities: ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã', 'Naviraí', 'Nova Andradina', 'Aquidauana', 'Sidrolândia', 'Maracaju']
    },
    {
      uf: 'MG', name: 'Minas Gerais', cities: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Ribeirão das Neves', 'Uberaba', 'Governador Valadares', 'Ipatinga', 'Sete Lagoas', 'Divinópolis', 'Santa Luzia', 'Ibirité', 'Poços de Caldas']
    },
    {
      uf: 'PA', name: 'Pará', cities: ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Castanhal', 'Parauapebas', 'Abaetetuba', 'Cametá', 'Marituba', 'Bragança']
    },
    {
      uf: 'PB', name: 'Paraíba', cities: ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux', 'Sousa', 'Cabedelo', 'Cajazeiras', 'Guarabira', 'Sapé']
    },
    {
      uf: 'PR', name: 'Paraná', cities: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo', 'Guarapuava', 'Paranaguá', 'Araucária', 'Toledo', 'Apucarana', 'Pinhais', 'Campo Largo']
    },
    {
      uf: 'PE', name: 'Pernambuco', cities: ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista', 'Cabo de Santo Agostinho', 'Camaragibe', 'Garanhuns', 'Vitória de Santo Antão']
    },
    {
      uf: 'PI', name: 'Piauí', cities: ['Teresina', 'Parnaíba', 'Picos', 'Floriano', 'Piripiri', 'Campo Maior', 'Barras', 'União', 'Altos', 'Esperantina']
    },
    {
      uf: 'RJ', name: 'Rio de Janeiro', cities: ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói', 'Belford Roxo', 'Campos dos Goytacazes', 'São João de Meriti', 'Petrópolis', 'Volta Redonda', 'Magé', 'Macaé', 'Itaboraí', 'Cabo Frio', 'Angra dos Reis']
    },
    {
      uf: 'RN', name: 'Rio Grande do Norte', cities: ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Macaíba', 'Ceará-Mirim', 'Caicó', 'Assu', 'Currais Novos', 'São José de Mipibu']
    },
    {
      uf: 'RS', name: 'Rio Grande do Sul', cities: ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Rio Grande', 'Alvorada', 'Passo Fundo', 'Sapucaia do Sul', 'Uruguaiana', 'Santa Cruz do Sul']
    },
    {
      uf: 'RO', name: 'Rondônia', cities: ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal', 'Rolim de Moura', 'Jaru', 'Guajará-Mirim', 'Ouro Preto do Oeste', 'Pimenta Bueno']
    },
    {
      uf: 'RR', name: 'Roraima', cities: ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Alto Alegre', 'Mucajaí', 'Cantá', 'Pacaraima', 'Baliza', 'São João da Baliza', 'São Luiz']
    },
    {
      uf: 'SC', name: 'Santa Catarina', cities: ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Criciúma', 'Chapecó', 'Itajaí', 'Jaraguá do Sul', 'Palhoça', 'Lages', 'Balneário Camboriú', 'Brusque', 'Tubarão', 'São Bento do Sul', 'Caçador']
    },
    {
      uf: 'SP', name: 'São Paulo', cities: ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'São José dos Campos', 'Ribeirão Preto', 'Sorocaba', 'Santos', 'Mauá', 'São José do Rio Preto', 'Diadema', 'Jundiaí', 'Carapicuíba', 'Piracicaba', 'Bauru', 'Itaquaquecetuba', 'São Vicente', 'Franca']
    },
    {
      uf: 'SE', name: 'Sergipe', cities: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'São Cristóvão', 'Estância', 'Tobias Barreto', 'Itabaianinha', 'Simão Dias', 'Nossa Senhora da Glória']
    },
    {
      uf: 'TO', name: 'Tocantins', cities: ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins', 'Colinas do Tocantins', 'Guaraí', 'Tocantinópolis', 'Dianópolis', 'Formoso do Araguaia']
    }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storeService: StoreService,
    private authService: AuthService,
    private alertService: AlertService,
    private categoryService: CategoryService,
    private productService: ProductService,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.storeId = params['storeId'];
      this.productId = params['id'] ? String(params['id']) : null;
      this.isEditing = !!this.productId;

      if (!this.storeId) {
        console.error('❌ StoreId não encontrado!');
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

  loadStoreName(): void {
    this.storeService.getStoreById(this.storeId).subscribe({
      next: (store) => {
        if (store) {
          this.storeName = store.storeName;
        }
      },
      error: (error) => {
        console.error('❌ Erro ao buscar nome da loja:', error);
      },
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
            oldPrice: product.oldPrice || 0,
            category: product.category || '',
            categorySlug: '',
            condition: product.condition || 'new',
            location: product.location || '',
            stock: product.stock || 1,
            images: product.images && product.images.length > 0 ? product.images : [''],
            freeShipping: product.freeShipping || false,
          };

          // Parse da localização existente (formato: "Cidade - UF")
          if (product.location) {
            this.parseLocation(product.location);
          }

          const category = this.categories.find(c => c.name === product.category);
          if (category) {
            this.product.categorySlug = category.slug;
          }

          this.imageUrls = product.images && product.images.length > 0 ? [...product.images] : [''];
          this.imageFiles = this.imageUrls.map(() => null);
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

  parseLocation(location: string): void {
    // Formato esperado: "Cidade - UF" ou "Cidade, UF"
    const match = location.match(/^(.+?)\s*[-–,]\s*([A-Z]{2})$/);
    if (match) {
      const city = match[1].trim();
      const uf = match[2].trim();
      
      const state = this.brazilianStates.find(s => s.uf === uf);
      if (state) {
        this.selectedState = uf;
        this.availableCities = state.cities;
        this.selectedCity = city;
      }
    }
  }

  checkStoreOwnership(): void {
    const user = this.authService.getCurrentUser();

    this.storeService.getStoreById(this.storeId).subscribe({
      next: (store) => {
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
    this.categoryService.getCategories().subscribe({
      next: (categories: Category[]) => {
        this.categories = categories.filter((cat) => cat.active);
        if (this.isEditing && this.product.category) {
          const category = this.categories.find(c => c.name === this.product.category);
          if (category) {
            this.product.categorySlug = category.slug;
          }
        }
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

  // ==================== LOCALIZAÇÃO ====================

  onStateChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const uf = select.value;

    this.selectedState = uf;
    this.selectedCity = '';
    this.availableCities = [];

    if (uf) {
      const state = this.brazilianStates.find(s => s.uf === uf);
      if (state) {
        this.availableCities = state.cities;
      }
    }

    this.updateLocation();
  }

  onCityChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedCity = select.value;
    this.updateLocation();
  }

  updateLocation(): void {
    if (this.selectedCity && this.selectedState) {
      this.product.location = `${this.selectedCity} - ${this.selectedState}`;
    } else {
      this.product.location = '';
    }
  }

  // ==================== IMAGENS ====================

  addImageField(): void {
    if (this.imageUrls.length < 5) {
      this.imageUrls.push('');
      this.imageFiles.push(null);
    }
  }

  removeImageField(index: number): void {
    if (this.imageUrls.length > 1) {
      this.imageUrls.splice(index, 1);
      this.imageFiles.splice(index, 1);
    }
  }

  onFileSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        this.alertService.warning('Arquivo inválido', 'Por favor, selecione uma imagem válida.');
        input.value = '';
        return;
      }

      // Validar tamanho (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.alertService.warning('Arquivo muito grande', 'A imagem deve ter no máximo 5MB.');
        input.value = '';
        return;
      }

      this.imageFiles[index] = file;

      // Criar preview da imagem
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imageUrls[index] = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(index: number): void {
    if (this.imageUrls[index] && !this.imageUrls[index].startsWith('data:')) {
      // Se for uma URL existente (edição), apenas limpa
      this.imageUrls[index] = '';
      this.imageFiles[index] = null;
    } else {
      // Se for um preview local, remove
      this.imageUrls[index] = '';
      this.imageFiles[index] = null;
    }
  }

  triggerFileInput(index: number): void {
    const fileInput = document.getElementById(`fileInput${index}`) as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  hasImagePreview(index: number): boolean {
    return !!this.imageUrls[index] && this.imageUrls[index].trim() !== '';
  }

  isDataUrl(url: string): boolean {
    return url.startsWith('data:');
  }

  // ==================== CATEGORIA ====================

  onCategorySelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const slug = select.value;

    const category = this.categories.find(c => c.slug === slug);
    if (category) {
      this.product.category = category.name;
      this.product.categorySlug = slug;
    } else {
      this.product.category = '';
      this.product.categorySlug = '';
    }
  }

  // ==================== PREÇO ====================

  isOnSale(): boolean {
    return this.product.oldPrice > 0 && this.product.oldPrice > this.product.price;
  }

  getDiscountPercentage(): number {
    if (this.isOnSale()) {
      return Math.round(((this.product.oldPrice - this.product.price) / this.product.oldPrice) * 100);
    }
    return 0;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  }

  // ==================== SUBMIT ====================

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    const user = this.authService.getCurrentUser();
    const sellerName = this.storeName || 'Vendedor';
    const userId = user?.id ? String(user.id) : '1';
    const categoryName = this.product.category;
    const oldPrice = this.isOnSale() ? this.product.oldPrice : undefined;

    // Coletar imagens (URLs ou Data URLs)
    const images = this.imageUrls
      .filter((url: string) => url.trim() !== '')
      .map(url => url.trim());

    const productData: Partial<Product> = {
      name: this.product.name,
      description: this.product.description,
      price: this.product.price,
      oldPrice: oldPrice,
      category: categoryName,
      condition: this.product.condition,
      location: this.product.location,
      stock: this.product.stock,
      images: images.length > 0
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

    if (this.isEditing && this.productId) {
      this.productService.updateProduct(this.productId, productData).subscribe({
        next: (product: Product) => {
          this.loading = false;
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
      this.storeService.createStoreProduct(this.storeId, productData).subscribe({
        next: (product: Product) => {
          this.loading = false;
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

  // ==================== VALIDAÇÃO ====================

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
    if (this.product.oldPrice > 0 && this.product.oldPrice <= this.product.price) {
      this.alertService.warning(
        'Preço antigo inválido',
        'O preço antigo deve ser maior que o preço atual para criar uma oferta.'
      );
      return false;
    }
    if (!this.product.category) {
      this.alertService.warning('Categoria obrigatória', 'Selecione uma categoria.');
      return false;
    }
    if (!this.selectedState) {
      this.alertService.warning('Estado obrigatório', 'Selecione um estado.');
      return false;
    }
    if (!this.selectedCity) {
      this.alertService.warning('Cidade obrigatória', 'Selecione uma cidade.');
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

  getStateName(uf: string): string {
    const state = this.brazilianStates.find(s => s.uf === uf);
    return state ? state.name : uf;
  }
}