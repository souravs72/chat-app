import { create } from 'zustand'
import type { User } from '@/types'
import { apiClient } from '@/api/client'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (phone: string, password: string) => Promise<void>
  signup: (name: string, phone: string, password: string) => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (phone: string, password: string) => {
    const { token, user } = await apiClient.login(phone, password)
    localStorage.setItem('token', token)
    set({ token, user, isAuthenticated: true })
  },

  signup: async (name: string, phone: string, password: string) => {
    const { token, user } = await apiClient.signup(name, phone, password)
    localStorage.setItem('token', token)
    set({ token, user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null, isAuthenticated: false })
  },

  loadUser: async () => {
    try {
      const user = await apiClient.getCurrentUser()
      set({ user })
    } catch (error) {
      console.error('Failed to load user:', error)
      localStorage.removeItem('token')
      set({ user: null, token: null, isAuthenticated: false })
    }
  },
}))

