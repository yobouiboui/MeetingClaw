import { useEffect, useRef, useState } from 'react'

type UseScreenCaptureOptions = {
  onInsight: (headline: string, detail: string) => void
  active: boolean
}

export function useScreenCapture({ onInsight, active }: UseScreenCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    setIsSupported(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getDisplayMedia === 'function',
    )
  }, [])

  useEffect(() => {
    if (active) {
      return
    }

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    videoRef.current = null
    setIsCapturing(false)
  }, [active])

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const start = async () => {
    if (!isSupported) {
      setError('Screen capture is not supported in this runtime.')
      return
    }

    if (!active) {
      setError('Start a meeting before enabling screen capture.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 1,
        },
        audio: false,
      })

      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      await video.play()

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Failed to initialize screen capture canvas.')
      }

      streamRef.current = stream
      videoRef.current = video

      const pushInsight = () => {
        if (!video.videoWidth || !video.videoHeight) {
          return
        }

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        const sampled = context.getImageData(
          Math.max(0, Math.floor(canvas.width / 2) - 8),
          Math.max(0, Math.floor(canvas.height / 2) - 8),
          16,
          16,
        )

        let total = 0
        for (let index = 0; index < sampled.data.length; index += 4) {
          total += sampled.data[index] + sampled.data[index + 1] + sampled.data[index + 2]
        }

        const averageLuma = Math.round(total / (sampled.data.length / 4) / 3)
        onInsight(
          'Screen capture sample',
          `Captured display frame ${canvas.width}x${canvas.height}. Center luminance ${averageLuma}.`,
        )
      }

      pushInsight()
      intervalRef.current = window.setInterval(pushInsight, 8000)

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setIsCapturing(false)
      })

      setError(null)
      setIsCapturing(true)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Failed to start screen capture.')
    }
  }

  const stop = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    videoRef.current = null
    setIsCapturing(false)
  }

  return {
    error,
    isCapturing,
    isSupported,
    start,
    stop,
  }
}
