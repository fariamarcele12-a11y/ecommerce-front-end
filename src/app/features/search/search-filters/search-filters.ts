// src/app/features/search/search-filters/search-filters.ts
import { Component, EventEmitter, Output, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models/category.model';
import { ProductFilters } from '../../../core/models/ProductModel/product-filters.model';

@Component({
  selector: 'app-search-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-filters.html',
  styleUrls: ['./search-filters.scss']
})
export class SearchFilters implements OnInit, OnChanges {
  @Input() filters: ProductFilters = {};
  @Output() filtersChange = new EventEmitter<ProductFilters>();
  @Output() clearFilters = new EventEmitter<void>();

  categories: Category[] = [];
  minPrice: number = 0;
  maxPrice: number = 10000;
  priceRange: number[] = [0, 10000];

  // 🔥 Estado e Cidade
  selectedState: string = '';
  selectedCity: string = '';
  availableCities: string[] = [];

  sortOptions = [
    { value: 'newest', label: 'Mais recentes' },
    { value: 'popular', label: 'Mais populares' },
    { value: 'price_asc', label: 'Menor preço' },
    { value: 'price_desc', label: 'Maior preço' }
  ];

  conditionOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'new', label: 'Novo' },
    { value: 'used', label: 'Usado' }
  ];

  states: { uf: string; name: string }[] = [
    { uf: 'AC', name: 'Acre' },
    { uf: 'AL', name: 'Alagoas' },
    { uf: 'AP', name: 'Amapá' },
    { uf: 'AM', name: 'Amazonas' },
    { uf: 'BA', name: 'Bahia' },
    { uf: 'CE', name: 'Ceará' },
    { uf: 'DF', name: 'Distrito Federal' },
    { uf: 'ES', name: 'Espírito Santo' },
    { uf: 'GO', name: 'Goiás' },
    { uf: 'MA', name: 'Maranhão' },
    { uf: 'MT', name: 'Mato Grosso' },
    { uf: 'MS', name: 'Mato Grosso do Sul' },
    { uf: 'MG', name: 'Minas Gerais' },
    { uf: 'PA', name: 'Pará' },
    { uf: 'PB', name: 'Paraíba' },
    { uf: 'PR', name: 'Paraná' },
    { uf: 'PE', name: 'Pernambuco' },
    { uf: 'PI', name: 'Piauí' },
    { uf: 'RJ', name: 'Rio de Janeiro' },
    { uf: 'RN', name: 'Rio Grande do Norte' },
    { uf: 'RS', name: 'Rio Grande do Sul' },
    { uf: 'RO', name: 'Rondônia' },
    { uf: 'RR', name: 'Roraima' },
    { uf: 'SC', name: 'Santa Catarina' },
    { uf: 'SP', name: 'São Paulo' },
    { uf: 'SE', name: 'Sergipe' },
    { uf: 'TO', name: 'Tocantins' },
  ];

  citiesByState: { [key: string]: string[] } = {
    AC: ['Rio Branco', 'Cruzeiro do Sul', 'Sena Madureira', 'Tarauacá'],
    AL: ['Maceió', 'Arapiraca', 'Palmeira dos Índios', 'Rio Largo'],
    AP: ['Macapá', 'Santana', 'Laranjal do Jari', 'Oiapoque'],
    AM: ['Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari'],
    BA: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Itabuna', 'Ilhéus', 'Porto Seguro'],
    CE: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral', 'Crato'],
    DF: ['Brasília', 'Ceilândia', 'Taguatinga', 'Samambaia', 'Águas Claras'],
    ES: ['Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Linhares', 'Guarapari'],
    GO: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Luziânia'],
    MA: ['São Luís', 'Imperatriz', 'Timon', 'Caxias', 'Codó'],
    MT: ['Cuiabá', 'Várzea Grande', 'Rondonópolis', 'Sinop', 'Tangará da Serra'],
    MS: ['Campo Grande', 'Dourados', 'Três Lagoas', 'Corumbá', 'Ponta Porã'],
    MG: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim', 'Montes Claros', 'Uberaba', 'Governador Valadares', 'Ipatinga', 'Divinópolis'],
    PA: ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Castanhal', 'Parauapebas'],
    PB: ['João Pessoa', 'Campina Grande', 'Santa Rita', 'Patos', 'Bayeux'],
    PR: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'Foz do Iguaçu', 'São José dos Pinhais'],
    PE: ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina', 'Paulista'],
    PI: ['Teresina', 'Parnaíba', 'Picos', 'Piripiri', 'Floriano'],
    RJ: ['Rio de Janeiro', 'Niterói', 'Nova Iguaçu', 'Duque de Caxias', 'Campos dos Goytacazes', 'Macaé', 'São Gonçalo', 'Belford Roxo', 'Petrópolis', 'Volta Redonda', 'Cabo Frio'],
    RN: ['Natal', 'Mossoró', 'Parnamirim', 'São Gonçalo do Amarante', 'Caicó'],
    RS: ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria', 'Gravataí', 'Novo Hamburgo', 'São Leopoldo', 'Rio Grande', 'Passo Fundo'],
    RO: ['Porto Velho', 'Ji-Paraná', 'Ariquemes', 'Vilhena', 'Cacoal'],
    RR: ['Boa Vista', 'Rorainópolis', 'Caracaraí', 'Mucajaí'],
    SC: ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Criciúma', 'Chapecó', 'Itajaí', 'Jaraguá do Sul', 'Palhoça', 'Balneário Camboriú'],
    SP: ['São Paulo', 'Campinas', 'Guarulhos', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'Ribeirão Preto', 'Santos', 'Sorocaba', 'São José dos Campos', 'Mauá', 'Diadema', 'Jundiaí', 'Piracicaba', 'Bauru'],
    SE: ['Aracaju', 'Nossa Senhora do Socorro', 'Lagarto', 'Itabaiana', 'Estância'],
    TO: ['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins'],
  };

  constructor(private categoryService: CategoryService) {}

  ngOnInit(): void {
    this.loadCategories();
    this.initializeFilters();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters'] && !changes['filters'].firstChange) {
      this.syncFilters();
    }
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        console.log('📂 Categorias carregadas:', categories.length);
      },
      error: (error) => {
        console.error('❌ Erro ao carregar categorias:', error);
      }
    });
  }

  initializeFilters(): void {
    this.filters = {
      sortBy: 'newest',
      hasDiscount: false,
      freeShipping: false,
      inStock: false,
      ...this.filters
    };
    this.priceRange = [this.filters.minPrice || 0, this.filters.maxPrice || 10000];
    this.selectedState = this.filters.state || '';
    this.selectedCity = this.filters.city || '';

    if (this.selectedState) {
      this.availableCities = [...(this.citiesByState[this.selectedState] || [])];
      this.availableCities.sort((a, b) => a.localeCompare(b));
    }

    console.log('🔧 Filtros inicializados:', this.filters);
  }

  syncFilters(): void {
    this.priceRange = [this.filters.minPrice || 0, this.filters.maxPrice || 10000];
    this.selectedState = this.filters.state || '';
    this.selectedCity = this.filters.city || '';

    if (this.selectedState) {
      this.availableCities = [...(this.citiesByState[this.selectedState] || [])];
      this.availableCities.sort((a, b) => a.localeCompare(b));
    }
  }

  onFilterChange(): void {
    this.filters = {
      ...this.filters,
      minPrice: this.priceRange[0],
      maxPrice: this.priceRange[1]
    };
    console.log('💰 Filtro de preço alterado:', this.filters);
    this.filtersChange.emit(this.filters);
  }

  /**
   * 🔥 Categoria alterada - emite o SLUG
   */
  onCategoryChange(slug: string): void {
    console.log('📂 Categoria alterada (slug):', slug);

    if (slug) {
      this.filters.category = slug;
    } else {
      delete this.filters.category;
    }

    this.filtersChange.emit(this.filters);
  }

  onSortChange(sortBy: string): void {
    this.filters.sortBy = sortBy as ProductFilters['sortBy'];
    console.log('📊 Ordenação alterada:', sortBy);
    this.filtersChange.emit(this.filters);
  }

  onConditionChange(condition: string): void {
    if (condition === 'all') {
      delete this.filters.condition;
    } else {
      this.filters.condition = condition as 'new' | 'used';
    }
    console.log('🏷️ Condição alterada para:', this.filters.condition);
    this.filtersChange.emit(this.filters);
  }

  onHasDiscountChange(hasDiscount: boolean): void {
    this.filters.hasDiscount = hasDiscount;
    console.log('🏷️ Promoção alterada:', hasDiscount);
    this.filtersChange.emit(this.filters);
  }

  onFreeShippingChange(freeShipping: boolean): void {
    this.filters.freeShipping = freeShipping;
    console.log('🚚 Frete grátis alterado:', freeShipping);
    this.filtersChange.emit(this.filters);
  }

  onInStockChange(inStock: boolean): void {
    this.filters.inStock = inStock;
    console.log('📦 Estoque alterado:', inStock);
    this.filtersChange.emit(this.filters);
  }

  onStateChange(): void {
    this.selectedCity = '';

    if (this.selectedState) {
      this.availableCities = [...(this.citiesByState[this.selectedState] || [])];
      this.availableCities.sort((a, b) => a.localeCompare(b));
    } else {
      this.availableCities = [];
    }

    this.applyLocationFilter();
  }

  onCityChange(): void {
    this.applyLocationFilter();
  }

  private applyLocationFilter(): void {
    this.filters = {
      ...this.filters,
      state: this.selectedState || undefined,
      city: this.selectedCity || undefined
    };

    console.log('📍 Filtro de localização:', {
      state: this.selectedState,
      city: this.selectedCity
    });

    this.filtersChange.emit(this.filters);
  }

  clearLocationFilter(): void {
    this.selectedState = '';
    this.selectedCity = '';
    this.availableCities = [];

    this.filters = {
      ...this.filters,
      state: undefined,
      city: undefined
    };

    this.filtersChange.emit(this.filters);
  }

  clearAllFilters(): void {
    this.priceRange = [0, 10000];
    this.selectedState = '';
    this.selectedCity = '';
    this.availableCities = [];

    this.filters = {
      sortBy: 'newest',
      hasDiscount: false,
      freeShipping: false,
      inStock: false
    };

    console.log('🧹 Filtros limpos');
    this.clearFilters.emit();
    this.filtersChange.emit(this.filters);
  }

  getActiveFiltersCount(): number {
    let count = 0;
    if (this.filters.category) count++;
    if (this.filters.minPrice && this.filters.minPrice > 0) count++;
    if (this.filters.maxPrice && this.filters.maxPrice < 10000) count++;
    if (this.filters.condition) count++;
    if (this.filters.hasDiscount) count++;
    if (this.filters.freeShipping) count++;
    if (this.filters.inStock) count++;
    if (this.filters.search) count++;
    if (this.selectedState) count++;
    if (this.selectedCity) count++;
    return count;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }
}
