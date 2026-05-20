const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/fconsumo', require('./routes/fconsumo.routes'));
app.use('/dproduto', require('./routes/dproduto.routes'));
app.use('/dmateriaprima', require('./routes/dmateriaprima.routes'));
app.use('/vendas', require('./routes/vendas.routes'));
app.use('/analise', require('./routes/analise.routes'));
app.use('/config', require('./routes/config.routes'));

const PORT = process.env.API_PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});