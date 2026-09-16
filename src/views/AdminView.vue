<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'

const sections = [
  { id: 'roles', routeName: 'admin-roles', label: 'Roles y permisos', icon: '◈', hint: 'Define quién puede hacer qué dentro de LendIt.' },
  { id: 'users', routeName: 'admin-users', label: 'Usuarios', icon: '⚈', hint: 'Administra las cuentas que participan en la red.' },
  { id: 'categories', routeName: 'admin-categories', label: 'Tipos de artículo', icon: '▤', hint: 'Ordena los objetos que se pueden prestar.' },
  { id: 'careers', routeName: 'admin-careers', label: 'Carreras', icon: '✎', hint: 'Mantén actualizada la estructura académica.' },
] as const

const route = useRoute()
const router = useRouter()
const activeSection = computed(() => sections.find((section) => section.routeName === route.name)?.id ?? 'roles')
const currentSection = computed(() => sections.find((section) => section.id === activeSection.value) ?? sections[0])

function openSection(routeName: (typeof sections)[number]['routeName']) {
  void router.push({ name: routeName })
}
</script>

<template>
  <div class="admin-page">
    <SiteHeader />

    <div class="admin">
      <aside class="admin__sidebar">
        <div class="admin__identity">
          <span class="admin__identity-mark" aria-hidden="true">L</span>
          <div>
            <p>Administración</p>
            <strong>Control del campus</strong>
          </div>
        </div>

        <p class="admin__eyebrow">Áreas de gestión</p>

        <nav class="admin__nav">
          <button
            v-for="section in sections"
            :key="section.id"
            type="button"
            class="admin__nav-item"
            :class="{ 'admin__nav-item--active': activeSection === section.id }"
            :aria-current="activeSection === section.id ? 'page' : undefined"
            @click="openSection(section.routeName)"
          >
            <span class="admin__nav-icon">{{ section.icon }}</span>
            <span class="admin__nav-text">
              <span class="admin__nav-label">{{ section.label }}</span>
              <span class="admin__nav-hint">{{ section.hint }}</span>
            </span>
          </button>
        </nav>

        <p class="admin__sidebar-note">
          Los cambios en estas áreas afectan a toda la comunidad LendIt.
        </p>
      </aside>

      <main class="admin__content">
        <header class="admin__masthead">
          <div>
            <p class="admin__eyebrow">Configuración de LendIt</p>
            <h1>{{ currentSection.label }}</h1>
            <p class="admin__description">{{ currentSection.hint }}</p>
          </div>
          <div class="admin__access">
            <span class="admin__access-dot" aria-hidden="true"></span>
            Acceso de administrador
          </div>
        </header>

        <section class="admin__workspace" :aria-label="currentSection.label">
          <div class="admin__workspace-rule" aria-hidden="true"></div>
          <div class="admin__content-inner">
            <router-view />
          </div>
        </section>
      </main>
    </div>

    <SiteFooter />
  </div>
</template>

<style scoped>
.admin-page {
  min-height: 100svh;
  background: var(--paper);
}

.admin {
  display: grid;
  grid-template-columns: 292px minmax(0, 1fr);
  min-height: calc(100svh - 79px);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--paper-2) 62%, transparent), transparent 26%),
    var(--paper);
}

/* ---------- sidebar ---------- */
.admin__sidebar {
  display: flex;
  flex-direction: column;
  padding: 34px 20px 28px;
  border-right: 1px solid var(--line);
  background: color-mix(in srgb, var(--paper-2) 78%, transparent);
}

.admin__identity {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 8px 54px;
}

.admin__identity-mark {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px 10px 10px 2px;
  background: var(--navy);
  color: var(--on-dark);
  font-family: var(--display);
  font-size: 18px;
  font-weight: 700;
}

.admin__identity p,
.admin__identity strong {
  display: block;
  margin: 0;
}

.admin__identity p,
.admin__eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.075em;
  color: var(--crimson-dark);
}

.admin__identity strong {
  color: var(--ink);
  font-family: var(--display);
  font-size: 16px;
}

.admin__eyebrow {
  margin: 0 10px 10px;
}

.admin__nav {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.admin__nav-item {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 13px 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.admin__nav-item:hover {
  background: color-mix(in srgb, var(--paper) 55%, transparent);
  border-color: var(--line);
}

.admin__nav-item--active {
  background: var(--paper);
  border-color: color-mix(in srgb, var(--crimson) 34%, var(--line));
  box-shadow: 0 8px 18px -16px rgba(22, 29, 51, 0.55), inset 3px 0 var(--crimson);
}

.admin__nav-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--gold-bg);
  color: var(--gold);
  font-size: 14px;
}

.admin__nav-item--active .admin__nav-icon {
  background: var(--crimson);
  color: #fbf3e6;
}

.admin__nav-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.admin__nav-label {
  font-size: 13.5px;
  font-weight: 650;
  color: var(--ink);
}

.admin__nav-hint {
  font-size: 11px;
  line-height: 1.35;
  color: var(--ink-faint);
}

.admin__sidebar-note {
  margin: auto 10px 0;
  padding-top: 22px;
  border-top: 1px solid var(--line);
  color: var(--ink-faint);
  font-size: 12px;
  line-height: 1.55;
}

/* ---------- content ---------- */
.admin__content {
  display: flex;
  flex-direction: column;
  padding: 46px clamp(24px, 4.5vw, 72px) 88px;
  min-width: 0;
}

.admin__masthead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  max-width: 1600px;
  margin-bottom: 34px;
}

.admin__masthead .admin__eyebrow {
  margin: 0 0 10px;
}

.admin__masthead h1 {
  font-size: clamp(32px, 4vw, 46px);
  line-height: 1;
  letter-spacing: -1.2px;
}

.admin__description {
  max-width: 52ch;
  margin-top: 12px;
  color: var(--ink-soft);
  font-size: 15px;
}

.admin__access {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-top: 6px;
  padding: 8px 11px;
  border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--line));
  border-radius: 999px;
  background: var(--gold-bg);
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 650;
}

.admin__access-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--gold);
}

.admin__workspace {
  width: 100%;
  flex: 1;
  max-width: 1600px;
  min-height: 520px;
  padding: 30px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: color-mix(in srgb, var(--paper) 88%, transparent);
  box-shadow: 0 20px 40px -36px rgba(22, 29, 51, 0.72);
}

.admin__workspace-rule {
  width: 52px;
  height: 3px;
  margin-bottom: 26px;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--crimson), var(--gold));
}

.admin__content-inner {
  min-width: 0;
}

@media (max-width: 860px) {
  .admin {
    grid-template-columns: 1fr;
  }

  .admin__sidebar {
    border-right: none;
    border-bottom: 1px solid var(--line);
    padding: 22px 20px;
  }

  .admin__identity {
    margin-bottom: 24px;
  }

  .admin__nav {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .admin__nav-item {
    flex: 1 1 auto;
    min-width: 180px;
  }

  .admin__nav-hint {
    display: none;
  }

  .admin__content {
    padding: 32px 20px 64px;
  }

  .admin__workspace {
    padding: 22px;
    min-height: 420px;
  }

  .admin__sidebar-note {
    display: none;
  }
}

@media (max-width: 560px) {
  .admin__masthead {
    flex-direction: column;
    gap: 14px;
    margin-bottom: 24px;
  }

  .admin__masthead h1 {
    font-size: 34px;
  }

  .admin__access {
    margin-top: 0;
  }

  .admin__nav {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .admin__nav-item {
    flex: 0 0 210px;
  }

  .admin__workspace {
    padding: 18px;
    border-radius: 14px;
  }
}
</style>
