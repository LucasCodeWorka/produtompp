const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Arquivo para persistir configurações
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

// Configuração padrão
const defaultConfig = {
  periodoInicio: '2025-07-01',
  periodoFim: '2025-12-31',
  margemPercentual: 10,
  familias: [
    { anterior: 'SORRENTINA', nova: 'BLOOM' }
  ]
};

// Carregar configurações do arquivo
const loadConfig = () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
  }
  return defaultConfig;
};

// Salvar configurações no arquivo
const saveConfigToFile = (config) => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    return false;
  }
};

// GET /config - Retorna configurações atuais
router.get('/', (req, res) => {
  const config = loadConfig();
  res.json({ config });
});

// POST /config - Salva novas configurações
router.post('/', (req, res) => {
  const newConfig = req.body;

  // Validar configurações
  if (!newConfig.periodoInicio || !newConfig.periodoFim) {
    return res.status(400).json({ error: 'Período é obrigatório' });
  }

  if (typeof newConfig.margemPercentual !== 'number' || newConfig.margemPercentual < 0) {
    return res.status(400).json({ error: 'Margem percentual inválida' });
  }

  if (!Array.isArray(newConfig.familias)) {
    return res.status(400).json({ error: 'Lista de famílias é obrigatória' });
  }

  // Validar cada família
  for (const familia of newConfig.familias) {
    if (!familia.anterior || !familia.nova) {
      return res.status(400).json({ error: 'Cada família deve ter anterior e nova' });
    }
  }

  // Salvar
  if (saveConfigToFile(newConfig)) {
    res.json({ success: true, config: newConfig });
  } else {
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
});

// GET /config/familias - Retorna apenas as famílias configuradas
router.get('/familias', (req, res) => {
  const config = loadConfig();
  res.json({ familias: config.familias });
});

// GET /config/periodo - Retorna o período configurado
router.get('/periodo', (req, res) => {
  const config = loadConfig();
  res.json({
    periodoInicio: config.periodoInicio,
    periodoFim: config.periodoFim
  });
});

// GET /config/margem - Retorna a margem configurada
router.get('/margem', (req, res) => {
  const config = loadConfig();
  res.json({ margemPercentual: config.margemPercentual });
});

module.exports = router;
