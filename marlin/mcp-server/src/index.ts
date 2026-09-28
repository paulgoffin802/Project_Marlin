import 'dotenv/config';
import { createApp } from './server.js';
import { readConfig } from './config.js';

const config = readConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.info(`Marlin MCP service listening on port ${config.port}.`);
});
