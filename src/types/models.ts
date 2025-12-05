// Domain Model Types (matching Prisma schema)

export type PartyStatus = 'DRAFT' | 'PLANNED' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type MediaType = 'PHOTO' | 'VIDEO' | 'AUDIO';
export type MediaMood = 'HYPE' | 'CHILL' | 'WILD' | 'ROMANTIC' | 'CRAZY' | 'ELEGANT';
export type MessageType = 'TEXT' | 'IMAGE' | 'SYSTEM';
export type NotificationType =
  | 'FOLLOW'
  | 'LIKE'
  | 'COMMENT'
  | 'PARTY_INVITE'
  | 'PARTY_START'
  | 'PARTY_END'
  | 'NEW_MEDIA'
  | 'SYSTEM';

// User Types
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  followersCount: number;
  followingCount: number;
  createdAt: Date;
}

export interface UserSummary {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

// Party Types
export interface PartyDetails {
  id: string;
  hostId: string;
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  status: PartyStatus;
  isPrivate: boolean;
  accessCode?: string | null;
  maxAttendees?: number | null;
  attendeesCount: number;
  host: UserSummary;
  venue?: VenueInfo | null;
  tags: string[];
}

export interface PartySummary {
  id: string;
  title: string;
  coverImageUrl?: string | null;
  startsAt: Date;
  status: PartyStatus;
  attendeesCount: number;
  host: UserSummary;
}

// Venue Types
export interface VenueInfo {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// Media Types
export interface MediaItem {
  id: string;
  partyId: string;
  uploaderId: string;
  type: MediaType;
  url: string;
  thumbnailUrl?: string | null;
  mood?: MediaMood | null;
  caption?: string | null;
  duration?: number | null;
  likesCount: number;
  viewsCount: number;
  createdAt: Date;
  uploader: UserSummary;
  isLiked?: boolean;
  isFavorited?: boolean;
}

// Chat Types
export interface ChatMessageItem {
  id: string;
  roomId: string;
  senderId: string;
  type: MessageType;
  content: string;
  mediaUrl?: string | null;
  createdAt: Date;
  sender: UserSummary;
}

// Notification Types
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  read: boolean;
  createdAt: Date;
}
