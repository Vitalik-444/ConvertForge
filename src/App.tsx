import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, ArrowDown, ArrowDownUp, ArrowRight, AudioLines, Check, ChevronDown, CircleHelp, Clock3, File, FileArchive, FileImage, FileText, Film, HardDrive, LockKeyhole, Menu, RefreshCw, ShieldCheck, Sparkles, UploadCloud, X, Zap } from 'lucide-react'
import { categories } from './data/supportedFormats'
import Header from './components/Header'
import Hero from './components/Hero'
import Footer from './components/Footer'
import { convertFile, createZip, downloadBlob, extensionOf, formatBytes, getTargets } from './services/conversionService'
import type { Category, ConversionRecord } from './types/file'

const iconMap = { archive: Archive, document: FileText, image: FileImage, audio: AudioLines, video: Film }
const initialHistory: ConversionRecord[] = (() => { try { return JSON.parse(localStorage.getItem('archiveforge-history') || '[]') } catch { return [] } })()

export default function App() {
  const [files, setFiles] = useState<File[]>([])
  const [target, setTarget] = useState('')
  const [category, setCategory] = useState<Category>('archive')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const [history, setHistory] = useState<ConversionRecord[]>(initialHistory)
  const [dragging, setDragging] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [quality, setQuality] = useState(88)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [background, setBackground] = useState('#ffffff')
  const [compression, setCompression] = useState(6)
  const inputRef = useRef<HTMLInputElement>(null)
  const currentFile = files[0]
  const targets = useMemo(() => currentFile ? getTargets(currentFile) : [], [currentFile])

  useEffect(() => { localStorage.setItem('archiveforge-history', JSON.stringify(history.slice(0, 8))) }, [history])

  function addFiles(incoming: FileList | File[]) {
    const selected = Array.from(incoming)
    if (!selected.length) return
    const tooLarge = selected.find(file => file.size > 100 * 1024 * 1024)
    if (tooLarge) { setError(`${tooLarge.name} is over the 100 MB browser limit.`); return }
    setFiles(selected)
    setCategory(selected[0].name.toLowerCase().endsWith('.zip') ? 'archive' : ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(extensionOf(selected[0].name)) ? 'image' : 'document')
    setTarget('')
    setResult(null)
    setError('')
  }

  function reset() { setFiles([]); setTarget(''); setResult(null); setError(''); setProgress(0); if (inputRef.current) inputRef.current.value = '' }

  async function runConversion() {
    if (!files.length) { setError('Choose a file first.'); return }
    setBusy(true); setError(''); setResult(null); setProgress(10)
    try {
      let output: Blob
      let outputName: string
      if (category === 'archive' && files.length > 1) {
        output = await createZip(files, compression)
        outputName = 'archiveforge-files.zip'
      } else {
        const converted = await convertFile(files[0], target, { quality, width, height, background })
        if (!converted.blob) throw new Error('No output file was created.')
        output = converted.blob
        outputName = converted.name
      }
      setProgress(75)
      if (!output.size) throw new Error('The output file is empty. Please try another file.')
      setResult({ blob: output, name: outputName })
      setProgress(100)
      setHistory(previous => [{ id: crypto.randomUUID(), name: files.map(file => file.name).join(', '), from: files.length > 1 ? `${files.length} files` : extensionOf(files[0].name).toUpperCase(), to: outputName.split('.').pop()?.toUpperCase() || target, date: new Date().toLocaleString(), status: 'Complete' as const }, ...previous].slice(0, 8))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Conversion failed. Please try again.'
      setError(message)
      setHistory(previous => [{ id: crypto.randomUUID(), name: files.map(file => file.name).join(', '), from: extensionOf(files[0].name).toUpperCase(), to: target, date: new Date().toLocaleString(), status: 'Failed' as const }, ...previous].slice(0, 8))
    } finally { setBusy(false) }
  }

  function selectCategory(id: Category) {
    setCategory(id); setFiles([]); setTarget(''); setResult(null); setError('')
    document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })
  }

  const archiveMode = category === 'archive'
  const isImage = category === 'image' || Boolean(currentFile && ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(extensionOf(currentFile.name)))
  const multiFiles = archiveMode && files.length > 1

  return <div className="app-shell">
    <Header menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

    <main id="top">
      <Hero />

      <section className="converter-section container" id="converter"><div className="section-heading"><div><div className="eyebrow">THE WORKSPACE</div><h2>Convert your files</h2><p>Choose a file, select a supported output and let ConvertForge do the rest.</p></div><div className="format-pill"><span className="status-dot"/> No sign-up required</div></div>
        <div className="workspace"><div className="workspace-top"><div className="step-label"><span>01</span><div><b>Upload your file</b><small>Up to 100 MB per file</small></div></div><div className="workspace-top-right"><span className="supported-tag"><ShieldCheck size={14}/> Secure processing</span></div></div>
          <div className={`dropzone ${dragging ? 'dragging' : ''} ${files.length ? 'has-files' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }}>
            {!files.length ? <><div className="upload-icon"><UploadCloud size={28}/></div><h3>Drop your files here</h3><p>or <button className="inline-link" onClick={() => inputRef.current?.click()}>browse from your device</button></p><span className="drop-note">Files stay in your browser for supported local conversions.</span><div className="drop-formats"><span>ZIP</span><span>TXT</span><span>DOCX</span><span>PNG</span><span>JPG</span><span>WEBP</span></div></> : <div className="file-list">{files.map((file, index) => <div className="uploaded-file" key={`${file.name}-${index}`}><div className="uploaded-file-icon">{file.name.endsWith('.zip') ? <Archive/> : isImage ? <FileImage/> : <FileText/>}</div><div className="uploaded-file-info"><b>{file.name}</b><span>{extensionOf(file.name).toUpperCase()} file · {formatBytes(file.size)}</span></div><button className="icon-button" onClick={() => setFiles(prev => prev.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}><X size={17}/></button></div>)}<button className="add-more" onClick={() => inputRef.current?.click()}><span>+</span> Add more files</button></div>}
            <input ref={inputRef} type="file" multiple onChange={event => { if (event.target.files) addFiles(event.target.files) }} hidden />
          </div>
          <div className="conversion-settings"><div className="step-label"><span>02</span><div><b>Choose output</b><small>Available formats depend on your file</small></div></div>
            {files.length > 1 && archiveMode ? <div className="multi-note"><Archive size={18}/><div><b>{files.length} files selected</b><span>They will be packed into a single ZIP archive.</span></div></div> : <div className="conversion-flow"><div className="format-box"><span>FROM</span><div><File size={18}/><b>{currentFile ? extensionOf(currentFile.name).toUpperCase() : '—'}</b></div><small>{currentFile ? currentFile.name : 'Upload a file first'}</small></div><div className="flow-arrow"><ArrowDownUp size={19}/></div><div className="format-box target-box"><span>CONVERT TO</span><div><ArrowRight size={18}/><select value={target} onChange={event => setTarget(event.target.value)} disabled={!targets.length}><option value="">Select format</option>{targets.map(item => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={15}/></div><small>{target ? `Output: .${target.toLowerCase()}` : 'Choose your output format'}</small></div></div>}
            {isImage && files.length > 0 && <div className="options-panel"><div className="option-heading">Image options <span>OPTIONAL</span></div><div className="options-grid"><label>Width (px)<input type="number" min="0" placeholder="Original" value={width || ''} onChange={event => setWidth(Math.max(0, Number(event.target.value)))}/></label><label>Height (px)<input type="number" min="0" placeholder="Original" value={height || ''} onChange={event => setHeight(Math.max(0, Number(event.target.value)))}/></label><label>Quality <div className="range-row"><input type="range" min="10" max="100" value={quality} onChange={event => setQuality(Number(event.target.value))}/><b>{quality}%</b></div></label><label>Background<input type="color" value={background} onChange={event => setBackground(event.target.value)}/></label></div></div>}
            {archiveMode && files.length > 0 && <div className="options-panel compression-row"><label>ZIP compression level <b>{compression}</b><input type="range" min="1" max="9" value={compression} onChange={event => setCompression(Number(event.target.value))}/><small>Higher compression can take longer.</small></label></div>}
            {error && <div className="error-banner"><CircleHelp size={18}/><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
            {busy && <div className="progress-wrap"><div className="progress-copy"><span>Processing your file…</span><b>{progress}%</b></div><div className="progress-track"><span style={{ width: `${progress}%` }}/></div></div>}
            {result ? <div className="result-card"><div className="result-check"><Check size={22}/></div><div className="result-copy"><b>Conversion complete</b><span>{result.name} · {formatBytes(result.blob.size)}</span></div><button className="button button-primary" onClick={() => downloadBlob(result.blob, result.name)}>Download file <ArrowDown size={16}/></button><button className="icon-button" onClick={reset} aria-label="Convert another"><RefreshCw size={17}/></button></div> : <div className="convert-footer"><span><LockKeyhole size={14}/> Your files are not saved to an account.</span><div><button className="button button-ghost" onClick={reset} disabled={!files.length}>Clear</button><button className="button button-primary convert-button" disabled={!files.length || (!multiFiles && !target) || busy} onClick={runConversion}>{busy ? <><RefreshCw size={16} className="spin"/> Converting…</> : <>Convert now <ArrowRight size={17}/></>}</button></div></div>}
          </div>
        </div><p className="workspace-footnote">ConvertForge currently processes ZIP, common image formats and selected document conversions in your browser. Other formats are shown as planned capabilities and require a conversion backend.</p>
      </section>

      <section className="categories-section container" id="formats"><div className="section-heading"><div><div className="eyebrow">TOOLS FOR EVERY FILE</div><h2>What do you need to convert?</h2><p>Pick a tool to jump straight into the right workflow.</p></div><span className="section-count">05 CATEGORIES</span></div><div className="category-grid">{categories.map(item => { const Icon = iconMap[item.icon as keyof typeof iconMap]; return <article className="category-card" key={item.id}><div className={`category-icon ${item.id}`}><Icon size={23}/></div><h3>{item.title}</h3><p>{item.description}</p><div className="category-formats">{item.formats}</div><button onClick={() => selectCategory(item.id)} className="category-link">Open converter <ArrowRight size={16}/></button></article> })}</div></section>

      <section className="archive-section container" id="archive"><div className="archive-visual"><div className="archive-folder"><Archive size={45}/><span>ZIP</span></div><div className="mini-file mini-one"><FileText size={16}/> report.txt <Check size={14}/></div><div className="mini-file mini-two"><FileImage size={16}/> image.png <Check size={14}/></div><div className="mini-file mini-three"><File size={16}/> notes.md <Check size={14}/></div></div><div className="archive-copy"><div className="eyebrow">PACK IT UP</div><h2>Archive Converter</h2><p>Combine multiple files into one ZIP, or load a ZIP archive to inspect and repackage its contents. Your files are handled locally in the browser.</p><ul><li><Check size={16}/> Create a ZIP from multiple files</li><li><Check size={16}/> Validate and read ZIP archives</li><li><Check size={16}/> Choose a compression level</li><li><Check size={16}/> Download the result instantly</li></ul><button className="button button-primary" onClick={() => { setCategory('archive'); document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' }) }}>Open archive tool <ArrowRight size={16}/></button></div></section>

      <section className="how-section container" id="how"><div className="section-heading centered"><div><div className="eyebrow">NO COMPLICATED WORKFLOW</div><h2>Three steps. That's it.</h2><p>From source file to ready-to-use result in a few clicks.</p></div></div><div className="steps-grid"><article><div className="step-icon"><UploadCloud/></div><span>STEP 01</span><h3>Upload</h3><p>Drop a file into the workspace or select it from your device.</p></article><article><div className="step-icon purple"><ArrowDownUp/></div><span>STEP 02</span><h3>Choose a format</h3><p>Pick an output that is supported for your selected file type.</p></article><article><div className="step-icon green"><Zap/></div><span>STEP 03</span><h3>Convert & download</h3><p>Run the conversion and save the finished file to your device.</p></article></div></section>

      <section className="privacy-banner container"><div className="privacy-icon"><ShieldCheck size={27}/></div><div><h3>Your Files. Your Control.</h3><p>Supported conversions run locally in your browser. ConvertForge does not upload those files to a server. Audio, video and advanced format conversions are not enabled until a backend is configured.</p></div><a href="#converter">Try it now <ArrowRight size={16}/></a></section>

      <section className="history-section container"><div className="history-heading"><div><div className="eyebrow">YOUR RECENT ACTIVITY</div><h2>Recent conversions</h2></div><span><Clock3 size={15}/> Stored on this device</span></div>{history.length ? <div className="history-list">{history.map(item => <div className="history-row" key={item.id}><div className="history-file-icon"><FileText size={19}/></div><div className="history-name"><b>{item.name}</b><span>{item.from} <ArrowRight size={12}/> {item.to}</span></div><span className="history-date">{item.date}</span><span className={`history-status ${item.status.toLowerCase()}`}><span/> {item.status}</span></div>)}</div> : <div className="empty-history"><Clock3 size={20}/><span>Your completed conversions will appear here.</span></div>}<p className="history-note">Only conversion details are stored in local storage. File contents are not saved. You may clear this history at any time.</p>{history.length > 0 && <button className="clear-history" onClick={() => setHistory([])}>Clear history</button>}</section>
    </main>

    <Footer />
  </div>
}
