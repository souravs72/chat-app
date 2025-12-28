import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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
  const { addMessage, setTyping } = useChatStore()
  const [client, setClient] = useState<RealtimeClient | null>(null)

  useEffect(() => {
    if (!token || !user) return

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws'
    const transport = new WebSocketTransport(wsUrl, token)
    const realtimeClient = new RealtimeClient(transport)

    realtimeClient.connect().then(() => {
      console.log('Realtime client connected')
      setClient(realtimeClient)

      // Subscribe to message events
      realtimeClient.subscribe('MESSAGE_SENT', (payload: Message) => {
        addMessage(payload)
      })

      // Subscribe to typing indicators
      realtimeClient.subscribe('TYPING_INDICATOR', (payload: TypingIndicator) => {
        setTyping(payload.chatId, payload.userId, payload.isTyping)
      })

      // Subscribe to user presence
      realtimeClient.subscribe('USER_CONNECTED', (payload: { userId: string }) => {
        console.log('User connected:', payload.userId)
      })

      realtimeClient.subscribe('USER_DISCONNECTED', (payload: { userId: string }) => {
        console.log('User disconnected:', payload.userId)
      })
    }).catch((error) => {
      console.error('Failed to connect realtime client:', error)
    })

    return () => {
      realtimeClient.disconnect()
    }
  }, [token, user, addMessage, setTyping])

  return (
    <RealtimeContext.Provider value={client}>
      {children}
    </RealtimeContext.Provider>
  )
}

