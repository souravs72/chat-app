import { useRef, useCallback } from 'react'
import { useRealtime } from '@/realtime/useRealtime'
import { useAuthStore } from '@/store/useAuthStore'

/**
 * Custom hook for managing typing indicators
 * 
 * Provides debounced typing detection to avoid sending too many events.
 * Automatically stops typing indicator after inactivity.
 */
export function useTypingIndicator(chatId: string | null) {
  const realtime = useRealtime()
  const { user } = useAuthStore()
  
  // Refs to manage typing state and timeouts
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingEventRef = useRef<number>(0)
  const isTypingRef = useRef<boolean>(false)
  
  // Throttle typing events to avoid spam (max once per 2 seconds)
  const TYPING_THROTTLE_MS = 2000
  // Stop typing after 3 seconds of inactivity
  const TYPING_STOP_DELAY_MS = 3000

  /**
   * Send typing indicator event
   */
  const sendTypingEvent = useCallback((isTyping: boolean) => {
    if (!chatId || !realtime || !user) return

    const now = Date.now()
    
    // Throttle typing start events
    if (isTyping && now - lastTypingEventRef.current < TYPING_THROTTLE_MS) {
      return
    }

    lastTypingEventRef.current = now
    isTypingRef.current = isTyping

    realtime.publish('TYPING_INDICATOR', {
      chatId,
      userId: user.id,
      isTyping,
    })
  }, [chatId, realtime, user])

  /**
   * Handle user typing
   * Sends typing start event and sets up auto-stop timer
   */
  const handleTyping = useCallback(() => {
    if (!chatId || !realtime || !user) return

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    // Send typing start event if not already typing
    if (!isTypingRef.current) {
      sendTypingEvent(true)
    }

    // Set timeout to stop typing after inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        sendTypingEvent(false)
        isTypingRef.current = false
      }
      typingTimeoutRef.current = null
    }, TYPING_STOP_DELAY_MS)
  }, [chatId, realtime, user, sendTypingEvent])

  /**
   * Stop typing indicator immediately
   * Called when message is sent or input is cleared
   */
  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    if (isTypingRef.current) {
      sendTypingEvent(false)
      isTypingRef.current = false
    }
  }, [sendTypingEvent])

  /**
   * Cleanup function
   * Should be called when component unmounts or chat changes
   */
  const cleanup = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    
    // Send stop typing event if currently typing
    if (isTypingRef.current) {
      sendTypingEvent(false)
      isTypingRef.current = false
    }
  }, [sendTypingEvent])

  return {
    handleTyping,
    stopTyping,
    cleanup,
  }
}

