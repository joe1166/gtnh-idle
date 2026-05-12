/// <reference types="vite/client" />

// Fallback for editors without the Vue Official (Volar) extension.
// When Volar is active it replaces this declaration with full type support.
declare module '*.vue' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: any
  export default component
}

interface Window {
  debugTasks: () => void
}
