// src/app/core/models/comment.model.ts
export interface Comment {
  id: string;              // Guid
  productId: string;       // Guid
  userId: string;          // Guid
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  isFromSeller?: boolean;
  replies?: CommentReply[];
  likes: number;
  isLiked?: boolean;
}

export interface CommentReply {
  id: string;              // Guid
  commentId: string;       // Guid
  userId: string;          // Guid
  userName: string;
  userAvatar?: string;
  content: string;
  isFromSeller?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateComment {
  productId: string;
  content: string;
}

export interface CreateReply {
  commentId: string;
  content: string;
  isFromSeller?: boolean;
}
