const express = require('express');
const path = require('path');

const app = express();

app.use(express.static('public'))
app.use(express.static('dist'))

app.use((_, res) => {
  res.sendFile(path.resolve('./public/index.html'))
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Running ar http://localhost:${PORT}`)
});