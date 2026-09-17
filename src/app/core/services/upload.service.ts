// src/app/core/services/upload.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, catchError, map, tap } from 'rxjs';
import { AlertService } from './alert.service';

export interface UploadResponse {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

export interface UploadProgress {
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  url?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private readonly http = inject(HttpClient);
  private readonly alertService = inject(AlertService);

  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  private readonly MAX_DIMENSION = 1200; // pixels

  validateFile(file: File, type: 'avatar' | 'logo' | 'banner' = 'avatar'): { valid: boolean; error?: string } {
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'Formato de arquivo não suportado. Use JPG, PNG, WEBP ou GIF.'
      };
    }

    const maxSize = type === 'banner' ? 10 * 1024 * 1024 : this.MAX_FILE_SIZE; // Banner: 10MB
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      return {
        valid: false,
        error: `Arquivo muito grande. Tamanho máximo: ${maxMB}MB.`
      };
    }

    return { valid: true };
  }

  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }

  async resizeAndConvertToBase64(file: File, maxWidth: number = 800, maxHeight: number = 800): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;

        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const base64 = canvas.toDataURL('image/jpeg', 0.85); // Qualidade 85%
            resolve(base64);
          } else {
            reject(new Error('Erro ao processar imagem'));
          }
        };

        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      };

      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    });
  }

  async uploadUserAvatar(file: File): Promise<string> {
    const validation = this.validateFile(file, 'avatar');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    try {
      const base64 = await this.resizeAndConvertToBase64(file, 400, 400);
      return base64;
    } catch (error) {
      console.error('❌ Erro ao processar avatar:', error);
      throw new Error('Erro ao processar a imagem. Tente novamente.', { cause: error });
    }
  }

  async uploadStoreLogo(file: File): Promise<string> {
    const validation = this.validateFile(file, 'logo');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    try {
      const base64 = await this.resizeAndConvertToBase64(file, 400, 400);
      return base64;
    } catch (error) {
      console.error('❌ Erro ao processar logo:', error);
      throw new Error('Erro ao processar a imagem. Tente novamente.', { cause: error });
    }
  }

  async uploadStoreBanner(file: File): Promise<string> {
    const validation = this.validateFile(file, 'banner');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    try {
      const base64 = await this.resizeAndConvertToBase64(file, 1200, 400);
      return base64;
    } catch (error) {
      console.error('❌ Erro ao processar banner:', error);
      throw new Error('Erro ao processar a imagem. Tente novamente.', { cause: error });
    }
  }

  uploadFile(file: File, endpoint: string): Observable<UploadProgress> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<UploadResponse>(endpoint, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map((event) => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            const progress = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
            return { progress, status: 'uploading' as const };
          case HttpEventType.Response:
            return {
              progress: 100,
              status: 'completed' as const,
              url: event.body?.url
            };
          default:
            return { progress: 0, status: 'uploading' as const };
        }
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erro no upload:', error);
        return throwError(() => new Error('Erro ao fazer upload da imagem.'));
      })
    );
  }

  getFileExtension(filename: string): string {
    return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  createPreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }

  deleteImage(url: string): Observable<void> {
    // Se for Base64, não precisa deletar
    if (url.startsWith('data:')) {
      return new Observable(observer => {
        observer.next();
        observer.complete();
      });
    }

    return this.http.delete<void>(`/api/upload/${url}`).pipe(
      catchError((error) => {
        console.error('❌ Erro ao deletar imagem:', error);
        return throwError(() => new Error('Erro ao deletar imagem.'));
      })
    );
  }
}
