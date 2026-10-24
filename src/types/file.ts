export type Category = 'archive' | 'document' | 'image' | 'audio' | 'video'
export interface ConversionRecord {
  id: string
  name: string
  from: string
  to: string
  date: string
  status: 'Complete' | 'Failed'
}
