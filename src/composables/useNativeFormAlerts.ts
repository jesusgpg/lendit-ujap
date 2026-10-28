import { onBeforeUnmount, onMounted } from 'vue'
import { ref } from 'vue'

type ValidatableField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

function isValidatableField(element: Element): element is ValidatableField {
  return element instanceof HTMLInputElement
    || element instanceof HTMLSelectElement
    || element instanceof HTMLTextAreaElement
}

function fieldLabel(field: ValidatableField) {
  const label = field.labels?.[0]?.textContent?.replace(/\s+/g, ' ').trim()
  const placeholder = 'placeholder' in field ? field.placeholder : ''
  return label || field.getAttribute('aria-label')?.trim() || field.name || placeholder || 'campo requerido'
}

export function useNativeFormAlerts() {
  const formAlert = ref('')
  const fieldsFromNativeValidation = new Set<string>()
  let notificationTimer: ReturnType<typeof setTimeout> | null = null

  function notify(fields: string[]) {
    if (!fields.length) return
    const list = [...new Set(fields)].join(', ')
    formAlert.value = `Completa o corrige: ${list}.`
  }

  function handleInvalid(event: Event) {
    const field = event.target
    if (!field || !isValidatableField(field as Element)) return

    // Keep the browser from replacing the app's visible notification with its
    // small native tooltip. The browser still focuses the invalid control.
    event.preventDefault()
    fieldsFromNativeValidation.add(fieldLabel(field as ValidatableField))
    if (notificationTimer) return

    notificationTimer = setTimeout(() => {
      notify([...fieldsFromNativeValidation])
      fieldsFromNativeValidation.clear()
      notificationTimer = null
    }, 0)
  }

  onMounted(() => {
    document.addEventListener('invalid', handleInvalid, true)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('invalid', handleInvalid, true)
    if (notificationTimer) clearTimeout(notificationTimer)
    fieldsFromNativeValidation.clear()
  })

  return { formAlert, dismissFormAlert: () => { formAlert.value = '' } }
}
