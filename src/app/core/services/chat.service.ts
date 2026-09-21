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
    return this.http.get<Message[]>(`${this.apiUrl}?userId=${id}&_sort=createdAt&_order=desc`).pipe(
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
      }),
    );
  }

  getSellerConversations(sellerId: number | string): Observable<ChatConversation[]> {
    const id = String(sellerId);
    return this.http
      .get<Message[]>(`${this.apiUrl}?sellerId=${id}&_sort=createdAt&_order=desc`)
      .pipe(
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
        }),
      );
  }

  getProductMessages(productId: number | string, userId: number | string): Observable<Message[]> {
    const productIdStr = String(productId);
    const userIdStr = String(userId);
    return this.http
      .get<
        Message[]
      >(`${this.apiUrl}?productId=${productIdStr}&userId=${userIdStr}&_sort=createdAt&_order=asc`)
      .pipe(
        catchError((error) => {
          console.warn('⚠️ Erro ao carregar mensagens do produto:', error);
          return of([]);
        }),
      );
  }

  getProductChat(
    productId: number | string,
    userId: number | string,
    sellerId: number | string,
  ): Observable<Message[]> {
    const productIdStr = String(productId);
    const userIdStr = String(userId);
    const sellerIdStr = String(sellerId);

    return this.http
      .get<
        Message[]
      >(`${this.apiUrl}?productId=${productIdStr}&userId=${userIdStr}&sellerId=${sellerIdStr}&_sort=createdAt&_order=asc`)
      .pipe(
        tap((messages) => {
          messages.forEach((msg) => {
            if (!msg.read && msg.sellerId === sellerId) {
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
   * 🔥 ENVIA MENSAGEM E NOTIFICA O DESTINATÁRIO
   *
   * CORREÇÃO: O spread `...message` agora vem ANTES dos valores validados,
   * garantindo que `userId` e `sellerId` nunca fiquem null.
   */
  sendMessage(message: Partial<Message>): Observable<Message> {
    // 🔥 VALIDAÇÃO: garantir que userId e sellerId nunca sejam null/undefined
    const safeUserId = message.userId != null ? String(message.userId) : '';
    const safeSellerId = message.sellerId != null ? String(message.sellerId) : '';

    // ⚠️ IMPORTANTE: spread PRIMEIRO, depois os valores validados sobrescrevem
    const newMessage: Message = {
      ...message,

      id: this.idGenerator.generateMessageId(),
      productId: String(message.productId || ''),
      productName: message.productName || '',
      sellerId: safeSellerId,
      sellerName: message.sellerName || '',
      userId: safeUserId,
      userName: message.userName || '',
      content: message.content || '',
      createdAt: new Date(),
      read: false,
      isFromSeller: message.isFromSeller || false,
    };

    console.log('📤 Enviando mensagem:', {
      userId: newMessage.userId,
      sellerId: newMessage.sellerId,
      isFromSeller: newMessage.isFromSeller,
      content: newMessage.content?.substring(0, 50),
    });

    return this.http.post<Message>(this.apiUrl, newMessage).pipe(
      tap(() => {
        // 🔥 Atualizar lista de conversas do cliente
        if (newMessage.userId && newMessage.userId !== '') {
          const userId =
            typeof newMessage.userId === 'string'
              ? parseInt(String(newMessage.userId), 10)
              : (newMessage.userId as number);
          if (!isNaN(userId)) {
            this.refreshConversations(userId);
          }
        }

        // 🔥 NOTIFICAR O DESTINATÁRIO
        this.sendNotificationForMessage(newMessage);
      }),
      catchError((error) => {
        console.error('❌ Erro ao enviar mensagem:', error);
        return throwError(() => new Error('Erro ao enviar mensagem.'));
      }),
    );
  }

  /**
   * 🔥 Envia a notificação correta baseada em quem enviou
   */
  private sendNotificationForMessage(message: Message): void {
    const preview = message.content.length > 60
      ? message.content.substring(0, 60) + '...'
      : message.content;

    console.log('🔔 sendNotificationForMessage:', {
      isFromSeller: message.isFromSeller,
      userId: message.userId,
      sellerId: message.sellerId,
    });

    if (message.isFromSeller) {
      // ============================================
      // VENDEDOR enviou → NOTIFICAR o CLIENTE
      // ============================================
      if (!message.userId || message.userId === '' || message.userId === 'null') {
        console.warn('⚠️ Não é possível notificar cliente: userId ausente ou inválido');
        return;
      }

      this.notificationService
        .notifyNewMessageToBuyer(
          String(message.userId),
          String(message.sellerId),
          message.sellerName || 'Vendedor',
          message.productName,
          preview,
          String(message.productId)
        );

      console.log('✅ Cliente notificado sobre resposta do vendedor:', message.userId);

    } else {
      // ============================================
      // CLIENTE enviou → NOTIFICAR o VENDEDOR
      // ============================================
      if (!message.sellerId || message.sellerId === '' || message.sellerId === 'null') {
        console.warn('⚠️ Não é possível notificar vendedor: sellerId ausente ou inválido');
        return;
      }

      this.notificationService
        .notifyNewMessageToSeller(
          String(message.sellerId),
          String(message.userId),
          message.userName || 'Cliente',
          message.productName,
          preview,
          String(message.productId)
        );

      console.log('✅ Vendedor notificado sobre nova mensagem do cliente:', message.sellerId);
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
    const userIdStr = String(userId);
    const sellerIdStr = String(sellerId);

    return this.http
      .get<
        Message[]
      >(`${this.apiUrl}?productId=${productIdStr}&userId=${userIdStr}&sellerId=${sellerIdStr}&read=false`)
      .pipe(
        map((messages) => {
          messages.forEach((msg) => {
            if (!msg.read && msg.sellerId === sellerId) {
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

  private buildConversations(grouped: Map<string, Message[]>): ChatConversation[] {
    const conversations: ChatConversation[] = [];
    grouped.forEach((messages, productId) => {
      const lastMessage = messages[messages.length - 1];
      const firstMessage = messages[0];

      conversations.push({
        productId: productId,
        productName: firstMessage.productName || 'Produto',
        productImage:
          firstMessage.productImage ||
          'https://picsum.photos/seed/' + productId + '/100/100',
        sellerId: String(firstMessage.sellerId || ''),
        sellerName: firstMessage.sellerName || 'Vendedor',
        lastMessage: lastMessage.content,
        lastMessageDate: lastMessage.createdAt,
        unreadCount: messages.filter((m) => !m.read && m.sellerId === firstMessage.sellerId).length,
        messages: messages,
      });
    });
    return conversations;
  }

  private refreshConversations(userId: number | string): void {
    this.getConversations(userId).subscribe();
  }
}
