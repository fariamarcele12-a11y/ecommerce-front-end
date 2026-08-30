// src/app/core/models/message.model.ts

/**
 * 🔥 Interface para uma mensagem individual
 */
export interface Message {
  /** ID único da mensagem (gerado pelo servidor) */
  id: number | string;

  /** ID do produto relacionado à conversa */
  productId: number | string;

  /** Nome do produto para exibição */
  productName: string;

  /** URL da imagem do produto */
  productImage?: string;

  /** ID do vendedor (dono do produto) */
  sellerId: number | string;

  /** Nome do vendedor para exibição */
  sellerName: string;

  /** ID do usuário que enviou a mensagem */
  userId: number | string;

  /** Nome do usuário para exibição */
  userName: string;

  /** Conteúdo da mensagem */
  content: string;

  /** Data de criação da mensagem */
  createdAt: Date | string;

  /** Indica se a mensagem foi lida */
  read: boolean;

  /** Indica se a mensagem foi enviada pelo vendedor */
  isFromSeller: boolean;

  /** Data de leitura da mensagem (opcional) */
  readAt?: Date | string;

  /** ID da conversa (opcional, para agrupamento) */
  conversationId?: number | string;
}

/**
 * 🔥 Interface para uma conversa (agrupamento de mensagens)
 */
export interface ChatConversation {
  /** ID do produto da conversa */
  productId: number | string;

  /** Nome do produto para exibição */
  productName: string;

  /** URL da imagem do produto */
  productImage: string;

  /** ID do vendedor */
  sellerId: number | string;

  /** Nome do vendedor para exibição */
  sellerName: string;

  /** Última mensagem da conversa (resumo) */
  lastMessage: string;

  /** Data da última mensagem */
  lastMessageDate: Date | string;

  /** Número de mensagens não lidas */
  unreadCount: number;

  /** Lista de mensagens da conversa */
  messages: Message[];

  /** Indica se é uma conversa com a loja (sem produto específico) */
  isStoreChat?: boolean;

  /** Data da última atividade (opcional) */
  lastActivity?: Date | string;

  /** Indica se o usuário está online (opcional) */
  isOnline?: boolean;
}

/**
 * 🔥 Interface para requisição de nova mensagem
 */
export interface SendMessageRequest {
  /** ID do produto */
  productId: number | string;

  /** Nome do produto */
  productName: string;

  /** ID do vendedor */
  sellerId: number | string;

  /** Nome do vendedor */
  sellerName: string;

  /** ID do usuário */
  userId: number | string;

  /** Nome do usuário */
  userName: string;

  /** Conteúdo da mensagem */
  content: string;

  /** Indica se é mensagem do vendedor */
  isFromSeller?: boolean;
}

/**
 * 🔥 Interface para estatísticas do chat
 */
export interface ChatStats {
  /** Total de conversas */
  totalConversations: number;

  /** Total de mensagens não lidas */
  unreadCount: number;

  /** Conversas com atividade recente (últimas 24h) */
  activeConversations: number;
}

/**
 * 🔥 Tipo para status da conversa
 */
export type ConversationStatus = 'active' | 'archived' | 'blocked';

/**
 * 🔥 Função auxiliar: cria uma mensagem vazia para fallback
 */
export function createEmptyMessage(): Message {
  return {
    id: 0,
    productId: 0,
    productName: '',
    sellerId: 0,
    sellerName: '',
    userId: 0,
    userName: '',
    content: '',
    createdAt: new Date(),
    read: false,
    isFromSeller: false
  };
}

/**
 * 🔥 Função auxiliar: cria uma conversa vazia para fallback
 */
export function createEmptyConversation(): ChatConversation {
  return {
    productId: 0,
    productName: '',
    productImage: 'https://via.placeholder.com/100x100/667eea/ffffff?text=Chat',
    sellerId: 0,
    sellerName: '',
    lastMessage: '',
    lastMessageDate: new Date(),
    unreadCount: 0,
    messages: [],
    isStoreChat: false
  };
}
