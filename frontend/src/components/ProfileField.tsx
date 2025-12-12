/**
 * Shared component for displaying profile fields in AI modals.
 * Used by AudienceProfileAIModal and CollaboratorProfileAIModal.
 */
interface ProfileFieldProps {
  label: string
  value: string | null
}

export function ProfileField({ label, value }: ProfileFieldProps) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs font-medium text-muted uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-foreground">
        {value || <span className="text-dim italic">Not specified</span>}
      </div>
    </div>
  )
}
