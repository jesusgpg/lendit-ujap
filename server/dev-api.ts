// The same API router is used locally and by the single Vercel function.
import 'dotenv/config'
import app from './app.js'

const port = Number(process.env.DEV_API_PORT ?? 8787)
app.listen(port, () => {
  console.log('[dev-api] escuchando en http://localhost:' + port)
})
