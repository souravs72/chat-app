import { useEffect, useState } from 'react'
import { useChatStore } from '@/store/useChatStore'
import { apiClient } from '@/api/client'
import ChatList from './ChatList'
import ChatWindow from './ChatWindow'
import NewChatModal from './NewChatModal'
import SettingsModal from './SettingsModal'
import UserProfile from '@/components/UserProfile'
import './ChatLayout.css'

export default function ChatLayout() {
  const { loadChats, activeChat } = useChatStore()
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    loadChats()
    apiClient.updateStatus('online')
    
    return () => {
      apiClient.updateStatus('offline')
    }
  }, [loadChats])

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <UserProfile />
        <button
          onClick={() => setIsSettingsOpen(true)}
          style={styles.settingsBtn}
          title="Settings"
        >
          ⚙️
        </button>
      </div>
      <div style={styles.content}>
        <div style={styles.sidebar}>
          <div style={styles.header}>
            <div style={styles.headerTop}>
              <div style={styles.headerTitle}>
                <div style={styles.logo}>💬</div>
                <h2 style={styles.title}>Chats</h2>
              </div>
              <button
                onClick={() => setIsNewChatOpen(true)}
                style={styles.newChatBtn}
                title="New Chat"
              >
                +
              </button>
            </div>
          </div>
          <ChatList />
        </div>
        <div style={styles.main}>
        {activeChat ? (
          <ChatWindow />
        ) : (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>💬</div>
            <h3 style={styles.emptyTitle}>Welcome to Chat Platform</h3>
            <p style={styles.emptyText}>
              To start chatting:
              <br />
              1. Click the <strong>+</strong> button in the sidebar
              <br />
              2. Search for users by name, phone, or email
              <br />
              3. Click on a user to start a conversation
            </p>
            <button
              onClick={() => setIsNewChatOpen(true)}
              style={styles.emptyButton}
            >
              Start New Chat
            </button>
          </div>
        )}
        </div>
      </div>
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#f0f2f5',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: 'white',
    borderBottom: '1px solid #e0e0e0',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    zIndex: 10,
    flexShrink: 0,
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '360px',
    borderRight: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white',
    boxShadow: '2px 0 4px rgba(0,0,0,0.05)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  header: {
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f8f9fa',
  },
  headerTop: {
    padding: '1.25rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logo: {
    fontSize: '1.5rem',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#333',
  },
  newChatBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '300',
    transition: 'background-color 0.2s',
  },
  settingsBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.25rem',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '8px',
    transition: 'background-color 0.2s',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f0f2f5',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#999',
    padding: '2rem',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  emptyTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#333',
    marginBottom: '0.5rem',
  },
  emptyText: {
    fontSize: '1rem',
    color: '#666',
    marginBottom: '2rem',
    maxWidth: '400px',
  },
  emptyButton: {
    padding: '0.75rem 2rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '24px',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
}

