// TestFlight helper on the App Store Connect API (no dependencies).
//
//   node scripts/testflight.mjs status                 builds + beta groups + membership
//   node scripts/testflight.mjs testers                testers per group with invite state
//   node scripts/testflight.mjs add <buildNumber> <group>   add a build to a beta group
//
// Credentials live in secrets/asc.json (git-ignored):
//   { "issuerId": "...", "keyId": "...", "p8": "secrets/AuthKey_<KEYID>.p8", "appId": "6807185832" }
import fs from 'node:fs'
import crypto from 'node:crypto'

const cfg = JSON.parse(fs.readFileSync('secrets/asc.json', 'utf8'))
const APP = cfg.appId
const BASE = 'https://api.appstoreconnect.apple.com/v1'

function token() {
  const b64u = (b) => Buffer.from(b).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const header = b64u(JSON.stringify({ alg: 'ES256', kid: cfg.keyId, typ: 'JWT' }))
  const payload = b64u(
    JSON.stringify({ iss: cfg.issuerId, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' }),
  )
  const data = `${header}.${payload}`
  const sig = crypto.sign('sha256', Buffer.from(data), {
    key: fs.readFileSync(cfg.p8, 'utf8'),
    dsaEncoding: 'ieee-p1363',
  })
  return `${data}.${b64u(sig)}`
}

async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 600)}`)
  return text ? JSON.parse(text) : null
}

async function builds() {
  const j = await api(
    'GET',
    `/builds?filter[app]=${APP}&sort=-uploadedDate&limit=8` +
      `&fields[builds]=version,uploadedDate,processingState,expired,buildBetaDetail,preReleaseVersion` +
      `&include=buildBetaDetail,preReleaseVersion` +
      `&fields[buildBetaDetails]=externalBuildState,internalBuildState` +
      `&fields[preReleaseVersions]=version`,
  )
  const inc = new Map((j.included ?? []).map((x) => [`${x.type}/${x.id}`, x]))
  return j.data.map((b) => {
    const det = inc.get(`buildBetaDetails/${b.relationships?.buildBetaDetail?.data?.id}`)
    const pre = inc.get(`preReleaseVersions/${b.relationships?.preReleaseVersion?.data?.id}`)
    return {
      id: b.id,
      number: b.attributes.version,
      marketing: pre?.attributes?.version,
      uploaded: b.attributes.uploadedDate,
      processing: b.attributes.processingState,
      expired: b.attributes.expired,
      external: det?.attributes?.externalBuildState,
      internal: det?.attributes?.internalBuildState,
    }
  })
}

async function groups() {
  const j = await api(
    'GET',
    `/apps/${APP}/betaGroups?fields[betaGroups]=name,isInternalGroup,hasAccessToAllBuilds,publicLinkEnabled`,
  )
  const out = []
  for (const g of j.data) {
    const b = await api('GET', `/betaGroups/${g.id}/builds?fields[builds]=version&limit=50`)
    out.push({ id: g.id, ...g.attributes, builds: b.data.map((x) => x.attributes.version) })
  }
  return out
}

async function testers(groupId) {
  const j = await api(
    'GET',
    `/betaGroups/${groupId}/betaTesters?fields[betaTesters]=email,firstName,lastName,inviteType,state&limit=100`,
  )
  return j.data.map((t) => ({ id: t.id, ...t.attributes }))
}

const cmd = process.argv[2]
if (cmd === 'testers') {
  for (const g of await groups()) {
    console.log(`"${g.name}":`)
    for (const t of await testers(g.id)) {
      console.log(`  ${t.email}  ${t.firstName ?? ''} ${t.lastName ?? ''}  invite:${t.inviteType}  state:${t.state ?? '-'}`)
    }
  }
} else if (cmd === 'status') {
  console.log('Builds (newest first):')
  for (const b of await builds()) {
    console.log(
      `  #${b.number} (${b.marketing ?? '?'})  uploaded ${b.uploaded}  processing:${b.processing}` +
        `  external:${b.external ?? '-'}  internal:${b.internal ?? '-'}${b.expired ? '  EXPIRED' : ''}`,
    )
  }
  console.log('Beta groups:')
  for (const g of await groups()) {
    console.log(
      `  "${g.name}"  ${g.isInternalGroup ? 'internal' : 'external'}  allBuilds:${g.hasAccessToAllBuilds}` +
        `  publicLink:${g.publicLinkEnabled}  builds:[${g.builds.join(', ')}]`,
    )
  }
} else if (cmd === 'add') {
  const [, , , number, ...nameParts] = process.argv
  const name = nameParts.join(' ')
  const b = (await builds()).find((x) => x.number === number)
  if (!b) throw new Error(`build #${number} not found`)
  const g = (await groups()).find((x) => x.name === name)
  if (!g) throw new Error(`group "${name}" not found`)
  if (g.builds.includes(number)) {
    console.log(`build #${number} is already in "${name}"`)
  } else {
    await api('POST', `/betaGroups/${g.id}/relationships/builds`, {
      data: [{ type: 'builds', id: b.id }],
    })
    console.log(`added build #${number} to "${name}"`)
  }
} else {
  console.log('usage: node scripts/testflight.mjs status | testers | add <buildNumber> <group name>')
  process.exit(1)
}
