<script setup lang="ts">
import 'emoji-picker-element'
import { nextTick, onBeforeUnmount, ref } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isOpen = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})

interface EmojiClickEvent extends Event {
  detail: { unicode?: string }
}

async function toggleOpen() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    positionPopover()
    window.addEventListener('scroll', positionPopover, true)
    window.addEventListener('resize', positionPopover)
  } else {
    window.removeEventListener('scroll', positionPopover, true)
    window.removeEventListener('resize', positionPopover)
  }
}

function positionPopover() {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return

  const popoverWidth = 340
  const spaceBelow = window.innerHeight - rect.bottom
  const openUpward = spaceBelow < 460

  popoverStyle.value = {
    left: `${Math.min(rect.left, window.innerWidth - popoverWidth - 16)}px`,
    ...(openUpward
      ? { bottom: `${window.innerHeight - rect.top + 8}px` }
      : { top: `${rect.bottom + 8}px` }),
  }
}

function handlePick(event: Event) {
  const unicode = (event as EmojiClickEvent).detail?.unicode
  if (unicode) {
    emit('update:modelValue', unicode)
  }
  close()
}

function close() {
  isOpen.value = false
  window.removeEventListener('scroll', positionPopover, true)
  window.removeEventListener('resize', positionPopover)
}

onBeforeUnmount(() => {
  window.removeEventListener('scroll', positionPopover, true)
  window.removeEventListener('resize', positionPopover)
})
</script>

<template>
  <div class="icon-picker">
    <button ref="trigger" type="button" class="icon-picker__trigger" @click="toggleOpen">
      <span v-if="props.modelValue">{{ props.modelValue }}</span>
      <span v-else class="icon-picker__placeholder">＋</span>
    </button>

    <Teleport to="body">
      <button v-if="isOpen" class="icon-picker__scrim" type="button" aria-label="Cerrar selector" @click="close"></button>
      <div v-if="isOpen" class="icon-picker__popover" :style="popoverStyle">
        <emoji-picker class="icon-picker__widget" @emoji-click="handlePick"></emoji-picker>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.icon-picker {
  position: relative;
}

.icon-picker__trigger {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s ease;
}

.icon-picker__trigger:hover {
  border-color: var(--crimson);
}

.icon-picker__placeholder {
  color: var(--ink-faint);
  font-size: 18px;
}
</style>

<style>
/* Sin scope: el picker y el scrim viven teletransportados a <body>, fuera del modal. */
.icon-picker__scrim {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: transparent;
  border: none;
  cursor: default;
  padding: 0;
}

.icon-picker__popover {
  position: fixed;
  z-index: 301;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--shadow);
  border: 1px solid var(--line);
}

.icon-picker__widget {
  --background: var(--paper-2);
  --border-color: var(--line);
  --indicator-color: var(--crimson);
  --input-border-color: var(--line-strong);
  --input-font-color: var(--ink);
  --outline-color: var(--crimson);
}
</style>
