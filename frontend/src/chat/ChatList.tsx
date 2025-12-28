import { useChatStore } from '@/store/useChatStore'
import { format } from 'date-fns'

export default function ChatList() {
  const { chats, selectChat, activeChat } = useChatStore()

  return (
    <div style={styles.container}>
      {chats.map((chat) => (
        <div
          key={chat.id}
          onClick={() => selectChat(chat.id)}
          style={{
            ...styles.chatItem,
            ...(activeChat?.id === chat.id ? styles.activeChat : {}),
          }}
        >
          <div style={styles.chatInfo}>
            <div style={styles.chatName}>
              {chat.type === 'channel' ? `# ${chat.name}` : chat.members?.[0]?.user?.name || 'Chat'}
            </div>
            <div style={styles.chatMeta}>
              {format(new Date(chat.createdAt), 'MMM d')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflowY: 'auto',
  },
  chatItem: {
    padding: '1rem',
    borderBottom: '1px solid #eee',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  activeChat: {
    backgroundColor: '#e3f2fd',
  },
  chatInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    fontWeight: '500',
  },
  chatMeta: {
    fontSize: '0.875rem',
    color: '#999',
  },
}

