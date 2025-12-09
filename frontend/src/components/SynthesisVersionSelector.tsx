interface VersionMeta {
  id: string
  version: number
  conversationCount: number
  createdAt: string
}

interface SynthesisVersionSelectorProps {
  versions: VersionMeta[]
  currentVersion: number
  onSelect: (version: number) => void
}

export function SynthesisVersionSelector({
  versions,
  currentVersion,
  onSelect
}: SynthesisVersionSelectorProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <select
      value={currentVersion}
      onChange={(e) => onSelect(parseInt(e.target.value, 10))}
      className="text-sm border rounded px-2 py-1.5 bg-white"
    >
      {versions.map((v) => (
        <option key={v.id} value={v.version}>
          v{v.version} - {formatDate(v.createdAt)} ({v.conversationCount} conv.)
        </option>
      ))}
    </select>
  )
}
