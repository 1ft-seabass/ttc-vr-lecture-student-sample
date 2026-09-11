const path = require('path');
const express = require('express');

const app = express();
const port = 5000;
const host = '0.0.0.0';

app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, host, () => {
  console.log(`03-room-model server listening on http://${host}:${port}`);
});
