const express = require('express');
const router = express.Router();
const pool = require('../database');
const cache = require('../cache');

// GET /dmateriaprima
// Retorna apenas Matéria-Prima (MP): cd_produto > 1000000
router.get('/', async (req, res) => {
  try {
    const cacheKey = 'dmateriaprima_all';

    // Verificar cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ data: cached, fromCache: true });
    }

    const query = `
      SELECT *
      FROM prd_produto
      WHERE cd_produto > 1000000
    `;

    const result = await pool.query(query);

    // Salvar no cache
    cache.set(cacheKey, result.rows);

    res.json({ data: result.rows, fromCache: false });
  } catch (error) {
    console.error('Erro ao buscar dmateriaprima:', error);
    res.status(500).json({ error: 'Erro ao buscar matéria-prima' });
  }
});

module.exports = router;
