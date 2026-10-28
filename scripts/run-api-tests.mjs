import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

const directory = resolve('output/qa-api')
mkdirSync(directory, { recursive: true })
const resultPath = resolve(directory, 'results.json')
for (const filename of ['results.json', 'junit.xml', 'report.html', 'report.md']) {
  const previous = resolve(directory, filename)
  if (existsSync(previous)) unlinkSync(previous)
}
const filters = process.argv.slice(2).filter(argument => argument !== '--')
if (filters.length && (filters.length !== 2 || !['-t', '--testNamePattern'].includes(filters[0]))) {
  console.error('Uso: pnpm test:api [-- -t "API-004 o /api/me"]')
  process.exit(1)
}
const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.api.config.ts', ...filters], { stdio: 'inherit', windowsHide: true })
if (!existsSync(resultPath)) {
  console.error('No result file was produced. The previous report is not evidence for this run.')
  process.exit(run.status ?? 1)
}
const results = JSON.parse(readFileSync(resultPath, 'utf8'))
const cases = (results.testResults ?? []).flatMap(suite => (suite.assertionResults ?? []).map(test => ({
  name: test.title ?? test.fullName,
  status: test.status,
  duration: test.duration ?? 0,
  errors: (test.failureMessages ?? []).join('\n'),
})))
const passed = cases.filter(test => test.status === 'passed').length
const failed = cases.filter(test => test.status === 'failed').length
const pending = cases.length - passed - failed
if (filters.length) console.log(`Filtro aplicado: ${filters[1]}. Los casos excluidos no se consideran aprobados.`)
const date = new Date(results.startTime ?? Date.now()).toISOString()
const elapsed = ((Date.now() - (results.startTime ?? Date.now())) / 1000).toFixed(2)
const limitation = 'API real de LendIt y PostgreSQL temporal; proveedor de identidad simulado localmente. No prueba contraseñas, envío/recepción de correo, signup, SMTP, RLS de Supabase ni despliegue en Vercel. API-009 prueba creación del perfil local desde una identidad preexistente, no registro en Supabase Auth.'
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const markdown = `# Informe de endpoints — LendIt UJAP\n\nFecha UTC: ${date}\n\nHerramientas: Supertest + Vitest + PostgreSQL real y efímero.\n\n**Resultado:** ${passed} aprobados, ${failed} fallidos, ${pending} pendientes. Duración: ${elapsed} s. Código de salida: ${run.status ?? 1}.\n\n**Alcance y límites:** ${limitation}\n\nRepetir: \`pnpm test:api\`. Evidencias: \`results.json\` y \`junit.xml\` en esta carpeta.\n\n| Caso y resultado esperado | Estado | Duración |\n| --- | --- | --- |\n${cases.map(test => `| ${test.name.replaceAll('|', '—')} | ${test.status} | ${test.duration} ms |`).join('\n')}\n\n${cases.filter(test => test.errors).map(test => `## Fallo: ${test.name}\n\n\`\`\`\n${test.errors}\n\`\`\`\n`).join('\n')}`
writeFileSync(resolve(directory, 'report.md'), markdown)
writeFileSync(resolve(directory, 'report.html'), `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe de endpoints — LendIt UJAP</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#17213b;background:#f5f6fa;margin:0}main{max-width:1100px;margin:40px auto;padding:32px;background:white;border:1px solid #ddd;border-radius:12px}h1{line-height:1.2}aside{background:#fff4d7;border-left:4px solid #b88917;padding:16px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;border-bottom:1px solid #ddd;padding:12px}th{background:#eef0f5}.passed{color:#116a38}.failed{color:#b00020}pre{white-space:pre-wrap;overflow-wrap:anywhere}code{background:#eef0f5;padding:3px 6px}@media print{body{background:white}main{border:0;margin:0;padding:0}tr{break-inside:avoid}}</style><main><h1>Informe de pruebas de endpoints</h1><p>LendIt UJAP · Supertest + Vitest · ${escape(date)}</p><h2>${passed} aprobados · ${failed} fallidos · ${pending} pendientes</h2><p>Duración: ${elapsed} s · Código de salida: ${run.status ?? 1}</p><aside><strong>Qué demuestra este informe</strong><br>${escape(limitation)}</aside><p>Repetir: <code>pnpm test:api</code>. Cada ejecución crea una BD temporal y elimina sus fixtures al terminar. Puede guardarse como PDF desde Imprimir.</p><table><thead><tr><th>Caso y resultado esperado</th><th>Estado</th><th>Tiempo</th></tr></thead><tbody>${cases.map(test => `<tr><td>${escape(test.name)}</td><td class="${escape(test.status)}">${escape(test.status)}</td><td>${test.duration} ms</td></tr>`).join('')}</tbody></table>${cases.filter(test => test.errors).map(test => `<h2>${escape(test.name)}</h2><pre>${escape(test.errors)}</pre>`).join('')}<p>Evidencia procesable: results.json y junit.xml. Este informe refleja una ejecución concreta; no certifica cobertura completa del producto.</p></main></html>`)
console.log(`\nInforme HTML: ${resolve(directory, 'report.html')}\nInforme Markdown: ${resolve(directory, 'report.md')}`)
process.exitCode = run.status ?? 1
