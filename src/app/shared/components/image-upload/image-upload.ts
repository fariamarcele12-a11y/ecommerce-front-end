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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentImage']) {
      const newValue = changes['currentImage'].currentValue;
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

  removeImage(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    this.alertService.confirm(
      'Remover imagem?',
      'Tem certeza que deseja remover esta imagem?',
      'Sim, remover',
      'Cancelar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.previewUrl = this.placeholder;
        this.selectedFile = null;
        this.errorMessage = '';

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
