import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/app-store'

function blobToBase64(blob: Blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer)
    let binary = ''

    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }

    return btoa(binary)
  })
}

export function useMicrophoneCapture() {
  const sessionActive = useAppStore((state) => state.snapshot?.session.active ?? false)
  const transcribeAudioFile = useAppStore((state) => state.transcribeAudioFile)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const pendingChunksRef = useRef<Blob[]>([])
  const isProcessingRef = useRef(false)
  const isSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'

  const clearAudioPipeline = async () => {
    pendingChunksRef.current = []
    isProcessingRef.current = false
    audioSourceRef.current?.disconnect()
    audioSourceRef.current = null
    analyserRef.current?.disconnect()
    analyserRef.current = null
    if (audioContextRef.current) {
      await audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  const processPendingChunks = async (mimeType: string) => {
    if (isProcessingRef.current) {
      return
    }

    isProcessingRef.current = true

    while (pendingChunksRef.current.length > 0) {
      const nextChunk = pendingChunksRef.current.shift()
      if (!nextChunk) {
        continue
      }

      try {
        const audioBase64 = await blobToBase64(nextChunk)
        await transcribeAudioFile({
          audioBase64,
          mimeType: nextChunk.type || mimeType || 'audio/webm',
          fileName: `mic-chunk-${Date.now()}.webm`,
          speakerHint: 'You',
        })
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : 'Failed to process microphone chunk.')
        pendingChunksRef.current = []
        break
      }
    }

    isProcessingRef.current = false
  }

  const shouldTranscribeChunk = () => {
    const analyser = analyserRef.current
    if (!analyser) {
      return true
    }

    const samples = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(samples)

    let peak = 0
    for (const sample of samples) {
      const centered = Math.abs(sample - 128) / 128
      if (centered > peak) {
        peak = centered
      }
    }

    return peak > 0.075
  }

  useEffect(() => {
    if (sessionActive) {
      return
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    } else {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaRecorderRef.current = null
      mediaStreamRef.current = null
      void clearAudioPipeline()
    }
  }, [sessionActive])

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop()
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      void clearAudioPipeline()
    }
  }, [])

  const start = async () => {
    if (!isSupported) {
      setError('Microphone capture is not supported in this runtime.')
      return
    }

    if (!sessionActive) {
      setError('Start a meeting before enabling microphone capture.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : ''

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      const audioContext = new window.AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.75
      source.connect(analyser)

      audioContextRef.current = audioContext
      audioSourceRef.current = source
      analyserRef.current = analyser

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size === 0) {
          return
        }

        if (!shouldTranscribeChunk()) {
          return
        }

        pendingChunksRef.current.push(event.data)
        void processPendingChunks(mimeType)
      })

      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((track) => track.stop())
        if (mediaRecorderRef.current === recorder) {
          mediaRecorderRef.current = null
        }
        if (mediaStreamRef.current === stream) {
          mediaStreamRef.current = null
        }
        void clearAudioPipeline()
        setIsRecording(false)
      })

      mediaRecorderRef.current = recorder
      mediaStreamRef.current = stream
      recorder.start(4000)
      setError(null)
      setIsRecording(true)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Failed to access microphone.')
    }
  }

  const stop = () => {
    mediaRecorderRef.current?.stop()
  }

  return {
    error,
    isRecording,
    isSupported,
    start,
    stop,
  }
}
