import type { Category } from '../types/file'

export const categories: { id: Category; title: string; description: string; formats: string; icon: string }[] = [
  { id: 'archive', title: 'Archive Converter', description: 'Package files into a ZIP or unpack an existing ZIP archive.', formats: 'ZIP · create & extract', icon: 'archive' },
  { id: 'document', title: 'Document Converter', description: 'Turn text and HTML into portable documents.', formats: 'TXT · HTML · PDF · DOCX', icon: 'document' },
  { id: 'image', title: 'Image Converter', description: 'Convert images right in your browser with size and quality controls.', formats: 'PNG · JPG · WEBP · BMP', icon: 'image' },
  { id: 'audio', title: 'Audio Converter', description: 'Audio conversion needs a media processing service.', formats: 'MP3 · WAV · OGG · FLAC', icon: 'audio' },
  { id: 'video', title: 'Video Converter', description: 'Video conversion needs FFmpeg on a server or in-browser.', formats: 'MP4 · WEBM · MOV · MKV', icon: 'video' },
]
