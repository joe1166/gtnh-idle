<template>
  <div class="prospector">
    <div class="prospector-header">
      <span>{{ t('mine.prospector.title') }}</span>
      <span v-if="prospectorLevel > 0" class="prospector-level">Lv.{{ prospectorLevel }}</span>
    </div>

    <template v-if="prospectorAbility <= 0">
      <p class="prospector-hint">{{ t('mine.prospector.no_tool') }}</p>
    </template>

    <template v-else>
      <button
        class="scan-btn"
        :disabled="store.prospectorCooldown > 0 || store.stamina <= 0"
        @click="store.useProspector()"
      >
        <template v-if="store.prospectorCooldown > 0">
          {{ t('mine.prospector.cooldown') }} {{ store.prospectorCooldown }}s
        </template>
        <template v-else>
          {{ t('mine.prospector.scan') }}
        </template>
      </button>

      <div v-if="store.prospectorResult" class="prospector-result">
        <template v-if="store.prospectorResult.abundance === 'empty'">
          <span class="result-none">{{ t('mine.prospector.result.none') }}</span>
        </template>
        <template v-else>
          <span class="result-label">{{ t('mine.prospector.result.prefix') }}</span>
          <span class="result-block">{{ nearestBlockName }}</span>
          <div class="result-abundance">
            <span
              class="abundance-dot"
              v-for="i in 4"
              :key="i"
              :class="{ filled: i <= abundanceDots }"
            />
            <span class="abundance-text">{{ abundanceText }}</span>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMineStore } from '../../stores/mineStore'
import { useToolStore } from '../../stores/toolStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'

const store     = useMineStore()
const toolStore = useToolStore()

const prospectorAbility = computed(() => toolStore.getAbility('prospector_ability'))
const prospectorLevel = computed(() => {
  const ability = prospectorAbility.value
  if (ability >= 8) return 3
  if (ability >= 5) return 2
  if (ability > 0) return 1
  return 0
})

const nearestBlockName = computed(() => {
  const blockId = store.prospectorResult?.nearestBlockId
  if (!blockId) return ''
  const def = db.get('mine_blocks', blockId)
  return def ? t(def.locKey) : blockId
})

const abundanceDots = computed(() => {
  switch (store.prospectorResult?.abundance) {
    case 'rich':     return 4
    case 'moderate': return 3
    case 'scarce':   return 2
    default:         return 0
  }
})

const abundanceText = computed(() => {
  const a = store.prospectorResult?.abundance
  if (!a) return ''
  return t(`mine.prospector.abundance.${a}`)
})
</script>

<style scoped>
.prospector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prospector-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
  padding-bottom: 6px;
}

.prospector-level {
  font-size: 0.75em;
  background: var(--accent);
  color: #000;
  padding: 1px 6px;
  border-radius: 10px;
}

.prospector-hint {
  color: var(--text-secondary);
  font-size: 0.85em;
}

.scan-btn {
  background: var(--bg-base);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px;
  font-family: var(--font-mono);
  transition: background 0.15s;
}
.scan-btn:hover:not(:disabled) {
  background: #3a3a3a;
}
.scan-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.prospector-result {
  background: #1e1e1e;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px;
  font-size: 0.85em;
}

.result-label {
  color: var(--text-secondary);
  display: block;
  margin-bottom: 2px;
}

.result-block {
  color: var(--warn);
  font-weight: bold;
}

.result-none {
  color: var(--text-secondary);
}

.result-abundance {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.abundance-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: #333;
  border: 1px solid #555;
}
.abundance-dot.filled {
  background: var(--warn);
  border-color: var(--warn);
}

.abundance-text {
  color: var(--text-secondary);
  margin-left: 4px;
}
</style>
