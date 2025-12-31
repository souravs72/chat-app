import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '@/store/useChatStore'
import { useRealtime } from '@/realtime/RealtimeProvider'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/store/useAuthStore'
import { format } from 'date-fns'

export default function ChatWindow() {
  const chatStore = useChatStore()
  const { activeChat, messages, addMessage, typingUsers } = chatStore
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

  const getChatDisplayName = () => {
    if (!activeChat) return 'Chat'
    if (activeChat.type === 'channel') {
      return `# ${activeChat.name}`
    }
    const otherMember = activeChat.members?.find(m => m.user?.id !== user?.id)
    return otherMember?.user?.name || 'Chat'
  }

  const getOtherUserStatus = () => {
    if (!activeChat || activeChat.type === 'channel') return null
    const otherMember = activeChat.members?.find(m => m.user?.id !== user?.id)
    return otherMember?.user?.status
  }

  const isNewChat = () => {
    if (!activeChat || activeChat.type === 'channel') return false
    // Check if current user has sent any messages in this chat
    const hasUserSentMessage = chatMessages.some(msg => msg.senderId === user?.id)
    return !hasUserSentMessage && chatMessages.length > 0
  }

  const handleBlock = async () => {
    if (!activeChat) return
    try {
      await apiClient.blockUser(activeChat.id)
      // Reload chat to update blocked status
      await chatStore.selectChat(activeChat.id)
    } catch (error) {
      console.error('Failed to block user:', error)
    }
  }

  const shouldShowAvatar = (message: typeof chatMessages[0], index: number) => {
    if (message.senderId === user?.id) return false
    if (index === 0) return true
    const prevMessage = chatMessages[index - 1]
    return prevMessage.senderId !== message.senderId
  }

  const shouldShowSenderName = (message: typeof chatMessages[0], index: number) => {
    if (message.senderId === user?.id) return false
    if (index === 0) return true
    const prevMessage = chatMessages[index - 1]
    return prevMessage.senderId !== message.senderId
  }

  const getMessageTime = (createdAt: string) => {
    try {
      return format(new Date(createdAt), 'HH:mm')
    } catch {
      return ''
    }
  }

  const showBlockOption = isNewChat()

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerInfo}>
            <div style={styles.headerAvatar}>
              {activeChat?.type === 'channel' ? '#' : getChatDisplayName().charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={styles.headerName}>{getChatDisplayName()}</div>
              {getOtherUserStatus() === 'online' && (
                <div style={styles.headerStatus}>Online</div>
              )}
            </div>
          </div>
          {showBlockOption && (
            <button onClick={handleBlock} style={styles.blockButton} title="Block user">
              Block
            </button>
          )}
        </div>
      </div>
      <div style={styles.messages}>
        {chatMessages.length === 0 && (
          <div style={styles.emptyMessages}>
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}
        {chatMessages.map((message, index) => {
          const isMyMessage = message.senderId === user?.id
          const showAvatar = shouldShowAvatar(message, index)
          const showSenderName = shouldShowSenderName(message, index)
          
          return (
          <div
            key={message.id}
            style={{
                ...styles.messageWrapper,
                ...(isMyMessage ? styles.myMessageWrapper : {}),
            }}
          >
              {!isMyMessage && showAvatar && (
                <div style={styles.avatar}>
                  {message.sender?.name?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              {!isMyMessage && !showAvatar && <div style={styles.avatarSpacer} />}
              <div
                style={{
                  ...styles.messageBubble,
                  ...(isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble),
                }}
              >
                {showSenderName && !isMyMessage && (
                  <div style={styles.senderName}>{message.sender?.name || 'Unknown'}</div>
                )}
                <div style={styles.messageContent}>
                  {message.type === 'image' && message.mediaUrl && (
                    <img src={message.mediaUrl} alt="Shared" style={styles.media} />
                  )}
                  {message.type === 'video' && message.mediaUrl && (
                    <video src={message.mediaUrl} controls style={styles.media} />
                  )}
                  {message.content && (
                    <div style={styles.messageText}>{message.content}</div>
                  )}
                </div>
                <div style={styles.messageFooter}>
                  <span style={styles.timestamp}>{getMessageTime(message.createdAt)}</span>
                  {isMyMessage && message.delivered && (
                    <span style={styles.status}>
                      {message.read ? '✓✓' : '✓'}
              </span>
                  )}
            </div>
              </div>
          </div>
          )
        })}
        {typingUserIds.length > 0 && (
          <div style={styles.typing}>
            <div style={styles.typingDots}>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
            <span style={styles.typingText}>
            {typingUserIds.length} user{typingUserIds.length > 1 ? 's' : ''} typing...
            </span>
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
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{
            ...styles.sendButton,
            ...((sending || !input.trim()) ? styles.sendButtonDisabled : {}),
          }}
        >
          {sending ? '...' : '→'}
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
    backgroundColor: '#f0f2f5',
  },
  header: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: 'white',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  blockButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  blockButtonHover: {
    backgroundColor: '#c82333',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  headerAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#007bff',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.1rem',
    fontWeight: '600',
  },
  headerName: {
    fontWeight: '600',
    fontSize: '1.1rem',
    color: '#333',
  },
  headerStatus: {
    fontSize: '0.75rem',
    color: '#4caf50',
    marginTop: '0.25rem',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  emptyMessages: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#999',
  },
  messageWrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.5rem',
    marginBottom: '0.25rem',
  },
  myMessageWrapper: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#007bff',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    fontWeight: '600',
    flexShrink: 0,
  },
  avatarSpacer: {
    width: '32px',
    flexShrink: 0,
  },
  messageBubble: {
    maxWidth: '65%',
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    wordBreak: 'break-word',
  },
  myMessageBubble: {
    backgroundColor: '#dcf8c6',
    borderTopRightRadius: '4px',
  },
  otherMessageBubble: {
    backgroundColor: 'white',
    borderTopLeftRadius: '4px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  senderName: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#007bff',
    marginBottom: '0.25rem',
  },
  messageContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  messageText: {
    fontSize: '0.9375rem',
    lineHeight: '1.4',
    color: '#333',
  },
  media: {
    maxWidth: '100%',
    maxHeight: '300px',
    borderRadius: '8px',
    objectFit: 'contain',
  },
  messageFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '0.25rem',
    marginTop: '0.25rem',
  },
  timestamp: {
    fontSize: '0.6875rem',
    color: '#999',
    opacity: 0.8,
  },
  status: {
    fontSize: '0.75rem',
    color: '#999',
  },
  typing: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    fontStyle: 'italic',
    color: '#999',
  },
  typingDots: {
    display: 'flex',
    gap: '0.25rem',
    alignItems: 'center',
  },
  typingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#999',
  },
  typingText: {
    fontSize: '0.875rem',
  },
  inputArea: {
    display: 'flex',
    padding: '1rem 1.5rem',
    borderTop: '1px solid #e0e0e0',
    backgroundColor: 'white',
    gap: '0.75rem',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '0.75rem 1rem',
    border: '1px solid #e0e0e0',
    borderRadius: '24px',
    fontSize: '1rem',
    outline: 'none',
  },
  sendButton: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    fontWeight: '600',
    transition: 'background-color 0.2s',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
}

