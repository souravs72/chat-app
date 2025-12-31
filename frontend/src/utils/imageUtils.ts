export const MAX_FILE_SIZE = 5 * 1024 * 1024
export const PROFILE_PIC_MAX_SIZE = 150
export const PROFILE_PIC_QUALITY = 0.7

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Please select an image file'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Image size must be less than 5MB'
  }
  return null
}

export function compressImage(
  imageUrl: string,
  maxSize: number = PROFILE_PIC_MAX_SIZE,
  quality: number = PROFILE_PIC_QUALITY
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(imageUrl)
        return
      }

      let { width, height } = img
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(imageUrl)
    img.src = imageUrl
  })
}


