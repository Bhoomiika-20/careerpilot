// Disposable real MongoDB + Express + Vite browser check. No production credentials.
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const mongo = await MongoMemoryServer.create({binary:{version:'7.0.14'},instance:{args:process.platform === 'win32' ? [] : ['--nounixsocket']}});
Object.assign(process.env,{NODE_ENV:'test',MONGODB_URI:mongo.getUri('ui_test'),JWT_SECRET:'disposable-ui-test-only-secret-0123456789',OPENAI_API_KEY:'',OPENAI_MODEL:'',CLIENT_URL:'http://127.0.0.1:5173',QA_URL:'http://127.0.0.1:5173',QA_PASSWORD:'Disposable-ui-password-123'});
let apiServer,vite;
try {
  const {connectDatabase}=await import('../../backend/src/config/database.js');await connectDatabase();
  const {seedData}=await import('../../backend/scripts/seed.js');await seedData({password:process.env.QA_PASSWORD});
  const {createApp}=await import('../../backend/src/app.js');apiServer=await new Promise(resolve=>{const s=createApp().listen(5000,'127.0.0.1',()=>resolve(s));});
  vite=await createServer({root:fileURLToPath(new URL('../../frontend/',import.meta.url)),server:{host:'127.0.0.1',port:5173,strictPort:true}});await vite.listen();
  await import('./smoke.mjs');
} finally {await vite?.close();if(apiServer)await new Promise(r=>apiServer.close(r));await mongoose.disconnect();await mongo.stop();}
