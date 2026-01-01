import { useState, useRef, useEffect } from 'react'
import './AttachmentButton.css'

export interface AttachmentOption {
  id: string
  label: string
  icon: string
  accept: string
  messageType: 'image' | 'video' | 'audio' | 'document'
}

interface AttachmentButtonProps {
  onFileSelect: (file: File, messageType: AttachmentOption['messageType']) => void
  disabled?: boolean
}

/**
 * AttachmentButton Component
 * 
 * Displays a button that opens a menu for selecting different media types.
 * Follows SOLID principles with single responsibility for attachment selection.
 */
export default function AttachmentButton({ 
  onFileSelect, 
  disabled = false 
}: AttachmentButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const attachmentOptions: AttachmentOption[] = [
    {
      id: 'image',
      label: 'Photo',
      icon: '📷',
      accept: 'image/*',
      messageType: 'image',
    },
    {
      id: 'video',
      label: 'Video',
      icon: '🎥',
      accept: 'video/*',
      messageType: 'video',
    },
    {
      id: 'audio',
      label: 'Audio',
      icon: '🎵',
      accept: 'audio/*',
      messageType: 'audio',
    },
    {
      id: 'document',
      label: 'Document',
      icon: '📄',
      accept: '.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.rar,.7z',
      messageType: 'document',
    },
  ]

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isMenuOpen])

  const handleOptionClick = (option: AttachmentOption) => {
    setIsMenuOpen(false)
    
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = option.accept
    input.style.display = 'none'
    
    const cleanup = () => {
      if (document.body.contains(input)) {
        document.body.removeChild(input)
      }
    }

    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        onFileSelect(file, option.messageType)
      }
      cleanup()
    })

    // Handle cancel event (when user clicks outside or presses ESC)
    const handleFocus = () => {
      setTimeout(() => {
        if (!input.files || input.files.length === 0) {
          cleanup()
        }
        window.removeEventListener('focus', handleFocus)
      }, 300)
    }
    window.addEventListener('focus', handleFocus)

    document.body.appendChild(input)
    input.click()
  }

  const toggleMenu = () => {
    if (!disabled) {
      setIsMenuOpen(!isMenuOpen)
    }
  }

  return (
    <div className="attachment-button-container">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        disabled={disabled}
        className="attachment-button"
        aria-label="Attach file"
        aria-expanded={isMenuOpen}
      >
        <span className="attachment-button-icon">📎</span>
      </button>
      {isMenuOpen && (
        <div ref={menuRef} className="attachment-menu">
          {attachmentOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className="attachment-menu-item"
              onClick={() => handleOptionClick(option)}
            >
              <span className="attachment-menu-icon">{option.icon}</span>
              <span className="attachment-menu-label">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

