import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import cors from 'cors'
import express from 'express'

import {
  getCustomerOrders,
  getOrder,
  postMercadoPagoWebhook,
  postOrder,
  postProcessPayment,
} from './controllers/checkout.js'
import {
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
  postPhoneLogin,
  postRequestCode,
  postVerifyCode,
} from './controllers/auth.js'
import { getCustomerFromRequest, requireCustomer } from './services/customer-auth.js'
import {
  getAdminCatalog,
  getPublicCatalog,
  postAdminCategory,
  postAdminProduct,
  putAdminCategory,
  putAdminProduct,
  removeAdminCategory,
  removeAdminProduct,
} from './controllers/catalog.js'
import {
  getDeliveryZones,
  postCalculateDelivery,
} from './controllers/delivery.js'

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url))
const staticDirectory = path.resolve(serviceDirectory, '../dist')
const indexFile = path.join(staticDirectory, 'index.html')

export function createApp() {
  const app = express()
  const frontendUrl = String(process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .replace(/\/$/, '')
  const allowedOrigins = new Set(
    [
      frontendUrl,
      process.env.BACKEND_URL,
      process.env.RENDER_EXTERNAL_URL,
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
  if (existsSync(indexFile)) {
    app.use(express.static(staticDirectory, { index: false }))
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
    response.json({ ok: true })
  })
  app.get('/api/catalog', getPublicCatalog)
  app.get('/api/delivery-zones', getDeliveryZones)
  app.post('/api/calculate-delivery', postCalculateDelivery)
  app.get('/api/auth/session', getCustomerSession)
  app.post('/api/auth/request-code', postRequestCode)
  app.post('/api/auth/verify-code', postVerifyCode)
  app.post('/api/auth/login/password', postPasswordLogin)
  app.post('/api/auth/login/phone', postPhoneLogin)
  app.post('/api/auth/guest', postGuestAccess)
  app.post('/api/auth/logout', postCustomerLogout)
  app.patch('/api/auth/profile', requireCustomer, patchCustomerProfile)
  app.post(
    '/api/orders',
    async (request, _response, next) => {
      request.customerUser = await getCustomerFromRequest(request)
      next()
    },
    postOrder,
  )
  app.get('/api/orders', requireCustomer, getCustomerOrders)
  app.get('/api/orders/:id', requireCustomer, getOrder)
  app.post('/api/process-payment', requireCustomer, postProcessPayment)
  app.post('/api/webhooks/mercadopago', postMercadoPagoWebhook)
  app.get('/api/admin/session', getAdminSession)
  app.post('/api/admin/login', postAdminLogin)
  app.post('/api/admin/logout', postAdminLogout)
  app.get('/api/admin/orders', requireAdmin, getAdminOrders)
  app.get('/api/admin/orders/stream', requireAdmin, getAdminOrderStream)
  app.patch('/api/admin/orders/:id/status', requireAdmin, patchAdminOrderStatus)
  app.get('/api/admin/catalog', requireAdmin, getAdminCatalog)
  app.post('/api/admin/products', requireAdmin, postAdminProduct)
  app.put('/api/admin/products/:id', requireAdmin, putAdminProduct)
  app.delete('/api/admin/products/:id', requireAdmin, removeAdminProduct)
  app.post('/api/admin/categories', requireAdmin, postAdminCategory)
  app.put('/api/admin/categories/:id', requireAdmin, putAdminCategory)
  app.delete('/api/admin/categories/:id', requireAdmin, removeAdminCategory)

  if (existsSync(indexFile)) {
    app.use(express.static(staticDirectory, { index: false }))
    app.get(/^(?!\/api\/).*/, (_request, response) => {
      response.sendFile(indexFile)
    })
  }

  app.use((error, _request, response, _next) => {
    if (error?.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'JSON inválido.' })
    }
    if (error?.message === 'Origem não permitida pelo CORS.') {
      return response.status(403).json({ error: error.message })
    }

    console.error('Erro não tratado na API', { message: error?.message })
    return response.status(500).json({ error: 'Erro interno do servidor.' })
  })

  return app
}
