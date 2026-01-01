import { useChatStore } from '@/store/useChatStore'
import { useAuthStore } from '@/store/useAuthStore'
import './TypingIndicator.css'

interface TypingIndicatorProps {
  chatId: string
}

/**
 * TypingIndicator Component
 * 
 * Displays an animated typing indicator showing which users are currently typing.
 * Shows user names and smooth animated dots for better UX.
 */
export default function TypingIndicator({ chatId }: TypingIndicatorProps) {
  const { typingUsers, activeChat, chats } = useChatStore()
  const { user } = useAuthStore()
  
  const typingUserIds = Array.from(typingUsers[chatId] || [])
  // Filter out current user (shouldn't see own typing indicator)
  const filteredTypingUserIds = typingUserIds.filter(id => id !== user?.id)
  
  if (filteredTypingUserIds.length === 0) {
    return null
  }

  // Get the chat to find user names (use activeChat if it matches, otherwise find in chats)
  const chat = activeChat?.id === chatId ? activeChat : chats.find(chat => chat.id === chatId)
  
  // Get user names for typing users
  const getTypingUserNames = () => {
    if (!chat || !chat.members) return []
    
    return filteredTypingUserIds
      .map(userId => {
        const member = chat.members?.find(m => m.user?.id === userId)
        return member?.user?.name || 'Someone'
      })
      .filter(Boolean)
  }

  const typingNames = getTypingUserNames()
  
  // Format the typing message
  const getTypingMessage = () => {
    if (typingNames.length === 0) {
      return 'Someone is typing...'
    }
    
    if (typingNames.length === 1) {
      return `${typingNames[0]} is typing`
    }
    
    if (typingNames.length === 2) {
      return `${typingNames[0]} and ${typingNames[1]} are typing`
    }
    
    return `${typingNames[0]} and ${typingNames.length - 1} others are typing`
  }

  return (
    <div className="typing-indicator">
      <div className="typing-indicator-content">
        <div className="typing-dots">
          <span className="typing-dot typing-dot-1"></span>
          <span className="typing-dot typing-dot-2"></span>
          <span className="typing-dot typing-dot-3"></span>
        </div>
        <span className="typing-text">{getTypingMessage()}</span>
      </div>
    </div>
  )
}

