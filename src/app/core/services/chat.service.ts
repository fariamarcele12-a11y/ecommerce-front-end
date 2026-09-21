// src/app/core/services/chat.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Message, ChatConversation } from '../models/message.model';
import { IdGeneratorService } from './id-generator.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private apiUrl = 'http://localhost:3000/messages';

  private conversations = new BehaviorSubject<ChatConversation[]>([]);
  private isBrowser: boolean;
  private readonly http = inject(HttpClient);
  private readonly idGenerator = inject(IdGeneratorService);
  private readonly notificationService = inject(NotificationService);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);
  }

  getConversations(userId: number | string): Observable<ChatConversation[]> {
    const id = String(userId);
    return this.http.get<Message[]>(`${this.apiUrl}?userId=${id}`).pipe(
      map((messages) => {
        // 🔥 ORDENAR POR DATA ANTES DE AGRUPAR
        const sorted = this.sortMessagesByDate(messages);
        const grouped = this.groupMessagesByProduct(sorted);
        return this.buildConversations(grouped);
      }),
      tap((conversations) => {
        this.conversations.next(conversations);
      }),
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar conversas, retornando array vazio:', error);
        return of([]);
      }),
    );
  }

  getSellerConversations(sellerId: number | string): Observable<ChatConversation[]> {
    const id = String(sellerId);
    return this.http
      .get<Message[]>(`${this.apiUrl}?sellerId=${id}`)
      .pipe(
        map((messages) => {
          // 🔥 ORDENAR POR DATA ANTES DE AGRUPAR
          const sorted = this.sortMessagesByDate(messages);
          const grouped = this.groupMessagesByProduct(sorted);
          return this.buildConversations(grouped);
        }),
        tap((conversations) => {
          this.conversations.next(conversations);
        }),
        catchError((error) => {
          console.warn('⚠️ Erro ao carregar conversas do vendedor:', error);
          return of([]);
        }),
      );
  }

  getProductMessages(productId: number | string, userId: number | string): Observable<Message[]> {
    const productIdStr = String(productId);
    const userIdStr = String(userId);
    return this.http
      .get<Message[]>(`${this.apiUrl}?productId=${productIdStr}&userId=${userIdStr}`)
      .pipe(
        // 🔥 ORDENAR POR DATA NO CLIENTE (mais confiável que o json-server)
        map((messages) => this.sortMessagesByDate(messages)),
        catchError((error) => {
          console.warn('⚠️ Erro ao carregar mensagens do produto:', error);
          return of([]);
        }),
      );
  }

  /**
   * 🔥 Busca as mensagens de uma conversa específica entre cliente e vendedor
   * E ordena por data de forma GARANTIDA no cliente
   */
  getProductChat(
    productId: number | string,
    userId: number | string,
    sellerId: number | string,
  ): Observable<Message[]> {
    const productIdStr = String(productId);
    const userIdStr = String(userId);
    const sellerIdStr = String(sellerId);

    // 🔥 Buscar TODAS as mensagens do produto (sem filtrar por userId)
    //    e filtrar no cliente — garante que vendedor e cliente vejam a mesma conversa
    return this.http
      .get<Message[]>(`${this.apiUrl}?productId=${productIdStr}`)
      .pipe(
        // 🔥 ORDENAR POR DATA NO CLIENTE
        map((messages) => {
          // Filtrar as mensagens desta conversa específica
          const conversationMessages = messages.filter(msg => {
            // A mensagem pertence a esta conversa se:
            // - o sellerId bate E
            // - (o userId bate OU a mensagem é do vendedor)
            const matchesSeller = String(msg.sellerId) === sellerIdStr;
            return matchesSeller;
          });

          // 🔥 ORDENAR POR DATA CRESCENTE (mais antiga primeiro)
          return this.sortMessagesByDate(conversationMessages);
        }),
        tap((messages) => {
          // Marcar como lidas
          messages.forEach((msg) => {
            if (!msg.read) {
              const msgId = typeof msg.id === 'string' ? parseInt(msg.id, 10) : (msg.id as number);
              if (!isNaN(msgId)) {
                this.markAsRead(msgId).subscribe();
              }
            }
          });
        }),
        catchError((error) => {
          console.warn('⚠️ Erro ao carregar chat do produto:', error);
          return of([]);
        }),
      );
  }

  /**
   * 🔥 ORDENA mensagens por data crescente (mais antiga primeiro)
   * Aceita `createdAt` como string ISO, Date ou timestamp
   */
  private sortMessagesByDate(messages: Message[]): Message[] {
    if (!messages || messages.length === 0) return [];

    return [...messages].sort((a, b) => {
      const dateA = this.parseDate(a.createdAt);
      const dateB = this.parseDate(b.createdAt);

      if (dateA === null && dateB === null) return 0;
      if (dateA === null) return -1;
      if (dateB === null) return 1;

      return dateA - dateB; // Crescente: mais antiga primeiro
    });
  }

  /**
   * 🔥 Converte string/Date para timestamp numérico de forma segura
   */
  private parseDate(date: Date | string | undefined | null): number | null {
    if (!date) return null;

    if (date instanceof Date) {
      const t = date.getTime();
      return isNaN(t) ? null : t;
    }

    if (typeof date === 'string') {
      const t = new Date(date).getTime();
      return isNaN(t) ? null : t;
    }

    return null;
  }

  sendMessage(message: Partial<Message>): Observable<Message> {
    const safeUserId = message.userId != null ? String(message.userId) : '';
    const safeSellerId = message.sellerId != null ? String(message.sellerId) : '';

    const newMessage: Message = {
      ...message,

      id: this.idGenerator.generateMessageId(),
      productId: String(message.productId || ''),
      productName: message.productName || '',
      productImage: message.productImage || '',
      sellerId: safeSellerId,
      sellerName: message.sellerName || '',
      userId: safeUserId,
      userName: message.userName || '',
      content: message.content || '',
      createdAt: new Date().toISOString(),   // 🔥 SEMPRE ISO 8601 com timezone
      read: false,
      isFromSeller: message.isFromSeller || false,
    };

    console.log('📤 Enviando mensagem:', {
      userId: newMessage.userId,
      sellerId: newMessage.sellerId,
      createdAt: newMessage.createdAt,
      isFromSeller: newMessage.isFromSeller,
    });

    return this.http.post<Message>(this.apiUrl, newMessage).pipe(
      tap(() => {
        if (newMessage.userId && newMessage.userId !== '') {
          this.refreshConversations(newMessage.userId);
        }
        this.sendNotificationForMessage(newMessage);
      }),
      catchError((error) => {
        console.error('❌ Erro ao enviar mensagem:', error);
        return throwError(() => new Error('Erro ao enviar mensagem.'));
      }),
    );
  }

  private sendNotificationForMessage(message: Message): void {
    const preview = message.content.length > 60
      ? message.content.substring(0, 60) + '...'
      : message.content;

    if (message.isFromSeller) {
      if (!message.userId || message.userId === '' || message.userId === 'null') {
        console.warn('⚠️ Não é possível notificar cliente: userId ausente ou inválido');
        return;
      }

      this.notificationService.notifyNewMessageToBuyer(
        String(message.userId),
        String(message.sellerId),
        message.sellerName || 'Vendedor',
        message.productName,
        preview,
        String(message.productId)
      );
    } else {
      if (!message.sellerId || message.sellerId === '' || message.sellerId === 'null') {
        console.warn('⚠️ Não é possível notificar vendedor: sellerId ausente ou inválido');
        return;
      }

      this.notificationService.notifyNewMessageToSeller(
        String(message.sellerId),
        String(message.userId),
        message.userName || 'Cliente',
        message.productName,
        preview,
        String(message.productId)
      );
    }
  }

  markAsRead(messageId: number | string): Observable<Message> {
    const id = String(messageId);
    return this.http.patch<Message>(`${this.apiUrl}/${id}`, {
      read: true,
      readAt: new Date().toISOString(),
    }).pipe(
      catchError((error) => {
        console.warn('⚠️ Erro ao marcar mensagem como lida:', error);
        return of({} as Message);
      }),
    );
  }

  markConversationAsRead(
    productId: number | string,
    userId: number | string,
    sellerId: number | string,
  ): Observable<void> {
    const productIdStr = String(productId);
    const sellerIdStr = String(sellerId);

    return this.http
      .get<Message[]>(`${this.apiUrl}?productId=${productIdStr}&sellerId=${sellerIdStr}&read=false`)
      .pipe(
        map((messages) => {
          messages.forEach((msg) => {
            if (!msg.read) {
              const msgId = typeof msg.id === 'string' ? parseInt(msg.id, 10) : (msg.id as number);
              if (!isNaN(msgId)) {
                this.markAsRead(msgId).subscribe();
              }
            }
          });
          return;
        }),
        catchError((error) => {
          console.warn('⚠️ Erro ao marcar conversa como lida:', error);
          return of(undefined);
        }),
      );
  }

  getUnreadCount(userId: number | string): Observable<number> {
    const id = String(userId);
    return this.http.get<Message[]>(`${this.apiUrl}?userId=${id}&read=false`).pipe(
      map((messages) => messages.length),
      catchError((error) => {
        console.warn('⚠️ Erro ao buscar mensagens não lidas:', error);
        return of(0);
      }),
    );
  }

  private groupMessagesByProduct(messages: Message[]): Map<string, Message[]> {
    const grouped = new Map<string, Message[]>();
    messages.forEach((msg) => {
      const key = String(msg.productId);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(msg);
    });
    return grouped;
  }

  /**
   * 🔥 Constrói as conversas ordenando as mensagens por data dentro de cada grupo
   */
  private buildConversations(grouped: Map<string, Message[]>): ChatConversation[] {
    const conversations: ChatConversation[] = [];
    grouped.forEach((messages, productId) => {
      // 🔥 GARANTIR ordenação dentro do grupo
      const sortedMessages = this.sortMessagesByDate(messages);

      const lastMessage = sortedMessages[sortedMessages.length - 1];
      const firstMessage = sortedMessages[0];

      const messageWithImage = sortedMessages.find(
        (m) => m.productImage && m.productImage.trim() !== ''
      );

      const productImage = messageWithImage?.productImage
        || firstMessage.productImage
        || 'https://via.placeholder.com/100x100/667eea/ffffff?text=Produto';

      conversations.push({
        productId: productId,
        productName: firstMessage.productName || 'Produto',
        productImage: productImage,
        sellerId: String(firstMessage.sellerId || ''),
        sellerName: firstMessage.sellerName || 'Vendedor',
        lastMessage: lastMessage.content,
        lastMessageDate: lastMessage.createdAt,
        unreadCount: sortedMessages.filter((m) => !m.read && m.sellerId === firstMessage.sellerId).length,
        messages: sortedMessages,
      });
    });

    // 🔥 ORDENAR as conversas por última mensagem (mais recente primeiro)
    return conversations.sort((a, b) => {
      const dateA = this.parseDate(a.lastMessageDate) || 0;
      const dateB = this.parseDate(b.lastMessageDate) || 0;
      return dateB - dateA; // Decrescente: mais recente primeiro
    });
  }

  private refreshConversations(userId: number | string): void {
    this.getConversations(userId).subscribe();
  }
}
