import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import cors from 'cors'
import compression from 'compression'
import express from 'express'
import { createRateLimiter } from './middleware/rate-limit.js'
import { shouldUsePostgres } from './services/postgres.js'

import {
  getCustomerOrders,
  getOrder,
  postMercadoPagoWebhook,
  postOrder,
  postProcessPayment,
} from './controllers/checkout.js'
import {
  getAdminCustomers,
  getAdminOrders,
  getAdminOrderStream,
  getAdminSession,
  patchAdminOrderStatus,
  postAdminLogin,
  postAdminLogout,
} from './controllers/admin.js'
import { requireAdmin } from './services/admin-auth.js'
import {
  getCustomerSession,
  patchCustomerProfile,
  postGuestAccess,
  postCustomerLogout,
  postPasswordLogin,
  postRequestCode,
  postVerifyCode,
} from './controllers/auth.js'
import { getCustomerFromRequest, requireCustomer } from './services/customer-auth.js'
import {
  getAdminCatalog,
  getPublicCatalog,
  postAdminCategory,
  postAdminExtra,
  postAdminProduct,
  postAdminPromotion,
  putAdminCategory,
  putAdminExtra,
  putAdminProduct,
  putAdminPromotion,
  removeAdminCategory,
  removeAdminExtra,
  removeAdminProduct,
  removeAdminPromotion,
} from './controllers/catalog.js'
import {
  getDeliveryZones,
  postCalculateDelivery,
} from './controllers/delivery.js'
import {
  getAdminStoreSettings,
  getPublicStoreSettings,
  putAdminStoreSettings,
} from './controllers/settings.js'
import {
  getAdminPoints,
  getCustomerPoints,
  postAdminPointsAdjustment,
  postAdminReward,
  postCustomerRedemption,
  putAdminPointsSettings,
  putAdminReward,
  removeAdminReward,
} from './controllers/loyalty.js'
import {
  getAdminCampaigns,
  getCustomerCampaigns,
  getPublicCampaignHighlights,
  patchAdminCampaignVoucher,
  postAdminCampaign,
  postAdminCampaignDistribution,
  postCustomerCampaignValidation,
  putAdminCampaign,
  removeAdminCampaign,
} from './controllers/campaigns.js'
import {
  getCustomerAddresses,
  postCustomerAddress,
  removeCustomerAddress,
} from './controllers/addresses.js'

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url))
const staticDirectory = path.resolve(serviceDirectory, '../dist')
const indexFile = path.join(staticDirectory, 'index.html')
const indexHtml = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : ''

export function createApp() {
  const app = express()
  const authRateLimit = createRateLimiter({
    windowMs: 10 * 60_000,
    max: 30,
  })
  const orderRateLimit = createRateLimiter({
    windowMs: 60_000,
    max: 20,
  })
  const paymentRateLimit = createRateLimiter({
    windowMs: 60_000,
    max: 12,
  })
  const deliveryRateLimit = createRateLimiter({
    windowMs: 60_000,
    max: 120,
  })
  const frontendUrl = String(process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .replace(/\/$/, '')
  const allowedOrigins = new Set(
    [
      frontendUrl,
      process.env.BACKEND_URL,
      process.env.RENDER_EXTERNAL_URL,
      'https://encantodovalepnz.com',
      'https://www.encantodovalepnz.com',
      'https://encanto-do-vale.onrender.com',
    ]
      .filter(Boolean)
      .map((origin) => String(origin).replace(/\/$/, '')),
  )

  function isAllowedOrigin(origin) {
    if (!origin) return true
    const normalizedOrigin = origin.replace(/\/$/, '')
    if (allowedOrigins.has(normalizedOrigin)) return true
    try {
      return new URL(normalizedOrigin).hostname.endsWith('.onrender.com')
    } catch {
      return false
    }
  }

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    )
    if (process.env.NODE_ENV === 'production') {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      )
    }
    next()
  })
  app.use(compression())
  if (existsSync(indexFile)) {
    app.use(express.static(staticDirectory, {
      index: false,
      maxAge: '1y',
      immutable: true,
      setHeaders(response, filePath) {
        if (filePath === indexFile) {
          response.setHeader('Cache-Control', 'no-cache')
        }
      },
    }))
  }
  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true)
          return
        }
        callback(new Error('Origem não permitida pelo CORS.'))
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    }),
  )
  app.use(express.json({ limit: '100kb' }))

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      storage: shouldUsePostgres() ? 'neon-postgres' : 'local-files',
      environment: process.env.NODE_ENV ?? 'development',
      persistent: shouldUsePostgres(),
    })
  })
  app.get('/api/catalog', getPublicCatalog)
  app.get('/api/store-settings', getPublicStoreSettings)
  app.get('/api/campaign-highlights', getPublicCampaignHighlights)
  app.get('/api/delivery-zones', getDeliveryZones)
  app.post('/api/calculate-delivery', deliveryRateLimit, postCalculateDelivery)
  app.get('/api/auth/session', getCustomerSession)
  app.post('/api/auth/request-code', authRateLimit, postRequestCode)
  app.post('/api/auth/verify-code', authRateLimit, postVerifyCode)
  app.post('/api/auth/login/password', authRateLimit, postPasswordLogin)
  app.post('/api/auth/guest', authRateLimit, postGuestAccess)
  app.post('/api/auth/logout', postCustomerLogout)
  app.patch('/api/auth/profile', requireCustomer, patchCustomerProfile)
  app.get('/api/addresses', requireCustomer, getCustomerAddresses)
  app.post('/api/addresses', requireCustomer, postCustomerAddress)
  app.delete('/api/addresses/:id', requireCustomer, removeCustomerAddress)
  app.post(
    '/api/orders',
    orderRateLimit,
    async (request, _response, next) => {
      request.customerUser = await getCustomerFromRequest(request)
      next()
    },
    postOrder,
  )
  app.get('/api/orders', requireCustomer, getCustomerOrders)
  app.get('/api/orders/:id', requireCustomer, getOrder)
  app.get('/api/loyalty', requireCustomer, getCustomerPoints)
  app.get('/api/campaigns', requireCustomer, getCustomerCampaigns)
  app.post(
    '/api/campaigns/validate',
    requireCustomer,
    postCustomerCampaignValidation,
  )
  app.post('/api/loyalty/redemptions', requireCustomer, postCustomerRedemption)
  app.post(
    '/api/process-payment',
    paymentRateLimit,
    requireCustomer,
    postProcessPayment,
  )
  app.post('/api/webhooks/mercadopago', postMercadoPagoWebhook)
  app.get('/api/admin/session', getAdminSession)
  app.post('/api/admin/login', postAdminLogin)
  app.post('/api/admin/logout', postAdminLogout)
  app.get('/api/admin/orders', requireAdmin, getAdminOrders)
  app.get('/api/admin/customers', requireAdmin, getAdminCustomers)
  app.get('/api/admin/orders/stream', requireAdmin, getAdminOrderStream)
  app.patch('/api/admin/orders/:id/status', requireAdmin, patchAdminOrderStatus)
  app.get('/api/admin/catalog', requireAdmin, getAdminCatalog)
  app.get('/api/admin/store-settings', requireAdmin, getAdminStoreSettings)
  app.put('/api/admin/store-settings', requireAdmin, putAdminStoreSettings)
  app.post('/api/admin/products', requireAdmin, postAdminProduct)
  app.put('/api/admin/products/:id', requireAdmin, putAdminProduct)
  app.delete('/api/admin/products/:id', requireAdmin, removeAdminProduct)
  app.post('/api/admin/extras', requireAdmin, postAdminExtra)
  app.put('/api/admin/extras/:id', requireAdmin, putAdminExtra)
  app.delete('/api/admin/extras/:id', requireAdmin, removeAdminExtra)
  app.post('/api/admin/categories', requireAdmin, postAdminCategory)
  app.put('/api/admin/categories/:id', requireAdmin, putAdminCategory)
  app.delete('/api/admin/categories/:id', requireAdmin, removeAdminCategory)
  app.post('/api/admin/promotions', requireAdmin, postAdminPromotion)
  app.put('/api/admin/promotions/:id', requireAdmin, putAdminPromotion)
  app.delete('/api/admin/promotions/:id', requireAdmin, removeAdminPromotion)
  app.get('/api/admin/loyalty', requireAdmin, getAdminPoints)
  app.put('/api/admin/loyalty/settings', requireAdmin, putAdminPointsSettings)
  app.post('/api/admin/loyalty/rewards', requireAdmin, postAdminReward)
  app.put('/api/admin/loyalty/rewards/:id', requireAdmin, putAdminReward)
  app.delete('/api/admin/loyalty/rewards/:id', requireAdmin, removeAdminReward)
  app.post('/api/admin/loyalty/adjustments', requireAdmin, postAdminPointsAdjustment)
  app.get('/api/admin/campaigns', requireAdmin, getAdminCampaigns)
  app.post('/api/admin/campaigns', requireAdmin, postAdminCampaign)
  app.put('/api/admin/campaigns/:id', requireAdmin, putAdminCampaign)
  app.delete('/api/admin/campaigns/:id', requireAdmin, removeAdminCampaign)
  app.post(
    '/api/admin/campaigns/:id/distribute',
    requireAdmin,
    postAdminCampaignDistribution,
  )
  app.patch(
    '/api/admin/campaign-vouchers/:id',
    requireAdmin,
    patchAdminCampaignVoucher,
  )

  if (indexHtml) {
    app.get(/^(?!\/api\/).*/, (_request, response) => {
      response.setHeader('Cache-Control', 'no-cache')
      response.type('html').send(indexHtml)
    })
  }

  app.use((error, _request, response, _next) => {
    if (error?.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'JSON inválido.' })
    }
    if (error?.message === 'Origem não permitida pelo CORS.') {
      return response.status(403).json({ error: error.message })
    }

    console.error('Erro não tratado na API', {
      message: error?.message,
      code: error?.code,
      path: error?.path,
    })
    return response.status(500).json({ error: 'Erro interno do servidor.' })
  })

  return app
}
