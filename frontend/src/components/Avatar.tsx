import './Avatar.css'

interface AvatarProps {
  src?: string | null
  name?: string
  size?: number
  className?: string
}

export default function Avatar({ src, name, size = 40, className = '' }: AvatarProps) {
  const initials = name?.charAt(0).toUpperCase() || '?'

  return (
    <div
      className={`avatar ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? (
        <img src={src} alt={name || 'User'} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}

