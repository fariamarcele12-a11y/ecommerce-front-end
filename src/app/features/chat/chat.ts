// src/app/features/chat/chat.ts
import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from '../../core/services/chat.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatConversation, Message } from '../../core/models/message.model';
import { IdGeneratorService } from '../../core/services/id-generator.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss']
})
export class Chat implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  conversations: ChatConversation[] = [];
  messages: Message[] = [];
  selectedConversation: ChatConversation | null = null;
  newMessage = '';
  loading = true;

  // 🔥 userId é STRING (UUID)
  userId: string = '';
  userName: string = '';
  isSeller = false;

  private productIdParam: string | null = null;
  private sellerIdParam: string | null = null;
  private productNameParam: string | null = null;
  private sellerNameParam: string | null = null;
  private isStoreChat: boolean = false;

  private routeSub: Subscription = new Subscription();
  private chatSub: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private alertService: AlertService,
    private authService: AuthService,
    private idGenerator: IdGeneratorService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.alertService.warning('Login necessário', 'Faça login para acessar o chat.');
      this.router.navigate(['/login']);
      return;
    }

    // 🔥 userId como STRING (UUID)
    this.userId = String(user.id || '');
    this.userName = user.name || 'Usuário';
    this.isSeller = user.hasStore === true;

    console.log('👤 Chat iniciado:', {
      userId: this.userId,
      userName: this.userName,
      isSeller: this.isSeller,
    });

    this.routeSub = this.route.queryParams.subscribe(params => {
      this.productIdParam = params['productId'] || null;
      this.sellerIdParam = params['sellerId'] || null;
      this.productNameParam = params['productName'] || null;
      this.sellerNameParam = params['sellerName'] || null;
      this.isStoreChat = params['store'] === 'true';

      if (this.productIdParam && this.sellerIdParam) {
        this.loadProductChat(this.productIdParam, this.sellerIdParam);
      } else if (this.sellerIdParam && this.isStoreChat) {
        this.loadStoreChat(this.sellerIdParam);
      } else {
        this.loadConversations();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
    this.chatSub.unsubscribe();
  }

  loadConversations(): void {
    this.loading = true;
    const observable = this.isSeller
      ? this.chatService.getSellerConversations(this.userId)
      : this.chatService.getConversations(this.userId);

    this.chatSub = observable.subscribe({
      next: (conversations: ChatConversation[]) => {
        this.conversations = conversations;
        this.loading = false;
      },
      error: (error: Error) => {
        console.error('❌ Erro ao carregar conversas:', error);
        this.loading = false;
        this.conversations = [];
        this.alertService.error('Erro', 'Não foi possível carregar as conversas.');
      }
    });
  }

  loadProductChat(productId: string, sellerId: string): void {
    this.loading = true;
    this.chatService.getProductChat(productId, this.userId, sellerId).subscribe({
      next: (messages: Message[]) => {
        this.messages = messages;
        this.loading = false;

        const productName = this.productNameParam || (messages.length > 0 ? messages[0].productName : 'Produto');
        const sellerName = this.sellerNameParam || (messages.length > 0 ? messages[0].sellerName : 'Vendedor');

        this.selectedConversation = {
          productId: productId,
          productName: productName,
          productImage: 'https://picsum.photos/seed/' + productId + '/100/100',
          sellerId: sellerId,
          sellerName: sellerName,
          lastMessage: messages.length > 0 ? messages[messages.length - 1]?.content || '' : '',
          lastMessageDate: messages.length > 0 ? messages[messages.length - 1]?.createdAt || new Date() : new Date(),
          unreadCount: 0,
          messages: messages || [],
          isStoreChat: false
        };

        this.scrollToBottom();
      },
      error: (error: Error) => {
        console.error('❌ Erro ao carregar mensagens:', error);
        this.loading = false;
        this.messages = [];

        const productName = this.productNameParam || 'Produto';
        const sellerName = this.sellerNameParam || 'Vendedor';

        this.selectedConversation = {
          productId: productId,
          productName: productName,
          productImage: 'https://picsum.photos/seed/' + productId + '/100/100',
          sellerId: sellerId,
          sellerName: sellerName,
          lastMessage: '',
          lastMessageDate: new Date(),
          unreadCount: 0,
          messages: [],
          isStoreChat: false
        };
      }
    });
  }

  loadStoreChat(sellerId: string): void {
    this.loading = true;
    const sellerName = this.sellerNameParam || 'Vendedor';

    this.selectedConversation = {
      productId: '',
      productName: 'Conversa com a Loja',
      productImage: 'https://via.placeholder.com/100x100/667eea/ffffff?text=Loja',
      sellerId: sellerId,
      sellerName: sellerName,
      lastMessage: '',
      lastMessageDate: new Date(),
      unreadCount: 0,
      messages: [],
      isStoreChat: true
    };

    this.messages = [];
    this.loading = false;
    this.scrollToBottom();
  }

  selectConversation(conversation: ChatConversation): void {
    this.selectedConversation = conversation;
    this.messages = conversation.messages || [];

    this.chatService.markConversationAsRead(
      conversation.productId,
      this.userId,
      conversation.sellerId
    ).subscribe({
      next: () => {
        if (this.selectedConversation) {
          this.selectedConversation.unreadCount = 0;
        }
      },
      error: (error) => {
        console.error('❌ Erro ao marcar conversa como lida:', error);
      }
    });

    this.scrollToBottom();
  }

  /**
   * 🔥 ENVIA MENSAGEM COM LÓGICA CORRETA DE DESTINATÁRIOS
   *
   * REGRA IMPORTANTE:
   * - O campo `userId` da mensagem SEMPRE representa o CLIENTE (comprador)
   * - O campo `sellerId` da mensagem SEMPRE representa o VENDEDOR
   *
   * Quando o VENDEDOR responde:
   *   - `userId` = ID do CLIENTE da conversa (não o ID do vendedor logado)
   *   - `sellerId` = ID do VENDEDOR logado
   *   - `isFromSeller` = true
   *
   * Quando o CLIENTE envia:
   *   - `userId` = ID do CLIENTE logado
   *   - `sellerId` = ID do VENDEDOR da conversa
   *   - `isFromSeller` = false
   */
  sendMessage(): void {
    if (!this.newMessage.trim() || !this.selectedConversation) return;

    if (!this.userId) {
      console.error('❌ userId está vazio, não é possível enviar a mensagem');
      this.alertService.error('Erro', 'Você precisa estar logado para enviar mensagens.');
      return;
    }

    const currentUserIdStr = String(this.userId);
    const conversationSellerIdStr = String(this.selectedConversation.sellerId || '');

    // 🔥 O usuário logado é o VENDEDOR desta conversa?
    //    Isso é verdade quando o ID do usuário logado é igual ao sellerId da conversa
    const loggedUserIsSeller = (currentUserIdStr === conversationSellerIdStr) || this.isSeller;

    // 🔥 Determinar os IDs corretos para a mensagem
    let messageUserId: string;
    let messageUserName: string;
    let messageSellerId: string;
    let messageSellerName: string;
    let messageIsFromSeller: boolean;

    if (loggedUserIsSeller) {
      // ============================================
      // VENDEDOR enviando mensagem
      // ============================================
      // userId = ID do CLIENTE da conversa (precisamos descobrir)
      // sellerId = ID do vendedor logado

      // Tentar descobrir o ID do cliente:
      // 1. Se a conversa veio da lista de conversas, tem nos messages
      // 2. Senão, precisamos buscar a partir das mensagens existentes
      let clientIdFromConversation = '';

      // Verificar se já temos o cliente nas mensagens anteriores
      if (this.messages.length > 0) {
        // Buscar a primeira mensagem do cliente (isFromSeller = false)
        const clientMessage = this.messages.find(m => m.isFromSeller === false);
        if (clientMessage?.userId) {
          clientIdFromConversation = String(clientMessage.userId);
        }
      }

      // Se a conversa foi carregada pela lista, pode ter o userId do cliente
      if (!clientIdFromConversation && this.selectedConversation.messages?.length) {
        const clientMessage = this.selectedConversation.messages.find(m => m.isFromSeller === false);
        if (clientMessage?.userId) {
          clientIdFromConversation = String(clientMessage.userId);
        }
      }

      // Se ainda não encontrou, usar o userIdParam da URL (se existir)
      if (!clientIdFromConversation) {
        const userIdParam = this.route.snapshot.queryParams['userId'];
        if (userIdParam && userIdParam !== 'NaN' && userIdParam !== 'null') {
          clientIdFromConversation = String(userIdParam);
        }
      }

      if (!clientIdFromConversation) {
        console.error('❌ Não foi possível identificar o cliente desta conversa');
        this.alertService.error(
          'Erro',
          'Não foi possível identificar o cliente desta conversa. Recarregue a página.'
        );
        return;
      }

      messageUserId = clientIdFromConversation;
      // Tentar pegar o nome do cliente da conversa
      const clientMessage = this.messages.find(m => m.isFromSeller === false);
      messageUserName = clientMessage?.userName || 'Cliente';

      messageSellerId = conversationSellerIdStr;
      messageSellerName = this.selectedConversation.sellerName || this.userName;
      messageIsFromSeller = true;

      console.log('📤 [VENDEDOR] Enviando mensagem:', {
        toClientId: messageUserId,
        fromSellerId: messageSellerId,
        isFromSeller: messageIsFromSeller,
      });

    } else {
      // ============================================
      // CLIENTE enviando mensagem
      // ============================================
      messageUserId = currentUserIdStr;
      messageUserName = this.userName;
      messageSellerId = conversationSellerIdStr;
      messageSellerName = this.selectedConversation.sellerName || '';
      messageIsFromSeller = false;

      console.log('📤 [CLIENTE] Enviando mensagem:', {
        fromClientId: messageUserId,
        toSellerId: messageSellerId,
        isFromSeller: messageIsFromSeller,
      });
    }

    const message: Partial<Message> = {
      productId: String(this.selectedConversation.productId || ''),
      productName: this.selectedConversation.productName || 'Conversa com a Loja',
      sellerId: messageSellerId,
      sellerName: messageSellerName,
      userId: messageUserId,
      userName: messageUserName,
      content: this.newMessage.trim(),
      isFromSeller: messageIsFromSeller,
    };

    const tempMessage: Message = {
      id: 'temp-' + Date.now(),
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
    };

    this.messages.push(tempMessage);
    this.newMessage = '';
    this.scrollToBottom();

    this.chatService.sendMessage(message).subscribe({
      next: (sentMessage: Message) => {
        const index = this.messages.findIndex(m => m.id === tempMessage.id);
        if (index !== -1) {
          this.messages[index] = sentMessage;
        }
        this.loadConversations();
      },
      error: (error: Error) => {
        console.error('❌ Erro ao enviar mensagem:', error);
        const index = this.messages.findIndex(m => m.id === tempMessage.id);
        if (index !== -1) {
          this.messages[index] = {
            ...this.messages[index],
            content: this.messages[index].content + ' ⚠️'
          };
        }
        this.alertService.warning('Aviso', 'Mensagem enviada localmente. Verifique sua conexão.');
      }
    });
  }

  scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const msgDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - msgDate.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 24) {
      return msgDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (hours < 48) {
      return 'Ontem';
    } else {
      return msgDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  isProductChat(): boolean {
    return !!this.selectedConversation?.productId && !this.selectedConversation?.isStoreChat;
  }

  isStoreChatType(): boolean {
    return this.selectedConversation?.isStoreChat === true;
  }

  getProductId(): string {
    return String(this.selectedConversation?.productId || '');
  }

  getSellerId(): string {
    return String(this.selectedConversation?.sellerId || '');
  }
}
