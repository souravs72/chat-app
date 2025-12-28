import { useEffect } from 'react'
import { useChatStore } from '@/store/useChatStore'
import { useAuthStore } from '@/store/useAuthStore'
import { apiClient } from '@/api/client'
import ChatList from './ChatList'
import ChatWindow from './ChatWindow'
import './ChatLayout.css'

export default function ChatLayout() {
  const { user, logout } = useAuthStore()
  const { loadChats, activeChat } = useChatStore()

  useEffect(() => {
    loadChats()
    apiClient.updateStatus('online')
    
    return () => {
      apiClient.updateStatus('offline')
    }
  }, [loadChats])

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.header}>
          <h2>Chat Platform</h2>
          <div style={styles.userInfo}>
            <span>{user?.name}</span>
            <button onClick={logout} style={styles.logoutBtn}>Logout</button>
          </div>
        </div>
        <ChatList />
      </div>
      <div style={styles.main}>
        {activeChat ? (
          <ChatWindow />
        ) : (
          <div style={styles.empty}>
            <p>Select a chat to start messaging</p>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
  },
  sidebar: {
    width: '300px',
    borderRight: '1px solid #ddd',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
  },
  logoutBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  empty: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#999',
  },
}

