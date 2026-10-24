import { ArrowRight, FileArchive, Menu, ShieldCheck, X } from 'lucide-react'
type HeaderProps = { menuOpen: boolean; setMenuOpen: (open: boolean) => void }
export default function Header({ menuOpen, setMenuOpen }: HeaderProps) {
  return (
    <header className="topbar"><a href="#top" className="brand"><span className="brand-mark"><FileArchive size={22}/></span><span>Convert<span>Forge</span><small>FILE CONVERSION TOOLS</small></span></a>
      <nav className={menuOpen ? 'nav-links open' : 'nav-links'}><a href="#converter" onClick={() => setMenuOpen(false)}>Convert Files</a><a href="#archive" onClick={() => setMenuOpen(false)}>Archive Converter</a><a href="#formats" onClick={() => setMenuOpen(false)}>Supported Formats</a><a href="#how" onClick={() => setMenuOpen(false)}>How It Works</a></nav>
      <div className="header-actions"><span className="secure-label"><ShieldCheck size={15}/> Browser tools</span><button className="button button-primary button-small" onClick={() => document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })}>Get Started <ArrowRight size={15}/></button><button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X/> : <Menu/>}</button></div>
    </header>
  )
}
