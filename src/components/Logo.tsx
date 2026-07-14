export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="Neon Harbor">
    <span className="brand__neon">NEON</span><span className="brand__harbor">HARBOR</span>
    {!compact && <small>EVERY STREET HAS A STORY</small>}
  </div>
}
