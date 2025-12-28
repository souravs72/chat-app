import { create } from 'zustand'
import type { Chat, Message } from '@/types'
import { apiClient } from '@/api/client'

interface ChatState {
  chats: Chat[]
  activeChat: Chat | null
  messages: Record<string, Message[]>
  typingUsers: Record<string, Set<string>>
  loadChats: () => Promise<void>
  selectChat: (chatId: string) => Promise<void>
  loadMessages: (chatId: string) => Promise<void>
  addMessage: (message: Message) => void
  setTyping: (chatId: string, userId: string, isTyping: boolean) => void
  markAsRead: (chatId: string, messageId: string) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChat: null,
  messages: {},
  typingUsers: {},

  loadChats: async () => {
    const chats = await apiClient.getChats()
    set({ chats })
  },

  selectChat: async (chatId: string) => {
    const chat = await apiClient.getChat(chatId)
    set({ activeChat: chat })
    await get().loadMessages(chatId)
  },

  loadMessages: async (chatId: string) => {
    const messages = await apiClient.getMessages(chatId)
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: messages,
      },
    }))
  },

  addMessage: (message: Message) => {
    set((state) => {
      const existingMessages = state.messages[message.chatId] || []
      return {
        messages: {
          ...state.messages,
          [message.chatId]: [...existingMessages, message],
        },
      }
    })
  },

  setTyping: (chatId: string, userId: string, isTyping: boolean) => {
    set((state) => {
      const typingSet = state.typingUsers[chatId] || new Set()
      if (isTyping) {
        typingSet.add(userId)
      } else {
        typingSet.delete(userId)
      }
      return {
        typingUsers: {
          ...state.typingUsers,
          [chatId]: typingSet,
        },
      }
    })
  },

  markAsRead: async (chatId: string, messageId: string) => {
    await apiClient.markAsRead(chatId, messageId)
    set((state) => {
      const messages = state.messages[chatId] || []
      return {
        messages: {
          ...state.messages,
          [chatId]: messages.map((msg) =>
            msg.id === messageId ? { ...msg, read: true } : msg
          ),
        },
      }
    })
  },
}))

