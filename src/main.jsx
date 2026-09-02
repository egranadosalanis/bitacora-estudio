import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthGate from './AuthGate.jsx'

// Aplica el tema guardado antes del primer render, para que no haya un
// parpadeo oscuro->claro al cargar si el usuario ya eligió modo claro.
try {
  const savedTheme = window.localStorage.getItem('clever_theme')
  if (savedTheme === 'light' || savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', savedTheme)
  }
} catch {
  // Modo privado / almacenamiento bloqueado: se queda en el tema por defecto.
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
)
