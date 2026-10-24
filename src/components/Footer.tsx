import { FileArchive } from 'lucide-react'
export default function Footer() {
  return (
    <footer className="footer container"><a href="#top" className="brand footer-brand"><span className="brand-mark"><FileArchive size={20}/></span><span>Archive<span>Forge</span><small>FILE CONVERSION TOOLS</small></span></a><p>Part of the Forge tools collection.</p><div><a href="#formats">Supported formats</a><a href="#how">How it works</a><a href="#converter">Privacy</a></div><span className="copyright">© {new Date().getFullYear()} ArchiveForge</span></footer>
  )
}
