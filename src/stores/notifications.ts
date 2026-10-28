import { defineStore } from 'pinia'
import { apiRequest } from '../lib/api'
import type { AppNotification } from '../types'

let generation = 0

interface NotificationsResponse {
  notifications: AppNotification[]
  unreadCount: number
}

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    notifications: [] as AppNotification[],
    unreadCount: 0,
    isLoading: false,
    reloadQueued: false,
    hasLoaded: false,
  }),
  actions: {
    async load() {
      if (this.isLoading) {
        this.reloadQueued = true
        return
      }
      const currentGeneration = generation
      this.isLoading = true
      try {
        const response = await apiRequest<NotificationsResponse>('/api/notifications')
        if (currentGeneration !== generation) return
        this.notifications = response.notifications
        this.unreadCount = response.unreadCount
        this.hasLoaded = true
      } finally {
        if (currentGeneration === generation) {
          this.isLoading = false
          if (this.reloadQueued) {
            this.reloadQueued = false
            void this.load()
          }
        }
      }
    },
    receive(notification: AppNotification) {
      if (this.notifications.some(existing => existing.id === notification.id)) return false
      this.notifications = [notification, ...this.notifications].slice(0, 40)
      if (!notification.readAt) this.unreadCount += 1
      if (this.isLoading) this.reloadQueued = true
      return true
    },
    async markRead(id: string) {
      const notification = this.notifications.find(item => item.id === id)
      if (!notification || notification.readAt) return
      notification.readAt = new Date().toISOString()
      this.unreadCount = Math.max(0, this.unreadCount - 1)
      try {
        await apiRequest('/api/notifications', {
          method: 'PATCH',
          body: JSON.stringify({ action: 'read', notificationIds: [id] }),
        })
      } catch {
        notification.readAt = null
        this.unreadCount += 1
      }
    },
    async markAllRead() {
      if (!this.unreadCount) return
      const changed = this.notifications.filter(item => !item.readAt)
      changed.forEach(item => { item.readAt = new Date().toISOString() })
      const previousCount = this.unreadCount
      this.unreadCount = 0
      try {
        await apiRequest('/api/notifications', {
          method: 'PATCH',
          body: JSON.stringify({ action: 'read-all' }),
        })
      } catch {
        changed.forEach(item => { item.readAt = null })
        this.unreadCount = previousCount
      }
    },
    clear() {
      generation++
      this.$reset()
    },
  },
})
