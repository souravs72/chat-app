import { useState, useRef, useEffect } from 'react'
import './ImageCropper.css'

interface ImageCropperProps {
  imageSrc: string
  onCrop: (croppedImageUrl: string) => void
  onCancel: () => void
  circular?: boolean
}

export default function ImageCropper({
  imageSrc,
  onCrop,
  onCancel,
  circular = true,
}: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)
  const [cropSize, setCropSize] = useState(200)

  const MIN_SCALE = 0.5
  const MAX_SCALE = 3

  useEffect(() => {
    const updateCropSize = () => {
      setCropSize(window.innerWidth <= 480 ? 120 : window.innerWidth <= 640 ? 150 : 200)
    }
    updateCropSize()
    window.addEventListener('resize', updateCropSize)
    return () => window.removeEventListener('resize', updateCropSize)
  }, [])

  useEffect(() => {
    if (imageRef.current?.complete) {
      setImageLoaded(true)
      initializeImage()
    }
  }, [imageSrc, cropSize])

  const initializeImage = () => {
    if (!imageRef.current || !containerRef.current) return

    const img = imageRef.current
    const { clientWidth, clientHeight } = containerRef.current
    const scale = Math.max(clientWidth / img.naturalWidth, clientHeight / img.naturalHeight) * 1.2

    setScale(scale)
    setPosition({
      x: (clientWidth - img.naturalWidth * scale) / 2,
      y: (clientHeight - img.naturalHeight * scale) / 2,
    })
  }

  const handleImageLoad = () => {
    setImageLoaded(true)
    initializeImage()
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const container = containerRef.current
    const img = imageRef.current
    if (!img) return

    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y

    // Constrain movement within container bounds
    const maxX = container.clientWidth - img.naturalWidth * scale
    const maxY = container.clientHeight - img.naturalHeight * scale

    setPosition({
      x: Math.max(maxX, Math.min(0, newX)),
      y: Math.max(maxY, Math.min(0, newY)),
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta))
    setScale(newScale)
  }

  const handleCrop = () => {
    const canvas = canvasRef.current
    const img = imageRef.current
    const container = containerRef.current
    if (!canvas || !img || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = cropSize
    canvas.height = cropSize

    const { width, height } = container.getBoundingClientRect()
    const cropX = (width - cropSize) / 2
    const cropY = (height - cropSize) / 2
    const sourceSize = cropSize / scale

    if (circular) {
      ctx.beginPath()
      ctx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, 2 * Math.PI)
      ctx.clip()
    }

    ctx.drawImage(
      img,
      (cropX - position.x) / scale,
      (cropY - position.y) / scale,
      sourceSize,
      sourceSize,
      0,
      0,
      cropSize,
      cropSize
    )

    onCrop(canvas.toDataURL('image/png'))
  }

  return (
    <div className="image-cropper-overlay">
      <div className="image-cropper-container">
        <div className="image-cropper-header">
          <h3>Crop Image</h3>
          <button className="image-cropper-close" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="image-cropper-content">
          <div
            ref={containerRef}
            className="image-cropper-preview"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop preview"
              onLoad={handleImageLoad}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'top left',
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              className="image-cropper-image"
            />
            <div 
              className={`image-cropper-crop-area ${circular ? 'circular' : ''}`}
              style={{
                width: `${cropSize}px`,
                height: `${cropSize}px`,
              }}
            />
          </div>

          <div className="image-cropper-controls">
            <div className="image-cropper-hint">
              Drag to move • Scroll to zoom
            </div>
            <div className="image-cropper-buttons">
              <button className="image-cropper-btn-cancel" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="image-cropper-btn-crop"
                onClick={handleCrop}
                disabled={!imageLoaded}
              >
                Crop
              </button>
            </div>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}

