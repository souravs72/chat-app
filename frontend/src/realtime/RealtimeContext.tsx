import { createContext } from 'react'
import { RealtimeClient } from './RealtimeClient'

export const RealtimeContext = createContext<RealtimeClient | null>(null)


