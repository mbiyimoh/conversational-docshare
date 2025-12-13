interface ProfileCreationChoiceProps {
  onSelectBrainDump: () => void
  onSelectInterview: () => void
}

export function ProfileCreationChoice({
  onSelectBrainDump,
  onSelectInterview
}: ProfileCreationChoiceProps) {
  return (
    <div className="max-w-2xl mx-auto py-12">
      <h2 className="text-2xl font-serif text-foreground text-center mb-2">
        Create Your AI Agent Profile
      </h2>
      <p className="text-muted text-center mb-8 font-body">
        Choose how you'd like to configure your AI agent's behavior
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Brain Dump Option - with RECOMMENDED badge */}
        <button
          onClick={onSelectBrainDump}
          className="p-6 rounded-lg border border-border bg-card-bg hover:border-accent/50 transition-colors text-left group"
        >
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-serif text-foreground mb-2">Describe in Your Own Words</h3>
            <p className="text-sm text-muted font-body mb-4">
              Speak or type a natural description. AI extracts a structured profile.
            </p>
            <span className="inline-block px-2 py-1 text-xs text-accent font-mono uppercase tracking-wider bg-accent/10 rounded">
              Recommended
            </span>
          </div>
        </button>

        {/* Interview Option */}
        <button
          onClick={onSelectInterview}
          className="p-6 rounded-lg border border-border bg-card-bg hover:border-border/80 transition-colors text-left group"
        >
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
              <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-serif text-foreground mb-2">Guided Interview</h3>
            <p className="text-sm text-muted font-body mb-4">
              Answer 5 structured questions to build your profile step by step.
            </p>
            <span className="inline-block px-2 py-1 text-xs text-dim font-mono uppercase tracking-wider">
              Step-by-step
            </span>
          </div>
        </button>
      </div>
    </div>
  )
}
