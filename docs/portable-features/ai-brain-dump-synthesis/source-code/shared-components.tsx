/**
 * AI Brain Dump Synthesis - Shared UI Components
 *
 * Reusable components for profile preview display.
 *
 * Dependencies:
 * - React
 * - Tailwind CSS
 */

import React from 'react'

// ============================================================================
// ProfileField - Displays a single field in the preview
// ============================================================================

interface ProfileFieldProps {
  /** Label to display above the value */
  label: string
  /** Value to display, or null for "Not specified" */
  value: string | null
}

/**
 * Simple field display for profile previews.
 * Shows the label and value, or "Not specified" if null.
 */
export function ProfileField({ label, value }: ProfileFieldProps) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-gray-900">
        {value || <span className="text-gray-400 italic">Not specified</span>}
      </div>
    </div>
  )
}

// ============================================================================
// ProfileArrayField - Displays an array as pills/tags
// ============================================================================

interface ProfileArrayFieldProps {
  /** Label to display above the values */
  label: string
  /** Array of string values to display */
  values: string[]
  /** Tailwind color classes for the pills (default: blue) */
  colorClasses?: string
}

/**
 * Displays an array of values as colored pills.
 * Useful for tags, expertise areas, topics, etc.
 */
export function ProfileArrayField({
  label,
  values,
  colorClasses = 'bg-blue-100 text-blue-700'
}: ProfileArrayFieldProps) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value, i) => (
            <span key={i} className={`px-2 py-1 ${colorClasses} rounded text-sm`}>
              {value}
            </span>
          ))
        ) : (
          <span className="text-gray-400 italic">Not specified</span>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// ProfileEnumField - Displays an enum value as a badge
// ============================================================================

interface ProfileEnumFieldProps {
  /** Label to display above the value */
  label: string
  /** Enum value to display, or null for "Not specified" */
  value: string | null
  /** Tailwind color classes for the badge (default: purple) */
  colorClasses?: string
}

/**
 * Displays a single enum/category value as a badge.
 * Useful for status, type, style, etc.
 */
export function ProfileEnumField({
  label,
  value,
  colorClasses = 'bg-purple-100 text-purple-700'
}: ProfileEnumFieldProps) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div>
        {value ? (
          <span className={`px-2 py-1 ${colorClasses} rounded text-sm capitalize`}>
            {value}
          </span>
        ) : (
          <span className="text-gray-400 italic">Not specified</span>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// LoadingSpinner - For button loading states
// ============================================================================

interface LoadingSpinnerProps {
  /** CSS class for sizing (default: w-4 h-4) */
  className?: string
}

/**
 * Simple animated spinner for loading states.
 */
export function LoadingSpinner({ className = 'w-4 h-4' }: LoadingSpinnerProps) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ============================================================================
// MicrophoneIcon - For voice input button
// ============================================================================

interface MicrophoneIconProps {
  /** CSS class for sizing (default: w-5 h-5) */
  className?: string
}

/**
 * Microphone icon for voice input buttons.
 */
export function MicrophoneIcon({ className = 'w-5 h-5' }: MicrophoneIconProps) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    </svg>
  )
}

// ============================================================================
// CloseIcon - For modal close button
// ============================================================================

interface CloseIconProps {
  /** CSS class for sizing (default: w-6 h-6) */
  className?: string
}

/**
 * X icon for close buttons.
 */
export function CloseIcon({ className = 'w-6 h-6' }: CloseIconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  )
}

// ============================================================================
// CheckIcon - For success states
// ============================================================================

interface CheckIconProps {
  /** CSS class for sizing (default: w-4 h-4) */
  className?: string
}

/**
 * Checkmark icon for success states.
 */
export function CheckIcon({ className = 'w-4 h-4' }: CheckIconProps) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  )
}
