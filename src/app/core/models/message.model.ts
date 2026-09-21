// src/app/core/models/message.model.ts

export interface Message {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  sellerId: string | number;
  sellerName: string;
  userId: string | number;
  userName: string;
  content: string;
  createdAt: Date | string;
  read: boolean;
  isFromSeller: boolean;
  readAt?: Date | string;
  conversationId?: string;
}

export interface ChatConversation {
  productId: string;
  productName: string;
  productImage: string;
  sellerId: string | number;
  sellerName: string;
  lastMessage: string;
  lastMessageDate: Date | string;
  unreadCount: number;
  messages: Message[];
  isStoreChat?: boolean;
  lastActivity?: Date | string;
  isOnline?: boolean;
}

export interface SendMessageRequest {
  productId: string;
  productName: string;
  productImage?: string;
  sellerId: string | number;
  sellerName: string;
  userId: string | number;
  userName: string;
  content: string;
  isFromSeller?: boolean;
}

export interface ChatStats {
  totalConversations: number;
  unreadCount: number;
  activeConversations: number;
}

export type ConversationStatus = 'active' | 'archived' | 'blocked';

export function createEmptyMessage(): Message {
  return {
    id: '',
    productId: '',
    productName: '',
    productImage: '',
    sellerId: '',
    sellerName: '',
    userId: '',
    userName: '',
    content: '',
    createdAt: new Date(),
    read: false,
    isFromSeller: false
  };
}

export function createEmptyConversation(): ChatConversation {
  return {
    productId: '',
    productName: '',
    productImage: 'https://via.placeholder.com/100x100/667eea/ffffff?text=Chat',
    sellerId: '',
    sellerName: '',
    lastMessage: '',
    lastMessageDate: new Date(),
    unreadCount: 0,
    messages: [],
    isStoreChat: false
  };
}
