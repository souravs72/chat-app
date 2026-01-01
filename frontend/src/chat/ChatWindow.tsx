import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '@/store/useChatStore'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/store/useAuthStore'
import { format } from 'date-fns'
import TypingIndicator from './TypingIndicator'
import { useTypingIndicator } from './useTypingIndicator'
import Avatar from '@/components/Avatar'
import AttachmentButton from '@/components/AttachmentButton'
import EmojiPicker from '@/components/EmojiPicker'
import FilePreviewPanel from '@/components/FilePreviewPanel'
import { uploadFile } from '@/utils/fileUploadUtils'
import type { MessageType } from '@/types'

export default function ChatWindow() {
  const chatStore = useChatStore()
  const { activeChat, messages, addMessage } = chatStore
  const { user } = useAuthStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ file: File; messageType: MessageType } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Use custom typing indicator hook
  const { handleTyping, stopTyping, cleanup } = useTypingIndicator(activeChat?.id || null)

  const chatMessages = activeChat ? messages[activeChat.id] || [] : []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeChat?.id])

  // Cleanup typing indicator when chat changes or component unmounts
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [activeChat?.id, cleanup])

  const handleSend = async (messageType: MessageType = 'text', content: string = input.trim(), mediaUrl?: string) => {
    if (!activeChat || (!content && !mediaUrl) || sending || uploading) return

    setSending(true)
    try {
      const message = await apiClient.sendMessage(
        activeChat.id, 
        messageType, 
        content || '', 
        mediaUrl
      )
      addMessage(message)
      
      // Stop typing indicator when message is sent
      stopTyping()
      
      setInput('')
    } catch (error) {
      console.error('Failed to send message:', error)
      // TODO: Show error toast to user
    } finally {
      setSending(false)
    }
  }

  const handleSendText = async () => {
    await handleSend('text', input.trim())
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    // Trigger typing indicator
    handleTyping()
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  const handleFileSelect = (file: File, messageType: MessageType) => {
    // Show preview panel instead of uploading immediately
    setSelectedFile({ file, messageType })
  }

  const handleFileSend = async (file: File, caption?: string) => {
    if (!activeChat || uploading || !selectedFile) return

    const messageType = selectedFile.messageType
    setSelectedFile(null)
    setUploading(true)
    try {
      const { mediaUrl } = await uploadFile(file, {
        onProgress: (progress) => {
          console.log(`Upload progress: ${progress}%`)
        },
      })

      await handleSend(messageType, caption || '', mediaUrl)
    } catch (error) {
      console.error('Failed to upload and send file:', error)
      // TODO: Show error toast to user
    } finally {
      setUploading(false)
    }
  }

  const handleFileCancel = () => {
    setSelectedFile(null)
  }

  const handleEmojiSelect = (emoji: string) => {
    setInput(prev => prev + emoji)
  }

  const getChatDisplayName = () => {
    if (!activeChat) return 'Chat'
    if (activeChat.type === 'channel') {
      return `# ${activeChat.name}`
    }
    const otherMember = activeChat.members?.find(m => m.user?.id !== user?.id)
    return otherMember?.user?.name || 'Chat'
  }

  const otherUser = activeChat?.type === 'channel' || !activeChat
    ? null
    : activeChat.members?.find(m => m.user?.id !== user?.id)?.user

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
            {activeChat?.type === 'channel' ? (
              <Avatar name={activeChat.name || '#'} size={40} />
            ) : (
              <Avatar
                src={otherUser?.profilePicture}
                name={otherUser?.name}
                size={40}
              />
            )}
            <div>
              <div style={styles.headerName}>{getChatDisplayName()}</div>
              {otherUser?.status === 'online' && (
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
                <Avatar
                  src={message.sender?.profilePicture}
                  name={message.sender?.name}
                  size={32}
                />
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
                    <img 
                      src={message.mediaUrl} 
                      alt={message.content || 'Shared image'} 
                      style={styles.media}
                      onError={(e) => {
                        console.error('Failed to load image:', message.mediaUrl, e)
                        // Fallback: show error message
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const errorDiv = document.createElement('div')
                        errorDiv.textContent = 'Image failed to load'
                        errorDiv.style.cssText = 'color: #999; font-size: 0.875rem; padding: 0.5rem;'
                        target.parentNode?.appendChild(errorDiv)
                      }}
                    />
                  )}
                  {message.type === 'video' && message.mediaUrl && (
                    <video src={message.mediaUrl} controls style={styles.media} />
                  )}
                  {message.type === 'audio' && message.mediaUrl && (
                    <audio src={message.mediaUrl} controls style={styles.audio} />
                  )}
                  {message.type === 'document' && message.mediaUrl && (
                    <a
                      href={message.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.documentLink}
                    >
                      📄 {message.content || 'Document'}
                    </a>
                  )}
                  {message.content && message.type !== 'document' && !(message.type === 'image' && message.mediaUrl) && (
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
        <div ref={messagesEndRef} />
      </div>
      {activeChat && (
        <div style={styles.typingIndicatorContainer}>
          <TypingIndicator chatId={activeChat.id} />
        </div>
      )}
      {selectedFile && (
        <FilePreviewPanel
          file={selectedFile.file}
          messageType={selectedFile.messageType}
          onSend={handleFileSend}
          onCancel={handleFileCancel}
        />
      )}
      <div style={styles.inputArea}>
        <div style={styles.leftButtons}>
          <AttachmentButton
            onFileSelect={handleFileSelect}
            disabled={sending || uploading}
          />
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            disabled={sending || uploading}
          />
        </div>
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder="Type a message..."
          style={styles.input}
          disabled={sending || uploading}
        />
        <button
          onClick={handleSendText}
          disabled={sending || uploading || !input.trim()}
          style={{
            ...styles.sendButton,
            ...((sending || uploading || !input.trim()) ? styles.sendButtonDisabled : {}),
          }}
        >
          {sending || uploading ? '...' : '→'}
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
    minHeight: 0, // Important for flex scrolling
  },
  typingIndicatorContainer: {
    flexShrink: 0,
    padding: '0.5rem 1.5rem',
    backgroundColor: '#f0f2f5',
    borderTop: '1px solid #e0e0e0',
    display: 'flex',
    alignItems: 'center',
    minHeight: '48px',
    maxHeight: '48px',
    overflow: 'hidden',
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
  audio: {
    width: '100%',
    maxWidth: '400px',
    marginTop: '0.5rem',
  },
  documentLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#f0f2f5',
    borderRadius: '8px',
    color: '#007bff',
    textDecoration: 'none',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    wordBreak: 'break-word',
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
  inputArea: {
    display: 'flex',
    padding: '1rem 1.5rem',
    borderTop: '1px solid #e0e0e0',
    backgroundColor: 'white',
    gap: '0.75rem',
    alignItems: 'center',
  },
  leftButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '0.75rem 1rem',
    border: '1px solid #e0e0e0',
    borderRadius: '24px',
    fontSize: '1rem',
    outline: 'none',
    backgroundColor: '#f0f2f5',
    minWidth: 0,
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

