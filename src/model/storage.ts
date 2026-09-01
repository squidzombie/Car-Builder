import * as FileSystem from 'expo-file-system/legacy'
import type { CardDocument } from './types'
import { serializeCard, deserializeCard } from './serialize'

// Local persistence (M6, CLAUDE.md §9): cards are JSON blobs, so they live
// as one file per card under the app's document directory (decision:
// plain files via expo-file-system instead of SQLite — no queries needed).
// Imported photos are copied into a persistent assets dir so image layers
// survive restarts; the in-memory registry is rebuilt from it on boot.

const ROOT = FileSystem.documentDirectory ?? ''
const CARDS_DIR = `${ROOT}cards/`
const ASSETS_DIR = `${ROOT}card-assets/`
const STATE_FILE = `${ROOT}card-builder-state.json`

async function ensureDir(dir: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {})
}

export async function saveCard(doc: CardDocument): Promise<void> {
  await ensureDir(CARDS_DIR)
  await FileSystem.writeAsStringAsync(`${CARDS_DIR}${doc.id}.json`, serializeCard(doc))
}

export async function loadCard(id: string): Promise<CardDocument | null> {
  try {
    const json = await FileSystem.readAsStringAsync(`${CARDS_DIR}${id}.json`)
    return deserializeCard(json)
  } catch {
    return null
  }
}

export async function deleteCard(id: string): Promise<void> {
  await FileSystem.deleteAsync(`${CARDS_DIR}${id}.json`, { idempotent: true })
}

/** All saved cards, newest first. Docs are small; reading them all is fine. */
export async function listCardDocs(): Promise<CardDocument[]> {
  await ensureDir(CARDS_DIR)
  let names: string[] = []
  try {
    names = await FileSystem.readDirectoryAsync(CARDS_DIR)
  } catch {
    return []
  }
  const docs: CardDocument[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    try {
      docs.push(deserializeCard(await FileSystem.readAsStringAsync(CARDS_DIR + name)))
    } catch {
      // ignore corrupt entries
    }
  }
  return docs.sort((a, b) => (a.meta.updatedAt < b.meta.updatedAt ? 1 : -1))
}

async function readState(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await FileSystem.readAsStringAsync(STATE_FILE))
  } catch {
    return {}
  }
}

async function writeState(patch: Record<string, unknown>): Promise<void> {
  const cur = await readState()
  await FileSystem.writeAsStringAsync(STATE_FILE, JSON.stringify({ ...cur, ...patch }))
}

export async function saveLastOpened(id: string): Promise<void> {
  await writeState({ lastCardId: id })
}

export async function loadLastOpened(): Promise<string | null> {
  const s = await readState()
  return typeof s.lastCardId === 'string' ? s.lastCardId : null
}

/** First-launch welcome (M7 onboarding): shown once, then flagged here. */
export async function loadOnboarded(): Promise<boolean> {
  return (await readState()).onboarded === true
}

export async function saveOnboarded(): Promise<void> {
  await writeState({ onboarded: true })
}

/** Copy a picked photo into the persistent assets dir; returns its new URI. */
export async function persistAsset(srcUri: string, assetId: string): Promise<string> {
  await ensureDir(ASSETS_DIR)
  const dotIdx = srcUri.lastIndexOf('.')
  const ext = dotIdx > srcUri.lastIndexOf('/') ? srcUri.slice(dotIdx) : '.jpg'
  const dest = `${ASSETS_DIR}${assetId}${ext}`
  await FileSystem.copyAsync({ from: srcUri, to: dest })
  return dest
}

/** Rebuild the in-memory asset registry from disk on boot. */
export async function restoreAssets(register: (id: string, uri: string) => void): Promise<void> {
  await ensureDir(ASSETS_DIR)
  let names: string[] = []
  try {
    names = await FileSystem.readDirectoryAsync(ASSETS_DIR)
  } catch {
    return
  }
  for (const name of names) {
    const id = name.replace(/\.[^.]+$/, '')
    register(id, ASSETS_DIR + name)
  }
}
