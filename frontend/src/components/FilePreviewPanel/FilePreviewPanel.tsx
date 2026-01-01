import { useState, useRef, useEffect } from 'react'
import './FilePreviewPanel.css'
import type { MessageType } from '@/types'

interface FilePreviewPanelProps {
  file: File
  messageType: MessageType
  onSend: (file: File, caption?: string) => void
  onCancel: () => void
}

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

/**
 * FilePreviewPanel Component
 * 
 * Displays a preview of the selected file and provides editing tools for images.
 * For images: crop, add text, draw lines, add emojis
 * For other files: simple preview without editing options
 */
export default function FilePreviewPanel({
  file,
  messageType,
  onSend,
  onCancel,
}: FilePreviewPanelProps) {
  const [caption, setCaption] = useState('')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editMode, setEditMode] = useState<'crop' | 'text' | 'draw' | 'emoji' | null>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawColor, setDrawColor] = useState('#000000')
  const [textInputs, setTextInputs] = useState<Array<{ id: number; x: number; y: number; text: string; color: string }>>([])
  const [nextTextId, setNextTextId] = useState(1)
  const [emojis, setEmojis] = useState<Array<{ id: number; x: number; y: number; emoji: string }>>([])
  const [nextEmojiId, setNextEmojiId] = useState(1)
  const [cropArea, setCropArea] = useState<CropArea | null>(null)
  const [isCropping, setIsCropping] = useState(false)
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null)
  const [scale, setScale] = useState(1)

  const isImage = messageType === 'image'

  useEffect(() => {
    if (isImage && file) {
      const url = URL.createObjectURL(file)
      setImageUrl(url)
      const img = new Image()
      img.onload = () => {
        setOriginalImage(img)
      }
      img.src = url
      return () => {
        URL.revokeObjectURL(url)
      }
    }
  }, [file, isImage])

  useEffect(() => {
    if (imageRef.current && originalImage) {
      const img = imageRef.current
      const rect = img.getBoundingClientRect()
      const newScale = rect.width / originalImage.naturalWidth
      setScale(newScale)
      
      if (drawCanvasRef.current) {
        const canvas = drawCanvasRef.current
        canvas.width = rect.width
        canvas.height = rect.height
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`
      }
    }
  }, [originalImage, imageUrl])

  const handleCropStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editMode !== 'crop' || !imageRef.current) return
    setIsCropping(true)
    const img = imageRef.current
    const rect = img.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setCropStart({ x, y })
    setCropArea({ x, y, width: 0, height: 0 })
  }

  const handleCropMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCropping || !cropStart || !imageRef.current) return
    const img = imageRef.current
    const rect = img.getBoundingClientRect()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top
    
    const x = Math.min(cropStart.x, currentX)
    const y = Math.min(cropStart.y, currentY)
    const width = Math.abs(currentX - cropStart.x)
    const height = Math.abs(currentY - cropStart.y)
    
    setCropArea({ x, y, width, height })
  }

  const handleCropEnd = () => {
    setIsCropping(false)
    setCropStart(null)
  }

  const handleCropApply = () => {
    if (!cropArea || !originalImage) return
    // Crop is applied when rendering the final image
    setEditMode(null)
    setIsEditing(false)
  }

  const handleDrawStart = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editMode !== 'draw' || !drawCanvasRef.current) return
    setIsDrawing(true)
    const canvas = drawCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || editMode !== 'draw' || !drawCanvasRef.current) return
    const canvas = drawCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = drawColor
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const handleDrawEnd = () => {
    setIsDrawing(false)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editMode === 'text' && imageRef.current) {
      const img = imageRef.current
      const rect = img.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      const text = prompt('Enter text:')
      if (text) {
        setTextInputs([...textInputs, { id: nextTextId, x, y, text, color: drawColor }])
        setNextTextId(nextTextId + 1)
      }
    } else if (editMode === 'emoji' && imageRef.current) {
      const img = imageRef.current
      const rect = img.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      const emoji = prompt('Enter emoji:')
      if (emoji) {
        setEmojis([...emojis, { id: nextEmojiId, x, y, emoji }])
        setNextEmojiId(nextEmojiId + 1)
      }
    }
  }

  const exportEditedImage = async (): Promise<File> => {
    if (!originalImage || !hiddenCanvasRef.current) {
      throw new Error('Image not loaded')
    }

    const canvas = hiddenCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Could not get canvas context')
    }

    // Determine output dimensions (apply crop if exists)
    let outputWidth = originalImage.naturalWidth
    let outputHeight = originalImage.naturalHeight
    let sourceX = 0
    let sourceY = 0
    let sourceWidth = originalImage.naturalWidth
    let sourceHeight = originalImage.naturalHeight

    if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
      // Convert display coordinates to natural image coordinates
      sourceX = cropArea.x / scale
      sourceY = cropArea.y / scale
      sourceWidth = cropArea.width / scale
      sourceHeight = cropArea.height / scale
      outputWidth = sourceWidth
      outputHeight = sourceHeight
    }

    canvas.width = outputWidth
    canvas.height = outputHeight

    // Draw the base image (with crop applied)
    ctx.drawImage(
      originalImage,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, outputWidth, outputHeight
    )

    // Draw the drawing layer (scale drawings to match)
    if (drawCanvasRef.current) {
      const drawCanvas = drawCanvasRef.current
      // Create a temporary canvas to scale the drawing
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = outputWidth
      tempCanvas.height = outputHeight
      const tempCtx = tempCanvas.getContext('2d')
      if (tempCtx) {
        if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
          // Draw only the cropped portion
          tempCtx.drawImage(
            drawCanvas,
            cropArea.x, cropArea.y, cropArea.width, cropArea.height,
            0, 0, outputWidth, outputHeight
          )
        } else {
          tempCtx.drawImage(drawCanvas, 0, 0, outputWidth, outputHeight)
        }
        ctx.drawImage(tempCanvas, 0, 0)
      }
    }

    // Draw text overlays
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const fontSize = 24 * (outputWidth / (cropArea ? (cropArea.width / scale) : originalImage.naturalWidth))
    textInputs.forEach((textInput) => {
      // Convert display coordinates to natural image coordinates
      const naturalX = textInput.x / scale
      const naturalY = textInput.y / scale
      
      let textX: number
      let textY: number
      
      // Adjust for crop
      if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
        const cropNaturalX = cropArea.x / scale
        const cropNaturalY = cropArea.y / scale
        textX = naturalX - cropNaturalX
        textY = naturalY - cropNaturalY
        // Check if text is within crop area
        if (textX < 0 || textY < 0 || textX > outputWidth || textY > outputHeight) {
          return // Skip this text if outside crop area
        }
      } else {
        // No crop, coordinates are already in natural space, but we're drawing to full output
        textX = (naturalX / originalImage.naturalWidth) * outputWidth
        textY = (naturalY / originalImage.naturalHeight) * outputHeight
      }
      
      ctx.fillStyle = textInput.color
      ctx.font = `${fontSize}px Arial`
      ctx.fillText(textInput.text, textX, textY)
    })

    // Draw emoji overlays
    const emojiSize = 32 * (outputWidth / (cropArea ? (cropArea.width / scale) : originalImage.naturalWidth))
    emojis.forEach((emojiItem) => {
      // Convert display coordinates to natural image coordinates
      const naturalX = emojiItem.x / scale
      const naturalY = emojiItem.y / scale
      
      let emojiX: number
      let emojiY: number
      
      // Adjust for crop
      if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
        const cropNaturalX = cropArea.x / scale
        const cropNaturalY = cropArea.y / scale
        emojiX = naturalX - cropNaturalX
        emojiY = naturalY - cropNaturalY
        // Check if emoji is within crop area
        if (emojiX < 0 || emojiY < 0 || emojiX > outputWidth || emojiY > outputHeight) {
          return // Skip this emoji if outside crop area
        }
      } else {
        // No crop, coordinates are already in natural space, but we're drawing to full output
        emojiX = (naturalX / originalImage.naturalWidth) * outputWidth
        emojiY = (naturalY / originalImage.naturalHeight) * outputHeight
      }
      
      ctx.font = `${emojiSize}px Arial`
      ctx.fillText(emojiItem.emoji, emojiX, emojiY)
    })

    // Convert canvas to blob and then to File
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'))
          return
        }
        const editedFile = new File([blob], file.name, { type: file.type || 'image/png' })
        resolve(editedFile)
      }, file.type || 'image/png', 0.95)
    })
  }

  const hasEdits = () => {
    if (!isImage) return false
    if (cropArea && cropArea.width > 0 && cropArea.height > 0) return true
    if (textInputs.length > 0) return true
    if (emojis.length > 0) return true
    if (drawCanvasRef.current) {
      const ctx = drawCanvasRef.current.getContext('2d')
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height)
        // Check if canvas has any non-transparent pixels
        const hasDrawings = imageData.data.some((value, index) => index % 4 !== 3 && value !== 0)
        if (hasDrawings) return true
      }
    }
    return false
  }

  const handleSend = async () => {
    try {
      let fileToSend = file
      if (isImage && hasEdits()) {
        fileToSend = await exportEditedImage()
      }
      onSend(fileToSend, caption.trim() || undefined)
    } catch (error) {
      console.error('Failed to export edited image:', error)
      // Fallback to original file if export fails
      onSend(file, caption.trim() || undefined)
    }
  }

  const getFileIcon = () => {
    if (isImage) return '📷'
    if (messageType === 'video') return '🎥'
    if (messageType === 'audio') return '🎵'
    return '📄'
  }

  const getFilePreview = () => {
    if (isImage) {
      return (
        <div 
          ref={containerRef}
          className="file-preview-image-container"
          onMouseDown={editMode === 'crop' ? handleCropStart : undefined}
          onMouseMove={editMode === 'crop' ? handleCropMove : undefined}
          onMouseUp={editMode === 'crop' ? handleCropEnd : undefined}
          onMouseLeave={editMode === 'crop' ? handleCropEnd : undefined}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Preview"
            className="file-preview-image"
          />
          {(isEditing && editMode === 'draw') && (
            <canvas
              ref={drawCanvasRef}
              className="file-preview-canvas"
              onMouseDown={handleDrawStart}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              onMouseLeave={handleDrawEnd}
            />
          )}
          {editMode === 'crop' && cropArea && (
            <div
              className="file-preview-crop-area"
              style={{
                left: `${cropArea.x}px`,
                top: `${cropArea.y}px`,
                width: `${cropArea.width}px`,
                height: `${cropArea.height}px`,
              }}
            />
          )}
          {textInputs.map((textInput) => (
            <div
              key={textInput.id}
              className="file-preview-text-overlay"
              style={{
                left: `${textInput.x}px`,
                top: `${textInput.y}px`,
                color: textInput.color,
              }}
            >
              {textInput.text}
            </div>
          ))}
          {emojis.map((emojiItem) => (
            <div
              key={emojiItem.id}
              className="file-preview-emoji-overlay"
              style={{
                left: `${emojiItem.x}px`,
                top: `${emojiItem.y}px`,
              }}
            >
              {emojiItem.emoji}
            </div>
          ))}
          {(isEditing && (editMode === 'text' || editMode === 'emoji')) && (
            <div
              className="file-preview-click-overlay"
              onClick={handleCanvasClick}
            />
          )}
        </div>
      )
    }

    return (
      <div className="file-preview-info">
        <div className="file-preview-icon">{getFileIcon()}</div>
        <div className="file-preview-name">{file.name}</div>
        <div className="file-preview-size">
          {(file.size / 1024).toFixed(2)} KB
        </div>
      </div>
    )
  }

  return (
    <div className="file-preview-panel">
      <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />
      <div className="file-preview-header">
        <h3 className="file-preview-title">Preview & Edit</h3>
        <button
          type="button"
          className="file-preview-close"
          onClick={onCancel}
          aria-label="Close preview"
        >
          ×
        </button>
      </div>

      <div className="file-preview-content">
        {getFilePreview()}
      </div>

      {isImage && (
        <div className="file-preview-tools">
          <div className="file-preview-tool-buttons">
            <button
              type="button"
              className={`file-preview-tool-btn ${editMode === 'crop' ? 'active' : ''}`}
              onClick={() => {
                const newMode = editMode === 'crop' ? null : 'crop'
                setEditMode(newMode)
                setIsEditing(newMode !== null)
                if (newMode === null && cropArea) {
                  handleCropApply()
                }
              }}
              title="Crop image"
            >
              ✂️ Crop
            </button>
            <button
              type="button"
              className={`file-preview-tool-btn ${editMode === 'text' ? 'active' : ''}`}
              onClick={() => {
                setEditMode(editMode === 'text' ? null : 'text')
                setIsEditing(editMode !== 'text')
              }}
              title="Add text"
            >
              📝 Text
            </button>
            <button
              type="button"
              className={`file-preview-tool-btn ${editMode === 'draw' ? 'active' : ''}`}
              onClick={() => {
                setEditMode(editMode === 'draw' ? null : 'draw')
                setIsEditing(editMode !== 'draw')
              }}
              title="Draw lines"
            >
              ✏️ Draw
            </button>
            <button
              type="button"
              className={`file-preview-tool-btn ${editMode === 'emoji' ? 'active' : ''}`}
              onClick={() => {
                setEditMode(editMode === 'emoji' ? null : 'emoji')
                setIsEditing(editMode !== 'emoji')
              }}
              title="Add emoji"
            >
              😊 Emoji
            </button>
            {editMode === 'draw' || editMode === 'text' ? (
              <input
                type="color"
                value={drawColor}
                onChange={(e) => setDrawColor(e.target.value)}
                className="file-preview-color-picker"
                title="Choose color"
              />
            ) : null}
          </div>
        </div>
      )}

      <div className="file-preview-footer">
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption (optional)"
          className="file-preview-caption"
        />
        <div className="file-preview-actions">
          <button
            type="button"
            className="file-preview-btn file-preview-btn-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="file-preview-btn file-preview-btn-send"
            onClick={handleSend}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
