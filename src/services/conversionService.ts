import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { jsPDF } from 'jspdf'

export const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() || ''
export const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

export function getTargets(file: File): string[] {
  const ext = extensionOf(file.name)
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext)) return ['PNG', 'JPG', 'WEBP', 'BMP']
  if (['txt', 'html', 'htm', 'rtf'].includes(ext)) return ['TXT', 'HTML', 'PDF', 'DOCX']
  if (ext === 'docx') return ['TXT']
  if (ext === 'zip') return ['EXTRACT', 'ZIP']
  return []
}

async function imageToBlob(file: File, target: string, quality: number, width: number, height: number, background: string): Promise<Blob> {
  const source = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = source
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('This image could not be opened.')) })
    const canvas = document.createElement('canvas')
    const ratio = Math.min(width > 0 ? width / image.naturalWidth : 1, height > 0 ? height / image.naturalHeight : 1, 1)
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare the image.')
    if (target === 'JPG' || target === 'BMP') { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height) }
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const mime = target === 'JPG' ? 'image/jpeg' : target === 'WEBP' ? 'image/webp' : target === 'BMP' ? 'image/bmp' : 'image/png'
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error(`Your browser cannot export ${target} images.`)), mime, quality / 100))
    if (target === 'BMP' && blob.type !== 'image/bmp') throw new Error('BMP export is not supported by this browser. Try PNG, JPG or WEBP.')
    return blob
  } finally { URL.revokeObjectURL(source) }
}

export async function convertFile(file: File, target: string, options: { quality: number; width: number; height: number; background: string }): Promise<{ blob?: Blob; name: string; extracted?: boolean }> {
  const ext = extensionOf(file.name)
  const base = file.name.replace(/\.[^.]+$/, '') || 'converted-file'
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext)) {
    if (ext === 'gif' && target !== 'GIF') throw new Error('GIF conversion exports a still frame only. Animated GIF conversion is not enabled.')
    const blob = await imageToBlob(file, target, options.quality, options.width, options.height, options.background)
    return { blob, name: `${base}.${target.toLowerCase()}` }
  }
  if (ext === 'zip') {
    const zip = await JSZip.loadAsync(file, { checkCRC32: true })
    const entries = Object.values(zip.files).filter(entry => !entry.dir)
    if (target === 'EXTRACT') {
      if (entries.length > 500) throw new Error('This archive contains more than 500 files. For safety, extraction is limited.')
      for (const entry of entries) {
        const normalized = entry.name.replace(/\\/g, '/')
        if (normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error('This archive contains an unsafe file path and cannot be extracted.')
      }
      const out = new JSZip()
      for (const entry of entries) out.file(entry.name, await entry.async('uint8array'))
      const blob = await out.generateAsync({ type: 'blob' })
      return { blob, name: `${base}-extracted.zip`, extracted: true }
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    return { blob, name: `${base}-converted.zip` }
  }
  if (['txt', 'html', 'htm', 'rtf'].includes(ext) || (ext === 'docx' && target === 'TXT')) {
    let text = await file.text()
    if (ext === 'docx') {
      const mammoth = await import('mammoth/mammoth.browser')
      const buffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer: buffer })
      text = result.value
    } else if (ext === 'html' || ext === 'htm') {
      const document = new DOMParser().parseFromString(text, 'text/html')
      text = document.body.innerText || document.body.textContent || ''
    } else if (ext === 'rtf') {
      text = text.replace(/\\'[0-9a-f]{2}/gi, '').replace(/\\par\b/g, '\n').replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '')
    }
    if (target === 'TXT') return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), name: `${base}.txt` }
    if (target === 'HTML') return { blob: new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>${base}</title></head><body><pre>${escapeHtml(text)}</pre></body></html>`], { type: 'text/html;charset=utf-8' }), name: `${base}.html` }
    if (target === 'DOCX') {
      const doc = new Document({ sections: [{ children: text.split(/\r?\n/).map(line => new Paragraph({ children: [new TextRun(line)] })) }] })
      return { blob: await Packer.toBlob(doc), name: `${base}.docx` }
    }
    if (target === 'PDF') {
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      pdf.setFont('helvetica', 'normal')
      const lines = pdf.splitTextToSize(text, 515)
      let y = 48
      for (const line of lines) { if (y > 790) { pdf.addPage(); y = 48 }; pdf.text(line, 40, y); y += 16 }
      return { blob: pdf.output('blob'), name: `${base}.pdf` }
    }
  }
  throw new Error(`Conversion from ${ext.toUpperCase() || 'this file type'} to ${target} is not available in this browser build. Audio, video, RAR, 7Z and advanced document conversions require a configured backend.`)
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char) ) }

export async function createZip(files: File[], compression: number): Promise<Blob> {
  const zip = new JSZip()
  for (const file of files) {
    const safeName = file.name.replace(/[\\/]/g, '_').replace(/^\.+/, '')
    if (!safeName) continue
    zip.file(safeName, file)
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: compression } })
}

export function downloadBlob(blob: Blob, name: string) { saveAs(blob, name) }
