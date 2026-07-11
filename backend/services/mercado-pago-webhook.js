import { createHmac, timingSafeEqual } from 'node:crypto'

function parseSignatureHeader(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim().split('='))
    .reduce((parts, [key, ...valueParts]) => {
      if (key) parts[key] = valueParts.join('=')
      return parts
    }, {})
}

function timestampIsFresh(timestamp, toleranceInMilliseconds = 30 * 60_000) {
  const numericTimestamp = Number(timestamp)
  if (!Number.isFinite(numericTimestamp)) return false
  const timestampInMilliseconds =
    numericTimestamp > 1_000_000_000_000
      ? numericTimestamp
      : numericTimestamp * 1000
  return Math.abs(Date.now() - timestampInMilliseconds) <= toleranceInMilliseconds
}

function safeCompareHex(first, second) {
  if (!/^[a-f0-9]+$/i.test(first) || !/^[a-f0-9]+$/i.test(second)) {
    return false
  }
  const firstBuffer = Buffer.from(first, 'hex')
  const secondBuffer = Buffer.from(second, 'hex')
  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  )
}

export function buildMercadoPagoWebhookManifest({ dataId, requestId, timestamp }) {
  return [
    dataId ? `id:${String(dataId).toLowerCase()};` : '',
    requestId ? `request-id:${requestId};` : '',
    timestamp ? `ts:${timestamp};` : '',
  ].join('')
}

export function validateMercadoPagoWebhookSignature({
  xSignature,
  xRequestId,
  dataId,
  secret,
  nowToleranceInMilliseconds,
}) {
  if (!secret) return false

  const signature = parseSignatureHeader(xSignature)
  if (!signature.ts || !signature.v1) return false
  if (!timestampIsFresh(signature.ts, nowToleranceInMilliseconds)) return false

  const manifest = buildMercadoPagoWebhookManifest({
    dataId,
    requestId: xRequestId,
    timestamp: signature.ts,
  })
  if (!manifest) return false

  const expected = createHmac('sha256', secret).update(manifest).digest('hex')
  return safeCompareHex(expected, signature.v1)
}
