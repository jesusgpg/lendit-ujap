<script setup lang="ts">
import type { Category } from '../types'

defineProps<{
  category?: Category
  isPlaceholder?: boolean
}>()

defineEmits<{
  (e: 'select', categoryId: string): void
}>()
</script>

<template>
  <li 
    v-if="isPlaceholder" 
    class="category-card category-card--more"
    @click="$emit('select', 'more')"
  >
    <span class="category-card__icon">+</span>
    <h3>Y lo que falte</h3>
    <p>Libros, batas de laboratorio, instrumentos… si es tuyo y se puede prestar, tiene un lugar aquí.</p>
  </li>
  <li 
    v-else-if="category" 
    class="category-card"
    @click="$emit('select', category.id)"
  >
    <span class="category-card__icon">{{ category.icon }}</span>
    <h3>{{ category.label }}</h3>
    <p>{{ category.blurb }}</p>
  </li>
</template>

<style scoped>
.category-card {
  list-style: none;
  padding: 28px 24px;
  border-radius: 18px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  cursor: pointer;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    border-color 0.25s ease;
}

.category-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-soft);
  border-color: var(--gold-light);
}

.category-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--crimson-bg);
  color: var(--crimson-dark);
  font-size: 19px;
  margin-bottom: 20px;
}

.category-card--more {
  background: transparent;
  border-style: dashed;
}

.category-card--more .category-card__icon {
  background: var(--gold-bg);
  color: var(--gold);
}

.category-card h3 {
  font-size: 18px;
  margin: 0 0 8px 0;
  color: var(--ink);
}

.category-card p {
  font-size: 14px;
  color: var(--ink-faint);
  line-height: 1.55;
  margin: 0;
}
</style>
