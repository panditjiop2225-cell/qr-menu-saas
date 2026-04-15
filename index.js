require('dotenv').config()
const express = require('express')
const cors = require('cors')

const menuRoutes  = require('./routes/menu')
const orderRoutes = require('./routes/orders')

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }))
app.use(express.json())

// Routes
app.use('/api/menu',   menuRoutes)
app.use('/api/orders', orderRoutes)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
