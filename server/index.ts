import { createApp } from './app.js';
import { createRealtimeCredential } from './openaiService.js';

// Bind to loopback: this checkpoint is a local demonstration backend.
const server = createApp({ createRealtimeCredential }).listen(3001, '127.0.0.1', () => {
  console.log('Workflow 01 API listening at http://127.0.0.1:3001');
});

server.on('error', () => {
  console.error('Could not start the API server. Check whether port 3001 is already in use.');
  process.exitCode = 1;
});

function shutdown() {
  server.close();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
