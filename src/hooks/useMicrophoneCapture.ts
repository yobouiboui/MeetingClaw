import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/app-store'

const CHUNK_DURATION_MS = 4000
const MIN_VOICE_PEAK = 0.075

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const pcmBytes = totalSamples * 2
  const buffer = new ArrayBuffer(44 + pcmBytes)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + pcmBytes, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, pcmBytes, true)

  let offset = 44
  for (const chunk of chunks) {
    for (let index = 0; index < chunk.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[index]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Uint8Array(buffer)
}

export function useMicrophoneCapture() {
  const sessionActive = useAppStore((state) => state.snapshot?.session.active ?? false)
  const transcribeAudioFile = useAppStore((state) => state.transcribeAudioFile)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const pendingChunksRef = useRef<Uint8Array[]>([])
  const isProcessingRef = useRef(false)
  const chunkBuffersRef = useRef<Float32Array[]>([])
  const chunkPeakRef = useRef(0)
  const chunkStartedAtRef = useRef<number | null>(null)
  const sampleRateRef = useRef(16000)
  const isSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioContext !== 'undefined'

  const clearAudioPipeline = async () => {
    pendingChunksRef.current = []
    chunkBuffersRef.current = []
    chunkPeakRef.current = 0
    chunkStartedAtRef.current = null
    isProcessingRef.current = false
    processorRef.current?.disconnect()
    processorRef.current = null
    audioSourceRef.current?.disconnect()
    audioSourceRef.current = null
    analyserRef.current?.disconnect()
    analyserRef.current = null
    if (audioContextRef.current) {
      await audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  const processPendingChunks = async () => {
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
        await transcribeAudioFile({
          audioBase64: bytesToBase64(nextChunk),
          mimeType: 'audio/wav',
          fileName: `mic-chunk-${Date.now()}.wav`,
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

  const flushChunk = () => {
    const chunkBuffers = chunkBuffersRef.current
    const chunkPeak = chunkPeakRef.current
    chunkBuffersRef.current = []
    chunkPeakRef.current = 0
    chunkStartedAtRef.current = null

    if (chunkBuffers.length === 0 || chunkPeak < MIN_VOICE_PEAK) {
      return
    }

    const wavBytes = encodeWav(chunkBuffers, sampleRateRef.current)
    pendingChunksRef.current.push(wavBytes)
    void processPendingChunks()
  }

  useEffect(() => {
    if (sessionActive) {
      return
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    void clearAudioPipeline()
    window.setTimeout(() => {
      setIsRecording(false)
    }, 0)
  }, [sessionActive])

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
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
          autoGainControl: true,
        },
      })

      const audioContext = new window.AudioContext({
        sampleRate: 16000,
      })
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.75

      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        const copy = new Float32Array(input.length)
        copy.set(input)

        if (chunkStartedAtRef.current === null) {
          chunkStartedAtRef.current = performance.now()
        }

        let peak = chunkPeakRef.current
        for (let index = 0; index < copy.length; index += 1) {
          const amplitude = Math.abs(copy[index])
          if (amplitude > peak) {
            peak = amplitude
          }
        }

        chunkPeakRef.current = peak
        chunkBuffersRef.current.push(copy)

        if (performance.now() - chunkStartedAtRef.current >= CHUNK_DURATION_MS) {
          flushChunk()
        }
      }

      source.connect(analyser)
      source.connect(processor)
      processor.connect(audioContext.destination)

      mediaStreamRef.current = stream
      audioContextRef.current = audioContext
      audioSourceRef.current = source
      analyserRef.current = analyser
      processorRef.current = processor
      sampleRateRef.current = audioContext.sampleRate

      setError(null)
      setIsRecording(true)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Failed to access microphone.')
    }
  }

  const stop = () => {
    flushChunk()
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    void clearAudioPipeline()
    setIsRecording(false)
  }

  return {
    error,
    isRecording,
    isSupported,
    start,
    stop,
  }
}
