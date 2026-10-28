<script setup lang="ts" generic="T extends string | string[] = string">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: T
    multiple?: boolean
    maxFiles?: number
    alt?: string
    hint?: string
    maxDimension?: number
    ariaLabel?: string
  }>(),
  {
    multiple: false,
    maxFiles: 8,
    alt: 'Foto del objeto',
    hint: 'JPG o PNG, hasta 5 MB. Se optimiza automáticamente.',
    maxDimension: undefined,
    ariaLabel: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const isProcessing = ref(false)
const errorMessage = ref('')
const draggedIndex = ref<number | null>(null)

const effectiveMaxDimension = computed(() => {
  if (props.maxDimension !== undefined) return props.maxDimension
  return props.multiple ? 1200 : 320
})

const imageList = computed<string[]>(() => {
  if (Array.isArray(props.modelValue)) {
    return props.modelValue.filter((url): url is string => typeof url === 'string' && url.length > 0)
  }
  if (typeof props.modelValue === 'string' && props.modelValue.trim().length > 0) {
    return [props.modelValue]
  }
  return []
})

const singleValue = computed<string>(() => {
  if (Array.isArray(props.modelValue)) {
    return props.modelValue[0] ?? ''
  }
  return typeof props.modelValue === 'string' ? props.modelValue : ''
})

const dropzoneLabel = computed(() => {
  if (props.ariaLabel) {
    return props.ariaLabel
  }
  if (props.multiple) {
    return `Subir fotos para ${props.alt.toLowerCase()} (hasta ${props.maxFiles})`
  }
  return `${singleValue.value ? 'Cambiar' : 'Subir'} ${props.alt.toLowerCase()}`
})

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

async function processFiles(files: FileList | File[]) {
  errorMessage.value = ''
  const fileArray = Array.from(files)
  if (!fileArray.length) return

  if (!props.multiple) {
    const file = fileArray[0]
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
      const resized = await resizeImage(file, effectiveMaxDimension.value)
      emit('update:modelValue', resized as unknown as T)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'No se pudo procesar la imagen.'
    } finally {
      isProcessing.value = false
    }
    return
  }

  // Multi-image mode
  const currentImages = [...imageList.value]
  const availableSlots = props.maxFiles - currentImages.length

  if (availableSlots <= 0) {
    errorMessage.value = `Ya alcanzaste el límite máximo de ${props.maxFiles} fotos.`
    return
  }

  const validFiles: File[] = []
  for (const file of fileArray) {
    if (!file.type.startsWith('image/')) {
      errorMessage.value = 'Algunos archivos no eran imágenes válidas y se omitieron.'
      continue
    }
    if (file.size > 5 * 1024 * 1024) {
      errorMessage.value = 'Algunas fotos superan los 5 MB y se omitieron.'
      continue
    }
    validFiles.push(file)
  }

  if (!validFiles.length) return

  const toProcess = validFiles.slice(0, availableSlots)
  if (validFiles.length > availableSlots) {
    errorMessage.value = `Se agregaron ${availableSlots} fotos (máximo ${props.maxFiles}).`
  }

  isProcessing.value = true
  try {
    const resizedImages = await Promise.all(
      toProcess.map((file) => resizeImage(file, effectiveMaxDimension.value)),
    )
    emit('update:modelValue', [...currentImages, ...resizedImages] as unknown as T)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudieron procesar las imágenes.'
  } finally {
    isProcessing.value = false
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    void processFiles(input.files)
  }
  input.value = ''
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    void processFiles(event.dataTransfer.files)
  }
}

function removeImage(index: number) {
  if (!props.multiple) {
    emit('update:modelValue', '' as unknown as T)
    return
  }
  const updated = imageList.value.filter((_, i) => i !== index)
  emit('update:modelValue', updated as unknown as T)
}

function setAsCover(index: number) {
  if (index === 0 || !props.multiple) return
  const current = [...imageList.value]
  const [selected] = current.splice(index, 1)
  if (selected) {
    current.unshift(selected)
    emit('update:modelValue', current as unknown as T)
  }
}

function moveImage(fromIndex: number, toIndex: number) {
  if (!props.multiple) return
  if (toIndex < 0 || toIndex >= imageList.value.length) return
  const current = [...imageList.value]
  const [moved] = current.splice(fromIndex, 1)
  if (moved) {
    current.splice(toIndex, 0, moved)
    emit('update:modelValue', current as unknown as T)
  }
}

function onDragStart(index: number, event: DragEvent) {
  draggedIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onDropThumbnail(targetIndex: number) {
  if (draggedIndex.value !== null && draggedIndex.value !== targetIndex) {
    moveImage(draggedIndex.value, targetIndex)
  }
  draggedIndex.value = null
}
</script>

<template>
  <!-- Single Image Mode (Preserved 1:1 for Profile/Register) -->
  <template v-if="!props.multiple">
    <div
      class="photo-dropzone"
      :class="{ 'photo-dropzone--dragging': isDragging, 'photo-dropzone--filled': singleValue }"
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
      <input ref="fileInput" class="photo-dropzone__input" type="file" tabindex="-1" aria-hidden="true" accept="image/*" @change="handleFileChange" />

      <div v-if="isProcessing" class="photo-dropzone__empty">
        <strong>Procesando foto…</strong>
        <span>Un momento, estamos optimizando la imagen.</span>
      </div>

      <div v-else-if="singleValue" class="photo-dropzone__filled">
        <img :src="singleValue" :alt="props.alt" />
        <div class="photo-dropzone__details">
          <strong>Foto lista</strong>
          <span>{{ props.hint }}</span>
          <button
            type="button"
            class="btn btn--ghost btn--small"
            :aria-label="singleValue ? 'Cambiar ' + props.alt.toLowerCase() : 'Subir ' + props.alt.toLowerCase()"
            @click.stop="openPicker"
          >
            Cambiar foto
          </button>
        </div>
      </div>

      <div v-else class="photo-dropzone__empty">
        <span class="photo-dropzone__icon" aria-hidden="true">+</span>
        <strong>Arrastra tu foto aquí</strong>
        <span>o haz clic para buscarla · {{ props.hint }}</span>
      </div>
    </div>
  </template>

  <!-- Multiple Image Mode (For Article Publication / Editing) -->
  <template v-else>
    <div class="multi-photos">
      <input
        id="article-photos-input"
        ref="fileInput"
        class="photo-dropzone__input"
        type="file"
        tabindex="-1"
        accept="image/*"
        multiple
        @change="handleFileChange"
      />

      <!-- When no images are selected yet -->
      <div
        v-if="imageList.length === 0"
        class="photo-dropzone"
        :class="{ 'photo-dropzone--dragging': isDragging }"
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
        <div v-if="isProcessing" class="photo-dropzone__empty">
          <strong>Procesando fotos…</strong>
          <span>Optimizando tus imágenes.</span>
        </div>
        <div v-else class="photo-dropzone__empty">
          <span class="photo-dropzone__icon" aria-hidden="true">+</span>
          <strong>Arrastra hasta {{ props.maxFiles }} fotos aquí</strong>
          <span>o haz clic para buscarlas · {{ props.hint }}</span>
        </div>
      </div>

      <!-- Gallery Grid when 1 or more images exist -->
      <div v-else class="multi-photos__body">
        <div class="multi-photos__header">
          <span class="multi-photos__counter">
            <strong>{{ imageList.length }}</strong> de {{ props.maxFiles }} fotos
          </span>
          <span class="multi-photos__guide">La primera foto se mostrará como portada.</span>
        </div>

        <div class="multi-photos__grid">
          <div
            v-for="(imgUrl, index) in imageList"
            :key="`${imgUrl.slice(0, 40)}-${index}`"
            class="photo-card"
            :class="{
              'photo-card--cover': index === 0,
              'photo-card--dragging': draggedIndex === index,
            }"
            draggable="true"
            @dragstart="onDragStart(index, $event)"
            @dragover.prevent
            @drop="onDropThumbnail(index)"
          >
            <div class="photo-card__preview">
              <img :src="imgUrl" :alt="`${props.alt} ${index + 1}`" />
              <span v-if="index === 0" class="photo-card__badge" title="Foto principal de la publicación">
                Portada
              </span>
            </div>

            <div class="photo-card__actions">
              <button
                v-if="index > 0"
                type="button"
                class="photo-btn photo-btn--cover"
                title="Hacer foto de portada"
                aria-label="Establecer como portada"
                @click.stop="setAsCover(index)"
              >
                ★ Portada
              </button>

              <div class="photo-card__nav">
                <button
                  type="button"
                  class="photo-btn photo-btn--arrow"
                  :disabled="index === 0"
                  title="Mover antes"
                  aria-label="Mover foto antes"
                  @click.stop="moveImage(index, index - 1)"
                >
                  ←
                </button>
                <button
                  type="button"
                  class="photo-btn photo-btn--arrow"
                  :disabled="index === imageList.length - 1"
                  title="Mover después"
                  aria-label="Mover foto después"
                  @click.stop="moveImage(index, index + 1)"
                >
                  →
                </button>
              </div>

              <button
                type="button"
                class="photo-btn photo-btn--delete"
                title="Eliminar esta foto"
                aria-label="Eliminar foto"
                @click.stop="removeImage(index)"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Add more tile if below max -->
          <div
            v-if="imageList.length < props.maxFiles"
            class="photo-card photo-card--add"
            :class="{ 'photo-card--add-dragging': isDragging }"
            role="button"
            tabindex="0"
            aria-label="Añadir más fotos"
            :aria-busy="isProcessing"
            @click="openPicker"
            @keydown.enter.prevent="openPicker"
            @keydown.space.prevent="openPicker"
            @dragenter.prevent="isDragging = true"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <span class="photo-card__add-icon" aria-hidden="true">+</span>
            <span class="photo-card__add-text">
              {{ isProcessing ? 'Procesando…' : 'Añadir más' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </template>

  <p v-if="errorMessage" class="photo-dropzone__error" role="alert">{{ errorMessage }}</p>
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
  max-width: 38ch;
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

/* Multi-photos styling */
.multi-photos {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.multi-photos__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.multi-photos__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
}

.multi-photos__counter {
  font-family: var(--mono);
  color: var(--ink);
}

.multi-photos__counter strong {
  color: var(--crimson);
}

.multi-photos__guide {
  color: var(--ink-faint);
}

.multi-photos__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
}

.photo-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--paper-2);
  border: 1.5px solid var(--line-strong);
  border-radius: 10px;
  overflow: hidden;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.photo-card:hover {
  border-color: color-mix(in srgb, var(--crimson) 40%, var(--line-strong));
}

.photo-card--cover {
  border-color: var(--gold);
  box-shadow: 0 0 0 1px var(--gold-light);
}

.photo-card--dragging {
  opacity: 0.4;
  transform: scale(0.96);
}

.photo-card__preview {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--paper-3);
  overflow: hidden;
}

.photo-card__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-card__badge {
  position: absolute;
  top: 6px;
  left: 6px;
  background: var(--gold);
  color: #1a160d;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.photo-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px;
  background: var(--paper);
  border-top: 1px solid var(--line);
  gap: 4px;
}

.photo-card__nav {
  display: flex;
  align-items: center;
  gap: 2px;
}

.photo-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--paper);
  color: var(--ink);
  font-size: 11px;
  cursor: pointer;
  padding: 3px 6px;
  line-height: 1;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.photo-btn:hover:not(:disabled) {
  border-color: var(--ink);
}

.photo-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.photo-btn--cover {
  background: var(--gold-bg);
  border-color: var(--gold-light);
  color: var(--ink);
  font-weight: 600;
  font-size: 10.5px;
  padding: 3px 5px;
}

.photo-btn--cover:hover {
  background: var(--gold);
  color: #1a160d;
}

.photo-btn--arrow {
  padding: 3px 6px;
  font-size: 11px;
  min-width: 22px;
}

.photo-btn--delete {
  color: var(--crimson);
  border-color: color-mix(in srgb, var(--crimson) 30%, var(--line));
  font-weight: 700;
  padding: 3px 6px;
  margin-left: auto;
}

.photo-btn--delete:hover {
  background: var(--crimson);
  color: #ffffff;
  border-color: var(--crimson);
}

.photo-card--add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  min-height: 130px;
  border: 1.5px dashed var(--line-strong);
  background: color-mix(in srgb, var(--paper) 50%, transparent);
  cursor: pointer;
  gap: 6px;
  transition: border-color 0.18s, background 0.18s, transform 0.18s;
}

.photo-card--add:hover,
.photo-card--add:focus-visible,
.photo-card--add-dragging {
  outline: none;
  border-color: var(--crimson);
  background: var(--crimson-bg);
}

.photo-card__add-icon {
  font-size: 22px;
  line-height: 1;
  color: var(--crimson);
  font-weight: 600;
}

.photo-card__add-text {
  font-size: 12px;
  color: var(--ink-soft);
  font-weight: 600;
}

@media (max-width: 420px) {
  .photo-dropzone__filled {
    align-items: flex-start;
  }

  .photo-dropzone__filled img {
    width: 64px;
    height: 64px;
  }

  .multi-photos__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
