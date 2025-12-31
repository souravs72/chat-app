import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { RealtimeClient, WebSocketTransport } from './RealtimeClient'
import { useAuthStore } from '@/store/useAuthStore'
import { useChatStore } from '@/store/useChatStore'
import type { Message, TypingIndicator } from '@/types'

const RealtimeContext = createContext<RealtimeClient | null>(null)

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider')
  }
  return context
}

interface RealtimeProviderProps {
  children: ReactNode
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const { token, user } = useAuthStore()
  const addMessage = useChatStore((state) => state.addMessage)
  const setTyping = useChatStore((state) => state.setTyping)
  const loadChats = useChatStore((state) => state.loadChats)
  const [client, setClient] = useState<RealtimeClient | null>(null)
  const unsubscribeRef = useRef<Array<() => void>>([])

  useEffect(() => {
    if (!token || !user) return

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws'
    const transport = new WebSocketTransport(wsUrl, token)
    const realtimeClient = new RealtimeClient(transport)

    realtimeClient.connect().then(() => {
      console.log('Realtime client connected')
      setClient(realtimeClient)

      // Clear any existing subscriptions
      unsubscribeRef.current.forEach(unsub => unsub())
      unsubscribeRef.current = []

      // Subscribe to message events
      const unsubMessage = realtimeClient.subscribe('MESSAGE_SENT', async (payload: Message) => {
        // Only add message if it's not from the current user (sender already has it from API response)
        // Backend already filters sender, but adding extra safety check
        if (payload.senderId !== user.id) {
        addMessage(payload)
          // Reload chats to show new chats if message is from a new contact
          // Use setTimeout to debounce rapid chat reloads
          setTimeout(() => {
            loadChats()
          }, 100)
        }
      })
      unsubscribeRef.current.push(unsubMessage)

      // Subscribe to typing indicators
      const unsubTyping = realtimeClient.subscribe('TYPING_INDICATOR', (payload: TypingIndicator) => {
        setTyping(payload.chatId, payload.userId, payload.isTyping)
      })
      unsubscribeRef.current.push(unsubTyping)

      // Subscribe to user presence
      const unsubConnected = realtimeClient.subscribe('USER_CONNECTED', (payload: { userId: string }) => {
        console.log('User connected:', payload.userId)
      })
      unsubscribeRef.current.push(unsubConnected)

      const unsubDisconnected = realtimeClient.subscribe('USER_DISCONNECTED', (payload: { userId: string }) => {
        console.log('User disconnected:', payload.userId)
      })
      unsubscribeRef.current.push(unsubDisconnected)
    }).catch((error) => {
      console.error('Failed to connect realtime client:', error)
    })

    return () => {
      // Clean up all subscriptions
      unsubscribeRef.current.forEach(unsub => unsub())
      unsubscribeRef.current = []
      realtimeClient.disconnect()
    }
  }, [token, user, addMessage, setTyping, loadChats])

  return (
    <RealtimeContext.Provider value={client}>
      {children}
    </RealtimeContext.Provider>
  )
}

