import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { config } from './config/env.js';
try {
  await connectDatabase();
  const server = createApp().listen(config.PORT, () => console.log(`CareerPilot API listening on port ${config.PORT}`));
  const stop = () => { server.close(async () => { await mongoose.disconnect(); process.exit(0); }); setTimeout(() => process.exit(1), 10000).unref(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
} catch { console.error('Could not connect to MongoDB. Check MONGODB_URI, network access and database credentials.'); process.exit(1); }
