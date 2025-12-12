import { useState, useEffect, useCallback, useRef } from 'react'

// TypeScript interfaces for Web Speech API
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

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor | undefined
    webkitSpeechRecognition: SpeechRecognitionConstructor | undefined
  }
}

interface SpeechRecognitionHook {
  isListening: boolean
  transcript: string
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  const SpeechRecognitionAPI = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null
  const isSupported = !!SpeechRecognitionAPI

  useEffect(() => {
    if (!isSupported) return

    const recognition = new SpeechRecognitionAPI!()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let finalTranscript = ''
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript
      }
      setTranscript(finalTranscript)
    }

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition

    return () => recognition.stop()
  }, [isSupported, SpeechRecognitionAPI])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('')
      recognitionRef.current.start()
      setIsListening(true)
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [isListening])

  const resetTranscript = useCallback(() => setTranscript(''), [])

  return { isListening, transcript, isSupported, startListening, stopListening, resetTranscript }
}
