<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string | null
  alt: string
  label?: string
  disabled?: boolean
}>(), { label: 'Imagen', disabled: false })

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
  (e: 'update:alt', value: string): void
}>()

const MAX_BYTES = 5 * 1024 * 1024
const uid = Math.random().toString(36).slice(2, 9)
const fileInput = ref<HTMLInputElement | null>(null)
const urlInput = ref('')
const errorMessage = ref('')
const previewBroken = ref(false)
const isProcessing = ref(false)

const isPending = computed(() => props.modelValue?.startsWith('data:') ?? false)

watch(() => props.modelValue, () => { previewBroken.value = false })

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}

async function resize(file: File, maxSize = 1200): Promise<string> {
  const source = await readAsDataUrl(file)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No se pudo procesar la imagen.'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => reject(new Error('El archivo no es una imagen válida.'))
    img.src = source
  })
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  errorMessage.value = ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    errorMessage.value = 'Usa una imagen JPG, PNG o WebP.'
    return
  }
  if (file.size > MAX_BYTES) {
    errorMessage.value = 'La imagen no puede pesar más de 5 MB.'
    return
  }
  isProcessing.value = true
  try {
    emit('update:modelValue', await resize(file))
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo procesar la imagen.'
  } finally {
    isProcessing.value = false
  }
}

function applyUrl() {
  errorMessage.value = ''
  const value = urlInput.value.trim()
  if (!value) return
  let parsed: URL
  try { parsed = new URL(value) } catch { errorMessage.value = 'Escribe un enlace válido.'; return }
  if (parsed.protocol !== 'https:') { errorMessage.value = 'El enlace debe empezar con https://.'; return }
  if (value.length > 255) { errorMessage.value = 'El enlace es demasiado largo (máximo 255 caracteres).'; return }
  emit('update:modelValue', parsed.href)
  urlInput.value = ''
}

function remove() {
  errorMessage.value = ''
  emit('update:modelValue', null)
  emit('update:alt', '')
}
</script>

<template>
  <fieldset class="image-picker" :disabled="disabled">
    <legend class="image-picker__legend">{{ label }}</legend>

    <div v-if="modelValue" class="image-picker__preview">
      <img
        v-if="!previewBroken"
        :src="modelValue"
        :alt="alt || 'Vista previa de la imagen'"
        @error="previewBroken = true"
      />
      <p v-else class="image-picker__broken" role="alert">No se pudo cargar la imagen de este enlace. Prueba con otro.</p>
      <p v-if="isPending" class="image-picker__note">Se subirá al guardar.</p>
    </div>
    <p v-else class="image-picker__empty">Sin imagen. Es opcional.</p>

    <div class="image-picker__actions">
      <input :id="`pick-file-${uid}`" ref="fileInput" class="image-picker__file" type="file" accept="image/jpeg,image/png,image/webp" @change="onFile" />
      <button type="button" class="btn btn--small" :disabled="isProcessing" @click="fileInput?.click()">
        {{ isProcessing ? 'Procesando…' : modelValue ? 'Reemplazar imagen' : 'Subir imagen' }}
      </button>
      <button v-if="modelValue" type="button" class="btn btn--small" @click="remove">Quitar imagen</button>
    </div>
    <p class="image-picker__hint">JPG, PNG o WebP, hasta 5 MB.</p>

    <div class="image-picker__url">
      <label :for="`pick-url-${uid}`">Pegar enlace</label>
      <div class="image-picker__url-row">
        <input :id="`pick-url-${uid}`" v-model="urlInput" type="url" inputmode="url" placeholder="https://…" @keydown.enter.prevent="applyUrl" />
        <button type="button" class="btn btn--small" @click="applyUrl">Usar enlace</button>
      </div>
    </div>

    <div v-if="modelValue" class="image-picker__url">
      <label :for="`pick-alt-${uid}`">Texto alternativo</label>
      <input :id="`pick-alt-${uid}`" :value="alt" type="text" maxlength="255" placeholder="Describe la imagen" @input="emit('update:alt', ($event.target as HTMLInputElement).value)" />
    </div>

    <p v-if="errorMessage" class="image-picker__error" role="alert">{{ errorMessage }}</p>
  </fieldset>
</template>

<style scoped>
.image-picker { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; border: 0; min-width: 0; }
.image-picker__legend { padding: 0; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: var(--ink-soft); }
.image-picker__preview img { display: block; width: 100%; max-width: 280px; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 10px; border: 1px solid var(--line); }
.image-picker__empty, .image-picker__hint, .image-picker__note { margin: 0; font-size: 12.5px; color: var(--ink-faint); }
.image-picker__broken, .image-picker__error { margin: 0; font-size: 13px; color: var(--crimson-dark); }
.image-picker__file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.image-picker__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.image-picker__url { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ink-soft); }
.image-picker__url-row { display: flex; gap: 8px; flex-wrap: wrap; }
.image-picker__url-row input { flex: 1 1 200px; }
.image-picker input[type='url'], .image-picker input[type='text'] {
  font: inherit; padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--line-strong); background: var(--paper); color: var(--ink); min-width: 0;
}
.image-picker input:focus-visible, .image-picker button:focus-visible { outline: 2px solid var(--crimson); outline-offset: 2px; }
</style>
