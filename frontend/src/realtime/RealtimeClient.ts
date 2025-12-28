/**
 * Transport-agnostic real-time client
 * 
 * This abstraction allows swapping WebSocket with:
 * - Server-Sent Events
 * - WebTransport
 * - gRPC-Web
 * - Mobile push + sync
 */

import type { RealtimeEvent } from '@/types'

export interface Transport {
  connect(): Promise<void>
  disconnect(): void
  send(event: RealtimeEvent): void
  onMessage(callback: (event: RealtimeEvent) => void): void
  onError(callback: (error: Error) => void): void
  onConnect(callback: () => void): void
  onDisconnect(callback: () => void): void
  isConnected(): boolean
}

export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null
  private url: string
  private token: string
  private messageCallbacks: Array<(event: RealtimeEvent) => void> = []
  private errorCallbacks: Array<(error: Error) => void> = []
  private connectCallbacks: Array<() => void> = []
  private disconnectCallbacks: Array<() => void> = []
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(url: string, token: string) {
    this.url = url
    this.token = token
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.url}?token=${this.token}`
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          this.reconnectAttempts = 0
          this.connectCallbacks.forEach(cb => cb())
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as RealtimeEvent
            this.messageCallbacks.forEach(cb => cb(data))
          } catch (error) {
            console.error('Failed to parse message:', error)
          }
        }

        this.ws.onerror = () => {
          const err = new Error('WebSocket error')
          this.errorCallbacks.forEach(cb => cb(err))
          reject(err)
        }

        this.ws.onclose = () => {
          this.disconnectCallbacks.forEach(cb => cb())
          this.attemptReconnect()
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        this.connect().catch(() => {
          // Reconnection will be attempted again
        })
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send(event: RealtimeEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event))
    } else {
      console.warn('WebSocket not connected, message not sent:', event)
    }
  }

  onMessage(callback: (event: RealtimeEvent) => void): void {
    this.messageCallbacks.push(callback)
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback)
  }

  onConnect(callback: () => void): void {
    this.connectCallbacks.push(callback)
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback)
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

export class RealtimeClient {
  private transport: Transport
  private eventHandlers: Map<string, Array<(payload: any) => void>> = new Map()

  constructor(transport: Transport) {
    this.transport = transport
    
    this.transport.onMessage((event) => {
      const handlers = this.eventHandlers.get(event.type) || []
      handlers.forEach(handler => handler(event.payload))
    })
  }

  async connect(): Promise<void> {
    await this.transport.connect()
  }

  disconnect(): void {
    this.transport.disconnect()
  }

  subscribe(eventType: string, handler: (payload: any) => void): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, [])
    }
    this.eventHandlers.get(eventType)!.push(handler)

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType) || []
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  publish(eventType: string, payload: any): void {
    this.transport.send({
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    })
  }

  isConnected(): boolean {
    return this.transport.isConnected()
  }
}

