const express = require('express');
const router = express.Router();
const pool = require('../database');
const cache = require('../cache');

// Período fixo: 2025.2 (segundo semestre de 2025)
const PERIODO_INICIO = '2025-07-01';
const PERIODO_FIM = '2025-12-31';

// GET /analise/consumo-bojo
// Retorna consumo médio de bojos por mês para uma família
// Filtrado para período 2025.2
router.get('/consumo-bojo', async (req, res) => {
  try {
    const { familia } = req.query;
    const familiaParam = familia || 'SORRENTINA';
    const cacheKey = `analise_consumo_bojo_${familiaParam}_2025.2`;

    // Verificar cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ data: cached, fromCache: true });
    }

    // Consumo detalhado por mês e por tipo de bojo - PERÍODO 2025.2
    const queryDetalhado = `
      SELECT
        TO_CHAR(v.data, 'YYYY-MM') AS mes,
        fc.cd_produtomp AS cd_bojo,
        mp.ds_produto AS ds_bojo,
        SUM(v.qt_liquida * fc.qt_consumo) AS total_consumo_bojo,
        SUM(v.qt_liquida) AS total_vendido
      FROM mv_vendas_qtd v
      INNER JOIN prd_produto p ON p.cd_produto = v.idproduto
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = v.idproduto AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      INNER JOIN vr_pcp_fcconsumo fc ON fc.cd_produtopa = v.idproduto
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      INNER JOIN prd_produto mp ON mp.cd_produto = fc.cd_produtomp
      WHERE UPPER(cf.ds_classificacao) = UPPER($1)
        AND UPPER(ca.ds_classificacao) = 'BOJO'
        AND fc.cd_produtomp > 1000000
        AND v.data >= $2 AND v.data <= $3
      GROUP BY TO_CHAR(v.data, 'YYYY-MM'), fc.cd_produtomp, mp.ds_produto
      ORDER BY mes DESC, total_consumo_bojo DESC
    `;

    // Resumo mensal - PERÍODO 2025.2
    const queryResumo = `
      WITH consumo_mensal AS (
        SELECT
          TO_CHAR(v.data, 'YYYY-MM') AS mes,
          SUM(v.qt_liquida * fc.qt_consumo) AS total_bojos_consumidos,
          SUM(v.qt_liquida) AS total_pecas_vendidas,
          COUNT(DISTINCT fc.cd_produtomp) AS qtd_tipos_bojo
        FROM mv_vendas_qtd v
        INNER JOIN prd_produto p ON p.cd_produto = v.idproduto
        LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = v.idproduto AND pcf.cd_tipoclas = 24
        LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
        INNER JOIN vr_pcp_fcconsumo fc ON fc.cd_produtopa = v.idproduto
        LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
        LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
        WHERE UPPER(cf.ds_classificacao) = UPPER($1)
          AND UPPER(ca.ds_classificacao) = 'BOJO'
          AND fc.cd_produtomp > 1000000
          AND v.data >= $2 AND v.data <= $3
        GROUP BY TO_CHAR(v.data, 'YYYY-MM')
      )
      SELECT
        mes,
        total_bojos_consumidos,
        total_pecas_vendidas,
        qtd_tipos_bojo
      FROM consumo_mensal
      ORDER BY mes DESC
    `;

    const [detalhadoResult, resumoResult] = await Promise.all([
      pool.query(queryDetalhado, [familiaParam, PERIODO_INICIO, PERIODO_FIM]),
      pool.query(queryResumo, [familiaParam, PERIODO_INICIO, PERIODO_FIM])
    ]);

    // Calcular média mensal
    const resumo = resumoResult.rows;
    const totalMeses = resumo.length;
    const somaBojos = resumo.reduce((acc, r) => acc + Number(r.total_bojos_consumidos), 0);
    const mediaMensal = totalMeses > 0 ? Math.round(somaBojos / totalMeses) : 0;

    const resultado = {
      familia: familiaParam,
      periodo: '2025.2 (Jul-Dez 2025)',
      resumo_mensal: resumo,
      detalhado: detalhadoResult.rows,
      estatisticas: {
        media_mensal_bojos: mediaMensal,
        total_meses_analisados: totalMeses,
        total_bojos_periodo: somaBojos,
        compra_minima_sugerida: Math.ceil(mediaMensal * 1.1) // 10% margem
      }
    };

    // Salvar no cache
    cache.set(cacheKey, resultado);

    res.json({ data: resultado, fromCache: false });
  } catch (error) {
    console.error('Erro ao buscar análise de consumo:', error);
    res.status(500).json({ error: 'Erro ao buscar análise de consumo de bojos' });
  }
});

// GET /analise/comparativo
// Compara consumo de bojos entre duas famílias
router.get('/comparativo', async (req, res) => {
  try {
    const { familiaOrigem, familiaDestino } = req.query;
    const origem = familiaOrigem || 'SORRENTINA';
    const destino = familiaDestino || 'BLOOM';
    const cacheKey = `analise_comparativo_${origem}_${destino}`;

    // Verificar cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ data: cached, fromCache: true });
    }

    // Query para pegar bojos usados por cada família
    const queryBojos = `
      SELECT DISTINCT
        $1 AS familia,
        fc.cd_produtomp AS cd_bojo,
        mp.ds_produto AS ds_bojo
      FROM vr_pcp_fcconsumo fc
      INNER JOIN prd_produto pa ON pa.cd_produto = fc.cd_produtopa
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = fc.cd_produtopa AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      INNER JOIN prd_produto mp ON mp.cd_produto = fc.cd_produtomp
      WHERE UPPER(cf.ds_classificacao) = UPPER($1)
        AND UPPER(ca.ds_classificacao) = 'BOJO'
        AND fc.cd_produtomp > 1000000
      ORDER BY mp.ds_produto
    `;

    const [bojosOrigem, bojosDestino] = await Promise.all([
      pool.query(queryBojos, [origem]),
      pool.query(queryBojos, [destino])
    ]);

    const resultado = {
      familia_origem: origem,
      familia_destino: destino,
      bojos_origem: bojosOrigem.rows,
      bojos_destino: bojosDestino.rows,
      qtd_bojos_origem: bojosOrigem.rows.length,
      qtd_bojos_destino: bojosDestino.rows.length
    };

    // Salvar no cache
    cache.set(cacheKey, resultado);

    res.json({ data: resultado, fromCache: false });
  } catch (error) {
    console.error('Erro ao buscar comparativo:', error);
    res.status(500).json({ error: 'Erro ao buscar comparativo de famílias' });
  }
});

// GET /analise/artigos-comparativo
// Tabela lateralizada: consumo de TODOS os artigos por família (SORRENTINA vs BLOOM)
// Filtrado para período 2025.2 - Com detalhes de SKUs e MPs
router.get('/artigos-comparativo', async (req, res) => {
  try {
    const cacheKey = 'analise_artigos_comparativo_2025.2_v2';

    // Verificar cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ data: cached, fromCache: true });
    }

    // Query com detalhes de SKUs, MPs e consumo (baseado em vendas)
    const queryComVendas = `
      SELECT
        ca.ds_classificacao AS artigo,
        COUNT(DISTINCT CASE WHEN UPPER(cf.ds_classificacao) = 'SORRENTINA' THEN fc.cd_produtopa END) AS qtd_skus_sorrentina,
        COUNT(DISTINCT CASE WHEN UPPER(cf.ds_classificacao) = 'BLOOM' THEN fc.cd_produtopa END) AS qtd_skus_bloom,
        COUNT(DISTINCT CASE WHEN UPPER(cf.ds_classificacao) = 'SORRENTINA' THEN fc.cd_produtomp END) AS qtd_mps_sorrentina,
        COUNT(DISTINCT CASE WHEN UPPER(cf.ds_classificacao) = 'BLOOM' THEN fc.cd_produtomp END) AS qtd_mps_bloom,
        SUM(CASE WHEN UPPER(cf.ds_classificacao) = 'SORRENTINA' THEN v.qt_liquida ELSE 0 END) AS pecas_vendidas_sorrentina,
        SUM(CASE WHEN UPPER(cf.ds_classificacao) = 'BLOOM' THEN v.qt_liquida ELSE 0 END) AS pecas_vendidas_bloom,
        SUM(CASE WHEN UPPER(cf.ds_classificacao) = 'SORRENTINA' THEN v.qt_liquida * fc.qt_consumo ELSE 0 END) AS consumo_sorrentina,
        SUM(CASE WHEN UPPER(cf.ds_classificacao) = 'BLOOM' THEN v.qt_liquida * fc.qt_consumo ELSE 0 END) AS consumo_bloom
      FROM mv_vendas_qtd v
      INNER JOIN prd_produto p ON p.cd_produto = v.idproduto
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = v.idproduto AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      INNER JOIN vr_pcp_fcconsumo fc ON fc.cd_produtopa = v.idproduto
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      WHERE UPPER(cf.ds_classificacao) IN ('SORRENTINA', 'BLOOM')
        AND fc.cd_produtomp > 1000000
        AND ca.ds_classificacao IS NOT NULL
        AND v.data >= $1 AND v.data <= $2
      GROUP BY ca.ds_classificacao
      ORDER BY ca.ds_classificacao
    `;

    // Query para buscar SKUs/MPs da BLOOM diretamente da fconsumo (sem depender de vendas)
    const queryBloomFconsumo = `
      SELECT
        ca.ds_classificacao AS artigo,
        COUNT(DISTINCT fc.cd_produtopa) AS qtd_skus_bloom,
        COUNT(DISTINCT fc.cd_produtomp) AS qtd_mps_bloom
      FROM vr_pcp_fcconsumo fc
      INNER JOIN prd_produto pa ON pa.cd_produto = fc.cd_produtopa
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = fc.cd_produtopa AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      WHERE UPPER(cf.ds_classificacao) = 'BLOOM'
        AND fc.cd_produtomp > 1000000
        AND ca.ds_classificacao IS NOT NULL
      GROUP BY ca.ds_classificacao
    `;

    const [resultComVendas, resultBloomFconsumo] = await Promise.all([
      pool.query(queryComVendas, [PERIODO_INICIO, PERIODO_FIM]),
      pool.query(queryBloomFconsumo)
    ]);

    // Criar mapa de SKUs/MPs reais da BLOOM da fconsumo
    const bloomFconsumoMap = {};
    resultBloomFconsumo.rows.forEach(row => {
      bloomFconsumoMap[row.artigo] = {
        qtd_skus: Number(row.qtd_skus_bloom),
        qtd_mps: Number(row.qtd_mps_bloom)
      };
    });

    const dados = resultComVendas.rows.map(row => {
      const qtdSkusSorrentina = Number(row.qtd_skus_sorrentina);
      const qtdMpsSorrentina = Number(row.qtd_mps_sorrentina);
      const totalConsumoSorrentina = Number(row.consumo_sorrentina);
      const totalConsumoBloom = Number(row.consumo_bloom);
      const pecasVendidasSorrentina = Number(row.pecas_vendidas_sorrentina);
      const pecasVendidasBloom = Number(row.pecas_vendidas_bloom);

      // Consumo médio SORRENTINA
      const consumoMedioSorrentina = qtdMpsSorrentina > 0 ? totalConsumoSorrentina / qtdMpsSorrentina : 0;

      // Compra mínima = consumo médio SORRENTINA + 10%
      const compraMinimasugerida = Math.ceil(consumoMedioSorrentina * 1.1);

      // BLOOM: Se não tem vendas, usar SKUs/MPs reais da fconsumo
      const bloomTemVendas = pecasVendidasBloom > 0;
      const bloomFconsumo = bloomFconsumoMap[row.artigo] || { qtd_skus: 0, qtd_mps: 0 };

      // Usar dados reais da BLOOM se disponíveis, senão da fconsumo
      const qtdSkusBloomFinal = bloomTemVendas ? Number(row.qtd_skus_bloom) : bloomFconsumo.qtd_skus;
      const qtdMpsBloomFinal = bloomTemVendas ? Number(row.qtd_mps_bloom) : bloomFconsumo.qtd_mps;

      // Consumo médio BLOOM
      const consumoMedioBloomReal = qtdMpsBloomFinal > 0 && bloomTemVendas ? totalConsumoBloom / qtdMpsBloomFinal : 0;

      return {
        artigo: row.artigo,
        qtd_skus_sorrentina: qtdSkusSorrentina,
        qtd_skus_bloom: qtdSkusBloomFinal,
        qtd_mps_sorrentina: qtdMpsSorrentina,
        qtd_mps_bloom: qtdMpsBloomFinal,
        pecas_vendidas_sorrentina: pecasVendidasSorrentina,
        pecas_vendidas_bloom: pecasVendidasBloom,
        consumo_sorrentina: Math.round(consumoMedioSorrentina * 100) / 100,
        consumo_bloom: bloomTemVendas ? Math.round(consumoMedioBloomReal * 100) / 100 : compraMinimasugerida,
        compra_minima_sugerida: compraMinimasugerida,
        bloom_projetado: !bloomTemVendas
      };
    });

    const response = {
      periodo: '2025.2 (Jul-Dez 2025)',
      artigos: dados
    };

    // Salvar no cache
    cache.set(cacheKey, response);

    res.json({ data: response, fromCache: false });
  } catch (error) {
    console.error('Erro ao buscar comparativo de artigos:', error);
    res.status(500).json({ error: 'Erro ao buscar comparativo de artigos' });
  }
});

// GET /analise/artigo-detalhe/:artigo
// Drill-down: Lista SKUs e MPs de um artigo específico
router.get('/artigo-detalhe/:artigo', async (req, res) => {
  try {
    const { artigo } = req.params;
    const { familia } = req.query;
    const familiaParam = familia || 'SORRENTINA';
    const cacheKey = `analise_artigo_detalhe_${artigo}_${familiaParam}_2025.2`;

    // Verificar cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ data: cached, fromCache: true });
    }

    // Query para listar SKUs que usam este artigo (com vendas)
    const querySkusComVendas = `
      SELECT DISTINCT
        fc.cd_produtopa AS cd_sku,
        pa.ds_produto AS ds_sku,
        MAX(fc.qt_consumo) AS qt_consumo,
        SUM(v.qt_liquida) AS pecas_vendidas,
        SUM(v.qt_liquida * fc.qt_consumo) AS total_consumo
      FROM mv_vendas_qtd v
      INNER JOIN prd_produto pa ON pa.cd_produto = v.idproduto
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = v.idproduto AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      INNER JOIN vr_pcp_fcconsumo fc ON fc.cd_produtopa = v.idproduto
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      WHERE UPPER(cf.ds_classificacao) = UPPER($1)
        AND UPPER(ca.ds_classificacao) = UPPER($2)
        AND fc.cd_produtomp > 1000000
        AND v.data >= $3 AND v.data <= $4
      GROUP BY fc.cd_produtopa, pa.ds_produto
      ORDER BY total_consumo DESC
    `;

    // Query para listar SKUs diretamente da ficha de consumo (sem depender de vendas)
    const querySkusSemVendas = `
      SELECT DISTINCT
        fc.cd_produtopa AS cd_sku,
        pa.ds_produto AS ds_sku,
        MAX(fc.qt_consumo) AS qt_consumo,
        0 AS pecas_vendidas,
        0 AS total_consumo
      FROM vr_pcp_fcconsumo fc
      INNER JOIN prd_produto pa ON pa.cd_produto = fc.cd_produtopa
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = fc.cd_produtopa AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      WHERE UPPER(cf.ds_classificacao) = UPPER($1)
        AND UPPER(ca.ds_classificacao) = UPPER($2)
        AND fc.cd_produtomp > 1000000
      GROUP BY fc.cd_produtopa, pa.ds_produto
      ORDER BY pa.ds_produto
    `;

    // Query para listar MPs (matérias-primas) deste artigo (com vendas)
    const queryMpsComVendas = `
      SELECT DISTINCT
        fc.cd_produtomp AS cd_mp,
        mp.ds_produto AS ds_mp,
        SUM(v.qt_liquida * fc.qt_consumo) AS total_consumo
      FROM mv_vendas_qtd v
      INNER JOIN prd_produto pa ON pa.cd_produto = v.idproduto
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = v.idproduto AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      INNER JOIN vr_pcp_fcconsumo fc ON fc.cd_produtopa = v.idproduto
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      INNER JOIN prd_produto mp ON mp.cd_produto = fc.cd_produtomp
      WHERE UPPER(cf.ds_classificacao) = UPPER($1)
        AND UPPER(ca.ds_classificacao) = UPPER($2)
        AND fc.cd_produtomp > 1000000
        AND v.data >= $3 AND v.data <= $4
      GROUP BY fc.cd_produtomp, mp.ds_produto
      ORDER BY total_consumo DESC
    `;

    // Query para listar MPs diretamente da ficha de consumo (sem depender de vendas)
    const queryMpsSemVendas = `
      SELECT DISTINCT
        fc.cd_produtomp AS cd_mp,
        mp.ds_produto AS ds_mp,
        0 AS total_consumo
      FROM vr_pcp_fcconsumo fc
      INNER JOIN prd_produto pa ON pa.cd_produto = fc.cd_produtopa
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = fc.cd_produtopa AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      INNER JOIN prd_produto mp ON mp.cd_produto = fc.cd_produtomp
      WHERE UPPER(cf.ds_classificacao) = UPPER($1)
        AND UPPER(ca.ds_classificacao) = UPPER($2)
        AND fc.cd_produtomp > 1000000
      GROUP BY fc.cd_produtomp, mp.ds_produto
      ORDER BY mp.ds_produto
    `;

    // Primeiro tentar buscar com vendas
    let [skusResult, mpsResult] = await Promise.all([
      pool.query(querySkusComVendas, [familiaParam, artigo, PERIODO_INICIO, PERIODO_FIM]),
      pool.query(queryMpsComVendas, [familiaParam, artigo, PERIODO_INICIO, PERIODO_FIM])
    ]);

    // Se não tem vendas, buscar SKUs/MPs da ficha de consumo e projetar
    let projetado = false;
    let compraMinimaProjetada = 0;

    if (skusResult.rows.length === 0) {
      // Buscar SKUs/MPs da família atual (sem depender de vendas)
      const [skusSemVendas, mpsSemVendas] = await Promise.all([
        pool.query(querySkusSemVendas, [familiaParam, artigo]),
        pool.query(queryMpsSemVendas, [familiaParam, artigo])
      ]);

      // Buscar consumo médio da SORRENTINA para projetar
      const [skusSorrentina, mpsSorrentina] = await Promise.all([
        pool.query(querySkusComVendas, ['SORRENTINA', artigo, PERIODO_INICIO, PERIODO_FIM]),
        pool.query(queryMpsComVendas, ['SORRENTINA', artigo, PERIODO_INICIO, PERIODO_FIM])
      ]);

      // Calcular consumo médio da SORRENTINA
      const totalConsumoSorrentina = skusSorrentina.rows.reduce((acc, row) => acc + Number(row.total_consumo), 0);
      const qtdMpsSorrentina = mpsSorrentina.rows.length;
      const consumoMedioSorrentina = qtdMpsSorrentina > 0 ? totalConsumoSorrentina / qtdMpsSorrentina : 0;
      compraMinimaProjetada = Math.ceil(consumoMedioSorrentina * 1.1);

      // Usar SKUs/MPs reais da família atual (não da SORRENTINA)
      skusResult = skusSemVendas;
      mpsResult = mpsSemVendas;
      projetado = true;
    }

    // Calcular totais e médias
    const totalConsumoSkus = skusResult.rows.reduce((acc, row) => acc + Number(row.total_consumo), 0);
    const qtdSkus = skusResult.rows.length;
    const qtdMps = mpsResult.rows.length;
    // Consumo médio = total de consumo dividido pelo número de MPs
    const consumoMedio = qtdMps > 0 ? totalConsumoSkus / qtdMps : 0;

    // Se projetado, usar compra mínima como consumo médio
    const consumoMedioFinal = projetado ? compraMinimaProjetada : consumoMedio;
    const totalConsumoFinal = projetado ? compraMinimaProjetada * qtdMps : totalConsumoSkus;

    const response = {
      artigo,
      familia: familiaParam,
      periodo: '2025.2 (Jul-Dez 2025)',
      projetado, // Flag para indicar se os dados são projetados
      estatisticas: {
        total_consumo: Math.round(totalConsumoFinal * 100) / 100,
        qtd_skus: qtdSkus,
        qtd_mps: qtdMps,
        consumo_medio: Math.round(consumoMedioFinal * 100) / 100
      },
      skus: skusResult.rows.map(row => ({
        cd_sku: row.cd_sku,
        ds_sku: row.ds_sku,
        qt_consumo: Math.round(Number(row.qt_consumo) * 100) / 100,
        pecas_vendidas: projetado ? 0 : Number(row.pecas_vendidas), // Zerar vendas se projetado
        total_consumo: projetado ? compraMinimaProjetada : Math.round(Number(row.total_consumo) * 100) / 100
      })),
      mps: mpsResult.rows.map(row => ({
        cd_mp: row.cd_mp,
        ds_mp: row.ds_mp,
        total_consumo: projetado ? compraMinimaProjetada : Math.round(Number(row.total_consumo) * 100) / 100
      }))
    };

    // Salvar no cache
    cache.set(cacheKey, response);

    res.json({ data: response, fromCache: false });
  } catch (error) {
    console.error('Erro ao buscar detalhe do artigo:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhe do artigo' });
  }
});

// GET /analise/artigos-comparativo-v2
// Versão dinâmica: aceita parâmetros de configuração
router.get('/artigos-comparativo-v2', async (req, res) => {
  try {
    const { familiaAnterior, familiaNova, periodoInicio, periodoFim, margem } = req.query;

    const anterior = familiaAnterior || 'SORRENTINA';
    const nova = familiaNova || 'BLOOM';
    const inicio = periodoInicio || PERIODO_INICIO;
    const fim = periodoFim || PERIODO_FIM;
    const margemPercent = Number(margem) || 10;

    const cacheKey = `analise_artigos_comparativo_${anterior}_${nova}_${inicio}_${fim}_${margemPercent}`;

    // Verificar cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ data: cached, fromCache: true });
    }

    // Query com detalhes de SKUs, MPs e consumo (baseado em vendas)
    const queryComVendas = `
      SELECT
        ca.ds_classificacao AS artigo,
        COUNT(DISTINCT CASE WHEN UPPER(cf.ds_classificacao) = UPPER($1) THEN fc.cd_produtopa END) AS qtd_skus_anterior,
        COUNT(DISTINCT CASE WHEN UPPER(cf.ds_classificacao) = UPPER($2) THEN fc.cd_produtopa END) AS qtd_skus_nova,
        COUNT(DISTINCT CASE WHEN UPPER(cf.ds_classificacao) = UPPER($1) THEN fc.cd_produtomp END) AS qtd_mps_anterior,
        COUNT(DISTINCT CASE WHEN UPPER(cf.ds_classificacao) = UPPER($2) THEN fc.cd_produtomp END) AS qtd_mps_nova,
        SUM(CASE WHEN UPPER(cf.ds_classificacao) = UPPER($1) THEN v.qt_liquida ELSE 0 END) AS pecas_vendidas_anterior,
        SUM(CASE WHEN UPPER(cf.ds_classificacao) = UPPER($2) THEN v.qt_liquida ELSE 0 END) AS pecas_vendidas_nova,
        SUM(CASE WHEN UPPER(cf.ds_classificacao) = UPPER($1) THEN v.qt_liquida * fc.qt_consumo ELSE 0 END) AS consumo_anterior,
        SUM(CASE WHEN UPPER(cf.ds_classificacao) = UPPER($2) THEN v.qt_liquida * fc.qt_consumo ELSE 0 END) AS consumo_nova
      FROM mv_vendas_qtd v
      INNER JOIN prd_produto p ON p.cd_produto = v.idproduto
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = v.idproduto AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      INNER JOIN vr_pcp_fcconsumo fc ON fc.cd_produtopa = v.idproduto
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      WHERE UPPER(cf.ds_classificacao) IN (UPPER($1), UPPER($2))
        AND fc.cd_produtomp > 1000000
        AND ca.ds_classificacao IS NOT NULL
        AND v.data >= $3 AND v.data <= $4
      GROUP BY ca.ds_classificacao
      ORDER BY ca.ds_classificacao
    `;

    // Query para buscar SKUs/MPs da família nova diretamente da fconsumo (sem depender de vendas)
    const queryNovaFconsumo = `
      SELECT
        ca.ds_classificacao AS artigo,
        COUNT(DISTINCT fc.cd_produtopa) AS qtd_skus_nova,
        COUNT(DISTINCT fc.cd_produtomp) AS qtd_mps_nova
      FROM vr_pcp_fcconsumo fc
      INNER JOIN prd_produto pa ON pa.cd_produto = fc.cd_produtopa
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = fc.cd_produtopa AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      WHERE UPPER(cf.ds_classificacao) = UPPER($1)
        AND fc.cd_produtomp > 1000000
        AND ca.ds_classificacao IS NOT NULL
      GROUP BY ca.ds_classificacao
    `;

    const [resultComVendas, resultNovaFconsumo] = await Promise.all([
      pool.query(queryComVendas, [anterior, nova, inicio, fim]),
      pool.query(queryNovaFconsumo, [nova])
    ]);

    // Criar mapa de SKUs/MPs reais da família nova da fconsumo
    const novaFconsumoMap = {};
    resultNovaFconsumo.rows.forEach(row => {
      novaFconsumoMap[row.artigo] = {
        qtd_skus: Number(row.qtd_skus_nova),
        qtd_mps: Number(row.qtd_mps_nova)
      };
    });

    const margemMultiplicador = 1 + (margemPercent / 100);

    const dados = resultComVendas.rows.map(row => {
      const qtdSkusAnterior = Number(row.qtd_skus_anterior);
      const qtdMpsAnterior = Number(row.qtd_mps_anterior);
      const totalConsumoAnterior = Number(row.consumo_anterior);
      const totalConsumoNova = Number(row.consumo_nova);
      const pecasVendidasAnterior = Number(row.pecas_vendidas_anterior);
      const pecasVendidasNova = Number(row.pecas_vendidas_nova);

      // Consumo médio família anterior
      const consumoMedioAnterior = qtdMpsAnterior > 0 ? totalConsumoAnterior / qtdMpsAnterior : 0;

      // Compra mínima = consumo médio anterior + margem%
      const compraMinimasugerida = Math.ceil(consumoMedioAnterior * margemMultiplicador);

      // Família nova: Se não tem vendas, usar SKUs/MPs reais da fconsumo
      const novaTemVendas = pecasVendidasNova > 0;
      const novaFconsumo = novaFconsumoMap[row.artigo] || { qtd_skus: 0, qtd_mps: 0 };

      // Usar dados reais da família nova se disponíveis, senão da fconsumo
      const qtdSkusNovaFinal = novaTemVendas ? Number(row.qtd_skus_nova) : novaFconsumo.qtd_skus;
      const qtdMpsNovaFinal = novaTemVendas ? Number(row.qtd_mps_nova) : novaFconsumo.qtd_mps;

      // Consumo médio família nova
      const consumoMedioNovaReal = qtdMpsNovaFinal > 0 && novaTemVendas ? totalConsumoNova / qtdMpsNovaFinal : 0;

      return {
        artigo: row.artigo,
        qtd_skus_anterior: qtdSkusAnterior,
        qtd_skus_nova: qtdSkusNovaFinal,
        qtd_mps_anterior: qtdMpsAnterior,
        qtd_mps_nova: qtdMpsNovaFinal,
        pecas_vendidas_anterior: pecasVendidasAnterior,
        pecas_vendidas_nova: pecasVendidasNova,
        consumo_anterior: Math.round(consumoMedioAnterior * 100) / 100,
        consumo_nova: novaTemVendas ? Math.round(consumoMedioNovaReal * 100) / 100 : compraMinimasugerida,
        compra_minima_sugerida: compraMinimasugerida,
        nova_projetado: !novaTemVendas
      };
    });

    const response = {
      familiaAnterior: anterior,
      familiaNova: nova,
      periodo: `${inicio} a ${fim}`,
      margem: margemPercent,
      artigos: dados
    };

    // Salvar no cache
    cache.set(cacheKey, response);

    res.json({ data: response, fromCache: false });
  } catch (error) {
    console.error('Erro ao buscar comparativo de artigos v2:', error);
    res.status(500).json({ error: 'Erro ao buscar comparativo de artigos' });
  }
});

// GET /analise/artigo-detalhe-v2/:artigo
// Drill-down dinâmico: aceita parâmetros de configuração
router.get('/artigo-detalhe-v2/:artigo', async (req, res) => {
  try {
    const { artigo } = req.params;
    const { familia, familiaAnterior, periodoInicio, periodoFim, margem } = req.query;

    const familiaParam = familia || 'SORRENTINA';
    const anterior = familiaAnterior || 'SORRENTINA';
    const inicio = periodoInicio || PERIODO_INICIO;
    const fim = periodoFim || PERIODO_FIM;
    const margemPercent = Number(margem) || 10;

    const cacheKey = `analise_artigo_detalhe_v2_${artigo}_${familiaParam}_${anterior}_${inicio}_${fim}_${margemPercent}`;

    // Verificar cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ data: cached, fromCache: true });
    }

    // Query para listar SKUs que usam este artigo (com vendas)
    const querySkusComVendas = `
      SELECT DISTINCT
        fc.cd_produtopa AS cd_sku,
        pa.ds_produto AS ds_sku,
        MAX(fc.qt_consumo) AS qt_consumo,
        SUM(v.qt_liquida) AS pecas_vendidas,
        SUM(v.qt_liquida * fc.qt_consumo) AS total_consumo
      FROM mv_vendas_qtd v
      INNER JOIN prd_produto pa ON pa.cd_produto = v.idproduto
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = v.idproduto AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      INNER JOIN vr_pcp_fcconsumo fc ON fc.cd_produtopa = v.idproduto
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      WHERE UPPER(cf.ds_classificacao) = UPPER($1)
        AND UPPER(ca.ds_classificacao) = UPPER($2)
        AND fc.cd_produtomp > 1000000
        AND v.data >= $3 AND v.data <= $4
      GROUP BY fc.cd_produtopa, pa.ds_produto
      ORDER BY total_consumo DESC
    `;

    // Query para listar SKUs diretamente da ficha de consumo (sem depender de vendas)
    const querySkusSemVendas = `
      SELECT DISTINCT
        fc.cd_produtopa AS cd_sku,
        pa.ds_produto AS ds_sku,
        MAX(fc.qt_consumo) AS qt_consumo,
        0 AS pecas_vendidas,
        0 AS total_consumo
      FROM vr_pcp_fcconsumo fc
      INNER JOIN prd_produto pa ON pa.cd_produto = fc.cd_produtopa
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = fc.cd_produtopa AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      WHERE UPPER(cf.ds_classificacao) = UPPER($1)
        AND UPPER(ca.ds_classificacao) = UPPER($2)
        AND fc.cd_produtomp > 1000000
      GROUP BY fc.cd_produtopa, pa.ds_produto
      ORDER BY pa.ds_produto
    `;

    // Query para listar MPs (matérias-primas) deste artigo (com vendas)
    const queryMpsComVendas = `
      SELECT DISTINCT
        fc.cd_produtomp AS cd_mp,
        mp.ds_produto AS ds_mp,
        SUM(v.qt_liquida * fc.qt_consumo) AS total_consumo
      FROM mv_vendas_qtd v
      INNER JOIN prd_produto pa ON pa.cd_produto = v.idproduto
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = v.idproduto AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      INNER JOIN vr_pcp_fcconsumo fc ON fc.cd_produtopa = v.idproduto
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      INNER JOIN prd_produto mp ON mp.cd_produto = fc.cd_produtomp
      WHERE UPPER(cf.ds_classificacao) = UPPER($1)
        AND UPPER(ca.ds_classificacao) = UPPER($2)
        AND fc.cd_produtomp > 1000000
        AND v.data >= $3 AND v.data <= $4
      GROUP BY fc.cd_produtomp, mp.ds_produto
      ORDER BY total_consumo DESC
    `;

    // Query para listar MPs diretamente da ficha de consumo (sem depender de vendas)
    const queryMpsSemVendas = `
      SELECT DISTINCT
        fc.cd_produtomp AS cd_mp,
        mp.ds_produto AS ds_mp,
        0 AS total_consumo
      FROM vr_pcp_fcconsumo fc
      INNER JOIN prd_produto pa ON pa.cd_produto = fc.cd_produtopa
      LEFT JOIN prd_produtoclas pcf ON pcf.cd_produto = fc.cd_produtopa AND pcf.cd_tipoclas = 24
      LEFT JOIN prd_classificacao cf ON cf.cd_tipoclas = pcf.cd_tipoclas AND cf.cd_classificacao = pcf.cd_classificacao
      LEFT JOIN prd_produtoclas pca ON pca.cd_produto = fc.cd_produtomp AND pca.cd_tipoclas = 111
      LEFT JOIN prd_classificacao ca ON ca.cd_tipoclas = pca.cd_tipoclas AND ca.cd_classificacao = pca.cd_classificacao
      INNER JOIN prd_produto mp ON mp.cd_produto = fc.cd_produtomp
      WHERE UPPER(cf.ds_classificacao) = UPPER($1)
        AND UPPER(ca.ds_classificacao) = UPPER($2)
        AND fc.cd_produtomp > 1000000
      GROUP BY fc.cd_produtomp, mp.ds_produto
      ORDER BY mp.ds_produto
    `;

    // Primeiro tentar buscar com vendas
    let [skusResult, mpsResult] = await Promise.all([
      pool.query(querySkusComVendas, [familiaParam, artigo, inicio, fim]),
      pool.query(queryMpsComVendas, [familiaParam, artigo, inicio, fim])
    ]);

    // Se não tem vendas, buscar SKUs/MPs da ficha de consumo e projetar
    let projetado = false;
    let compraMinimaProjetada = 0;
    const margemMultiplicador = 1 + (margemPercent / 100);

    if (skusResult.rows.length === 0) {
      // Buscar SKUs/MPs da família atual (sem depender de vendas)
      const [skusSemVendas, mpsSemVendas] = await Promise.all([
        pool.query(querySkusSemVendas, [familiaParam, artigo]),
        pool.query(queryMpsSemVendas, [familiaParam, artigo])
      ]);

      // Buscar consumo médio da família anterior para projetar
      const [skusAnterior, mpsAnterior] = await Promise.all([
        pool.query(querySkusComVendas, [anterior, artigo, inicio, fim]),
        pool.query(queryMpsComVendas, [anterior, artigo, inicio, fim])
      ]);

      // Calcular consumo médio da família anterior
      const totalConsumoAnterior = skusAnterior.rows.reduce((acc, row) => acc + Number(row.total_consumo), 0);
      const qtdMpsAnterior = mpsAnterior.rows.length;
      const consumoMedioAnterior = qtdMpsAnterior > 0 ? totalConsumoAnterior / qtdMpsAnterior : 0;
      compraMinimaProjetada = Math.ceil(consumoMedioAnterior * margemMultiplicador);

      // Usar SKUs/MPs reais da família atual (não da anterior)
      skusResult = skusSemVendas;
      mpsResult = mpsSemVendas;
      projetado = true;
    }

    // Calcular totais e médias
    const totalConsumoSkus = skusResult.rows.reduce((acc, row) => acc + Number(row.total_consumo), 0);
    const qtdSkus = skusResult.rows.length;
    const qtdMps = mpsResult.rows.length;
    // Consumo médio = total de consumo dividido pelo número de MPs
    const consumoMedio = qtdMps > 0 ? totalConsumoSkus / qtdMps : 0;

    // Se projetado, usar compra mínima como consumo médio
    const consumoMedioFinal = projetado ? compraMinimaProjetada : consumoMedio;
    const totalConsumoFinal = projetado ? compraMinimaProjetada * qtdMps : totalConsumoSkus;

    const response = {
      artigo,
      familia: familiaParam,
      familiaAnterior: anterior,
      periodo: `${inicio} a ${fim}`,
      margem: margemPercent,
      projetado, // Flag para indicar se os dados são projetados
      estatisticas: {
        total_consumo: Math.round(totalConsumoFinal * 100) / 100,
        qtd_skus: qtdSkus,
        qtd_mps: qtdMps,
        consumo_medio: Math.round(consumoMedioFinal * 100) / 100
      },
      skus: skusResult.rows.map(row => ({
        cd_sku: row.cd_sku,
        ds_sku: row.ds_sku,
        qt_consumo: Math.round(Number(row.qt_consumo) * 100) / 100,
        pecas_vendidas: projetado ? 0 : Number(row.pecas_vendidas),
        total_consumo: projetado ? compraMinimaProjetada : Math.round(Number(row.total_consumo) * 100) / 100
      })),
      mps: mpsResult.rows.map(row => ({
        cd_mp: row.cd_mp,
        ds_mp: row.ds_mp,
        total_consumo: projetado ? compraMinimaProjetada : Math.round(Number(row.total_consumo) * 100) / 100
      }))
    };

    // Salvar no cache
    cache.set(cacheKey, response);

    res.json({ data: response, fromCache: false });
  } catch (error) {
    console.error('Erro ao buscar detalhe do artigo v2:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhe do artigo' });
  }
});

module.exports = router;
