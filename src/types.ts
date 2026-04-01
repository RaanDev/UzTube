export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  created_at?: string;
}

export interface Video {
  id: number;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  userId: number;
  userName: string;
  userAvatar?: string;
  views: number;
  likes: number;
  dislikes: number;
  created_at: string;
}

export interface Comment {
  id: number;
  videoId: number;
  userId: number;
  userName: string;
  userAvatar?: string;
  text: string;
  created_at: string;
}

export interface Channel {
  id: number;
  name: string;
  avatar?: string;
}

export interface AppNotification {
  id: number;
  userId: number;
  type: string;
  message: string;
  videoId?: number;
  isRead: number;
  created_at: string;
}
