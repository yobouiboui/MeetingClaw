import { useEffect, useState } from 'react'
import { MainWindow } from './components/MainWindow'
import { OverlayWindow } from './components/OverlayWindow'
import { getCurrentWindowLabel } from './lib/tauri'
import { useAppStore } from './store/app-store'

function App() {
  const [label, setLabel] = useState('main')
  const initialize = useAppStore((state) => state.initialize)

  useEffect(() => {
    initialize()
    void getCurrentWindowLabel().then(setLabel)
  }, [initialize])

  if (label === 'overlay') {
    return <OverlayWindow />
  }

  return <MainWindow />
}

export default App
