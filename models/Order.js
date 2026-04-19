const mongoose = require('mongoose')

const statusHistorySchema = new mongoose.Schema({
  status:    { type: String, required: true },
  timestamp: { type: String, required: true },
  updatedBy: { type: String, default: 'system' },
}, { _id: false })

const gstBreakdownSchema = new mongoose.Schema({
  rate: { type: Number, required: true },
  cgst: { type: Number, required: true },
  sgst: { type: Number, required: true },
}, { _id: false })

const orderItemSchema = new mongoose.Schema({
  id:       { type: Number, required: true },
  name:     { type: String, required: true },
  qty:      { type: Number, required: true },
  price:    { type: Number, required: true },
  gstRate:  { type: Number, default: 5 },
}, { _id: false })

const orderSchema = new mongoose.Schema({
  orderId:         { type: String, required: true, unique: true, index: true },
  orderNumber:     { type: String, default: null },
  razorpayOrderId: { type: String, default: null },
  paymentId:       { type: String, default: null },
  paidAt:          { type: String, default: null },

  items:           { type: [orderItemSchema], required: true },
  subtotal:        { type: Number, default: null },
  gstAmount:       { type: Number, default: null },
  gstBreakdown:    { type: [gstBreakdownSchema], default: [] },
  totalAmount:     { type: Number, required: true },

  paymentMethod:   { type: String, required: true, enum: ['cash', 'counter', 'online', 'upi'] },
  tableNumber:     { type: String, default: null },
  customerName:    { type: String, required: true },
  customerPhone:   { type: String, default: null },
  specialInstructions: { type: String, default: null },
  instructions:    { type: String, default: null },

  status:          {
    type: String, required: true, default: 'pending',
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled', 'awaiting_payment', 'new'],
  },
  statusHistory:   { type: [statusHistorySchema], default: [] },

  createdAt:       { type: String, required: true },
  updatedAt:       { type: String, default: null },
}, {
  // Disable Mongoose auto timestamps since we manage createdAt/updatedAt as ISO strings
  timestamps: false,
  versionKey: false,
})

module.exports = mongoose.model('Order', orderSchema)
