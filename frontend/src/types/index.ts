// Shared type definitions

export interface User {
  id: string
  name: string
  phone: string
  status: 'online' | 'offline'
  lastSeen?: string
}

export interface Chat {
  id: string
  type: 'personal' | 'channel'
  createdAt: string
  name?: string
  members?: ChatMember[]
}

export interface ChatMember {
  chatId: string
  userId: string
  role: 'admin' | 'member'
  user?: User
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'location'

export interface Message {
  id: string
  chatId: string
  senderId: string
  type: MessageType
  content: string
  mediaUrl?: string
  createdAt: string
  delivered?: boolean
  read?: boolean
  sender?: User
}

export interface Story {
  id: string
  userId: string
  mediaUrl: string
  expiresAt: string
  user?: User
}

export interface RealtimeEvent {
  type: string
  payload: any
  timestamp: string
}

export interface TypingIndicator {
  chatId: string
  userId: string
  isTyping: boolean
}

export interface AuthResponse {
  token: string
  user: User
}

