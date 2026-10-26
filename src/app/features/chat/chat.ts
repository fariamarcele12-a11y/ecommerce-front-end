// src/app/features/chat/chat.ts
import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from '../../core/services/chat.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../../core/services/product.service';
import { ChatConversation, Message } from '../../core/models/message.model';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrls: ['./chat.scss'],
})
export class Chat implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  conversations: ChatConversation[] = [];
  messages: Message[] = [];
  selectedConversation: ChatConversation | null = null;
  newMessage = '';
  loading = true;

  userId: string = '';
  userName: string = '';
  isSeller = false;

  private productIdParam: string | null = null;
  private sellerIdParam: string | null = null;
  private productNameParam: string | null = null;
  private sellerNameParam: string | null = null;
  private productImageParam: string | null = null;
  private isStoreChat: boolean = false;

  private productImageCache = new Map<string, string>();

  private routeSub: Subscription = new Subscription();
  private chatSub: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private alertService: AlertService,
    private authService: AuthService,
    private productService: ProductService,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.alertService.warning('Login necessário', 'Faça login para acessar o chat.');
      this.router.navigate(['/login']);
      return;
    }

    this.userId = String(user.id || '');
    this.userName = user.name || 'Usuário';
    this.isSeller = user.hasStore === true;

    this.routeSub = this.route.queryParams.subscribe((params) => {
      this.productIdParam = params['productId'] || null;
      this.sellerIdParam = params['sellerId'] || null;
      this.productNameParam = params['productName'] || null;
      this.sellerNameParam = params['sellerName'] || null;
      this.productImageParam = params['productImage'] || null;
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

  // 🔥 Busca todas as conversas (comprador + vendedor)
  loadConversations(): void {
    this.loading = true;
    
    this.chatSub = this.chatService.getAllConversations(this.userId, this.isSeller).subscribe({
      next: (conversations: ChatConversation[]) => {
        this.conversations = conversations;
        this.loading = false;

        this.conversations.forEach((conv) => {
          if (!conv.productImage || conv.productImage.includes('placeholder')) {
            this.enrichConversationWithProductImage(conv);
          }
        });
      },
      error: (error: Error) => {
        console.error('❌ Erro ao carregar conversas:', error);
        this.loading = false;
        this.conversations = [];
        this.alertService.error('Erro', 'Não foi possível carregar as conversas.');
      },
    });
  }

  private enrichConversationWithProductImage(conversation: ChatConversation): void {
    const productId = conversation.productId;
    if (!productId || productId === '00000000-0000-0000-0000-000000000000') return;

    if (this.productImageCache.has(productId)) {
      conversation.productImage = this.productImageCache.get(productId)!;
      return;
    }

    this.productService.getProductById(productId).subscribe({
      next: (product) => {
        if (product?.images && product.images.length > 0) {
          const image = product.images[0];
          this.productImageCache.set(productId, image);
          conversation.productImage = image;
        }
      },
      error: (err) => {
        console.warn('⚠️ Não foi possível buscar imagem do produto', productId, err);
      },
    });
  }

  loadProductChat(productId: string, sellerId: string): void {
    this.loading = true;
    this.chatService.getProductChat(productId, this.userId, sellerId).subscribe({
      next: (messages: Message[]) => {
        this.messages = messages;
        this.loading = false;

        const productName =
          this.productNameParam || (messages.length > 0 ? messages[0].productName : 'Produto');
        const sellerName =
          this.sellerNameParam || (messages.length > 0 ? messages[0].sellerName : 'Vendedor');

        const imageFromMessages = messages.find((m) => m.productImage)?.productImage;
        const productImage =
          this.productImageParam ||
          imageFromMessages ||
          'https://via.placeholder.com/100x100/667eea/ffffff?text=Produto';

        // Descobre o buyerId a partir das mensagens
        const firstClientMsg = messages.find(m => !m.isFromSeller);
        const buyerId = firstClientMsg ? String(firstClientMsg.userId) : '';
        const buyerName = firstClientMsg ? firstClientMsg.userName : '';

        this.selectedConversation = {
          productId: productId,
          productName: productName,
          productImage: productImage,
          sellerId: sellerId,
          sellerName: sellerName,
          buyerId: buyerId,
          buyerName: buyerName,
          lastMessage: messages.length > 0 ? messages[messages.length - 1]?.content || '' : '',
          lastMessageDate:
            messages.length > 0
              ? messages[messages.length - 1]?.createdAt || new Date()
              : new Date(),
          unreadCount: 0,
          messages: messages || [],
          isStoreChat: false,
        };

        if (!this.productImageParam && !imageFromMessages) {
          this.enrichConversationWithProductImage(this.selectedConversation);
        }

        this.scrollToBottom();
      },
      error: (error: Error) => {
        console.error('❌ Erro ao carregar mensagens:', error);
        this.loading = false;
        this.messages = [];

        this.selectedConversation = {
          productId: productId,
          productName: this.productNameParam || 'Produto',
          productImage: this.productImageParam || 'https://via.placeholder.com/100x100/667eea/ffffff?text=Produto',
          sellerId: sellerId,
          sellerName: this.sellerNameParam || 'Vendedor',
          lastMessage: '',
          lastMessageDate: new Date(),
          unreadCount: 0,
          messages: [],
          isStoreChat: false,
        };
      },
    });
  }

  // 🔥 CORRIGIDO: carrega a conversa da loja usando GUID vazio
  loadStoreChat(sellerId: string): void {
    this.loading = true;
    const sellerName = this.sellerNameParam || 'Vendedor';
    const emptyProductId = '00000000-0000-0000-0000-000000000000';

    this.chatService.getProductChat(emptyProductId, this.userId, sellerId).subscribe({
      next: (messages: Message[]) => {
        this.messages = messages;
        this.loading = false;

        // Descobre o buyerId a partir das mensagens
        const firstClientMsg = messages.find(m => !m.isFromSeller);
        const buyerId = firstClientMsg ? String(firstClientMsg.userId) : '';
        const buyerName = firstClientMsg ? firstClientMsg.userName : '';

        this.selectedConversation = {
          productId: emptyProductId,
          productName: 'Conversa com a Loja',
          productImage: 'https://via.placeholder.com/100x100/667eea/ffffff?text=Loja',
          sellerId: sellerId,
          sellerName: sellerName,
          buyerId: buyerId,
          buyerName: buyerName,
          lastMessage: messages.length > 0 ? messages[messages.length - 1]?.content || '' : '',
          lastMessageDate:
            messages.length > 0
              ? messages[messages.length - 1]?.createdAt || new Date()
              : new Date(),
          unreadCount: 0,
          messages: messages || [],
          isStoreChat: true,
        };

        this.scrollToBottom();
      },
      error: (error: Error) => {
        console.error('❌ Erro ao carregar conversa da loja:', error);
        this.loading = false;
        this.messages = [];

        this.selectedConversation = {
          productId: emptyProductId,
          productName: 'Conversa com a Loja',
          productImage: 'https://via.placeholder.com/100x100/667eea/ffffff?text=Loja',
          sellerId: sellerId,
          sellerName: sellerName,
          lastMessage: '',
          lastMessageDate: new Date(),
          unreadCount: 0,
          messages: [],
          isStoreChat: true,
        };
      },
    });
  }

  selectConversation(conversation: ChatConversation): void {
    this.selectedConversation = conversation;
    this.messages = conversation.messages || [];

    this.chatService
      .markConversationAsRead(conversation.productId, conversation.buyerId || '', conversation.sellerId)
      .subscribe({
        next: () => {
          if (this.selectedConversation) {
            this.selectedConversation.unreadCount = 0;
          }
        },
        error: (error) => {
          console.error('❌ Erro ao marcar conversa como lida:', error);
        },
      });

    this.scrollToBottom();
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.selectedConversation) return;

    if (!this.userId) {
      this.alertService.error('Erro', 'Você precisa estar logado para enviar mensagens.');
      return;
    }

    const currentUserIdStr = String(this.userId);
    const conversationSellerIdStr = String(this.selectedConversation.sellerId || '');

    // 🔥 Identifica se o usuário logado é o VENDEDOR DESTA conversa (não apenas se tem loja)
    const isSellerOfThisChat = currentUserIdStr === conversationSellerIdStr;

    let messageUserId: string;
    let messageUserName: string;
    let messageSellerId: string;
    let messageSellerName: string;
    let messageIsFromSeller: boolean;

    if (isSellerOfThisChat) {
      // ============================================
      // VENDEDOR enviando mensagem
      // ============================================
      let clientIdFromConversation = '';
      let clientNameFromConversation = '';

      if (this.messages.length > 0) {
        const clientMessage = this.messages.find((m) => m.isFromSeller === false);
        if (clientMessage?.userId) {
          clientIdFromConversation = String(clientMessage.userId);
          clientNameFromConversation = clientMessage.userName || 'Cliente';
        }
      }

      if (!clientIdFromConversation && this.selectedConversation.buyerId) {
        clientIdFromConversation = String(this.selectedConversation.buyerId);
        clientNameFromConversation = this.selectedConversation.buyerName || 'Cliente';
      }

      if (!clientIdFromConversation) {
        const userIdParam = this.route.snapshot.queryParams['userId'];
        if (userIdParam && userIdParam !== 'NaN' && userIdParam !== 'null') {
          clientIdFromConversation = String(userIdParam);
        }
      }

      if (!clientIdFromConversation) {
        this.alertService.error(
          'Erro',
          'Não foi possível identificar o cliente desta conversa. Recarregue a página.',
        );
        return;
      }

      messageUserId = clientIdFromConversation;
      messageUserName = clientNameFromConversation || 'Cliente';
      messageSellerId = conversationSellerIdStr;
      messageSellerName = this.selectedConversation.sellerName || this.userName;
      messageIsFromSeller = true;
    } else {
      // ============================================
      // CLIENTE enviando mensagem
      // ============================================
      messageUserId = currentUserIdStr;
      messageUserName = this.userName;
      messageSellerId = conversationSellerIdStr;
      messageSellerName = this.selectedConversation.sellerName || '';
      messageIsFromSeller = false;
    }

    const productImage =
      this.selectedConversation.productImage ||
      this.productImageParam ||
      this.messages.find((m) => m.productImage)?.productImage ||
      '';

    const message: Partial<Message> = {
      productId: String(this.selectedConversation.productId || ''),
      productName: this.selectedConversation.productName || 'Conversa com a Loja',
      productImage: productImage,
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
      productImage: message.productImage || '',
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
        const index = this.messages.findIndex((m) => m.id === tempMessage.id);
        if (index !== -1) {
          this.messages[index] = sentMessage;
        }
        this.loadConversations();
      },
      error: (error: Error) => {
        console.error('❌ Erro ao enviar mensagem:', error);
        const index = this.messages.findIndex((m) => m.id === tempMessage.id);
        if (index !== -1) {
          this.messages[index] = {
            ...this.messages[index],
            content: this.messages[index].content + ' ⚠️',
          };
        }
        this.alertService.warning('Aviso', 'Mensagem enviada localmente. Verifique sua conexão.');
      },
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

  // 🔥 CORRIGIDO: hora certa de Brasília
  formatDate(date: Date | string): string {
    if (!date) return '';

    let msgDate: Date;
    if (date instanceof Date) {
      msgDate = date;
    } else {
      let safe = date;
      if (!safe.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(safe)) safe += 'Z';
      msgDate = new Date(safe);
    }

    if (isNaN(msgDate.getTime())) return '';

    const now = new Date();
    const diff = now.getTime() - msgDate.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 24) {
      return msgDate.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (hours < 48) {
      return 'Ontem';
    } else {
      return msgDate.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: 'short',
      });
    }
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  isProductChat(): boolean {
    return (
      !!this.selectedConversation?.productId &&
      this.selectedConversation?.productId !== '00000000-0000-0000-0000-000000000000' &&
      !this.selectedConversation?.isStoreChat
    );
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

  onImageError(event: Event, size: string): void {
    const img = event.target as HTMLImageElement;
    if (!img) return;
    if (img.src.includes('placeholder.com')) return;
    img.src = `https://via.placeholder.com/${size}/667eea/ffffff?text=Produto`;
  }
}