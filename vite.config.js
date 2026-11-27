import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins:[react()],
  build:{
    // Target modern browsers used by current Lighthouse/Chrome; avoid legacy polyfills.
    target:'es2022',
    cssTarget:'chrome111',
    rollupOptions:{
      output:{
        manualChunks(id){
          if(!id.includes('/node_modules/')) return;
          if(id.includes('/@supabase/')) return 'supabase';
          if(id.includes('/lucide-react/')) return 'icons';
          if(id.includes('/react-router') || id.includes('/@remix-run/')) return 'router';
          if(id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-vendor';
        }
      }
    }
  }
});
