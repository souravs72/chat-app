import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '@/store/useChatStore'
import { useRealtime } from '@/realtime/RealtimeProvider'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/store/useAuthStore'
import { format } from 'date-fns'

export default function ChatWindow() {
  const { activeChat, messages, addMessage, typingUsers } = useChatStore()
  const { user } = useAuthStore()
  const realtime = useRealtime()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const chatMessages = activeChat ? messages[activeChat.id] || [] : []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSend = async () => {
    if (!activeChat || !input.trim() || sending) return

    setSending(true)
    try {
      const message = await apiClient.sendMessage(activeChat.id, 'text', input.trim())
      addMessage(message)
      
      // Publish typing stop
      if (realtime) {
        realtime.publish('TYPING_INDICATOR', {
          chatId: activeChat.id,
          userId: user?.id,
          isTyping: false,
        })
      }
      
      setInput('')
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleTyping = () => {
    if (!activeChat || !realtime || !user) return

    // Publish typing indicator
    realtime.publish('TYPING_INDICATOR', {
      chatId: activeChat.id,
      userId: user.id,
      isTyping: true,
    })

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (realtime) {
        realtime.publish('TYPING_INDICATOR', {
          chatId: activeChat.id,
          userId: user.id,
          isTyping: false,
        })
      }
    }, 3000)
  }

  const typingUserIds = activeChat ? Array.from(typingUsers[activeChat.id] || []) : []

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3>{activeChat?.type === 'channel' ? `# ${activeChat.name}` : 'Chat'}</h3>
      </div>
      <div style={styles.messages}>
        {chatMessages.map((message) => (
          <div
            key={message.id}
            style={{
              ...styles.message,
              ...(message.senderId === user?.id ? styles.myMessage : {}),
            }}
          >
            <div style={styles.messageHeader}>
              <span style={styles.sender}>{message.sender?.name || 'Unknown'}</span>
              <span style={styles.timestamp}>
                {format(new Date(message.createdAt), 'HH:mm')}
              </span>
            </div>
            <div style={styles.messageContent}>{message.content}</div>
            {message.delivered && (
              <div style={styles.status}>
                {message.read ? '✓✓' : '✓'}
              </div>
            )}
          </div>
        ))}
        {typingUserIds.length > 0 && (
          <div style={styles.typing}>
            {typingUserIds.length} user{typingUserIds.length > 1 ? 's' : ''} typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div style={styles.inputArea}>
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            handleTyping()
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Type a message..."
          style={styles.input}
        />
        <button onClick={handleSend} disabled={sending || !input.trim()} style={styles.sendButton}>
          Send
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid #ddd',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  message: {
    maxWidth: '70%',
    padding: '0.75rem',
    backgroundColor: '#f0f0f0',
    borderRadius: '8px',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007bff',
    color: 'white',
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.25rem',
    fontSize: '0.875rem',
  },
  sender: {
    fontWeight: '500',
  },
  timestamp: {
    opacity: 0.7,
  },
  messageContent: {
    wordBreak: 'break-word',
  },
  status: {
    marginTop: '0.25rem',
    fontSize: '0.75rem',
    opacity: 0.7,
  },
  typing: {
    padding: '0.5rem',
    fontStyle: 'italic',
    color: '#999',
  },
  inputArea: {
    display: 'flex',
    padding: '1rem',
    borderTop: '1px solid #ddd',
    gap: '0.5rem',
  },
  input: {
    flex: 1,
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
  },
  sendButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
}

