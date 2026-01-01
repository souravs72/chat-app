import { useContext } from 'react'
import { RealtimeContext } from './RealtimeContext'
import { RealtimeClient } from './RealtimeClient'

export function useRealtime(): RealtimeClient {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider')
  }
  return context
}
