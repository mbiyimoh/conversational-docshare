/**
 * AI Brain Dump Synthesis - Speech Recognition Hook
 *
 * React hook for browser-native speech recognition.
 * Provides voice input capabilities with graceful degradation.
 *
 * Dependencies:
 * - React 18+
 * - Browser with SpeechRecognition API (Chrome, Edge, Safari)
 *
 * Usage:
 * const { isListening, transcript, isSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition()
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================================================
// TypeScript interfaces for Web Speech API
// These are needed because the Web Speech API types aren't in standard TS libs
// ============================================================================

interface ISpeechRecognitionEvent extends Event {
  results: {
    length: number
    item(index: number): {
      length: number
      item(index: number): { transcript: string }
      [index: number]: { transcript: string }
    }
    [index: number]: {
      length: number
      item(index: number): { transcript: string }
      [index: number]: { transcript: string }
    }
  }
}

interface ISpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: ISpeechRecognitionEvent) => void) | null
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition

// Augment the Window interface for vendor-prefixed API
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor | undefined
    webkitSpeechRecognition: SpeechRecognitionConstructor | undefined
  }
}

// ============================================================================
// Hook Return Type
// ============================================================================

interface SpeechRecognitionHook {
  /** Whether the microphone is currently active */
  isListening: boolean
  /** The accumulated transcript from speech recognition */
  transcript: string
  /** Whether the browser supports speech recognition */
  isSupported: boolean
  /** Start listening for speech input */
  startListening: () => void
  /** Stop listening for speech input */
  stopListening: () => void
  /** Clear the current transcript */
  resetTranscript: () => void
}

// ============================================================================
// The Hook
// ============================================================================

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  // Check for browser support (with vendor prefix fallback)
  const SpeechRecognitionAPI = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null
  const isSupported = !!SpeechRecognitionAPI

  // Initialize speech recognition on mount
  useEffect(() => {
    if (!isSupported) return

    const recognition = new SpeechRecognitionAPI!()

    // Configuration
    recognition.continuous = true      // Keep listening until explicitly stopped
    recognition.interimResults = true  // Get partial results as user speaks
    recognition.lang = 'en-US'         // Adapt this for other languages

    // Handle speech results
    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let finalTranscript = ''
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript
      }
      setTranscript(finalTranscript)
    }

    // Handle errors
    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    // Handle recognition ending
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition

    // Cleanup on unmount
    return () => recognition.stop()
  }, [isSupported, SpeechRecognitionAPI])

  // Start listening
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('')  // Clear previous transcript
      recognitionRef.current.start()
      setIsListening(true)
    }
  }, [isListening])

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [isListening])

  // Reset transcript without stopping
  const resetTranscript = useCallback(() => setTranscript(''), [])

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript
  }
}
