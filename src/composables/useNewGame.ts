import { useSaveLoad } from './useSaveLoad'

export function useNewGame() {
  function startNewGame(): void {
    const { deleteSave } = useSaveLoad()
    deleteSave()
    location.reload()
  }

  return { startNewGame }
}
