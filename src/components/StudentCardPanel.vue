<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { loadStudentCard, removeStudentCard, saveStudentCard } from '../lib/studentCard'
import ModalDialog from './ModalDialog.vue'

const stored = ref<Awaited<ReturnType<typeof loadStudentCard>>>(null)
const selected = ref<File | null>(null)
const preview = ref('')
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const message = ref('')
const confirmRemove = ref(false)
const confirmDiscard = ref(false)
let resolveNavigation: ((allow: boolean) => void) | null = null
function guardNavigation() {
  if (busy.value) return false
  if (!selected.value) return true
  confirmDiscard.value = true
  return new Promise<boolean>(resolve => { resolveNavigation = resolve })
}
function discardNavigation(allow: boolean) {
  if (allow) clearSelection()
  confirmDiscard.value = false
  resolveNavigation?.(allow)
  resolveNavigation = null
}
onBeforeRouteLeave(guardNavigation)
onBeforeRouteUpdate(guardNavigation)
const input = ref<HTMLInputElement | null>(null)
const updatedAt = computed(() => stored.value?.updatedAt ? new Date(stored.value.updatedAt).toLocaleDateString('es-VE') : '')

function clearSelection() {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
  selected.value = null
  if (input.value) input.value.value = ''
}
async function load() {
  loading.value = true
  error.value = ''
  try { stored.value = await loadStudentCard() }
  catch (err) { error.value = err instanceof Error ? err.message : 'No se pudo cargar el carnet.' }
  finally { loading.value = false }
}
function choose(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  clearSelection()
  error.value = ''; message.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size) {
    error.value = 'Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.'
    return
  }
  selected.value = file
  preview.value = URL.createObjectURL(file)
}
async function save() {
  if (!selected.value || busy.value) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    await saveStudentCard(selected.value)
    clearSelection()
    message.value = 'Carnet guardado. La carga no equivale a una verificación de identidad.'
    await load()
  } catch (err) { error.value = err instanceof Error ? err.message : 'No se pudo guardar el carnet.' }
  finally { busy.value = false }
}
async function remove() {
  if (busy.value) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    await removeStudentCard()
    stored.value = null
    clearSelection()
    confirmRemove.value = false
    message.value = 'Carnet eliminado.'
  } catch (err) { error.value = err instanceof Error ? err.message : 'No se pudo eliminar el carnet.'; confirmRemove.value = false }
  finally { busy.value = false }
}
onMounted(load)
onBeforeUnmount(clearSelection)
</script>

<template>
  <section class="card-panel" aria-labelledby="student-card-heading" :aria-busy="loading || busy">
    <header><span class="card-panel__tag">Documento privado</span><h2 id="student-card-heading">Carnet universitario</h2><p>Sube una foto legible de tu carnet UJAP. No aparecerá en el catálogo, tu foto de perfil ni los mensajes.</p></header>
    <p v-if="loading" role="status">Cargando tu carnet…</p>
    <template v-else>
      <div class="card-panel__document">
        <img v-if="preview || stored?.url" :src="preview || stored?.url" alt="Vista privada de tu carnet universitario" @error="error = 'La vista previa no está disponible. Vuelve a cargar el carnet.'" />
        <div v-else class="card-panel__empty"><strong>Tu identificación del campus</strong><p>Aún no has cargado un carnet.</p></div>
        <div class="card-panel__state"><strong>{{ selected ? 'Imagen pendiente de guardar' : stored ? 'Carnet cargado' : 'Sin documento' }}</strong><span v-if="stored && !selected">Actualizado el {{ updatedAt }}</span><span>Sin verificación automática</span></div>
      </div>
      <label class="card-panel__file">{{ stored ? 'Seleccionar otra imagen' : 'Seleccionar imagen del carnet' }}<input ref="input" type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy" aria-describedby="card-file-hint" @change="choose" /></label>
      <p id="card-file-hint" class="card-panel__hint">JPG, PNG o WebP · Hasta 5 MB. Comprueba que el nombre, la foto y los datos del carnet se lean completos.</p>
      <div class="card-panel__actions">
        <button v-if="selected" type="button" class="btn btn--primary" :disabled="busy" @click="save">{{ busy ? 'Guardando…' : 'Guardar carnet' }}</button>
        <button v-if="selected" type="button" class="btn" :disabled="busy" @click="clearSelection">Descartar selección</button>
        <button v-if="stored && !selected" type="button" class="btn" :disabled="busy" @click="load">Actualizar vista</button>
        <button v-if="stored && !selected" type="button" class="btn card-panel__remove" :disabled="busy" @click="confirmRemove = true">Eliminar carnet</button>
      </div>
    </template>
    <p v-if="error" role="alert" class="card-panel__error">{{ error }} <button type="button" :disabled="loading || busy" @click="load">Reintentar carga</button></p>
    <p v-if="message" role="status">{{ message }}</p>
    <ModalDialog v-if="confirmRemove" title="Eliminar tu carnet" @close="!busy && (confirmRemove = false)">
      <p>Se eliminará la imagen de tu carnet universitario. Puedes volver a cargarla cuando lo necesites.</p>
      <div class="card-panel__actions"><button class="btn" :disabled="busy" @click="confirmRemove = false">Cancelar</button><button class="btn btn--primary" :disabled="busy" @click="remove">{{ busy ? 'Eliminando…' : 'Eliminar carnet' }}</button></div>
    </ModalDialog>
    <ModalDialog v-if="confirmDiscard" title="La imagen no se ha guardado" @close="discardNavigation(false)"><p>Si sales ahora, tendrás que seleccionar la imagen de tu carnet de nuevo.</p><div class="card-panel__actions"><button class="btn" @click="discardNavigation(false)">Seguir aquí</button><button class="btn btn--primary" @click="discardNavigation(true)">Descartar y salir</button></div></ModalDialog>
  </section>
</template>

<style scoped>
.card-panel{display:grid;gap:22px}.card-panel header{display:grid;gap:10px}.card-panel h2{font:500 26px/1.2 var(--display);margin:0}.card-panel p{margin:0;line-height:1.65;color:var(--ink-soft)}.card-panel__tag{font:500 12px var(--sans);color:var(--crimson-dark)}.card-panel__document{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:24px;align-items:center;padding:24px;background:var(--surface-soft);border-radius:16px}.card-panel__document img{width:100%;max-height:300px;object-fit:contain;border-radius:8px}.card-panel__empty{min-height:160px;display:flex;flex-direction:column;justify-content:center;gap:12px;border:1px solid var(--line-strong);border-radius:10px;padding:20px;background:var(--paper)}.card-panel__state{display:grid;gap:10px;font-size:14px}.card-panel__state span{font-size:13px;color:var(--ink-soft)}.card-panel__file{display:grid;gap:10px;font-weight:600;font-size:14px}.card-panel input{max-width:100%;font:400 14px var(--sans);color:var(--ink);padding:12px;border:1px solid var(--line-strong);border-radius:10px;background:var(--paper)}.card-panel input::file-selector-button{padding:10px 14px;border:0;border-radius:8px;margin-right:12px;background:var(--surface-soft);color:var(--ink);cursor:pointer}.card-panel__hint{font-size:13px}.card-panel__actions{display:flex;flex-wrap:wrap;gap:12px}.card-panel__remove,.card-panel__error{color:var(--crimson-dark)!important}.card-panel__error button{font:inherit;min-height:44px;background:none;border:0;text-decoration:underline;color:inherit;cursor:pointer}.card-panel :is(button,input):focus-visible{outline:2px solid var(--crimson);outline-offset:3px}@media(max-width:640px){.card-panel__document{grid-template-columns:1fr;padding:16px}.card-panel__state{gap:6px}.card-panel__actions .btn{flex:1}}
</style>
