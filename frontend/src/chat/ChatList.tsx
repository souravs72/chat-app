import { useChatStore } from '@/store/useChatStore'
import { useAuthStore } from '@/store/useAuthStore'
import { format } from 'date-fns'

export default function ChatList() {
  const { chats, selectChat, activeChat, lastMessages } = useChatStore()
  const { user } = useAuthStore()

  const getChatDisplayName = (chat: typeof chats[0]) => {
    if (chat.type === 'channel') {
      return chat.name || 'Channel'
    }
    // For personal chats, show the other user's name
    const otherMember = chat.members?.find(m => m.user?.id !== user?.id)
    return otherMember?.user?.name || 'Unknown User'
  }

  const getChatAvatar = (chat: typeof chats[0]) => {
    if (chat.type === 'channel') {
      return (chat.name || '#').charAt(0).toUpperCase()
    }
    const otherMember = chat.members?.find(m => m.user?.id !== user?.id)
    return otherMember?.user?.name?.charAt(0).toUpperCase() || '?'
  }

  const getOtherUserStatus = (chat: typeof chats[0]) => {
    if (chat.type === 'channel') return null
    const otherMember = chat.members?.find(m => m.user?.id !== user?.id)
    return otherMember?.user?.status
  }

  const getLastMessagePreview = (chatId: string) => {
    const lastMessage = lastMessages[chatId]
    if (!lastMessage) return 'No messages yet'
    if (lastMessage.type === 'image') return '📷 Image'
    if (lastMessage.type === 'video') return '🎥 Video'
    if (lastMessage.type === 'audio') return '🎵 Audio'
    if (lastMessage.type === 'document') return '📄 Document'
    if (lastMessage.type === 'location') return '📍 Location'
    return lastMessage.content || 'Message'
  }

  const getLastMessageTime = (chatId: string) => {
    const lastMessage = lastMessages[chatId]
    if (!lastMessage) return null
    try {
      const date = new Date(lastMessage.createdAt)
      const now = new Date()
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
      
      if (diffInHours < 24) {
        return format(date, 'HH:mm')
      } else if (diffInHours < 168) { // 7 days
        return format(date, 'EEE')
      } else {
        return format(date, 'MMM d')
      }
    } catch {
      return null
    }
  }

  if (chats.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <p style={styles.emptyText}>No chats yet</p>
        <p style={styles.emptySubtext}>Start a new conversation!</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {chats.map((chat) => {
        const isActive = activeChat?.id === chat.id
        const otherUserStatus = getOtherUserStatus(chat)
        const lastMessage = lastMessages[chat.id]
        
        return (
        <div
          key={chat.id}
          onClick={() => selectChat(chat.id)}
          style={{
            ...styles.chatItem,
              ...(isActive ? styles.activeChat : {}),
          }}
        >
            <div style={styles.avatarContainer}>
              <div style={styles.avatar}>
                {getChatAvatar(chat)}
              </div>
              {otherUserStatus === 'online' && (
                <div style={styles.onlineIndicator} />
              )}
            </div>
            <div style={styles.chatInfo}>
              <div style={styles.chatHeader}>
                <div style={styles.chatName}>
                  {getChatDisplayName(chat)}
                </div>
                {lastMessage && (
                  <div style={styles.chatTime}>
                    {getLastMessageTime(chat.id)}
                  </div>
                )}
              </div>
              <div style={styles.chatPreview}>
                <span style={styles.previewText}>
                  {getLastMessagePreview(chat.id)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflowY: 'auto',
    backgroundColor: '#f8f9fa',
  },
  emptyContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2rem',
    color: '#999',
  },
  emptyText: {
    fontSize: '1.1rem',
    marginBottom: '0.5rem',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: '0.9rem',
  },
  chatItem: {
    display: 'flex',
    padding: '1rem',
    borderBottom: '1px solid #e0e0e0',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    backgroundColor: 'white',
    alignItems: 'center',
    gap: '1rem',
  },
  activeChat: {
    backgroundColor: '#e3f2fd',
    borderLeft: '3px solid #007bff',
  },
  avatarContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    backgroundColor: '#007bff',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    fontWeight: '600',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: '2px',
    right: '2px',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#4caf50',
    border: '2px solid white',
  },
  chatInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    fontWeight: '600',
    fontSize: '1rem',
    color: '#333',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chatTime: {
    fontSize: '0.75rem',
    color: '#999',
    flexShrink: 0,
    marginLeft: '0.5rem',
  },
  chatPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  previewText: {
    fontSize: '0.875rem',
    color: '#666',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
}

