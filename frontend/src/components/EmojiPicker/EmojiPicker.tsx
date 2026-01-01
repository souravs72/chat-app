import { useState, useRef, useEffect } from 'react'
import './EmojiPicker.css'

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  disabled?: boolean
}

/**
 * EmojiPicker Component
 * 
 * Displays a button that opens an emoji picker.
 * Follows SOLID principles with single responsibility for emoji selection.
 */
export default function EmojiPicker({ 
  onEmojiSelect, 
  disabled = false 
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Common emojis organized by category
  const emojiCategories = [
    {
      name: 'Frequently Used',
      emojis: ['😀', '😂', '❤️', '👍', '😍', '😊', '🎉', '🙏'],
    },
    {
      name: 'Smileys & People',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔'],
    },
    {
      name: 'Gestures & Body',
      emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
    },
    {
      name: 'Objects',
      emojis: ['💎', '🔔', '📱', '💻', '⌚', '📷', '🎥', '📻', '🎙', '🎤', '🎧', '🎵', '🎶', '🎸', '🎹', '🎺', '🎷', '🥁', '🎯', '🎮', '🕹', '🎲', '🎳', '🎰', '🧩'],
    },
    {
      name: 'Symbols',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️'],
    },
  ]

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji)
    // Keep picker open to allow multiple emoji selections
  }

  const togglePicker = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <div className="emoji-picker-container">
      <button
        ref={buttonRef}
        type="button"
        onClick={togglePicker}
        disabled={disabled}
        className="emoji-picker-button"
        aria-label="Add emoji"
        aria-expanded={isOpen}
      >
        <span className="emoji-picker-button-icon">😊</span>
      </button>
      {isOpen && (
        <div ref={pickerRef} className="emoji-picker">
          <div className="emoji-picker-header">
            <span className="emoji-picker-title">Choose an emoji</span>
          </div>
          <div className="emoji-picker-content">
            {emojiCategories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="emoji-category">
                <div className="emoji-category-name">{category.name}</div>
                <div className="emoji-grid">
                  {category.emojis.map((emoji, emojiIndex) => (
                    <button
                      key={`${categoryIndex}-${emojiIndex}`}
                      type="button"
                      className="emoji-item"
                      onClick={() => handleEmojiClick(emoji)}
                      aria-label={`Emoji ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

