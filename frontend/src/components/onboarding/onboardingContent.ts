export interface OnboardingSlideData {
  id: string
  title: string
  subtitle: string
  iconType: 'document-chat' | 'brain' | 'share-link' | 'sparkle'
}

export const ONBOARDING_SLIDES: OnboardingSlideData[] = [
  {
    id: 'documents',
    title: 'Share documents, not reading lists',
    subtitle: 'Turn your documents into conversations that your audience actually engages with.',
    iconType: 'document-chat',
  },
  {
    id: 'configure',
    title: 'Train your AI in minutes',
    subtitle: "Answer a few questions. We'll configure an AI that speaks your language and knows your content.",
    iconType: 'brain',
  },
  {
    id: 'share',
    title: 'One link, instant access',
    subtitle: 'Share a single link. No logins required. Your audience gets answers immediately.',
    iconType: 'share-link',
  },
  {
    id: 'ready',
    title: 'Ready to transform how you share?',
    subtitle: 'Create your first project and see the magic happen.',
    iconType: 'sparkle',
  },
]
