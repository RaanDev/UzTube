export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  created_at?: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  views: number;
  likes: number;
  dislikes: number;
  created_at: string;
  category?: string;
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  avatar?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  message: string;
  videoId?: string;
  isRead: boolean;
  created_at: string;
}
