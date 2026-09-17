// src/app/core/models/notification.model.ts
export interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'order' | 'sale' | 'review' | 'system';
  title: string;
  message: string;
  link?: string;
  icon?: string;
  read: boolean;
  createdAt: string;
  data?: any; // Dados extras (ex: orderId, productId)
}
