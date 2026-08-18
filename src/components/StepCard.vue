<script setup lang="ts">
import type { Step } from '../types'

defineProps<{
  step: Step
  isCompleted?: boolean
}>()

defineEmits<{
  (e: 'complete', stepNum: string): void
}>()
</script>

<template>
  <li class="step" :class="{ 'step--completed': isCompleted }">
    <div class="step__header">
      <span class="step__seal">{{ step.n }}</span>
      <button 
        class="btn-complete" 
        :class="{ 'btn-complete--done': isCompleted }"
        @click="$emit('complete', step.n)"
      >
        {{ isCompleted ? '✓ Leído' : 'Marcar leído' }}
      </button>
    </div>
    <h3>{{ step.title }}</h3>
    <p>{{ step.text }}</p>
  </li>
</template>

<style scoped>
.step {
  list-style: none;
  position: relative;
  padding: 20px;
  border-radius: 16px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  transition: all 0.3s ease;
}

.step--completed {
  border-color: var(--gold-light);
  background: color-mix(in srgb, var(--gold-bg) 30%, var(--paper-2));
}

.step__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.step__seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 1.5px solid var(--gold-light);
  font-family: var(--display);
  font-weight: 650;
  font-size: 16px;
  color: var(--gold);
  transition: all 0.3s ease;
}

.step--completed .step__seal {
  background: var(--gold);
  color: var(--navy);
  border-color: var(--gold);
}

.step h3 {
  font-size: 20px;
  margin: 0 0 8px 0;
  color: var(--ink);
  transition: color 0.3s ease;
}

.step--completed h3 {
  color: var(--gold-dark);
}

.step p {
  font-size: 15px;
  color: var(--ink-soft);
  max-width: 32ch;
  margin: 0;
}

.btn-complete {
  background: transparent;
  color: var(--ink-faint);
  border: 1px dashed var(--line-strong);
  border-radius: 999px;
  padding: 4px 12px;
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-complete:hover {
  border-color: var(--gold);
  color: var(--gold);
}

.btn-complete--done {
  background: var(--gold-bg);
  color: var(--gold-dark);
  border-color: var(--gold-light);
  border-style: solid;
}

.btn-complete--done:hover {
  background: var(--gold-light);
  color: var(--navy);
}
</style>
