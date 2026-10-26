<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    photoUrls?: string[] | null
    photoUrl?: string | null
    title: string
    categoryIcon?: string | null
    compact?: boolean
  }>(),
  {
    photoUrls: () => [],
    photoUrl: null,
    categoryIcon: null,
    compact: false,
  },
)

const currentIndex = ref(0)
const touchStartX = ref<number | null>(null)

const photos = computed<string[]>(() => {
  const result: string[] = []
  if (Array.isArray(props.photoUrls) && props.photoUrls.length > 0) {
    for (const url of props.photoUrls) {
      if (typeof url === 'string' && url.trim().length > 0) {
        result.push(url.trim())
      }
    }
  }

  // Fallback to single photoUrl if photoUrls was empty
  if (result.length === 0 && typeof props.photoUrl === 'string' && props.photoUrl.trim().length > 0) {
    result.push(props.photoUrl.trim())
  }

  return result
})

const hasPhotos = computed(() => photos.value.length > 0)
const hasMultiple = computed(() => photos.value.length > 1)
const currentPhoto = computed(() => (hasPhotos.value ? photos.value[currentIndex.value] : null))

watch(
  () => photos.value.length,
  (newLength) => {
    if (currentIndex.value >= newLength) {
      currentIndex.value = 0
    }
  },
)

function nextPhoto() {
  if (!hasMultiple.value) return
  currentIndex.value = (currentIndex.value + 1) % photos.value.length
}

function prevPhoto() {
  if (!hasMultiple.value) return
  currentIndex.value = (currentIndex.value - 1 + photos.value.length) % photos.value.length
}

function goToPhoto(index: number) {
  if (index >= 0 && index < photos.value.length) {
    currentIndex.value = index
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!hasMultiple.value) return
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    nextPhoto()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prevPhoto()
  } else if (e.key === 'Home') {
    e.preventDefault()
    goToPhoto(0)
  } else if (e.key === 'End') {
    e.preventDefault()
    goToPhoto(photos.value.length - 1)
  }
}

function onTouchStart(e: TouchEvent) {
  if (!hasMultiple.value || e.touches.length !== 1) return
  touchStartX.value = e.touches[0].clientX
}

function onTouchEnd(e: TouchEvent) {
  if (!hasMultiple.value || touchStartX.value === null || e.changedTouches.length !== 1) return
  const deltaX = e.changedTouches[0].clientX - touchStartX.value
  touchStartX.value = null
  if (Math.abs(deltaX) > 40) {
    if (deltaX > 0) {
      prevPhoto()
    } else {
      nextPhoto()
    }
  }
}
</script>

<template>
  <div
    class="item-gallery"
    :class="{ 'item-gallery--compact': compact, 'item-gallery--multiple': hasMultiple }"
    :tabindex="hasMultiple ? 0 : undefined"
    :role="hasMultiple ? 'region' : undefined"
    :aria-label="hasMultiple ? `Galería de fotos de ${title}` : undefined"
    @keydown="onKeydown"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <!-- Fallback if no photos uploaded -->
    <div v-if="!hasPhotos" class="item-gallery__fallback">
      <span class="item-gallery__fallback-icon" aria-hidden="true">{{ categoryIcon || '·' }}</span>
      <span class="sr-only">Sin foto disponible para {{ title }}</span>
    </div>

    <!-- Active photo -->
    <template v-else>
      <img
        :key="currentPhoto ?? 'img'"
        :src="currentPhoto ?? ''"
        :alt="hasMultiple ? `Foto ${currentIndex + 1} de ${photos.length} de ${title}` : `Foto de ${title}`"
        class="item-gallery__image"
        loading="lazy"
      />

      <!-- Controls only when multiple photos exist -->
      <template v-if="hasMultiple">
        <button
          type="button"
          class="item-gallery__nav item-gallery__nav--prev"
          aria-label="Foto anterior"
          title="Foto anterior"
          @click.stop.prevent="prevPhoto"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            stroke="currentColor"
            fill="none"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          type="button"
          class="item-gallery__nav item-gallery__nav--next"
          aria-label="Siguiente foto"
          title="Siguiente foto"
          @click.stop.prevent="nextPhoto"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            stroke="currentColor"
            fill="none"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <span class="item-gallery__counter" aria-live="polite" aria-atomic="true">
          <span class="sr-only">Foto {{ currentIndex + 1 }} de {{ photos.length }}</span>
          <span aria-hidden="true">{{ currentIndex + 1 }} / {{ photos.length }}</span>
        </span>

        <div class="item-gallery__dots" role="tablist" aria-label="Fotos del objeto">
          <button
            v-for="(_, index) in photos"
            :key="index"
            type="button"
            role="tab"
            class="item-gallery__dot"
            :class="{ 'item-gallery__dot--active': index === currentIndex }"
            :aria-label="`Ver foto ${index + 1} de ${photos.length}`"
            :aria-selected="index === currentIndex"
            @click.stop.prevent="goToPhoto(index)"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.item-gallery {
  position: relative;
  width: 100%;
  height: 180px;
  overflow: hidden;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--navy-bg), var(--gold-bg));
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.item-gallery--compact {
  height: 96px;
  border-radius: 11px;
}

.item-gallery:focus-visible {
  outline: 2px solid var(--crimson);
  outline-offset: 2px;
}

.item-gallery__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.item-gallery__fallback {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: var(--ink);
}

.item-gallery__fallback-icon {
  font-size: 31px;
  line-height: 1;
}

.item-gallery__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: color-mix(in srgb, var(--navy) 78%, transparent);
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}

.item-gallery--compact .item-gallery__nav {
  width: 26px;
  height: 26px;
}

.item-gallery__nav svg {
  display: block;
}

.item-gallery--compact .item-gallery__nav svg {
  width: 14px;
  height: 14px;
}

.item-gallery__nav:hover {
  background: var(--crimson);
  border-color: var(--crimson);
  transform: translateY(-50%) scale(1.06);
}

.item-gallery__nav:active {
  transform: translateY(-50%) scale(0.96);
}

.item-gallery__nav:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}

.item-gallery__nav--prev {
  left: 6px;
}

.item-gallery__nav--next {
  right: 6px;
}

.item-gallery__counter {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 3;
  font-family: var(--mono);
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1;
  color: #ffffff;
  background: color-mix(in srgb, var(--navy) 82%, black);
  padding: 3.5px 7px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.item-gallery--compact .item-gallery__counter {
  top: 5px;
  right: 5px;
  font-size: 9.5px;
  padding: 3px 6px;
}

.item-gallery__dots {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border-radius: 999px;
  background: rgba(13, 23, 48, 0.45);
  backdrop-filter: blur(3px);
}

.item-gallery--compact .item-gallery__dots {
  bottom: 5px;
  gap: 3px;
  padding: 2px 5px;
}

.item-gallery__dot {
  width: 6px;
  height: 6px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  transition: all 0.2s ease;
}

.item-gallery--compact .item-gallery__dot {
  width: 5px;
  height: 5px;
}

.item-gallery__dot:hover {
  background: rgba(255, 255, 255, 0.95);
}

.item-gallery__dot:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 1px;
}

.item-gallery__dot--active {
  width: 13px;
  background: var(--gold-light);
}

.item-gallery--compact .item-gallery__dot--active {
  width: 11px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .item-gallery__nav,
  .item-gallery__dot {
    transition: none;
  }
}
</style>
