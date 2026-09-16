import { defineStore } from 'pinia'
import { apiRequest } from '../lib/api'
import type { Career, Category, Role, School } from '../types'

interface CategoriesResponse {
  categories: Category[]
}

interface CareersResponse {
  careers: Career[]
}

interface RolesResponse {
  roles: Role[]
}

interface SchoolsResponse {
  schools: School[]
}

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    categories: [] as Category[],
    careers: [] as Career[],
    roles: [] as Role[],
    schools: [] as School[],
    isInitialized: false,
  }),

  actions: {
    async initialize() {
      if (this.isInitialized) {
        return
      }
      await Promise.all([this.loadCategories(), this.loadCareers(), this.loadSchools()])
      this.isInitialized = true
    },

    async loadCategories() {
      const response = await apiRequest<CategoriesResponse>('/api/categories')
      this.categories = response.categories
    },

    async loadCareers() {
      const response = await apiRequest<CareersResponse>('/api/careers')
      this.careers = response.careers
    },

    async loadSchools() {
      const response = await apiRequest<SchoolsResponse>('/api/schools')
      this.schools = response.schools
    },

    // Requiere sesión activa (el endpoint exige autenticación); se usa para el
    // selector de audiencia al publicar y el panel de administración de roles.
    async loadRoles() {
      const response = await apiRequest<RolesResponse>('/api/roles')
      this.roles = response.roles
    },
  },
})
