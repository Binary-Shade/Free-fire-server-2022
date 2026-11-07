import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  plugins:[react()],
  base:'/admin/',
  resolve:{alias:{'@':path.resolve(__dirname,'src')}},
  build:{
    outDir:'../public/admin-app',
    emptyOutDir:true,
    rollupOptions:{output:{manualChunks:{
      'react-vendor':['react','react-dom','react-router-dom'],
      'charts':['recharts'],
      'data-grid':['@tanstack/react-table'],
      'icons':['lucide-react']
    }}}
  },
  server:{proxy:{'/admin/api':'http://127.0.0.1:3002'}}
});
