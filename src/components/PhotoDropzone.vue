<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    alt?: string
    hint?: string
  }>(),
  {
    modelValue: '',
    alt: 'Foto de perfil',
    hint: 'JPG o PNG, hasta 5 MB. Se recorta automáticamente.',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const isProcessing = ref(false)
const errorMessage = ref('')
const dropzoneLabel = computed(() => `${props.modelValue ? 'Cambiar' : 'Subir'} ${props.alt.toLowerCase()}`)

function openPicker() {
  if (!isProcessing.value) {
    fileInput.value?.click()
  }
}

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')

        if (!context) {
          reject(new Error('No se pudo procesar la imagen.'))
          return
        }

        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      image.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      image.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsDataURL(file)
  })
}

async function processFile(file: File) {
  errorMessage.value = ''

  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Selecciona un archivo de imagen válido.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'La foto no puede pesar más de 5 MB.'
    return
  }

  isProcessing.value = true
  try {
    emit('update:modelValue', await resizeImage(file, 320))
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo procesar la imagen.'
  } finally {
    isProcessing.value = false
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    void processFile(file)
  }
  input.value = ''
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file) {
    void processFile(file)
  }
}
</script>

<template>
  <div
    class="photo-dropzone"
    :class="{ 'photo-dropzone--dragging': isDragging, 'photo-dropzone--filled': props.modelValue }"
    role="button"
    tabindex="0"
    :aria-label="dropzoneLabel"
    :aria-busy="isProcessing"
    @click="openPicker"
    @keydown.enter.prevent="openPicker"
    @keydown.space.prevent="openPicker"
    @dragenter.prevent="isDragging = true"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="handleDrop"
  >
    <input ref="fileInput" class="photo-dropzone__input" type="file" accept="image/*" @change="handleFileChange" />

    <div v-if="isProcessing" class="photo-dropzone__empty">
      <strong>Procesando foto…</strong>
      <span>Un momento, estamos optimizando la imagen.</span>
    </div>

    <div v-else-if="props.modelValue" class="photo-dropzone__filled">
      <img :src="props.modelValue" :alt="props.alt" />
      <div class="photo-dropzone__details">
        <strong>Foto lista</strong>
        <span>{{ props.hint }}</span>
        <button type="button" class="btn btn--ghost btn--small" @click.stop="openPicker">Cambiar foto</button>
      </div>
    </div>

    <div v-else class="photo-dropzone__empty">
      <span class="photo-dropzone__icon" aria-hidden="true">+</span>
      <strong>Arrastra tu foto aquí</strong>
      <span>o haz clic para buscarla · {{ props.hint }}</span>
    </div>
  </div>

  <p v-if="errorMessage" class="photo-dropzone__error">{{ errorMessage }}</p>
</template>

<style scoped>
.photo-dropzone {
  width: 100%;
  min-height: 132px;
  padding: 14px;
  border: 1.5px dashed var(--line-strong);
  border-radius: 14px;
  background: color-mix(in srgb, var(--paper) 68%, transparent);
  color: var(--ink-soft);
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.photo-dropzone:hover,
.photo-dropzone:focus-visible,
.photo-dropzone--dragging {
  outline: none;
  border-color: var(--crimson);
  background: var(--crimson-bg);
}

.photo-dropzone--dragging {
  transform: translateY(-2px);
}

.photo-dropzone--filled {
  border-style: solid;
}

.photo-dropzone__input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.photo-dropzone__empty,
.photo-dropzone__filled {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 100px;
  text-align: center;
}

.photo-dropzone__empty {
  flex-direction: column;
}

.photo-dropzone__empty strong,
.photo-dropzone__details strong {
  color: var(--ink);
  font-size: 14px;
}

.photo-dropzone__empty span:not(.photo-dropzone__icon),
.photo-dropzone__details span {
  max-width: 34ch;
  color: var(--ink-faint);
  font-size: 11.5px;
  line-height: 1.4;
}

.photo-dropzone__icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--gold-light);
  border-radius: 50%;
  color: var(--gold);
  font-size: 22px;
  line-height: 1;
}

.photo-dropzone__filled {
  justify-content: flex-start;
  text-align: left;
}

.photo-dropzone__filled img {
  flex: 0 0 auto;
  width: 82px;
  height: 82px;
  border: 2px solid var(--gold-light);
  border-radius: 50%;
  object-fit: cover;
}

.photo-dropzone__details {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.photo-dropzone__details .btn {
  margin-top: 3px;
  padding: 6px 11px;
  font-size: 12px;
}

.photo-dropzone__error {
  margin: 7px 2px 0;
  color: var(--crimson-dark);
  font-size: 12px;
}

@media (max-width: 420px) {
  .photo-dropzone__filled {
    align-items: flex-start;
  }

  .photo-dropzone__filled img {
    width: 64px;
    height: 64px;
  }
}
</style>
