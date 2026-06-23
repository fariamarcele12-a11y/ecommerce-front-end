import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertOptions } from 'sweetalert2';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'question';

@Injectable({
  providedIn: 'root'
})
export class AlertService {

  /**
   * Alerta de sucesso
   */
  success(title: string, message?: string, timer: number = 3000): Promise<unknown> {
    return Swal.fire({
      icon: 'success',
      title,
      text: message,
      timer,
      showConfirmButton: true,
      confirmButtonColor: '#28a745',
      confirmButtonText: 'OK',
      timerProgressBar: true
    });
  }

  /**
   * Alerta de erro
   */
  error(title: string, message?: string, timer: number = 5000): Promise<any> {
    return Swal.fire({
      icon: 'error',
      title,
      text: message,
      timer,
      showConfirmButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'OK',
      timerProgressBar: true
    });
  }

  /**
   * Alerta de aviso
   */
  warning(title: string, message?: string): Promise<any> {
    return Swal.fire({
      icon: 'warning',
      title,
      text: message,
      showConfirmButton: true,
      confirmButtonColor: '#ffc107',
      confirmButtonText: 'OK',
      cancelButtonText: 'Cancelar',
      showCancelButton: true
    });
  }

  /**
   * Alerta de informação
   */
  info(title: string, message?: string, timer: number = 3000): Promise<any> {
    return Swal.fire({
      icon: 'info',
      title,
      text: message,
      timer,
      showConfirmButton: true,
      confirmButtonColor: '#17a2b8',
      confirmButtonText: 'OK',
      timerProgressBar: true
    });
  }

  /**
   * Alerta de confirmação (sim/não)
   */
  confirm(
    title: string,
    message?: string,
    confirmText: string = 'Sim',
    cancelText: string = 'Não'
  ): Promise<any> {
    return Swal.fire({
      title,
      text: message,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#dc3545',
      confirmButtonText: confirmText,
      cancelButtonText: cancelText
    });
  }

  /**
   * Alerta com input de texto
   */
  prompt(
    title: string,
    message?: string,
    inputPlaceholder: string = 'Digite aqui...'
  ): Promise<any> {
    return Swal.fire({
      title,
      text: message,
      input: 'text',
      inputPlaceholder,
      showCancelButton: true,
      confirmButtonText: 'OK',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) {
          return 'Por favor, digite um valor!';
        }
        return null;
      }
    });
  }

  /**
   * Alerta com select (dropdown)
   */
  select(
    title: string,
    options: { value: string; label: string }[],
    message?: string
  ): Promise<any> {
    const selectOptions = options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');

    return Swal.fire({
      title,
      text: message,
      html: `
        <select id="swal-select" class="form-control">
          <option value="">Selecione...</option>
          ${selectOptions}
        </select>
      `,
      showCancelButton: true,
      confirmButtonText: 'OK',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const select = document.getElementById('swal-select') as HTMLSelectElement;
        if (!select || !select.value) {
          Swal.showValidationMessage('Por favor, selecione uma opção!');
          return null;
        }
        return select.value;
      }
    });
  }

  /**
   * Alerta de loading
   */
  loading(title: string = 'Aguarde...', message?: string): void {
    Swal.fire({
      title,
      text: message,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  /**
   * Fecha o alerta atual
   */
  close(): void {
    Swal.close();
  }

  /**
   * Alerta toast (notificação pequena)
   */
  toast(
    title: string,
    icon: SweetAlertIcon = 'success',
    timer: number = 3000
  ): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      timer,
      showConfirmButton: false,
      timerProgressBar: true
    });
  }

  /**
   * Alerta customizado
   */
  custom(options: SweetAlertOptions): Promise<any> {
    return Swal.fire(options);
  }
}
