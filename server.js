/* Express server setup */
// const express = require('express');
// const mysql = require('mysql');
// const cors = require('cors');
// const path = require('path');

// const app = express();
// const port = 3000;

// app.use(cors());
// app.use(express.json());
// app.use(express.static(path.join(__dirname, 'public')));

/* MySQL database setup */
// const db = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: '',
//   database: 'nike_inventory'
// });

// db.connect(err => {
//   if (err) throw err;
//   console.log('Connected to MySQL database');
// });

/**
 * GET all products, returning the category name via JOIN
 */
// app.get('/api/products', (req, res) => {
//   const sql = `
//     SELECT
//       p.id,
//       p.name,
//       p.quantity,
//       p.price,
//       c.name AS category,
//       p.description
//     FROM products p
//     LEFT JOIN category c ON p.category_id = c.category_id
//   `;
//   db.query(sql, (err, results) => {
//     if (err) {
//       console.error('Error fetching products:', err);
//       return res.status(500).json({ error: 'Database query failed' });
//     }
//     res.json(results);
//   });
// });

/**
 * GET search products by name or category name
 */
// app.get('/api/products/search', (req, res) => {
//   const { q } = req.query;
//   const sql = `
//     SELECT
//       p.id,
//       p.name,
//       p.quantity,
//       p.price,
//       c.name AS category,
//       p.description
//     FROM products p
//     LEFT JOIN category c ON p.category_id = c.category_id
//     WHERE p.name LIKE ? OR c.name LIKE ?
//   `;
//   db.query(sql, [`%${q}%`, `%${q}%`], (err, results) => {
//     if (err) {
//       console.error('Error executing search:', err);
//       return res.status(500).json({ error: 'Database query failed' });
//     }
//     res.json(results);
//   });
// });

/**
 * POST add a new product.
 * If client sends a category name, we look up its ID.
 */
// app.post('/api/products', (req, res) => {
//   const { name, quantity, price, category, description } = req.body;
//   // first find category_id
//   db.query(
//     'SELECT category_id FROM category WHERE name = ?',
//     [category],
//     (err, rows) => {
//       if (err) {
//         console.error('Error fetching category:', err);
//         return res.status(500).json({ error: 'Database query failed' });
//       }
//       const category_id = rows[0]?.category_id || null;
//       const sql = `
//         INSERT INTO products
//           (name, quantity, price, category_id, description)
//         VALUES (?, ?, ?, ?, ?)
//       `;
//       db.query(
//         sql,
//         [name, quantity, price, category_id, description],
//         err => {
//           if (err) {
//             console.error('Error inserting product:', err);
//             return res.status(500).json({ error: 'Insert failed' });
//           }
//           res.json({ message: 'Product added successfully' });
//         }
//       );
//     }
//   );
// });

/**
 * PUT update an existing product (all fields, including category by name)
 */
// app.put('/api/products/:id', (req, res) => {
//   const { id } = req.params;
//   const { name, quantity, price, category, description } = req.body;
//   // resolve category name to ID
//   db.query(
//     'SELECT category_id FROM category WHERE name = ?',
//     [category],
//     (err, rows) => {
//       if (err) return res.status(500).json({ error: 'Database query failed' });
//       const category_id = rows[0]?.category_id || null;
//       const sql = `
//         UPDATE products
//         SET name = ?, quantity = ?, price = ?, category_id = ?, description = ?
//         WHERE id = ?
//       `;
//       db.query(
//         sql,
//         [name, quantity, price, category_id, description, id],
//         (err, result) => {
//           if (err) {
//             console.error('Error updating product:', err);
//             return res.status(500).json({ error: 'Update failed' });
//           }
//           res.json({ message: 'Product updated successfully' });
//         }
//       );
//     }
//   );
// });

/**
 * DELETE a product
 */
// app.delete('/api/products/:id', (req, res) => {
//   const { id } = req.params;
//   db.query('DELETE FROM products WHERE id = ?', [id], (err, result) => {
//     if (err) {
//       console.error('Error deleting product:', err);
//       return res.status(500).json({ error: 'Delete failed' });
//     }
//     res.json({ message: 'Product deleted successfully' });
//   });
// });

/**
 * PUT update only the quantity (status) of a product
 */
// app.put('/api/products/:id/status', (req, res) => {
//   const { id } = req.params;
//   const { quantity } = req.body;

//   if (quantity == null || isNaN(quantity) || quantity < 0) {
//     return res.status(400).json({ message: 'Invalid quantity value' });
//   }

//   db.query(
//     'UPDATE products SET quantity = ? WHERE id = ?',
//     [quantity, id],
//     (err, result) => {
//       if (err) {
//         console.error('Error updating product status:', err);
//         return res.status(500).json({ message: 'Failed to update product status' });
//       }
//       if (result.affectedRows === 0) {
//         return res.status(404).json({ message: 'Product not found' });
//       }
//       res.json({ message: 'Product status updated successfully' });
//     }
//   );
// });

// Serve index.html for the root URL
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });
