import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Message, ChatConversation } from '../models/message.model';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'https://ecommerce-api-mf.vercel.app/messages';
  private localApiUrl = 'http://localhost:3000/messages';

  private conversations = new BehaviorSubject<ChatConversation[]>([]);
  private isBrowser: boolean;
  private readonly http = inject(HttpClient);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /**
   * Busca todas as conversas do usuário
   */
  getConversations(userId: number): Observable<ChatConversation[]> {
    return this.http.get<Message[]>(`${this.apiUrl}?userId=${userId}&_sort=createdAt&_order=desc`).pipe(
      map((messages) => {
        const grouped = this.groupMessagesByProduct(messages);
        return this.buildConversations(grouped);
      }),
      tap((conversations) => {
        this.conversations.next(conversations);
      }),
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar conversas, retornando array vazio:', error);
        return of([]);
      })
    );
  }

  /**
   * Busca conversas do vendedor
   */
  getSellerConversations(sellerId: number): Observable<ChatConversation[]> {
    return this.http.get<Message[]>(`${this.apiUrl}?sellerId=${sellerId}&_sort=createdAt&_order=desc`).pipe(
      map((messages) => {
        const grouped = this.groupMessagesByProduct(messages);
        return this.buildConversations(grouped);
      }),
      tap((conversations) => {
        this.conversations.next(conversations);
      }),
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar conversas do vendedor:', error);
        return of([]);
      })
    );
  }

  /**
   * Busca mensagens de um produto específico
   */
  getProductMessages(productId: number, userId: number): Observable<Message[]> {
    return this.http.get<Message[]>(
      `${this.apiUrl}?productId=${productId}&userId=${userId}&_sort=createdAt&_order=asc`
    ).pipe(
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar mensagens do produto:', error);
        return of([]);
      })
    );
  }

  /**
   * Busca mensagens entre usuário e vendedor para um produto
   */
  getProductChat(productId: number, userId: number, sellerId: number): Observable<Message[]> {
    return this.http.get<Message[]>(
      `${this.apiUrl}?productId=${productId}&userId=${userId}&sellerId=${sellerId}&_sort=createdAt&_order=asc`
    ).pipe(
      tap((messages) => {
        messages.forEach(msg => {
          if (!msg.read && msg.sellerId === sellerId) {
            this.markAsRead(msg.id).subscribe();
          }
        });
      }),
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar chat do produto:', error);
        return of([]);
      })
    );
  }

  /**
   * Envia uma nova mensagem
   */
  sendMessage(message: Partial<Message>): Observable<Message> {
    const newMessage: Message = {
      id: Date.now(),
      productId: message.productId!,
      productName: message.productName || '',
      sellerId: message.sellerId!,
      sellerName: message.sellerName || '',
      userId: message.userId!,
      userName: message.userName || '',
      content: message.content!,
      createdAt: new Date(),
      read: false,
      isFromSeller: message.isFromSeller || false,
      ...message
    };

    return this.http.post<Message>(this.apiUrl, newMessage).pipe(
      tap(() => {
        if (newMessage.userId) {
          this.refreshConversations(newMessage.userId);
        }
      }),
      catchError((error) => {
        console.error('❌ Erro ao enviar mensagem:', error);
        return throwError(() => new Error('Erro ao enviar mensagem.'));
      })
    );
  }

  /**
   * Marca uma mensagem como lida
   */
  markAsRead(messageId: number): Observable<Message> {
    return this.http.patch<Message>(`${this.apiUrl}/${messageId}`, { read: true }).pipe(
      catchError((error) => {
        console.warn('⚠️ Erro ao marcar mensagem como lida:', error);
        return of({} as Message);
      })
    );
  }

  /**
   * Marca todas as mensagens de uma conversa como lidas
   */
  markConversationAsRead(productId: number, userId: number, sellerId: number): Observable<void> {
    return this.http.get<Message[]>(
      `${this.apiUrl}?productId=${productId}&userId=${userId}&sellerId=${sellerId}&read=false`
    ).pipe(
      map((messages) => {
        messages.forEach(msg => {
          if (!msg.read && msg.sellerId === sellerId) {
            this.markAsRead(msg.id).subscribe();
          }
        });
        return;
      }),
      catchError((error) => {
        console.warn('⚠️ Erro ao marcar conversa como lida:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Obtém o número de mensagens não lidas
   */
  getUnreadCount(userId: number): Observable<number> {
    return this.http.get<Message[]>(`${this.apiUrl}?userId=${userId}&read=false`).pipe(
      map((messages) => messages.length),
      catchError((error) => {
        console.warn('⚠️ Erro ao buscar mensagens não lidas:', error);
        return of(0);
      })
    );
  }

  /**
   * Agrupa mensagens por produto
   */
  private groupMessagesByProduct(messages: Message[]): Map<number, Message[]> {
    const grouped = new Map<number, Message[]>();
    messages.forEach(msg => {
      if (!grouped.has(msg.productId)) {
        grouped.set(msg.productId, []);
      }
      grouped.get(msg.productId)!.push(msg);
    });
    return grouped;
  }

  /**
   * Constrói objetos de conversa a partir das mensagens agrupadas
   */
  private buildConversations(grouped: Map<number, Message[]>): ChatConversation[] {
    const conversations: ChatConversation[] = [];
    grouped.forEach((messages, productId) => {
      const lastMessage = messages[messages.length - 1];
      const firstMessage = messages[0];

      conversations.push({
        productId: productId,
        productName: firstMessage.productName || 'Produto',
        productImage: 'https://picsum.photos/seed/' + productId + '/100/100',
        sellerId: firstMessage.sellerId,
        sellerName: firstMessage.sellerName || 'Vendedor',
        lastMessage: lastMessage.content,
        lastMessageDate: lastMessage.createdAt,
        unreadCount: messages.filter(m => !m.read && m.sellerId === firstMessage.sellerId).length,
        messages: messages
      });
    });
    return conversations;
  }

  /**
   * Atualiza as conversas
   */
  private refreshConversations(userId: number): void {
    this.getConversations(userId).subscribe();
  }
}
