const express  = require('express')
const Razorpay = require('razorpay')
const crypto   = require('crypto')

const router = express.Router()
const Order  = require('../models/Order')

// ─── Valid status transitions ──────────────────────────────────────────────

const VALID_TRANSITIONS = {
  pending:          ['confirmed', 'cancelled'],
  confirmed:        ['preparing', 'cancelled'],
  preparing:        ['ready',     'cancelled'],
  ready:            ['delivered'],
  delivered:        [],
  cancelled:        [],
  // Legacy statuses for backward compat
  new:              ['preparing', 'cancelled'],
  awaiting_payment: ['pending'],
}

const ALL_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeOrderId() {
  return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

async function makeOrderNumber() {
  const count = await Order.countDocuments()
  return `#${1001 + count}`
}

function getRazorpay() {
  const keyId     = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  console.log('[Razorpay] key loaded:', keyId ? `${keyId.slice(0, 12)}…` : 'MISSING')
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing from .env')
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret })
}

function makeHistory(status, timestamp, updatedBy = 'system') {
  return { status, timestamp, updatedBy }
}

// ─── GET /api/orders ── list all ──────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const all = await Order.find().sort({ createdAt: -1 }).lean()
    res.json(all)
  } catch (err) {
    console.error('[orders] GET / error:', err.message)
    res.status(500).json({ error: 'Failed to fetch orders' })
  }
})

// ─── POST /api/orders ──────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const {
    items,
    // accept both field names
    totalAmount: totalAmountField, total,
    subtotal, gstAmount, gstBreakdown,
    paymentMethod, tableNumber,
    customerName, customerPhone,
    specialInstructions, instructions,
  } = req.body

  const totalAmount = totalAmountField ?? total

  console.log(`[orders] POST / — method=${paymentMethod ?? 'razorpay'}, amount=${totalAmount}`)

  if (!items?.length) {
    return res.status(400).json({ error: 'items are required' })
  }
  if (!totalAmount) {
    return res.status(400).json({ error: 'total or totalAmount is required' })
  }
  if (!customerName?.trim()) {
    return res.status(400).json({ error: 'customerName is required' })
  }

  // Normalise items: support both qty and quantity
  const normalisedItems = items.map(item => ({
    id:      item.id,
    name:    item.name,
    price:   item.price,
    qty:     item.qty ?? item.quantity ?? 1,
    gstRate: item.gstRate ?? 5,
  }))

  const orderId     = makeOrderId()
  const orderNumber = await makeOrderNumber()
  const now         = new Date().toISOString()
  const notes       = specialInstructions ?? instructions ?? null

  // ── Cash / Counter / UPI — no Razorpay needed ─────────────────────────
  const offlinePaymentMethods = ['cash', 'counter', 'upi']
  if (offlinePaymentMethods.includes(paymentMethod)) {
    try {
      const order = await Order.create({
        orderId, orderNumber,
        items: normalisedItems,
        subtotal: subtotal ?? null,
        gstAmount: gstAmount ?? null,
        gstBreakdown: gstBreakdown ?? [],
        totalAmount, paymentMethod,
        tableNumber:          tableNumber   ?? null,
        customerName:         customerName.trim(),
        customerPhone:        customerPhone ?? null,
        specialInstructions:  notes,
        status:               'pending',
        statusHistory:        [makeHistory('pending', now)],
        createdAt:            now,
      })
      console.log(`[orders] ${paymentMethod} order created: ${order.orderId} (${orderNumber})`)
      return res.status(201).json({
        success:     true,
        orderId:     order._id.toString(),
        orderNumber: order.orderNumber,
        message:     'Order created successfully',
      })
    } catch (err) {
      console.error('[orders] order create error:', err.message)
      return res.status(500).json({ error: 'Failed to create order' })
    }
  }

  // ── Razorpay (online) ──────────────────────────────────────────────────
  const amountPaise = Math.round(totalAmount * 100)
  let razorpayOrder
  try {
    const rzp = getRazorpay()
    razorpayOrder = await rzp.orders.create({
      amount: amountPaise, currency: 'INR',
      receipt: orderId, notes: { restaurant: 'Spice Garden' },
    })
    console.log(`[orders] Razorpay order created: ${razorpayOrder.id}`)
  } catch (err) {
    console.error('[orders] Razorpay error:', err.message, err.error ?? '')
    return res.status(502).json({
      error: 'Payment gateway error', detail: err.message,
      hint: 'Check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in server/.env',
    })
  }

  try {
    const order = await Order.create({
      orderId, orderNumber, razorpayOrderId: razorpayOrder.id,
      items: normalisedItems,
      subtotal: subtotal ?? null,
      gstAmount: gstAmount ?? null,
      gstBreakdown: gstBreakdown ?? [],
      totalAmount, paymentMethod: 'online',
      tableNumber:          tableNumber   ?? null,
      customerName:         customerName.trim(),
      customerPhone:        customerPhone ?? null,
      specialInstructions:  notes,
      status:               'awaiting_payment',
      statusHistory:        [makeHistory('awaiting_payment', now)],
      createdAt:            now,
    })
    res.json({
      orderId:         order._id.toString(),
      orderNumber:     order.orderNumber,
      razorpayOrderId: razorpayOrder.id,
      amount:          amountPaise,
      currency:        'INR',
      keyId:           process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('[orders] save Razorpay order error:', err.message)
    return res.status(500).json({ error: 'Failed to save order' })
  }
})

// ─── POST /api/orders/verify ───────────────────────────────────────────────

router.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body
  console.log(`[orders] verify — orderId=${orderId}`)

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification fields' })
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keySecret) return res.status(500).json({ error: 'RAZORPAY_KEY_SECRET not set' })

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (expected !== razorpay_signature) {
    console.warn(`[orders] signature mismatch for ${orderId}`)
    return res.status(400).json({ error: 'Payment signature mismatch' })
  }

  try {
    const now   = new Date().toISOString()
    const order = await Order.findOne({ orderId })
    if (order) {
      order.status        = 'pending'
      order.paymentId     = razorpay_payment_id
      order.paidAt        = now
      order.statusHistory = [
        ...(order.statusHistory ?? []),
        makeHistory('pending', now),
      ]
      await order.save()
      console.log(`[orders] verified & pending kitchen: ${orderId}`)
    }
  } catch (err) {
    console.error('[orders] verify save error:', err.message)
  }

  res.json({ success: true })
})

// ─── PUT /api/orders/:orderId/status ── managed status update ─────────────

router.put('/:orderId/status', async (req, res) => {
  const { orderId }                     = req.params
  const { status, updatedBy = 'admin' } = req.body

  if (!ALL_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status', allowed: ALL_STATUSES })
  }

  try {
    const order = await Order.findOne({ orderId })
    if (!order) return res.status(404).json({ error: 'Order not found' })

    const allowed = VALID_TRANSITIONS[order.status] ?? []
    if (!allowed.includes(status)) {
      return res.status(422).json({
        error:   `Cannot transition from '${order.status}' to '${status}'`,
        current: order.status,
        allowed,
      })
    }

    const now = new Date().toISOString()
    order.status        = status
    order.updatedAt     = now
    order.statusHistory = [
      ...(order.statusHistory ?? [makeHistory(order.status, order.createdAt)]),
      makeHistory(status, now, updatedBy),
    ]
    await order.save()

    console.log(`[orders] ${orderId}: → ${status} (by ${updatedBy})`)
    res.json(order.toObject())
  } catch (err) {
    console.error('[orders] status update error:', err.message)
    res.status(500).json({ error: 'Failed to update order status' })
  }
})

// ─── PATCH /api/orders/:orderId ── legacy kitchen status (backward compat) ─

router.patch('/:orderId', async (req, res) => {
  const { orderId } = req.params
  const { status }  = req.body
  const LEGACY_VALID = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled', 'new']

  if (!LEGACY_VALID.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${LEGACY_VALID.join(', ')}` })
  }

  try {
    const order = await Order.findOne({ orderId })
    if (!order) return res.status(404).json({ error: 'Order not found' })

    const now = new Date().toISOString()
    order.status        = status
    order.updatedAt     = now
    order.statusHistory = [
      ...(order.statusHistory ?? [makeHistory(order.status, order.createdAt)]),
      makeHistory(status, now, 'system'),
    ]
    await order.save()

    console.log(`[orders] ${orderId} → ${status} (legacy PATCH)`)
    res.json({ orderId, status })
  } catch (err) {
    console.error('[orders] legacy patch error:', err.message)
    res.status(500).json({ error: 'Failed to update order' })
  }
})

// ─── GET /api/orders/:id ── single order (by _id or orderId) ─────────────

router.get('/:id', async (req, res) => {
  const { id } = req.params
  try {
    // Try MongoDB ObjectId first, fall back to custom orderId
    const isObjectId = /^[a-f\d]{24}$/i.test(id)
    const order = isObjectId
      ? await Order.findById(id).lean()
      : await Order.findOne({ orderId: id }).lean()
    if (!order) return res.status(404).json({ error: 'Order not found' })
    res.json(order)
  } catch (err) {
    console.error('[orders] GET /:id error:', err.message)
    res.status(500).json({ error: 'Failed to fetch order' })
  }
})

module.exports = router
