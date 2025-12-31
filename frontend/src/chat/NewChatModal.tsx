import { useState, useEffect } from 'react'
import { apiClient } from '@/api/client'
import { useChatStore } from '@/store/useChatStore'
import type { User } from '@/types'

interface NewChatModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function NewChatModal({ isOpen, onClose }: NewChatModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'personal' | 'channel'>('personal')
  const [channelName, setChannelName] = useState('')
  const { createPersonalChat, createChannel, loadChats } = useChatStore()

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setUsers([])
      setChannelName('')
      setActiveTab('personal')
    }
  }, [isOpen])

  useEffect(() => {
    if (!searchQuery.trim() || activeTab !== 'personal') {
      setUsers([])
      return
    }

    const searchUsers = async () => {
      setLoading(true)
      try {
        const results = await apiClient.searchUsers(searchQuery)
        setUsers(results)
      } catch (error) {
        console.error('Failed to search users:', error)
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(searchUsers, 300)
    return () => clearTimeout(timeoutId)
  }, [searchQuery, activeTab])

  const handleStartChat = async (userId: string) => {
    try {
      await createPersonalChat(userId)
      await loadChats()
      onClose()
    } catch (error) {
      console.error('Failed to start chat:', error)
    }
  }

  const handleCreateChannel = async () => {
    if (!channelName.trim()) return
    try {
      await createChannel(channelName.trim())
      await loadChats()
      onClose()
    } catch (error) {
      console.error('Failed to create channel:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>New Chat</h2>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'personal' ? styles.activeTab : {}),
            }}
            onClick={() => setActiveTab('personal')}
          >
            Personal
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'channel' ? styles.activeTab : {}),
            }}
            onClick={() => setActiveTab('channel')}
          >
            Channel
          </button>
        </div>

        {activeTab === 'personal' ? (
          <div style={styles.content}>
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
              autoFocus
            />
            {loading && <div style={styles.loading}>Searching...</div>}
            <div style={styles.userList}>
              {users.map((user) => (
                <div
                  key={user.id}
                  style={styles.userItem}
                  onClick={() => handleStartChat(user.id)}
                >
                  <div style={styles.avatar}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={styles.userInfo}>
                    <div style={styles.userName}>{user.name}</div>
                    <div style={styles.userPhone}>
                      {user.phone}
                      {user.email && ` • ${user.email}`}
                    </div>
                  </div>
                  <div style={styles.statusIndicator}>
                    <div
                      style={{
                        ...styles.statusDot,
                        backgroundColor: user.status === 'online' ? '#4caf50' : '#999',
                      }}
                    />
                  </div>
                </div>
              ))}
              {!loading && searchQuery && users.length === 0 && (
                <div style={styles.empty}>No users found</div>
              )}
              {!searchQuery && (
                <div style={styles.empty}>Start typing to search for users</div>
              )}
            </div>
          </div>
        ) : (
          <div style={styles.content}>
            <input
              type="text"
              placeholder="Channel name..."
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              style={styles.searchInput}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateChannel()
                }
              }}
              autoFocus
            />
            <button
              onClick={handleCreateChannel}
              disabled={!channelName.trim()}
              style={{
                ...styles.createBtn,
                ...(!channelName.trim() ? styles.createBtnDisabled : {}),
              }}
            >
              Create Channel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  header: {
    padding: '1.5rem',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: '600',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '2rem',
    cursor: 'pointer',
    color: '#666',
    padding: 0,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e0e0e0',
  },
  tab: {
    flex: 1,
    padding: '1rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500',
    color: '#666',
    borderBottom: '2px solid transparent',
  },
  activeTab: {
    color: '#007bff',
    borderBottomColor: '#007bff',
  },
  content: {
    padding: '1.5rem',
    flex: 1,
    overflowY: 'auto',
  },
  searchInput: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '1rem',
    marginBottom: '1rem',
  },
  loading: {
    textAlign: 'center',
    color: '#666',
    padding: '1rem',
  },
  userList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  userItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#007bff',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    fontWeight: '600',
    marginRight: '1rem',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: '500',
    marginBottom: '0.25rem',
  },
  userPhone: {
    fontSize: '0.875rem',
    color: '#666',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    padding: '2rem',
  },
  createBtn: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '1rem',
  },
  createBtnDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
}

