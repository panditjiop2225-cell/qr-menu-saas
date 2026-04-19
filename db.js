const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/qr-menu'

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log(`[db] MongoDB connected: ${mongoose.connection.host}`)
  } catch (err) {
    console.error('[db] MongoDB connection error:', err.message)
    process.exit(1)
  }
}

module.exports = connectDB
