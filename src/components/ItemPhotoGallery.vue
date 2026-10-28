<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ModalDialog from './ModalDialog.vue'

const props = withDefaults(
  defineProps<{
    photoUrls?: string[] | null
    photoUrl?: string | null
    title: string
    categoryIcon?: string | null
    compact?: boolean
    zoomable?: boolean
  }>(),
  {
    photoUrls: () => [],
    photoUrl: null,
    categoryIcon: null,
    compact: false,
    zoomable: false,
  },
)

const currentIndex = ref(0)
const touchStartX = ref<number | null>(null)
const slideDirection = ref<'next' | 'prev'>('next')
const viewerOpen = ref(false)

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
  slideDirection.value = 'next'
  currentIndex.value = (currentIndex.value + 1) % photos.value.length
}

function prevPhoto() {
  if (!hasMultiple.value) return
  slideDirection.value = 'prev'
  currentIndex.value = (currentIndex.value - 1 + photos.value.length) % photos.value.length
}

function goToPhoto(index: number) {
  if (index >= 0 && index < photos.value.length) {
    slideDirection.value = index >= currentIndex.value ? 'next' : 'prev'
    currentIndex.value = index
  }
}

function openViewer() {
  if (props.zoomable && hasPhotos.value) viewerOpen.value = true
}

function onViewerKeydown(event: KeyboardEvent) {
  if (!viewerOpen.value || !hasMultiple.value) return
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    nextPhoto()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    prevPhoto()
  } else if (event.key === 'Home') {
    event.preventDefault()
    goToPhoto(0)
  } else if (event.key === 'End') {
    event.preventDefault()
    goToPhoto(photos.value.length - 1)
  }
}

watch(viewerOpen, (isOpen) => {
  if (isOpen) window.addEventListener('keydown', onViewerKeydown)
  else window.removeEventListener('keydown', onViewerKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onViewerKeydown))

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
  if ((e.target as HTMLElement | null)?.closest('button')) {
    touchStartX.value = null
    return
  }
  if (!hasMultiple.value || e.touches.length !== 1) return
  touchStartX.value = e.touches[0].clientX
}

function onTouchEnd(e: TouchEvent) {
  if (!hasMultiple.value || touchStartX.value === null || e.changedTouches.length !== 1) {
    touchStartX.value = null
    return
  }
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
      <Transition :name="`gallery-${slideDirection}`" mode="out-in">
        <div :key="currentPhoto ?? 'img'" class="item-gallery__photo">
          <img
            :src="currentPhoto ?? ''"
            :alt="hasMultiple ? `Foto ${currentIndex + 1} de ${photos.length} de ${title}` : `Foto de ${title}`"
            class="item-gallery__image"
            loading="lazy"
          />
        </div>
      </Transition>

      <button
        v-if="zoomable"
        type="button"
        class="item-gallery__expand"
        aria-label="Ampliar foto"
        title="Ampliar foto"
        aria-haspopup="dialog"
        @click.stop.prevent="openViewer"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </button>

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

        <div class="item-gallery__dots" role="group" aria-label="Seleccionar foto">
          <button
            v-for="(_, index) in photos"
            :key="index"
            type="button"
            class="item-gallery__dot"
            :class="{ 'item-gallery__dot--active': index === currentIndex }"
            :aria-label="`Ver foto ${index + 1} de ${photos.length}`"
            :aria-pressed="index === currentIndex"
            @click.stop.prevent="goToPhoto(index)"
          />
        </div>
      </template>
    </template>

  <ModalDialog v-if="viewerOpen" :title="`Fotos de ${title}`" wide @close="viewerOpen = false">
    <div class="item-gallery__viewer">
      <div class="item-gallery__viewer-stage" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
        <Transition :name="`gallery-${slideDirection}`" mode="out-in">
          <img
            :key="currentPhoto ?? 'viewer-img'"
            class="item-gallery__viewer-image"
            :src="currentPhoto ?? ''"
            :alt="hasMultiple ? `Foto ${currentIndex + 1} de ${photos.length} de ${title}` : `Foto de ${title}`"
          />
        </Transition>
        <template v-if="hasMultiple">
          <button type="button" class="item-gallery__viewer-nav item-gallery__viewer-nav--prev" aria-label="Foto anterior" @click="prevPhoto">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button type="button" class="item-gallery__viewer-nav item-gallery__viewer-nav--next" aria-label="Siguiente foto" @click="nextPhoto">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <span class="item-gallery__viewer-counter" aria-live="polite" aria-atomic="true">{{ currentIndex + 1 }} / {{ photos.length }}</span>
        </template>
      </div>
      <p class="item-gallery__viewer-caption">{{ title }}</p>
      <div v-if="hasMultiple" class="item-gallery__thumbnails" role="group" aria-label="Seleccionar foto">
        <button
          v-for="(photo, index) in photos"
          :key="photo + index"
          type="button"
          class="item-gallery__thumbnail"
          :class="{ 'item-gallery__thumbnail--active': index === currentIndex }"
          :aria-label="`Ver foto ${index + 1} de ${photos.length}`"
          :aria-pressed="index === currentIndex"
          @click="goToPhoto(index)"
        >
          <img :src="photo" alt="" loading="lazy" />
        </button>
      </div>
    </div>
  </ModalDialog>
  </div>
</template>

<style scoped>
.item-gallery {
  position: relative;
  width: 100%;
  height: 180px;
  overflow: hidden;
  border-radius: 12px;
  background: var(--surface-soft);
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

.item-gallery__photo {
  position: absolute;
  inset: 0;
}

.gallery-next-enter-active,
.gallery-next-leave-active,
.gallery-prev-enter-active,
.gallery-prev-leave-active {
  transition: transform 180ms var(--ease-out), opacity 180ms ease;
}

.gallery-next-enter-from { opacity: 0; transform: translateX(7%); }
.gallery-next-leave-to { opacity: 0; transform: translateX(-7%); }
.gallery-prev-enter-from { opacity: 0; transform: translateX(-7%); }
.gallery-prev-leave-to { opacity: 0; transform: translateX(7%); }

.item-gallery__expand {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 4;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--on-dark) 35%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--navy) 78%, transparent);
  color: var(--on-dark);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: background-color 150ms ease, transform 150ms var(--ease-out);
}

.item-gallery__expand:active { transform: scale(0.96); }
.item-gallery__expand:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

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
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: color-mix(in srgb, var(--navy) 78%, transparent);
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}

.item-gallery__nav svg {
  display: block;
}

.item-gallery--compact .item-gallery__nav svg {
  width: 14px;
  height: 14px;
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
  gap: 2px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(13, 23, 48, 0.45);
  backdrop-filter: blur(3px);
}

.item-gallery--compact .item-gallery__dots {
  bottom: 2px;
}

.item-gallery__dot {
  display: grid;
  flex: 0 0 22px;
  place-items: center;
  width: 22px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}

.item-gallery__dot::before {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.65);
  content: '';
  transition: width 180ms var(--ease-out), background-color 180ms ease;
}

.item-gallery__dot:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: -1px;
}

.item-gallery__dot--active::before {
  width: 13px;
  background: var(--gold-light);
}

.item-gallery__viewer { display: grid; gap: 14px; }

.item-gallery__viewer-stage {
  position: relative;
  height: min(66dvh, 680px);
  min-height: 260px;
  overflow: hidden;
  border-radius: 14px;
  background: var(--navy);
  touch-action: pan-y;
}

.item-gallery__viewer-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.item-gallery__viewer-nav {
  position: absolute;
  top: 50%;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--on-dark) 35%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--navy) 80%, transparent);
  color: var(--on-dark);
  cursor: pointer;
  transform: translateY(-50%);
  transition: background-color 150ms ease, transform 150ms var(--ease-out);
}

.item-gallery__viewer-nav:active { transform: translateY(-50%) scale(0.96); }
.item-gallery__viewer-nav:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.item-gallery__viewer-nav--prev { left: 12px; }
.item-gallery__viewer-nav--next { right: 12px; }

.item-gallery__viewer-counter {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--on-dark) 25%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--navy) 82%, transparent);
  color: var(--on-dark);
  font: 600 12px/1 var(--mono);
}

.item-gallery__viewer-caption { margin: 0; color: var(--ink); font: 600 16px/1.4 var(--sans); }

.item-gallery__thumbnails {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 2px 8px;
  scrollbar-width: thin;
}

.item-gallery__thumbnail {
  flex: 0 0 72px;
  width: 72px;
  height: 64px;
  overflow: hidden;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 9px;
  background: var(--surface-soft);
  cursor: pointer;
  transition: border-color 150ms ease, transform 150ms var(--ease-out);
}

.item-gallery__thumbnail img { display: block; width: 100%; height: 100%; object-fit: cover; }
.item-gallery__thumbnail--active { border-color: var(--crimson); }
.item-gallery__thumbnail:focus-visible { outline: 2px solid var(--crimson); outline-offset: 2px; }

@media (hover: hover) and (pointer: fine) {
  .item-gallery__expand:hover { background: var(--crimson); transform: scale(1.06); }
  .item-gallery__nav:hover {
    background: var(--crimson);
    border-color: var(--crimson);
    transform: translateY(-50%) scale(1.06);
  }
  .item-gallery__dot:hover::before { background: rgba(255, 255, 255, 0.95); }
  .item-gallery__viewer-nav:hover { background: var(--crimson); transform: translateY(-50%) scale(1.06); }
  .item-gallery__thumbnail:hover { transform: translateY(-2px); }
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
  .item-gallery__dot,
  .item-gallery__dot::before,
  .item-gallery__expand,
  .item-gallery__viewer-nav,
  .item-gallery__thumbnail,
  .gallery-next-enter-active,
  .gallery-next-leave-active,
  .gallery-prev-enter-active,
  .gallery-prev-leave-active {
    transition: none;
  }

  .gallery-next-enter-from,
  .gallery-next-leave-to,
  .gallery-prev-enter-from,
  .gallery-prev-leave-to { transform: none; }
}

@media (max-width: 520px) {
  .item-gallery__viewer-stage { height: min(58dvh, 560px); min-height: 220px; }
  .item-gallery__viewer-nav { width: 44px; height: 44px; }
  .item-gallery__viewer-nav--prev { left: 8px; }
  .item-gallery__viewer-nav--next { right: 8px; }
}
</style>
