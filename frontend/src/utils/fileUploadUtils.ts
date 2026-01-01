import { apiClient } from '@/api/client'
import type { MessageType } from '@/types'

/**
 * File upload utility functions
 * Handles file uploads to media service and returns media URLs
 */

export interface UploadOptions {
  onProgress?: (progress: number) => void
  maxSize?: number // in bytes
}

export interface FileUploadResult {
  mediaUrl: string
  fileType: MessageType
}

/**
 * Get the message type based on file MIME type
 */
export function getMessageTypeFromFile(file: File): MessageType {
  const mimeType = file.type.toLowerCase()
  
  if (mimeType.startsWith('image/')) {
    return 'image'
  }
  if (mimeType.startsWith('video/')) {
    return 'video'
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio'
  }
  
  return 'document'
}

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxSize: number): boolean {
  return file.size <= maxSize
}

/**
 * Upload a file to the media service
 */
export async function uploadFile(
  file: File,
  options: UploadOptions = {}
): Promise<FileUploadResult> {
  const { onProgress, maxSize = 100 * 1024 * 1024 } = options // Default 100MB

  // Validate file size
  if (!validateFileSize(file, maxSize)) {
    throw new Error(`File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`)
  }

  try {
    // Get upload URL from backend
    const { uploadUrl, mediaUrl } = await apiClient.getUploadUrl(
      file.name,
      file.type
    )

    // Upload file to storage (S3, etc.)
    const xhr = new XMLHttpRequest()

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100)
          onProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const fileType = getMessageTypeFromFile(file)
          resolve({ mediaUrl, fileType })
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was aborted'))
      })

      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
  } catch (error) {
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Create a file input element programmatically
 */
export function createFileInput(
  accept: string,
  multiple: boolean = false
): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.multiple = multiple
  input.style.display = 'none'
  return input
}

