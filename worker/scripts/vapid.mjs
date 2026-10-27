// VAPID 키 한 쌍을 만든다 (P-256). 공개키는 앱과 wrangler.toml에, 개인키는 wrangler secret에 넣는다.
const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey))
const jwk = await crypto.subtle.exportKey('jwk', keys.privateKey)
console.log(`VAPID_PUBLIC_KEY=${Buffer.from(raw).toString('base64url')}`)
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`)
