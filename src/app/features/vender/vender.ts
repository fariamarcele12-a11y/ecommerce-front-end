import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { AlertService } from '../../core/services/alert.service';
import { Category } from '../../core/models/category.model';
import { Product } from '../../core/models/ProductModel/product.model';

@Component({
  selector: 'app-vender',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vender.html',
  styleUrls: ['./vender.scss'],
})
export class Vender implements OnInit {
  // Dados do formulário
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
  loading = false;
  submitted = false;
  imageUrls: string[] = [''];

  // Para upload de imagens
  selectedFiles: (File | null)[] = [null];
  imagePreviews: (string | null)[] = [null];
  isUploading = false;

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private alertService: AlertService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error) => {
        console.error('Erro ao carregar categorias:', error);
        this.alertService.error('Erro', 'Não foi possível carregar as categorias.');
      },
    });
  }

  // ===== MÉTODOS PARA IMAGENS =====

  addImageField(): void {
    if (this.imageUrls.length < 5) {
      this.imageUrls.push('');
      this.selectedFiles.push(null);
      this.imagePreviews.push(null);
    } else {
      this.alertService.warning('Limite de imagens', 'Você pode adicionar no máximo 5 imagens.');
    }
  }

  removeImageField(index: number): void {
    if (this.imageUrls.length > 1) {
      this.imageUrls.splice(index, 1);
      this.selectedFiles.splice(index, 1);
      this.imagePreviews.splice(index, 1);
    } else {
      this.alertService.warning(
        'Imagem obrigatória',
        'O produto precisa ter pelo menos uma imagem.',
      );
    }
  }

  onFileSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        this.alertService.warning(
          'Arquivo inválido',
          'Por favor, selecione uma imagem (JPG, PNG, etc).',
        );
        input.value = '';
        return;
      }

      // Validar tamanho (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.alertService.warning('Arquivo muito grande', 'A imagem deve ter no máximo 5MB.');
        input.value = '';
        return;
      }

      this.selectedFiles[index] = file;

      // Criar preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreviews[index] = e.target?.result as string;
        // Limpar a URL se houver
        this.imageUrls[index] = '';
      };
      reader.readAsDataURL(file);
    }
  }

  removeFile(index: number): void {
    this.selectedFiles[index] = null;
    this.imagePreviews[index] = null;
    this.imageUrls[index] = '';
  }

  getImageSource(index: number): string | null {
    // Prioridade: preview do upload > URL digitada
    if (this.imagePreviews[index]) {
      return this.imagePreviews[index];
    }
    if (this.imageUrls[index] && this.imageUrls[index].trim() !== '') {
      return this.imageUrls[index];
    }
    return null;
  }

  // ===== FIM MÉTODOS PARA IMAGENS =====

  onSubmit(): void {
    this.submitted = true;

    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    this.isUploading = true;

    // Filtrar imagens válidas - REMOVER URLs vazias
    const images: string[] = [];
    this.imageUrls.forEach((url) => {
      if (url && url.trim() !== '' && url.trim() !== 'https://') {
        images.push(url.trim());
      }
    });

    // Adicionar imagens selecionadas (upload)
    const uploadPromises: Promise<string>[] = [];
    this.selectedFiles.forEach((file) => {
      if (file) {
        const promise = new Promise<string>((resolve) => {
          setTimeout(() => {
            const mockUrl = URL.createObjectURL(file);
            resolve(mockUrl);
          }, 500);
        });
        uploadPromises.push(promise);
      }
    });

    // Aguardar todos os uploads
    Promise.all(uploadPromises)
      .then((uploadedUrls) => {
        // Combinar URLs manuais + URLs de upload
        const allImages = [...images, ...uploadedUrls];

        // Se não tiver imagens, usar placeholder
        if (allImages.length === 0) {
          allImages.push('https://via.placeholder.com/300x300/667eea/ffffff?text=Sem+Imagem');
        }

        this.isUploading = false;

        // Preparar dados do produto
        const productData = {
          name: this.product.name.trim(),
          description: this.product.description.trim(),
          price: Number(this.product.price),
          category: this.product.category,
          condition: this.product.condition,
          location: this.product.location.trim(),
          stock: Number(this.product.stock),
          images: allImages, // Garantir que é um array
        };

        // Adicionar oldPrice se for maior que 0
        if (this.product.oldPrice > 0) {
          (productData as any).oldPrice = Number(this.product.oldPrice);
        }

        console.log('📦 Enviando produto simplificado:', JSON.stringify(productData, null, 2));

        this.productService.createProduct(productData).subscribe({
          next: (product) => {
            this.loading = false;
            this.alertService.success(
              'Produto publicado! 🎉',
              `${product.name} foi adicionado com sucesso ao marketplace.`,
              4000,
            );
            this.router.navigate(['/produto', product.id]);
          },
          error: (error) => {
            this.loading = false;
            console.error('❌ Erro ao publicar produto:', error);
            this.alertService.error(
              'Erro ao publicar',
              'Não foi possível publicar seu produto. Verifique os dados e tente novamente.',
            );
          },
        });
      })
      .catch((error) => {
        this.isUploading = false;
        this.loading = false;
        console.error('❌ Erro no upload:', error);
        this.alertService.error('Erro no upload', 'Não foi possível fazer upload das imagens.');
      });
  }

  validateForm(): boolean {
    if (!this.product.name || this.product.name.trim().length < 3) {
      this.alertService.warning(
        'Nome inválido',
        'O nome do produto deve ter pelo menos 3 caracteres.',
      );
      return false;
    }

    if (!this.product.description || this.product.description.trim().length < 10) {
      this.alertService.warning(
        'Descrição inválida',
        'A descrição deve ter pelo menos 10 caracteres.',
      );
      return false;
    }

    if (!this.product.price || this.product.price <= 0) {
      this.alertService.warning('Preço inválido', 'Informe um preço válido maior que zero.');
      return false;
    }

    if (!this.product.category) {
      this.alertService.warning('Categoria obrigatória', 'Selecione uma categoria para o produto.');
      return false;
    }

    if (!this.product.location || this.product.location.trim().length < 3) {
      this.alertService.warning('Localização inválida', 'Informe sua localização (cidade/estado).');
      return false;
    }

    if (!this.product.stock || this.product.stock < 0) {
      this.alertService.warning('Estoque inválido', 'Informe uma quantidade de estoque válida.');
      return false;
    }

    // Validar se tem pelo menos uma imagem (URL ou arquivo)
    const hasImage =
      this.imageUrls.some((url) => url && url.trim() !== '') ||
      this.selectedFiles.some((file) => file !== null);

    if (!hasImage) {
      this.alertService.warning(
        'Imagem obrigatória',
        'Adicione pelo menos uma imagem do produto (URL ou arquivo).',
      );
      return false;
    }

    return true;
  }

  onImageUrlChange(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.imageUrls[index] = input.value;
    // Se adicionar URL, limpar o preview do upload
    if (input.value && input.value.trim() !== '') {
      this.selectedFiles[index] = null;
      this.imagePreviews[index] = null;
    }
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  getCategoryName(slug: string): string {
    const category = this.categories.find((c) => c.slug === slug);
    return category ? category.name : slug;
  }

  /**
   * Retorna a quantidade de imagens válidas (URLs + uploads)
   */
  getValidImageCount(): number {
    const validUrls = this.imageUrls.filter(
      (url) => url && url.trim() !== '' && url.trim() !== 'https://',
    ).length;

    const validFiles = this.selectedFiles.filter((file) => file !== null).length;

    return validUrls + validFiles;
  }
}
