import { createEditorStore } from './editorStore'
import { demoCard } from '../templates/demo'
import { deserializeCard, serializeCard } from '../model/serialize'

// App-wide editor store, seeded with the demo card through the JSON
// round-trip (same guarantee App.tsx relied on before).
export const useEditor = createEditorStore(deserializeCard(serializeCard(demoCard())))
