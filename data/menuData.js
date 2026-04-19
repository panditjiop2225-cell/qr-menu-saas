const restaurant = {
  name: 'Spice Garden',
  tagline: 'Authentic Indian Flavors Since 1995',
  address: '42, MG Road, Indiranagar, Bengaluru — 560038',
  phone: '+91 98765 43210',
  hours: 'Mon–Sun  11:00 AM – 11:00 PM',
  gstNo: '29ABCDE1234F1Z5',
}

const categories = [
  { id: 'starters',     label: 'Starters',       emoji: '🥗' },
  { id: 'main-course',  label: 'Main Course',     emoji: '🍛' },
  { id: 'breads',       label: 'Breads',          emoji: '🫓' },
  { id: 'rice-biryani', label: 'Rice & Biryani',  emoji: '🍚' },
  { id: 'desserts',     label: 'Desserts',        emoji: '🍮' },
]

const menuItems = [
  { id: 1,  name: 'Tandoori Chicken',     category: 'starters',     price: 349, gstRate: 5,  isVeg: false, isSpicy: true,  tags: ['Bestseller', "Chef's Special"] },
  { id: 2,  name: 'Paneer Tikka',         category: 'starters',     price: 279, gstRate: 5,  isVeg: true,  isSpicy: false, tags: ['Bestseller'] },
  { id: 3,  name: 'Butter Chicken',       category: 'main-course',  price: 399, gstRate: 18, isVeg: false, isSpicy: false, tags: ['Bestseller', 'Must Try'] },
  { id: 4,  name: 'Paneer Butter Masala', category: 'main-course',  price: 329, gstRate: 5,  isVeg: true,  isSpicy: false, tags: [] },
  { id: 5,  name: 'Dal Makhani',          category: 'main-course',  price: 259, gstRate: 5,  isVeg: true,  isSpicy: false, tags: ["Chef's Special"] },
  { id: 6,  name: 'Mutton Rogan Josh',    category: 'main-course',  price: 499, gstRate: 18, isVeg: false, isSpicy: true,  tags: ["Chef's Special"] },
  { id: 7,  name: 'Garlic Naan',          category: 'breads',       price: 79,  gstRate: 5,  isVeg: true,  isSpicy: false, tags: [] },
  { id: 8,  name: 'Chicken Biryani',      category: 'rice-biryani', price: 429, gstRate: 12, isVeg: false, isSpicy: true,  tags: ['Bestseller'] },
  { id: 9,  name: 'Veg Dum Biryani',      category: 'rice-biryani', price: 319, gstRate: 5,  isVeg: true,  isSpicy: false, tags: [] },
  { id: 10, name: 'Gulab Jamun',          category: 'desserts',     price: 149, gstRate: 5,  isVeg: true,  isSpicy: false, tags: ['Must Try'] },
]

module.exports = { restaurant, categories, menuItems }
