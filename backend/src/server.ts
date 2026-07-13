import { createApp } from './app.js';
import { config } from './config.js';

createApp().listen(config.port, () => {
  console.log(`🌳 Greenwood API listening on http://localhost:${config.port}`);
});
