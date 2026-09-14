// src/app/shared/components/image-upload/image-upload.ts
import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UploadService } from '../../../core/services/upload.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-upload.html',
  styleUrls: ['./image-upload.scss']
})
export class ImageUpload implements OnInit, OnChanges {
  @Input() type: 'avatar' | 'logo' | 'banner' = 'avatar';
  @Input() currentImage: string = '';
  @Input() placeholder: string = 'https://via.placeholder.com/150';
  @Input() maxSizeMB: number = 5;
  @Input() aspectRatio: string = '1:1';

  @Output() imageUploaded = new EventEmitter<string>();
  @Output() imageRemoved = new EventEmitter<void>();

  previewUrl: string = '';
  selectedFile: File | null = null;
  isDragging = false;
  isProcessing = false;
  errorMessage = '';

  constructor(
    private uploadService: UploadService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.previewUrl = this.currentImage || this.placeholder;
  }

  /**
   * 🔥 Detecta mudanças no currentImage
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentImage']) {
      const newValue = changes['currentImage'].currentValue;
      console.log('🔄 currentImage mudou:', newValue ? 'Sim' : 'Não');
      this.previewUrl = newValue || this.placeholder;
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
    // 🔥 Limpar o input para permitir selecionar o mesmo arquivo novamente
    input.value = '';
  }

  async handleFile(file: File): Promise<void> {
    this.errorMessage = '';

    const validation = this.uploadService.validateFile(file, this.type);
    if (!validation.valid) {
      this.errorMessage = validation.error || 'Arquivo inválido';
      this.alertService.warning('Arquivo inválido', this.errorMessage);
      return;
    }

    this.isProcessing = true;
    this.selectedFile = file;

    try {
      const preview = await this.uploadService.createPreview(file);
      this.previewUrl = preview;

      let processedImage: string;
      switch (this.type) {
        case 'avatar':
          processedImage = await this.uploadService.uploadUserAvatar(file);
          break;
        case 'logo':
          processedImage = await this.uploadService.uploadStoreLogo(file);
          break;
        case 'banner':
          processedImage = await this.uploadService.uploadStoreBanner(file);
          break;
        default:
          processedImage = preview;
      }

      this.isProcessing = false;
      this.previewUrl = processedImage;
      this.imageUploaded.emit(processedImage);
      this.alertService.success('Imagem carregada!', 'A imagem foi processada com sucesso.', 2000);

    } catch (error: any) {
      this.isProcessing = false;
      this.errorMessage = error.message || 'Erro ao processar imagem';
      this.alertService.error('Erro', this.errorMessage);
      this.previewUrl = this.currentImage || this.placeholder;
      this.selectedFile = null;
    }
  }

  /**
   * 🔥 Remove a imagem - CORRIGIDO
   */
  removeImage(event: Event): void {
    // 🔥 Parar propagação para não abrir o seletor
    event.preventDefault();
    event.stopPropagation();

    this.alertService.confirm(
      'Remover imagem?',
      'Tem certeza que deseja remover esta imagem?',
      'Sim, remover',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        console.log('🗑️ Removendo imagem do tipo:', this.type);
        
        // 🔥 Limpar preview e arquivo
        this.previewUrl = this.placeholder;
        this.selectedFile = null;
        this.errorMessage = '';
        
        // 🔥 Emitir evento para o componente pai
        this.imageRemoved.emit();
        
        this.alertService.success('Imagem removida', 'A imagem foi removida com sucesso.', 2000);
      }
    });
  }

  openFileSelector(): void {
    const input = document.getElementById(`file-input-${this.type}`) as HTMLInputElement;
    input?.click();
  }

  getPlaceholderText(): string {
    switch (this.type) {
      case 'avatar':
        return 'Foto de perfil';
      case 'logo':
        return 'Logo da loja';
      case 'banner':
        return 'Banner da loja';
      default:
        return 'Imagem';
    }
  }

  getPlaceholderIcon(): string {
    switch (this.type) {
      case 'avatar':
        return 'bi-person-circle';
      case 'logo':
        return 'bi-shop';
      case 'banner':
        return 'bi-image';
      default:
        return 'bi-image';
    }
  }
}