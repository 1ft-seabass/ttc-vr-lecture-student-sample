const path = require('path');
const express = require('express');

const app = express();
const PORT = 5000;

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`01-firststep server listening on http://localhost:${PORT}`);
});
