const express  = require('express')
const Razorpay = require('razorpay')
const crypto   = require('crypto')

const router = express.Router()

// In-memory order store (replace with DB in production)
const orders = new Map()

// ─── helpers ───────────────────────────────────────────────────────────────

function makeOrderId() {
  return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
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

// ─── Seed demo orders (shown when dashboard first loads) ──────────────────

function seedDemoOrders() {
  const now = Date.now()
  const seed = [
    {
      orderId: 'ORD-DEMO-001',
      items: [
        { id: 1, name: 'Butter Chicken', qty: 2, price: 320 },
        { id: 2, name: 'Garlic Naan',    qty: 4, price: 45  },
        { id: 3, name: 'Mango Lassi',    qty: 2, price: 95  },
      ],
      totalAmount: 1120, paymentMethod: 'cash', tableNumber: '4',
      customerName: 'Rahul Sharma', customerPhone: '98765-43210', instructions: 'Less spicy please',
      status: 'new', createdAt: new Date(now - 3 * 60000).toISOString(),
    },
    {
      orderId: 'ORD-DEMO-002',
      items: [
        { id: 4, name: 'Paneer Tikka',   qty: 1, price: 280 },
        { id: 5, name: 'Dal Makhani',    qty: 1, price: 220 },
        { id: 6, name: 'Jeera Rice',     qty: 2, price: 140 },
      ],
      totalAmount: 780, paymentMethod: 'online', tableNumber: '7',
      customerName: 'Priya Patel', customerPhone: '91234-56789', instructions: null,
      status: 'preparing', createdAt: new Date(now - 12 * 60000).toISOString(),
    },
    {
      orderId: 'ORD-DEMO-003',
      items: [
        { id: 7, name: 'Masala Dosa',    qty: 2, price: 160 },
        { id: 8, name: 'Filter Coffee',  qty: 2, price: 60  },
      ],
      totalAmount: 440, paymentMethod: 'online', tableNumber: '2',
      customerName: 'Arun Kumar', customerPhone: null, instructions: 'Extra sambar on the side',
      status: 'ready', createdAt: new Date(now - 25 * 60000).toISOString(),
    },
    {
      orderId: 'ORD-DEMO-004',
      items: [
        { id: 9, name: 'Chicken Biryani', qty: 1, price: 380 },
        { id: 10, name: 'Raita',           qty: 1, price: 60  },
      ],
      totalAmount: 440, paymentMethod: 'cash', tableNumber: '11',
      customerName: 'Meena Iyer', customerPhone: '99887-76655', instructions: null,
      status: 'delivered', createdAt: new Date(now - 55 * 60000).toISOString(),
    },
    {
      orderId: 'ORD-DEMO-005',
      items: [
        { id: 11, name: 'Veg Thali',      qty: 2, price: 250 },
        { id: 12, name: 'Gulab Jamun',    qty: 4, price: 40  },
      ],
      totalAmount: 660, paymentMethod: 'cash', tableNumber: '5',
      customerName: 'Vikram Nair', customerPhone: null, instructions: 'No onions please',
      status: 'new', createdAt: new Date(now - 1 * 60000).toISOString(),
    },
  ]
  seed.forEach(o => orders.set(o.orderId, o))
  console.log('[orders] seeded', seed.length, 'demo orders')
}

seedDemoOrders()

// ─── GET /api/orders ── list all ──────────────────────────────────────────

router.get('/', (req, res) => {
  const all = Array.from(orders.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  res.json(all)
})

// ─── POST /api/orders ──────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { items, totalAmount, paymentMethod, tableNumber, customerName, customerPhone, instructions } = req.body
  console.log(`[orders] POST / — method=${paymentMethod ?? 'razorpay'}, amount=${totalAmount}`)

  if (!items?.length || !totalAmount) {
    return res.status(400).json({ error: 'items and totalAmount are required' })
  }

  const orderId = makeOrderId()

  // ── Cash / Pay-at-Counter ──────────────────────────────────────────────
  if (paymentMethod === 'cash') {
    const order = {
      orderId, items, totalAmount,
      paymentMethod:  'cash',
      tableNumber:    tableNumber ?? null,
      customerName:   customerName ?? null,
      customerPhone:  customerPhone ?? null,
      instructions:   instructions ?? null,
      status:         'new',
      createdAt:      new Date().toISOString(),
    }
    orders.set(orderId, order)
    console.log(`[orders] cash order created: ${orderId}`)
    return res.json({ orderId, paymentMethod: 'cash', status: 'new' })
  }

  // ── Razorpay ────────────────────────────────────────────────────────────
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

  orders.set(orderId, {
    orderId, razorpayOrderId: razorpayOrder.id,
    items, totalAmount, paymentMethod: 'online',
    tableNumber:   tableNumber ?? null,
    customerName:  customerName ?? null,
    customerPhone: customerPhone ?? null,
    instructions:  instructions ?? null,
    status:        'awaiting_payment',
    createdAt:     new Date().toISOString(),
  })

  res.json({
    orderId, razorpayOrderId: razorpayOrder.id,
    amount: amountPaise, currency: 'INR',
    keyId: process.env.RAZORPAY_KEY_ID,
  })
})

// ─── POST /api/orders/verify ───────────────────────────────────────────────

router.post('/verify', (req, res) => {
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

  if (orderId && orders.has(orderId)) {
    const order = orders.get(orderId)
    orders.set(orderId, {
      ...order,
      status:    'new',
      paymentId: razorpay_payment_id,
      paidAt:    new Date().toISOString(),
    })
    console.log(`[orders] verified & ready for kitchen: ${orderId}`)
  }

  res.json({ success: true })
})

// ─── PATCH /api/orders/:orderId ── update kitchen status ──────────────────

router.patch('/:orderId', (req, res) => {
  const { orderId } = req.params
  const { status }  = req.body
  const VALID = ['new', 'preparing', 'ready', 'delivered']

  if (!VALID.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID.join(', ')}` })
  }

  const order = orders.get(orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  orders.set(orderId, { ...order, status, updatedAt: new Date().toISOString() })
  console.log(`[orders] ${orderId} → ${status}`)
  res.json({ orderId, status })
})

// ─── GET /api/orders/:orderId ── single order ─────────────────────────────

router.get('/:orderId', (req, res) => {
  const order = orders.get(req.params.orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  res.json(order)
})

module.exports = router
