const express = require('express');
const router = express.Router();
const pool = require('../database');
const cache = require('../cache');

// GET /vendas
// Query params: familia (BLOOM, SORRENTINA)
// Retorna vendas de produtos acabados com familia e artigo
router.get('/', async (req, res) => {
  try {
    const { familia } = req.query;
    const cacheKey = `vendas_${familia || 'all'}`;

    // Verificar cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ data: cached, fromCache: true });
    }

    let query = `
      SELECT
        v.*,
        p.ds_produto,
        cf.ds_classificacao AS familia,
        ca.ds_classificacao AS artigo
      FROM mv_vendas_qtd v
      INNER JOIN prd_produto p ON p.cd_produto = v.idproduto
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = v.idproduto AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = v.idproduto AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      WHERE v.idproduto <= 1000000
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
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ error: 'Erro ao buscar dados de vendas' });
  }
});

module.exports = router;
