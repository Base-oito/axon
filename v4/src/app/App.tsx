import { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import LoadingScreen from '@/app/LoadingScreen'

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<div>Axon V4 — em construção</div>} />
      </Routes>
    </Suspense>
  )
}
