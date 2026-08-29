import type { CardDocument, Layer, Side } from './types'

/**
 * Serialize a CardDocument to JSON. Key order is normalized by construction
 * (documents are always built through our own types), so serialize(deserialize(s)) === s
 * for any string we produced.
 */
export function serializeCard(doc: CardDocument): string {
  return JSON.stringify(doc)
}

export class CardParseError extends Error {}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const LAYER_TYPES = new Set(['fill', 'image', 'shape', 'path', 'stamp', 'text'])

function validateLayer(l: unknown, path: string): asserts l is Layer {
  if (!isRecord(l)) throw new CardParseError(`${path}: not an object`)
  if (typeof l.id !== 'string') throw new CardParseError(`${path}.id: missing`)
  if (typeof l.type !== 'string' || !LAYER_TYPES.has(l.type))
    throw new CardParseError(`${path}.type: unknown layer type ${String(l.type)}`)
  if (!isRecord(l.transform)) throw new CardParseError(`${path}.transform: missing`)
  // the type-specific payload must be present for its declared type
  if (l[l.type] === undefined)
    throw new CardParseError(`${path}: layer of type '${l.type}' has no '${l.type}' payload`)
}

function validateSide(s: unknown, path: string): asserts s is Side {
  if (!isRecord(s) || !Array.isArray(s.layers))
    throw new CardParseError(`${path}: missing layers array`)
  s.layers.forEach((l, i) => validateLayer(l, `${path}.layers[${i}]`))
}

/** Parse and validate a CardDocument from JSON. Throws CardParseError on malformed input. */
export function deserializeCard(json: string): CardDocument {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch (e) {
    throw new CardParseError(`invalid JSON: ${(e as Error).message}`)
  }
  if (!isRecord(raw)) throw new CardParseError('document is not an object')
  if (raw.version !== 1) throw new CardParseError(`unsupported version ${String(raw.version)}`)
  if (typeof raw.id !== 'string') throw new CardParseError('missing id')
  if (!isRecord(raw.size) || typeof raw.size.w !== 'number' || typeof raw.size.h !== 'number')
    throw new CardParseError('missing size')
  validateSide(raw.front, 'front')
  validateSide(raw.back, 'back')
  if (!isRecord(raw.palette)) throw new CardParseError('missing palette')
  if (!isRecord(raw.meta)) throw new CardParseError('missing meta')
  return raw as unknown as CardDocument
}
