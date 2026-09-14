// src/app/shared/components/image-upload/image-upload.ts
import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
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
export class ImageUpload implements OnInit {
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
   * 🔥 Quando o usuário arrasta um arquivo
   */
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

  /**
   * 🔥 Quando o usuário seleciona um arquivo
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  /**
   * 🔥 Processa o arquivo selecionado
   */
  async handleFile(file: File): Promise<void> {
    this.errorMessage = '';

    // Validar arquivo
    const validation = this.uploadService.validateFile(file, this.type);
    if (!validation.valid) {
      this.errorMessage = validation.error || 'Arquivo inválido';
      this.alertService.warning('Arquivo inválido', this.errorMessage);
      return;
    }

    this.isProcessing = true;
    this.selectedFile = file;

    try {
      // Criar preview
      const preview = await this.uploadService.createPreview(file);
      this.previewUrl = preview;

      // Processar imagem (redimensionar)
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
      this.imageUploaded.emit(processedImage);
      this.alertService.success('Imagem carregada!', 'A imagem foi processada com sucesso.', 2000);

    } catch (error: any) {
      this.isProcessing = false;
      this.errorMessage = error.message || 'Erro ao processar imagem';
      this.alertService.error('Erro', this.errorMessage);
      // Restaurar preview anterior
      this.previewUrl = this.currentImage || this.placeholder;
      this.selectedFile = null;
    }
  }

  /**
   * 🔥 Remove a imagem
   */
  removeImage(): void {
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

  /**
   * 🔥 Abre o seletor de arquivos
   */
  openFileSelector(): void {
    const input = document.getElementById(`file-input-${this.type}`) as HTMLInputElement;
    input?.click();
  }

  /**
   * 🔥 Retorna o texto do placeholder
   */
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

  /**
   * 🔥 Retorna o ícone do placeholder
   */
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
