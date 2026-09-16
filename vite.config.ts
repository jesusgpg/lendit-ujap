import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // GitHub Pages serves this project from /lendit-ujap/; Vercel serves it from the domain root.
    base: env.GH_PAGES ? '/lendit-ujap/' : '/',
    // Solo se exponen valores diseñados para ser públicos. Nunca se incluye una contraseña aquí.
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_PUBLISHABLE_KEY ?? '',
      ),
      'import.meta.env.VITE_ALLOW_TEST_EMAILS': JSON.stringify(
        env.VITE_ALLOW_TEST_EMAILS ?? env.ALLOW_TEST_EMAILS ?? 'false',
      ),
    },
    server: {
      proxy: {
        '/api': `http://localhost:${env.DEV_API_PORT ?? '8787'}`,
      },
    },
    plugins: [
      vue({
        template: {
          compilerOptions: {
            // Web component de emoji-picker-element, no es un componente de Vue.
            isCustomElement: (tag) => tag === 'emoji-picker',
          },
        },
      }),
    ],
  }
})
