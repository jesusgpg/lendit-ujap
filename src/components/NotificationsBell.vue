<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore } from '../stores/notifications'
import type { AppNotification } from '../types'

const router = useRouter()
const store = useNotificationsStore()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const isOpen = ref(false)

function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function close() {
  isOpen.value = false
}

function onPointerDown(event: PointerEvent) {
  if (isOpen.value && root.value && !root.value.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    close()
    trigger.value?.focus()
  }
}

function openNotification(notification: AppNotification) {
  void store.markRead(notification.id)
  close()
  const href = notification.href.startsWith('/') && !notification.href.startsWith('//') ? notification.href : '/inicio'
  void router.push(href)
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="notifications">
    <button
      ref="trigger"
      class="notifications__trigger"
      type="button"
      :aria-expanded="isOpen"
      aria-controls="notifications-panel"
      :aria-label="store.unreadCount ? `Notificaciones, ${store.unreadCount} sin leer` : 'Notificaciones'"
      @click="isOpen = !isOpen"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      <span v-if="store.unreadCount" class="notifications__count" aria-hidden="true">{{ store.unreadCount > 9 ? '9+' : store.unreadCount }}</span>
    </button>
    <span class="sr-only" role="status" aria-atomic="true">{{ store.unreadCount ? `${store.unreadCount} notificaciones sin leer` : '' }}</span>

    <section v-if="isOpen" id="notifications-panel" class="notifications__panel" aria-label="Notificaciones">
      <header class="notifications__header">
        <h2>Notificaciones</h2>
        <button v-if="store.unreadCount" type="button" @click="store.markAllRead">Marcar todo como leído</button>
      </header>
      <p v-if="store.isLoading && !store.notifications.length" class="notifications__empty" role="status">Cargando notificaciones…</p>
      <p v-else-if="!store.notifications.length" class="notifications__empty">Aún no tienes notificaciones.</p>
      <ul v-else class="notifications__list">
        <li v-for="notification in store.notifications" :key="notification.id">
          <button
            type="button"
            class="notifications__item"
            :class="{ 'is-unread': !notification.readAt }"
            @click="openNotification(notification)"
          >
            <span class="notifications__item-title">{{ notification.title }}</span>
            <span class="notifications__item-message">{{ notification.message }}</span>
            <time :datetime="notification.createdAt">{{ formatTime(notification.createdAt) }}</time>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.notifications { position: relative; display: inline-flex; align-items: center; }
.notifications__trigger { position: relative; display: inline-grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 1px solid transparent; border-radius: 50%; color: var(--ink); background: transparent; cursor: pointer; }
.notifications__trigger:hover, .notifications__trigger[aria-expanded='true'] { background: var(--paper); border-color: var(--line); }
.notifications__trigger svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.notifications__count { position: absolute; top: 1px; right: 0; display: grid; place-items: center; min-width: 18px; height: 18px; padding: 0 4px; border: 2px solid var(--paper-2); border-radius: 999px; color: var(--on-dark); background: var(--crimson); font: 700 10px/1 var(--sans); }
.notifications__panel { position: absolute; z-index: 80; top: calc(100% + 10px); right: 0; width: min(380px, calc(100vw - 24px)); max-height: min(70dvh, 560px); overflow: auto; border: 1px solid var(--line-strong); border-radius: 14px; color: var(--ink); background: var(--paper); box-shadow: var(--shadow); }
.notifications__header { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 16px; border-bottom: 1px solid var(--line); background: var(--paper); }
.notifications__header h2 { font: 650 17px/1.3 var(--sans); }
.notifications__header button { min-height: 44px; padding: 6px 0; border: 0; color: var(--crimson-dark); background: transparent; font: 600 12px/1.35 var(--sans); text-align: right; cursor: pointer; }
.notifications__list { list-style: none; margin: 0; padding: 0; }
.notifications__item { display: grid; width: 100%; gap: 4px; min-height: 44px; padding: 13px 16px; border: 0; border-bottom: 1px solid var(--line); color: var(--ink); background: transparent; text-align: left; cursor: pointer; }
.notifications__item:hover { background: var(--paper-2); }
.notifications__item.is-unread { box-shadow: inset 3px 0 var(--crimson); background: var(--crimson-bg); }
.notifications__item-title { font-size: 14px; font-weight: 700; }
.notifications__item-message { color: var(--ink-soft); font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
.notifications__item time { color: var(--ink-soft); font: 12px/1.4 var(--mono); }
.notifications__empty { padding: 22px 16px; color: var(--ink-soft); font-size: 14px; }
.notifications :is(button):focus-visible { outline: 2px solid var(--crimson); outline-offset: 2px; }
@media (max-width: 760px) { .notifications__panel { position: fixed; top: 68px; right: 12px; } }
@media (prefers-reduced-motion: reduce) { .notifications__trigger { transition: none; } }
</style>
