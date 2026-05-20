const express = require('express');
const router = express.Router();
const pool = require('../database');
const cache = require('../cache');

// GET /dproduto
// Query params: familia (BLOOM, SORRENTINA)
// Retorna apenas Produto Acabado (PA): cd_produto <= 1000000
router.get('/', async (req, res) => {
  try {
    const { familia } = req.query;
    const cacheKey = `dproduto_${familia || 'all'}`;

    // Verificar cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ data: cached, fromCache: true });
    }

    let query = `
      SELECT
        p.*,
        cf.ds_classificacao AS familia,
        ca.ds_classificacao AS artigo
      FROM prd_produto p
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = p.cd_produto AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = p.cd_produto AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      WHERE p.cd_produto <= 1000000
    `;

    const params = [];

    if (familia) {
      query += ` AND UPPER(cf.ds_classificacao) = UPPER($1)`;
      params.push(familia);
    }

    const result = await pool.query(query, params);

    // Salvar no cache
    cache.set(cacheKey, result.rows);

    res.json({ data: result.rows, fromCache: false });
  } catch (error) {
    console.error('Erro ao buscar dproduto:', error);
    res.status(500).json({ error: 'Erro ao buscar produtos acabados' });
  }
});

module.exports = router;
