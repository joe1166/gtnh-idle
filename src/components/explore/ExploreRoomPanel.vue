<template>
  <div class="room-panel">
    <div class="panel-title">
      {{ t('explore.panel.room') }}
      <span class="mode-tag">{{ modeText }}</span>
    </div>

    <div v-if="currentRoom" class="room-info">
      <div class="room-name">{{ roomName }}</div>
      <div class="room-desc">{{ roomDesc }}</div>

      <template v-if="store.mode === 'explore'">
        <button
          v-if="canLoot && !isLooting"
          class="btn-loot"
          @click="startLoot()"
        >
          {{ t('explore.action.loot') }}
        </button>
        <div v-if="isLooting" class="loot-progress-wrap">
          <div class="loot-progress-text">{{ t('explore.action.loot') }}...</div>
          <div class="loot-progress-track">
            <div class="loot-progress-fill" :style="{ width: `${lootProgress}%` }" />
          </div>
        </div>
        <div
          v-if="roomLootEntries.length > 0"
          class="loot-room-box"
        >
          <div class="loot-room-title">{{ t('explore.loot.room_title') }}</div>
          <div
            v-for="entry in roomLootEntries"
            :key="entry.resourceId"
            class="loot-room-row"
          >
            <span>{{ entry.name }}</span>
            <span>+{{ entry.amount }}</span>
          </div>
        </div>
      </template>

      <template v-else-if="store.mode === 'event'">
        <div class="event-box">
          <div class="event-text">{{ eventText }}</div>
          <div class="event-actions">
            <button
              v-for="opt in eventOptions"
              :key="opt.key"
              class="btn-event"
              @click="store.chooseEventOption(opt.key)"
            >
              {{ t(opt.textLocKey) }}
            </button>
            <button
              v-if="eventOptions.length === 0"
              class="btn-event"
              @click="store.advanceEvent()"
            >
              {{ t('explore.event.continue') }}
            </button>
          </div>
        </div>
      </template>

      <template v-else-if="store.mode === 'combat'">
        <div class="combat-box">
          <div class="combat-title">{{ t('explore.combat.enemies') }}</div>
          <div
            v-for="enemy in aliveEnemies"
            :key="enemy.id + '-' + enemy.hp"
            class="enemy-row"
          >
            <span>{{ t(enemy.nameLocKey) }}</span>
            <span>{{ enemy.hp }}/{{ enemy.maxHp }}</span>
          </div>
          <div class="combat-log">{{ store.currentRoundLog || t('explore.combat.running') }}</div>
          <button class="btn-flee" @click="store.fleeCombat()">
            {{ t('explore.combat.flee') }}
          </button>
        </div>
      </template>
    </div>

    <button class="btn-exit" :disabled="store.mode === 'combat'" @click="store.openExitDialog()">
      {{ t('explore.action.exit') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { useExploreStore } from '../../stores/exploreStore'
import { db } from '../../data/db'
import { t } from '../../data/i18n'

const store = useExploreStore()
const currentRoom = computed(() => store.currentRoom)
const isLooting = ref(false)
const lootProgress = ref(0)
let lootTimer: number | null = null

const modeText = computed(() => {
  if (store.mode === 'event') return t('explore.mode.event')
  if (store.mode === 'combat') return t('explore.mode.combat')
  if (store.mode === 'result') return t('explore.mode.result')
  return t('explore.mode.explore')
})

const roomName = computed(() => {
  const room = currentRoom.value
  if (!room) return ''
  if (room.defId === 'entry') return t('mine.node.entrance')
  const def = db.get('explore_rooms', room.defId)
  return def ? t(def.locKey) : room.defId
})

const roomDesc = computed(() => {
  const room = currentRoom.value
  if (!room || room.defId === 'entry') return t('explore.room.entry_desc')
  const def = db.get('explore_rooms', room.defId)
  return def ? t(def.descLocKey) : ''
})

const canLoot = computed(() => {
  const room = currentRoom.value
  if (!room || room.looted || room.defId === 'entry') return false
  const def = db.get('explore_rooms', room.defId)
  return !!def && (def.rewardId ?? 0) > 0
})

const eventText = computed(() => {
  const node = store.currentEventNode
  if (!node) return t('explore.event.empty')
  return t(node.textLocKey)
})

const eventOptions = computed(() => {
  const node = store.currentEventNode
  if (!node) return [] as Array<{ key: 'A' | 'B' | 'C'; textLocKey: string }>
  const options: Array<{ key: 'A' | 'B' | 'C'; textLocKey: string }> = []
  if (node.optionATextLocKey) options.push({ key: 'A', textLocKey: node.optionATextLocKey })
  if (node.optionBTextLocKey) options.push({ key: 'B', textLocKey: node.optionBTextLocKey })
  if (node.optionCTextLocKey) options.push({ key: 'C', textLocKey: node.optionCTextLocKey })
  return options
})

const aliveEnemies = computed(() => {
  const room = currentRoom.value
  if (!room?.enemies) return []
  return room.enemies.filter(e => e.hp > 0)
})

const roomLootEntries = computed(() => {
  const room = currentRoom.value
  if (!room?.roomLoot) return [] as Array<{ resourceId: string; name: string; amount: number }>
  return Object.entries(room.roomLoot)
    .map(([resourceId, amount]) => ({
      resourceId,
      amount,
      name: db.name('resources', resourceId),
    }))
    .sort((a, b) => b.amount - a.amount)
})

function clearLootTimer(): void {
  if (lootTimer != null) {
    window.clearInterval(lootTimer)
    lootTimer = null
  }
}

function startLoot(): void {
  const room = currentRoom.value
  if (!room || isLooting.value || !canLoot.value) return
  isLooting.value = true
  lootProgress.value = 0
  clearLootTimer()

  const durationMs = 700
  const stepMs = 50
  const totalSteps = Math.ceil(durationMs / stepMs)
  let step = 0

  lootTimer = window.setInterval(() => {
    step += 1
    lootProgress.value = Math.min(100, Math.round((step / totalSteps) * 100))
    if (step >= totalSteps) {
      clearLootTimer()
      store.lootRoom(room.instanceId)
      isLooting.value = false
    }
  }, stepMs)
}

onBeforeUnmount(() => {
  clearLootTimer()
})
</script>

<style scoped>
.room-panel {
  width: 320px;
  max-width: 320px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  background: var(--bg-panel);
  border-left: 1px solid var(--border);
}

.panel-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.mode-tag {
  color: var(--accent);
  font-size: 0.75rem;
}

.room-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.room-name {
  font-size: 1.1rem;
  font-weight: bold;
}

.room-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.event-box,
.combat-box {
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
}

.event-text {
  font-size: 0.86rem;
  color: var(--text-primary);
  line-height: 1.6;
}

.event-actions {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.btn-event {
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text-primary);
  cursor: pointer;
  font-family: var(--font-mono);
}

.btn-event:hover {
  background: var(--bg-hover);
}

.combat-title {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.enemy-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.84rem;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.combat-log {
  margin-top: 10px;
  font-size: 0.78rem;
  color: var(--accent);
}

.btn-flee {
  margin-top: 10px;
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--danger-border);
  color: var(--danger);
  background: var(--danger-bg);
  font-family: var(--font-mono);
  cursor: pointer;
  padding: 8px 10px;
}

.btn-flee:hover {
  background: var(--danger-border);
}

.btn-loot,
.btn-exit {
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  cursor: pointer;
  padding: 9px 12px;
}

.btn-loot {
  color: var(--accent);
  border-color: var(--accent);
  background: transparent;
}

.btn-loot:hover {
  background: var(--accent-subtle);
}

.btn-exit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.loot-progress-wrap {
  margin-top: 6px;
}

.loot-progress-text {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.loot-progress-track {
  height: 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
  background: var(--bg-base);
}

.loot-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.06s linear;
}

.loot-room-box {
  margin-top: 10px;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.02);
  padding: 8px;
}

.loot-room-title {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.loot-room-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  padding: 2px 0;
}

.btn-exit {
  margin-top: auto;
  color: var(--danger);
  border-color: var(--danger-border);
  background: var(--danger-bg);
}

.btn-exit:hover {
  background: var(--danger-border);
}
</style>
