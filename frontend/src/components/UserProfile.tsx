import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { apiClient } from '@/api/client'
import ImageCropper from './ImageCropper'
import Avatar from './Avatar'
import { validateImageFile } from '@/utils/imageUtils'
import { uploadProfilePicture } from '@/utils/uploadUtils'
import './UserProfile.css'

export default function UserProfile() {
  const { user, loadUser } = useAuthStore()
  const [showMenu, setShowMenu] = useState(false)
  const [showCropper, setShowCropper] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const error = validateImageFile(file)
    if (error) {
      alert(error)
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setImageToCrop(event.target?.result as string)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = async (croppedImageUrl: string) => {
    setShowCropper(false)
    setUploading(true)

    try {
      await uploadProfilePicture(croppedImageUrl, async (url) => {
        await apiClient.updateProfile(undefined, undefined, url)
        await loadUser()
      })
      setImageToCrop(null)
    } catch (error) {
      console.error('Failed to upload profile picture:', error)
      alert('Failed to upload profile picture. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePicture = async () => {
    if (!confirm('Remove profile picture?')) return
    try {
      await apiClient.updateProfile(undefined, undefined, null)
      await loadUser()
      setShowMenu(false)
    } catch (error) {
      console.error('Failed to remove profile picture:', error)
      alert('Failed to remove profile picture. Please try again.')
    }
  }

  return (
    <>
      <div className="user-profile" ref={menuRef}>
        <div
          className="user-profile-avatar"
          onClick={() => setShowMenu(!showMenu)}
          style={{ cursor: 'pointer' }}
        >
          {uploading ? (
            <div className="user-profile-loading">⏳</div>
          ) : (
            <Avatar src={user?.profilePicture} name={user?.name} size={40} />
          )}
        </div>

        {showMenu && (
          <div className="user-profile-menu">
            <div className="user-profile-menu-header">
              <Avatar
                src={user?.profilePicture}
                name={user?.name}
                size={48}
                className="user-profile-menu-avatar"
              />
              <div className="user-profile-menu-info">
                <div className="user-profile-menu-name">
                  {user?.name || 'User'}
                </div>
                <div className="user-profile-menu-status">Online</div>
              </div>
            </div>

            <div className="user-profile-menu-divider" />

            <button
              className="user-profile-menu-item"
              onClick={() => {
                fileInputRef.current?.click()
                setShowMenu(false)
              }}
            >
              📷 {user?.profilePicture ? 'Change Picture' : 'Upload Picture'}
            </button>

            {user?.profilePicture && (
              <button
                className="user-profile-menu-item"
                onClick={handleRemovePicture}
              >
                🗑️ Remove Picture
              </button>
            )}

            <div className="user-profile-menu-divider" />

          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {showCropper && imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCrop={handleCropComplete}
          onCancel={() => {
            setShowCropper(false)
            setImageToCrop(null)
          }}
          circular={true}
        />
      )}
    </>
  )
}

