import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env } from './env.js';

let memoryServer = null;

/**
 * Connects to MONGO_URI, or starts an in-memory MongoDB when none is configured.
 * Returns true when running in-memory (the caller then seeds demo data).
 */
export async function connectDB() {
  let uri = env.mongoUri;
  let inMemory = false;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    // Reuse the binary `npm install` already cached in server/node_modules, whatever the cwd.
    const downloadDir = fileURLToPath(new URL('../../node_modules/.cache/mongodb-memory-server', import.meta.url));
    memoryServer = await MongoMemoryServer.create({ binary: { downloadDir } });
    uri = memoryServer.getUri('prepstack-careeros');
    inMemory = true;
  }
  await mongoose.connect(uri);
  return inMemory;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
