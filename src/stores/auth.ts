import { defineStore } from 'pinia'
import type { AuthUser, LoginCredentials } from '../types'

const STORAGE_KEY = 'lendit-ujap:auth-user'

function readCachedUser(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? (JSON.parse(raw) as AuthUser) : null
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: readCachedUser() as AuthUser | null,
  }),

  getters: {
    isAuthenticated: (state) => state.user !== null,
  },

  actions: {
    login({ email, password }: LoginCredentials): { ok: boolean; error?: string } {
      if (!email.endsWith('@ujap.edu.ve')) {
        return { ok: false, error: 'Usa tu correo institucional (@ujap.edu.ve).' }
      }
      if (password.length < 6) {
        return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' }
      }

      const name = email.split('@')[0].replace(/[._]/g, ' ')
      this.user = { name, email }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user))
      return { ok: true }
    },

    logout() {
      this.user = null
      localStorage.removeItem(STORAGE_KEY)
    },
  },
})
