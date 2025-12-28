import axios, { AxiosInstance } from 'axios'
import type { AuthResponse, User, Chat, Message, Story } from '@/types'

class ApiClient {
  private client: AxiosInstance

  constructor(baseURL: string = '/api') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    // Handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  // Auth endpoints
  async signup(name: string, phone: string, password: string): Promise<AuthResponse> {
    const response = await this.client.post('/auth/signup', { name, phone, password })
    return response.data
  }

  async login(phone: string, password: string): Promise<AuthResponse> {
    const response = await this.client.post('/auth/login', { phone, password })
    return response.data
  }

  // User endpoints
  async getCurrentUser(): Promise<User> {
    const response = await this.client.get('/users/me')
    return response.data
  }

  async getUser(userId: string): Promise<User> {
    const response = await this.client.get(`/users/${userId}`)
    return response.data
  }

  async updateStatus(status: 'online' | 'offline'): Promise<void> {
    await this.client.patch('/users/me/status', { status })
  }

  // Chat endpoints
  async getChats(): Promise<Chat[]> {
    const response = await this.client.get('/chats')
    return response.data
  }

  async getChat(chatId: string): Promise<Chat> {
    const response = await this.client.get(`/chats/${chatId}`)
    return response.data
  }

  async createPersonalChat(userId: string): Promise<Chat> {
    const response = await this.client.post('/chats/personal', { userId })
    return response.data
  }

  async createChannel(name: string): Promise<Chat> {
    const response = await this.client.post('/chats/channel', { name })
    return response.data
  }

  async getMessages(chatId: string, limit: number = 50, before?: string): Promise<Message[]> {
    const params: any = { limit }
    if (before) params.before = before
    const response = await this.client.get(`/chats/${chatId}/messages`, { params })
    return response.data
  }

  async sendMessage(chatId: string, type: string, content: string, mediaUrl?: string): Promise<Message> {
    const response = await this.client.post(`/chats/${chatId}/messages`, {
      type,
      content,
      mediaUrl,
    })
    return response.data
  }

  async pinChat(chatId: string): Promise<void> {
    await this.client.post(`/chats/${chatId}/pin`)
  }

  async unpinChat(chatId: string): Promise<void> {
    await this.client.delete(`/chats/${chatId}/pin`)
  }

  async markAsRead(chatId: string, messageId: string): Promise<void> {
    await this.client.post(`/chats/${chatId}/messages/${messageId}/read`)
  }

  // Story endpoints
  async getStories(): Promise<Story[]> {
    const response = await this.client.get('/stories')
    return response.data
  }

  async createStory(mediaUrl: string): Promise<Story> {
    const response = await this.client.post('/stories', { mediaUrl })
    return response.data
  }

  // Media endpoints
  async getUploadUrl(fileName: string, fileType: string): Promise<{ uploadUrl: string; mediaUrl: string }> {
    const response = await this.client.post('/media/upload-url', { fileName, fileType })
    return response.data
  }
}

export const apiClient = new ApiClient()

