import { create } from 'zustand'
import type { Chat, Message } from '@/types'
import { apiClient } from '@/api/client'

interface ChatState {
  chats: Chat[]
  activeChat: Chat | null
  messages: Record<string, Message[]>
  typingUsers: Record<string, Set<string>>
  lastMessages: Record<string, Message>
  loadChats: () => Promise<void>
  selectChat: (chatId: string) => Promise<void>
  loadMessages: (chatId: string) => Promise<void>
  addMessage: (message: Message) => void
  setTyping: (chatId: string, userId: string, isTyping: boolean) => void
  markAsRead: (chatId: string, messageId: string) => Promise<void>
  createPersonalChat: (userId: string) => Promise<Chat>
  createChannel: (name: string) => Promise<Chat>
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChat: null,
  messages: {},
  typingUsers: {},
  lastMessages: {},

  loadChats: async () => {
    const chats = await apiClient.getChats()
    // Load last message for each chat
    const lastMessages: Record<string, Message> = {}
    for (const chat of chats) {
      try {
        const messages = await apiClient.getMessages(chat.id, 1)
        if (messages.length > 0) {
          lastMessages[chat.id] = messages[0]
        }
      } catch (error) {
        console.error(`Failed to load last message for chat ${chat.id}:`, error)
      }
    }
    set({ chats, lastMessages })
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
      
      // Deduplicate: Check if message already exists by ID
      const messageExists = existingMessages.some(msg => msg.id === message.id)
      if (messageExists) {
        // Message already exists, don't add duplicate
        return state
      }
      
      return {
        messages: {
          ...state.messages,
          [message.chatId]: [...existingMessages, message],
        },
        lastMessages: {
          ...state.lastMessages,
          [message.chatId]: message,
        },
      }
    })
  },

  setTyping: (chatId: string, userId: string, isTyping: boolean) => {
    set((state) => {
      const existingSet = state.typingUsers[chatId] || new Set<string>()
      // Create a new Set to ensure Zustand detects the change
      const newTypingSet = new Set(existingSet)
      
      if (isTyping) {
        newTypingSet.add(userId)
      } else {
        newTypingSet.delete(userId)
      }
      
      // If the set is empty, remove it from the record
      if (newTypingSet.size === 0) {
        const { [chatId]: _, ...restTypingUsers } = state.typingUsers
        return {
          typingUsers: restTypingUsers,
        }
      }
      
      return {
        typingUsers: {
          ...state.typingUsers,
          [chatId]: newTypingSet,
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

  createPersonalChat: async (userId: string) => {
    const chat = await apiClient.createPersonalChat(userId)
    await get().loadChats()
    return chat
  },

  createChannel: async (name: string) => {
    const chat = await apiClient.createChannel(name)
    await get().loadChats()
    return chat
  },
}))

