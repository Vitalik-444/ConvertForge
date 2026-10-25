import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { jsPDF } from 'jspdf'

export type ConversionOptions = { quality: number; width: number; height: number; background: string; compression?: number }
export type ConversionOutput = { blob?: Blob; name: string; extracted?: boolean }

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'avif', 'ico']
export const TEXT_EXTENSIONS = ['txt', 'html', 'htm', 'rtf', 'md', 'markdown', 'csv', 'json', 'xml', 'log']

export const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() || ''
export const isImageName = (name: string) => IMAGE_EXTENSIONS.includes(extensionOf(name))
export const isZipName = (name: string) => extensionOf(name) === 'zip'
export const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

export function getTargets(file: File): string[] {
  const ext = extensionOf(file.name)
  if (IMAGE_EXTENSIONS.includes(ext)) return ['PNG', 'JPG', 'WEBP', 'BMP', 'PDF', 'ZIP']
  if (TEXT_EXTENSIONS.includes(ext)) {
    const targets = ['TXT', 'HTML', 'PDF', 'DOCX']
    if (ext === 'csv') targets.push('JSON')
    if (ext === 'json') targets.push('CSV')
    return [...targets, 'ZIP']
  }
  if (ext === 'docx') return ['TXT', 'HTML', 'PDF', 'ZIP']
  if (ext === 'zip') return ['EXTRACT', 'TXT', 'ZIP']
  return ['ZIP']
}

export function getBatchTargets(files: File[]): string[] {
  if (!files.length) return []
  const [first, ...rest] = files.map(file => getTargets(file).filter(target => target !== 'EXTRACT'))
  const common = first.filter(target => rest.every(list => list.includes(target)))
  return common.length ? common : ['ZIP']
}

function uniqueName(name: string, used: Set<string>) {
  if (!used.has(name)) { used.add(name); return name }
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const tail = dot > 0 ? name.slice(dot) : ''
  let counter = 2
  while (used.has(`${stem} (${counter})${tail}`)) counter++
  const next = `${stem} (${counter})${tail}`
  used.add(next)
  return next
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const source = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = source
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error(`${file.name} could not be opened as an image.`)) })
    return image
  } finally { setTimeout(() => URL.revokeObjectURL(source), 0) }
}

async function imageToCanvas(file: File, width: number, height: number, background: string, fill: boolean): Promise<HTMLCanvasElement> {
  const image = await loadImage(file)
  const sourceWidth = image.naturalWidth || 1024
  const sourceHeight = image.naturalHeight || 1024
  const canvas = document.createElement('canvas')
  const ratio = Math.min(width > 0 ? width / sourceWidth : 1, height > 0 ? height / sourceHeight : 1, 1)
  canvas.width = Math.max(1, Math.round(sourceWidth * ratio))
  canvas.height = Math.max(1, Math.round(sourceHeight * ratio))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare the image.')
  if (fill) { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height) }
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function imageToBlob(file: File, target: string, quality: number, width: number, height: number, background: string): Promise<Blob> {
  const canvas = await imageToCanvas(file, width, height, background, target === 'JPG' || target === 'BMP')
  const mime = target === 'JPG' ? 'image/jpeg' : target === 'WEBP' ? 'image/webp' : target === 'BMP' ? 'image/bmp' : 'image/png'
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error(`Your browser cannot export ${target} images.`)), mime, quality / 100))
  if (target === 'BMP' && blob.type !== 'image/bmp') throw new Error('BMP export is not supported by this browser. Try PNG, JPG or WEBP.')
  if (target === 'WEBP' && blob.type !== 'image/webp') throw new Error('WEBP export is not supported by this browser. Try PNG or JPG.')
  return blob
}

async function imagesToPdf(files: File[], options: ConversionOptions): Promise<Blob> {
  let pdf: jsPDF | null = null
  for (const file of files) {
    const canvas = await imageToCanvas(file, options.width, options.height, options.background, true)
    const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait'
    if (!pdf) pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation })
    else pdf.addPage('a4', orientation)
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 24
    const scale = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height)
    const drawWidth = canvas.width * scale
    const drawHeight = canvas.height * scale
    pdf.addImage(canvas.toDataURL('image/jpeg', Math.max(0.1, options.quality / 100)), 'JPEG', (pageWidth - drawWidth) / 2, (pageHeight - drawHeight) / 2, drawWidth, drawHeight)
  }
  if (!pdf) throw new Error('No images were selected.')
  return pdf.output('blob')
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char)) }

function htmlDocument(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;max-width:860px;margin:32px auto;padding:0 20px;line-height:1.65;color:#1e293b}pre{white-space:pre-wrap;word-break:break-word}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:6px 10px;text-align:left}th{background:#f1f5f9}code{background:#f1f5f9;padding:1px 5px;border-radius:4px}pre code{background:none;padding:0}blockquote{margin:0;padding-left:14px;border-left:3px solid #cbd5e1;color:#475569}img{max-width:100%}</style></head><body>${body}</body></html>`
}

function markdownToHtml(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let paragraph: string[] = []
  let list: 'ul' | 'ol' | null = null
  let fenced = false
  const inline = (value: string) => escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
  const flushParagraph = () => { if (paragraph.length) { out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = [] } }
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null } }
  for (const line of lines) {
    if (/^```/.test(line)) {
      flushParagraph(); closeList()
      out.push(fenced ? '</code></pre>' : '<pre><code>')
      fenced = !fenced
      continue
    }
    if (fenced) { out.push(escapeHtml(line)); continue }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const quote = line.match(/^>\s?(.*)$/)
    if (heading) { flushParagraph(); closeList(); out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`) }
    else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushParagraph(); closeList(); out.push('<hr>') }
    else if (bullet || numbered) {
      flushParagraph()
      const kind = bullet ? 'ul' : 'ol'
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind }
      out.push(`<li>${inline((bullet || numbered)![1])}</li>`)
    }
    else if (quote) { flushParagraph(); closeList(); out.push(`<blockquote>${inline(quote[1])}</blockquote>`) }
    else if (!line.trim()) { flushParagraph(); closeList() }
    else { closeList(); paragraph.push(line) }
  }
  flushParagraph(); closeList()
  if (fenced) out.push('</code></pre>')
  return out.join('\n')
}

function parseCsv(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] || ''
  const delimiter = [',', ';', '\t'].map(char => ({ char, count: firstLine.split(char).length })).sort((a, b) => b.count - a.count)[0].char
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++ }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === delimiter) { row.push(cell); cell = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++
      row.push(cell); cell = ''
      rows.push(row); row = []
    } else cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(item => item.some(value => value.trim() !== ''))
}

function csvToHtml(source: string): string {
  const rows = parseCsv(source)
  if (!rows.length) return '<p></p>'
  const [head, ...body] = rows
  return `<table><thead><tr>${head.map(value => `<th>${escapeHtml(value)}</th>`).join('')}</tr></thead><tbody>${body.map(item => `<tr>${item.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

function csvToJson(source: string): string {
  const rows = parseCsv(source)
  if (!rows.length) return '[]'
  const [head, ...body] = rows
  const keys = head.map((value, index) => value.trim() || `column${index + 1}`)
  return JSON.stringify(body.map(item => Object.fromEntries(keys.map((key, index) => [key, item[index] ?? '']))), null, 2)
}

function jsonToCsv(source: string): string {
  let data: unknown
  try { data = JSON.parse(source) } catch { throw new Error('This JSON file is not valid and cannot be converted.') }
  const items = Array.isArray(data) ? data : [data]
  if (!items.length || items.some(item => item === null || typeof item !== 'object')) throw new Error('JSON must be an object or an array of objects to convert it to CSV.')
  const keys = Array.from(new Set(items.flatMap(item => Object.keys(item as Record<string, unknown>))))
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [keys.map(cell).join(','), ...items.map(item => keys.map(key => cell((item as Record<string, unknown>)[key])).join(','))].join('\r\n')
}

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const result: string[] = []
  for (const paragraph of text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')) {
    if (!paragraph) { result.push(''); continue }
    let current = ''
    for (const word of paragraph.split(/(?<= )/)) {
      if (context.measureText(current + word).width <= maxWidth) { current += word; continue }
      if (current) result.push(current.trimEnd())
      current = ''
      if (context.measureText(word).width <= maxWidth) { current = word; continue }
      for (const char of word) {
        if (context.measureText(current + char).width > maxWidth && current) { result.push(current); current = '' }
        current += char
      }
    }
    result.push(current.trimEnd())
  }
  return result
}

function textToCanvasPdf(text: string): Blob {
  const scale = 2
  const pageWidth = 595
  const pageHeight = 842
  const margin = 44
  const lineHeight = 18
  const canvas = document.createElement('canvas')
  canvas.width = pageWidth * scale
  canvas.height = pageHeight * scale
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare the PDF.')
  context.scale(scale, scale)
  context.font = '12.5px "Segoe UI", Arial, "Helvetica Neue", sans-serif'
  context.textBaseline = 'top'
  const lines = wrapLines(context, text, pageWidth - margin * 2)
  const perPage = Math.floor((pageHeight - margin * 2) / lineHeight)
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pages = Math.max(1, Math.ceil(lines.length / perPage))
  for (let page = 0; page < pages; page++) {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, pageWidth, pageHeight)
    context.fillStyle = '#111827'
    lines.slice(page * perPage, (page + 1) * perPage).forEach((line, index) => context.fillText(line, margin, margin + index * lineHeight))
    if (page) pdf.addPage('a4', 'portrait')
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageWidth, pageHeight)
  }
  return pdf.output('blob')
}

function textToPdf(text: string): Blob {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ')
  if (/[^\n\u0020-\u007e\u00a0-\u00ff]/.test(normalized)) return textToCanvasPdf(normalized)
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  pdf.setFont('helvetica', 'normal')
  const lines = pdf.splitTextToSize(normalized, 515)
  let y = 48
  for (const line of lines) { if (y > 790) { pdf.addPage(); y = 48 }; pdf.text(line, 40, y); y += 16 }
  return pdf.output('blob')
}

async function readDocument(file: File, ext: string): Promise<{ text: string; html?: string }> {
  if (ext === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser')
    const arrayBuffer = await file.arrayBuffer()
    const [raw, rich] = await Promise.all([mammoth.extractRawText({ arrayBuffer }), mammoth.convertToHtml({ arrayBuffer })])
    return { text: raw.value, html: rich.value }
  }
  const raw = await file.text()
  if (ext === 'html' || ext === 'htm') {
    const parsed = new DOMParser().parseFromString(raw, 'text/html')
    parsed.querySelectorAll('script,style,noscript').forEach(node => node.remove())
    return { text: (parsed.body.textContent || '').replace(/\n\s*\n\s*\n+/g, '\n\n').trim() }
  }
  if (ext === 'rtf') return { text: raw.replace(/\\'[0-9a-f]{2}/gi, '').replace(/\\par\b/g, '\n').replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '') }
  if (ext === 'md' || ext === 'markdown') return { text: raw, html: markdownToHtml(raw) }
  if (ext === 'csv') return { text: raw, html: csvToHtml(raw) }
  if (ext === 'json') { try { return { text: JSON.stringify(JSON.parse(raw), null, 2) } } catch { return { text: raw } } }
  return { text: raw }
}

export async function convertFile(file: File, target: string, options: ConversionOptions): Promise<ConversionOutput> {
  const ext = extensionOf(file.name)
  const base = file.name.replace(/\.[^.]+$/, '') || 'converted-file'
  const level = options.compression ?? 6
  if (!getTargets(file).includes(target)) throw new Error(`Conversion from ${ext.toUpperCase() || 'this file type'} to ${target} is not available in this browser build. Audio, video, RAR, 7Z and advanced document conversions require a configured backend.`)
  if (target === 'ZIP' && ext !== 'zip') return { blob: await createZip([file], level), name: `${base}.zip` }
  if (IMAGE_EXTENSIONS.includes(ext)) {
    if (target === 'PDF') return { blob: await imagesToPdf([file], options), name: `${base}.pdf` }
    const blob = await imageToBlob(file, target, options.quality, options.width, options.height, options.background)
    return { blob, name: `${base}.${target.toLowerCase()}` }
  }
  if (ext === 'zip') {
    const zip = await JSZip.loadAsync(file, { checkCRC32: true })
    const entries = Object.values(zip.files).filter(entry => !entry.dir)
    if (target === 'TXT') {
      const listing = [`${file.name}`, `${entries.length} file(s)`, '', ...Object.values(zip.files).map(entry => entry.name)].join('\n')
      return { blob: new Blob([listing], { type: 'text/plain;charset=utf-8' }), name: `${base}-contents.txt` }
    }
    if (target === 'EXTRACT') {
      if (entries.length > 500) throw new Error('This archive contains more than 500 files. For safety, extraction is limited.')
      for (const entry of entries) {
        const normalized = entry.name.replace(/\\/g, '/')
        if (normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error('This archive contains an unsafe file path and cannot be extracted.')
      }
      const out = new JSZip()
      for (const entry of entries) out.file(entry.name, await entry.async('uint8array'))
      const blob = await out.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level } })
      return { blob, name: `${base}-extracted.zip`, extracted: true }
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level } })
    return { blob, name: `${base}-converted.zip` }
  }
  if (ext === 'csv' && target === 'JSON') return { blob: new Blob([csvToJson(await file.text())], { type: 'application/json;charset=utf-8' }), name: `${base}.json` }
  if (ext === 'json' && target === 'CSV') return { blob: new Blob(['\uFEFF' + jsonToCsv(await file.text())], { type: 'text/csv;charset=utf-8' }), name: `${base}.csv` }
  if (TEXT_EXTENSIONS.includes(ext) || ext === 'docx') {
    const { text, html } = await readDocument(file, ext)
    if (target === 'TXT') return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), name: `${base}.txt` }
    if (target === 'HTML') return { blob: new Blob([htmlDocument(base, html ?? `<pre>${escapeHtml(text)}</pre>`)], { type: 'text/html;charset=utf-8' }), name: `${base}.html` }
    if (target === 'DOCX') {
      const doc = new Document({ sections: [{ children: text.split(/\r?\n/).map(line => new Paragraph({ children: [new TextRun(line)] })) }] })
      return { blob: await Packer.toBlob(doc), name: `${base}.docx` }
    }
    if (target === 'PDF') return { blob: textToPdf(text), name: `${base}.pdf` }
  }
  throw new Error(`Conversion from ${ext.toUpperCase() || 'this file type'} to ${target} is not available in this browser build.`)
}

export async function createZip(files: File[], compression: number): Promise<Blob> {
  const zip = new JSZip()
  const used = new Set<string>()
  for (const file of files) {
    const safeName = file.name.replace(/[\\/]/g, '_').replace(/^\.+/, '')
    if (!safeName) continue
    zip.file(uniqueName(safeName, used), file)
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: compression } })
}

export async function convertBatch(files: File[], target: string, options: ConversionOptions, onProgress?: (value: number) => void): Promise<{ blob: Blob; name: string }> {
  if (target === 'ZIP') return { blob: await createZip(files, options.compression ?? 6), name: 'convertforge-files.zip' }
  if (target === 'PDF' && files.every(file => isImageName(file.name))) return { blob: await imagesToPdf(files, options), name: 'convertforge-images.pdf' }
  const zip = new JSZip()
  const used = new Set<string>()
  for (let index = 0; index < files.length; index++) {
    const converted = await convertFile(files[index], target, options)
    if (converted.blob) zip.file(uniqueName(converted.name, used), converted.blob)
    onProgress?.(10 + Math.round(((index + 1) / files.length) * 65))
  }
  return { blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: options.compression ?? 6 } }), name: 'convertforge-converted.zip' }
}

export function downloadBlob(blob: Blob, name: string) { saveAs(blob, name) }
