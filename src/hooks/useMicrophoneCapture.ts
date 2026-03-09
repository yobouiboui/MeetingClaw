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
  const isSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'

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
    }
  }, [sessionActive])

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop()
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
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

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size === 0) {
          return
        }

        void blobToBase64(event.data)
          .then((audioBase64) =>
            transcribeAudioFile({
              audioBase64,
              mimeType: event.data.type || mimeType || 'audio/webm',
              fileName: `mic-chunk-${Date.now()}.webm`,
              speakerHint: 'You',
            }),
          )
          .catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : 'Failed to process microphone chunk.')
          })
      })

      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((track) => track.stop())
        if (mediaRecorderRef.current === recorder) {
          mediaRecorderRef.current = null
        }
        if (mediaStreamRef.current === stream) {
          mediaStreamRef.current = null
        }
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
