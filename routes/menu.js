const express = require('express')
const router = express.Router()
const { restaurant, categories, menuItems } = require('../data/menuData')

// GET /api/menu  — full menu + restaurant info
router.get('/', (_req, res) => {
  res.json({ restaurant, categories, items: menuItems })
})

// GET /api/menu/categories
router.get('/categories', (_req, res) => {
  res.json(categories)
})

// GET /api/menu/:category
router.get('/:category', (req, res) => {
  const { category } = req.params
  const items = menuItems.filter((item) => item.category === category)

  if (items.length === 0) {
    return res.status(404).json({ error: `Category "${category}" not found` })
  }

  res.json({ category, items })
})

module.exports = router
