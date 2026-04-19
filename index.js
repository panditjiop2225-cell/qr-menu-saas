require('dotenv').config()
const express   = require('express')
const cors      = require('cors')
const connectDB = require('./db')

const menuRoutes  = require('./routes/menu')
const orderRoutes = require('./routes/orders')

const app  = express()
const PORT = process.env.PORT || 5000

const ALLOWED_ORIGINS = [
  'https://mainversion.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3002',
  ...(process.env.CLIENT_ORIGIN ? [process.env.CLIENT_ORIGIN] : []),
]

app.use(cors({
  origin: (origin, cb) => {
    // allow server-to-server / curl (no origin) and listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json())

// Routes
app.use('/api/menu',   menuRoutes)
app.use('/api/orders', orderRoutes)

app.get('/', (_req, res) => res.json({ message: 'QR Menu Backend API is running!', status: 'OK' }))
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// Connect to MongoDB, then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
})
