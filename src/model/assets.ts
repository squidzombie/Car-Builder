// In-memory image asset registry (M3). Layers reference images by
// assetId; this maps ids to local URIs from the photo picker. Durable
// on-device persistence of assets arrives with local save (M6).

const uris = new Map<string, string>()
let counter = 0

export function registerAsset(uri: string): string {
  for (const [id, u] of uris) if (u === uri) return id
  counter += 1
  const id = `asset-${Date.now().toString(36)}-${counter.toString(36)}`
  uris.set(id, uri)
  return id
}

export function getAssetUri(id: string): string | undefined {
  return uris.get(id)
}
