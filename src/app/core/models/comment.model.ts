// src/app/core/models/comment.model.ts
export interface Comment {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  rating: number;
  createdAt: string;
  updatedAt?: string;
  replies?: Comment[];
  likes: number;
  isLiked?: boolean;
}

export interface CreateComment {
  productId: string;
  content: string;
  rating: number;
}
