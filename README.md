# ArchiveForge

A dark, WinRAR-inspired file conversion workspace built with React, TypeScript, Vite, Tailwind CSS v4, Lucide, JSZip, docx and jsPDF.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Implemented in this browser build

- Drag-and-drop and file picker uploads, multi-file selection, 100 MB per-file guard.
- ZIP archive reading/validation, safe-path checks, ZIP creation from multiple files, and configurable ZIP compression.
- Image conversion through the browser Canvas API for PNG, JPG and WEBP where supported, including resize, quality and background settings. BMP export depends on browser support. GIF conversion to a still frame is labelled as limited.
- TXT/HTML/RTF text extraction into TXT or HTML, TXT/HTML/RTF to DOCX, TXT/HTML/RTF to PDF, and DOCX to TXT.
- Download output, status/error handling, and metadata-only recent history in localStorage.

## Important limitations

- The frontend intentionally does not pretend that RAR/7Z/TAR, audio/video, or advanced PDF/DOCX conversions are implemented. These need suitable backend tools (for example, a securely configured archive utility, LibreOffice and FFmpeg) and server deployment.
- jsPDF's built-in Helvetica font does not guarantee correct Cyrillic glyphs in generated PDFs. For production Ukrainian/Russian PDF output, embed a Unicode TTF font and register it with jsPDF.
- This app currently has no backend; supported browser conversions run on the user's device. The UI labels unavailable conversions honestly.
- ZIP extraction/repackaging creates a new ZIP containing the archive's files rather than writing files directly to the user's filesystem.

## Deployment

The frontend can be deployed to Vercel as a Vite project. For server-side conversion, deploy a separate backend and add a clearly configured API service; do not advertise unsupported formats until those tools are installed and tested.
