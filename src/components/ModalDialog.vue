<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

withDefaults(
  defineProps<{
    title: string
    wide?: boolean
  }>(),
  { wide: false },
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const dialog = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
let appRoot: HTMLElement | null = null
let previousInert = false

function focusableElements() {
  return Array.from(dialog.value?.querySelectorAll<HTMLElement>(
    'button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
  ) ?? []).filter(el => el.tabIndex >= 0 && el.getClientRects().length > 0)
}

function handleKeydown(event: KeyboardEvent) {
  const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
  if (dialogs[dialogs.length - 1] !== dialog.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
  } else if (event.key === 'Tab') {
    const elements = focusableElements()
    const first = elements[0]
    const last = elements[elements.length - 1]
    if (!first) {
      event.preventDefault()
      dialog.value?.focus()
    } else if (!dialog.value?.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault()
      ;(event.shiftKey ? last : first)?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

onMounted(async () => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  appRoot = document.getElementById('app')
  previousInert = appRoot?.inert ?? false
  if (appRoot) appRoot.inert = true
  document.addEventListener('keydown', handleKeydown, true)
  await nextTick()
  ;(focusableElements()[0] ?? dialog.value)?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown, true)
  document.body.style.overflow = previousOverflow
  if (appRoot) appRoot.inert = previousInert
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div class="modal-overlay" @click.self="$emit('close')">
        <div ref="dialog" class="modal" :class="{ 'modal--wide': wide }" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
          <header class="modal__header">
            <h2>{{ title }}</h2>
            <button class="modal__close" type="button" aria-label="Cerrar" @click="$emit('close')">×</button>
          </header>
          <div class="modal__body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: color-mix(in srgb, var(--navy) 55%, transparent);
  backdrop-filter: blur(4px);
}

.modal {
  width: min(100%, 380px);
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 20px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  padding: 28px;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}

.modal::-webkit-scrollbar {
  width: 8px;
}

.modal::-webkit-scrollbar-track {
  background: transparent;
}

.modal::-webkit-scrollbar-thumb {
  background: var(--line-strong);
  border-radius: 999px;
}

.modal::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--crimson) 55%, var(--line-strong));
}

.modal--wide {
  width: 100%;
  max-width: 540px;
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal__header h2 {
  font-size: 22px;
}

.modal__close {
  min-width: 44px;
  min-height: 44px;
  background: transparent;
  border: none;
  font-size: 22px;
  line-height: 1;
  color: var(--ink-faint);
  cursor: pointer;
  padding: 4px;
}

.modal__close:hover {
  color: var(--ink);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
