<script setup lang="ts">
defineProps<{
  title: string
}>()

defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <Transition name="modal-fade">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal" role="dialog" aria-modal="true" :aria-label="title">
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
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 20px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  padding: 28px;
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
