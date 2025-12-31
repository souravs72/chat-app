import { apiClient } from '@/api/client'
import { compressImage, PROFILE_PIC_MAX_SIZE, PROFILE_PIC_QUALITY } from './imageUtils'

export async function uploadProfilePicture(
  imageUrl: string,
  onSuccess: (url: string) => Promise<void>
): Promise<void> {
  try {
    const response = await fetch(imageUrl)
    const blob = await response.blob()

    const { uploadUrl, mediaUrl } = await apiClient.getUploadUrl(
      'profile.jpg',
      'image/jpeg'
    )

    await fetch(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'image/jpeg' },
    })

    await onSuccess(mediaUrl)
  } catch (error: any) {
    if (error.response?.status === 503 || error.response?.status === 500) {
      const compressed = await compressImage(
        imageUrl,
        PROFILE_PIC_MAX_SIZE,
        PROFILE_PIC_QUALITY
      )
      await onSuccess(compressed)
    } else {
      throw error
    }
  }
}

