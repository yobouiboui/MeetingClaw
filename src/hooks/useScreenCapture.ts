import { useEffect, useRef, useState } from 'react'

type UseScreenCaptureOptions = {
  onInsight: (headline: string, detail: string) => void
  active: boolean
}

type TesseractWorker = {
  recognize: (image: Blob | string) => Promise<{ data: { text: string } }>
  terminate: () => Promise<unknown>
}

export function useScreenCapture({ onInsight, active }: UseScreenCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const ocrWorkerRef = useRef<TesseractWorker | null>(null)
  const ocrPromiseRef = useRef<Promise<TesseractWorker> | null>(null)
  const ocrBusyRef = useRef(false)
  const previousFingerprintRef = useRef<Uint8ClampedArray | null>(null)

  const ensureWorker = async () => {
    if (ocrWorkerRef.current) {
      return ocrWorkerRef.current
    }

    if (!ocrPromiseRef.current) {
      ocrPromiseRef.current = import('tesseract.js').then(async ({ createWorker }) => {
        const worker = (await createWorker('eng')) as unknown as TesseractWorker
        ocrWorkerRef.current = worker
        return worker
      })
    }

    return ocrPromiseRef.current
  }

  const terminateWorker = async () => {
    const worker = ocrWorkerRef.current
    ocrWorkerRef.current = null
    ocrPromiseRef.current = null
    ocrBusyRef.current = false

    if (worker) {
      await worker.terminate()
    }
  }

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
    previousFingerprintRef.current = null
    setIsCapturing(false)
    void terminateWorker()
  }, [active])

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      previousFingerprintRef.current = null
      void terminateWorker()
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
      const fingerprintCanvas = document.createElement('canvas')
      const fingerprintContext = fingerprintCanvas.getContext('2d', { willReadFrequently: true })
      const ocrCanvas = document.createElement('canvas')
      const ocrContext = ocrCanvas.getContext('2d')
      if (!context) {
        throw new Error('Failed to initialize screen capture canvas.')
      }
      if (!fingerprintContext || !ocrContext) {
        throw new Error('Failed to initialize screen analysis canvases.')
      }

      streamRef.current = stream
      videoRef.current = video

      const pushInsight = async () => {
        if (!video.videoWidth || !video.videoHeight) {
          return
        }

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        fingerprintCanvas.width = 64
        fingerprintCanvas.height = 36
        fingerprintContext.drawImage(video, 0, 0, fingerprintCanvas.width, fingerprintCanvas.height)

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
        const frameDetail = `Captured display frame ${canvas.width}x${canvas.height}. Center luminance ${averageLuma}.`
        const fingerprint = fingerprintContext.getImageData(
          0,
          0,
          fingerprintCanvas.width,
          fingerprintCanvas.height,
        ).data
        const previousFingerprint = previousFingerprintRef.current

        if (previousFingerprint) {
          let delta = 0
          for (let index = 0; index < fingerprint.length; index += 16) {
            delta += Math.abs(fingerprint[index] - previousFingerprint[index])
            delta += Math.abs(fingerprint[index + 1] - previousFingerprint[index + 1])
            delta += Math.abs(fingerprint[index + 2] - previousFingerprint[index + 2])
          }

          const averageDelta = delta / ((fingerprint.length / 16) * 3)
          if (averageDelta < 8) {
            onInsight('Screen capture sample', `${frameDetail} Screen remained visually stable.`)
            return
          }
        }

        previousFingerprintRef.current = new Uint8ClampedArray(fingerprint)

        if (ocrBusyRef.current) {
          onInsight('Screen capture sample', frameDetail)
          return
        }

        ocrBusyRef.current = true
        try {
          const worker = await ensureWorker()
          const targetWidth = Math.min(1280, canvas.width)
          const targetHeight = Math.max(1, Math.round((canvas.height / canvas.width) * targetWidth))
          ocrCanvas.width = targetWidth
          ocrCanvas.height = targetHeight
          ocrContext.drawImage(video, 0, 0, targetWidth, targetHeight)
          const frameBlob = await new Promise<Blob | null>((resolve) => {
            ocrCanvas.toBlob(resolve, 'image/png')
          })

          if (!frameBlob) {
            onInsight('Screen capture sample', frameDetail)
            return
          }

          const result = await worker.recognize(frameBlob)
          const extractedText = result.data.text.replace(/\s+/g, ' ').trim()

          onInsight(
            'Screen capture sample',
            extractedText
              ? `${frameDetail} OCR: ${extractedText.slice(0, 280)}`
              : `${frameDetail} OCR: no readable text detected.`,
          )
        } catch (reason: unknown) {
          const message =
            reason instanceof Error ? reason.message : 'Screen OCR failed for this frame.'
          onInsight('Screen capture sample', `${frameDetail} OCR error: ${message}`)
        } finally {
          ocrBusyRef.current = false
        }
      }

      void pushInsight()
      intervalRef.current = window.setInterval(() => {
        void pushInsight()
      }, 8000)

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setIsCapturing(false)
        void terminateWorker()
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
    previousFingerprintRef.current = null
    setIsCapturing(false)
    void terminateWorker()
  }

  return {
    error,
    isCapturing,
    isSupported,
    start,
    stop,
  }
}
