import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';

export interface Endereco {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CepService {
  private readonly apiUrl = 'https://viacep.com.br/ws';

  constructor(private http: HttpClient) {}

  /**
   * Busca endereço pelo CEP usando a API ViaCEP
   */
  buscarCep(cep: string): Observable<Endereco> {
    // Remove caracteres não numéricos
    const cepLimpo = cep.replace(/\D/g, '');

    // Valida se o CEP tem 8 dígitos
    if (cepLimpo.length !== 8) {
      return throwError(() => new Error('CEP inválido. Deve conter 8 dígitos.'));
    }

    return this.http.get<Endereco>(`${this.apiUrl}/${cepLimpo}/json/`).pipe(
      timeout(10000), // Timeout de 10 segundos
      map((response) => {
        // Verifica se o CEP foi encontrado
        if (response.erro) {
          throw new Error('CEP não encontrado');
        }
        return response;
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar CEP:', error);
        return throwError(() => new Error('Erro ao buscar CEP. Tente novamente.'));
      })
    );
  }

  /**
   * Formata o CEP para exibição
   */
  formatarCep(cep: string): string {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length <= 5) return cepLimpo;
    return cepLimpo.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
  }

  /**
   * Valida se o CEP é válido (apenas números e 8 dígitos)
   */
  validarCep(cep: string): boolean {
    const cepLimpo = cep.replace(/\D/g, '');
    return cepLimpo.length === 8;
  }
}
