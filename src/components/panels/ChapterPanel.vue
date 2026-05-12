<template>
  <div class="chapter-panel">
    <div v-if="!chapter" class="empty-hint">
      {{ t('chapter.empty') }}
    </div>

    <div v-else class="panel-card">
      <!-- 章节标题 -->
      <div class="chapter-header">
        <span class="chapter-icon">📋</span>
        <div class="chapter-info">
          <div class="chapter-name">{{ chapter.locKey ? t(chapter.locKey) : '' }}</div>
          <div class="chapter-desc">{{ chapter.descLocKey ? t(chapter.descLocKey) : '' }}</div>
        </div>
      </div>

      <!-- 任务清单 -->
      <div class="tasks-section">
        <div class="tasks-title">{{ t('chapter.tasks.title') }}</div>
        <div class="task-list">
          <div
            v-for="task in currentTasks"
            :key="task.id"
            class="task-row"
            :class="{ 'task-row--done': task.completed }"
          >
            <span class="task-check">{{ task.completed ? '✅' : '☐' }}</span>
            <span class="task-desc">{{ t(task.locKey) }}</span>
            <span class="task-progress">
              <template v-if="!task.completed">
                <template v-if="isMultiResourceTask(task)">
                  <span
                    v-for="(p, i) in getMultiResourceProgress(task)"
                    :key="i"
                    class="sub-progress"
                  >
                    {{ t('res.' + p.resourceId) }}[{{ p.current }}/{{ p.target }}]
                  </span>
                </template>
                <template v-else-if="task.type === TaskType.PRODUCE_STEAM">
                  [{{ steamStore.totalProducedMb }}/{{ task.para1 }}]
                </template>
                <template v-else>
                  [{{ getTaskCurrent(task) }}/{{ task.para2 ?? task.para1 }}]
                </template>
              </template>
            </span>
          </div>
        </div>
      </div>

      <!-- 章节已完成 -->
      <div v-if="allTasksDone" class="chapter-complete">
        <span class="complete-icon">🎉</span> {{ t('chapter.tasks.all_done') }}
        <button class="advance-btn" @click="progressionStore.advanceToNextChapter()">
          {{ t('chapter.advance') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useProgressionStore } from '../../stores/progressionStore'
import { useTaskStore } from '../../stores/taskStore'
import { usePowerStore } from '../../stores/powerStore'
import { useSteamStore } from '../../stores/steamStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useMachineStore } from '../../stores/machineStore'
import { t } from '../../data/i18n'
import { TaskType } from '../../data/types'
import type { TaskWithStatus } from '../../stores/taskStore'

const progressionStore = useProgressionStore()
const taskStore        = useTaskStore()
const powerStore       = usePowerStore()
const steamStore       = useSteamStore()
const inventoryStore   = useInventoryStore()
const machineStore     = useMachineStore()

const chapter = computed(() => progressionStore.currentChapter)

const currentTasks = computed<TaskWithStatus[]>(() => {
  if (!chapter.value) return []
  return taskStore.getTasksWithStatus(chapter.value.taskIds)
})

const allTasksDone = computed(() =>
  currentTasks.value.length > 0 && currentTasks.value.every((task: TaskWithStatus) => task.completed)
)

function getTaskCurrent(task: TaskWithStatus): string | number {
  switch (task.type) {
    case TaskType.HAVE_ITEM:
    case TaskType.PRODUCE_TOTAL:
      if (task.para1.includes(',')) return 0 // 多资源走 getMultiResourceProgress
      return Math.floor((task.type === TaskType.HAVE_ITEM
        ? inventoryStore.getAmount(task.para1)
        : inventoryStore.totalProduced[task.para1]) ?? 0)

    case TaskType.BUILD_MACHINE:
      return machineStore.instances.filter((m: { defId: string }) => m.defId === task.para1).length

    case TaskType.REACH_EU_PER_SEC:
      return Math.floor(powerStore.totalGenPerSec)

    case TaskType.HAVE_TOOL:
      return 0 // 工具等级任务不需要进度数字显示

    case TaskType.OWN_MACHINE:
      return machineStore.instances.filter((m: { defId: string }) => m.defId === task.para1).length

    case TaskType.PRODUCE_STEAM:
      return steamStore.totalProducedMb

    default:
      return 0
  }
}

function isMultiResourceTask(task: TaskWithStatus): boolean {
  return task.type === TaskType.PRODUCE_TOTAL && task.para1.includes(',')
}

interface ResourceProgress {
  resourceId: string
  current: number
  target: number
}

function getMultiResourceProgress(task: TaskWithStatus): ResourceProgress[] {
  const resourceIds = task.para1.split(',')
  const amounts = (task.para2 ?? '').split(',').map((v) => Number(v) || 0)
  return resourceIds.map((rid, i) => ({
    resourceId: rid,
    current: Math.floor(inventoryStore.totalProduced[rid] ?? 0),
    target: amounts[i] ?? 0,
  }))
}
</script>

<style scoped>
.chapter-panel {
  font-family: 'Consolas', 'Courier New', monospace;
  color: var(--text-primary);
}

.panel-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  padding: 16px 18px;
}

.chapter-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;
}

.chapter-icon {
  font-size: 20px;
  line-height: 1.2;
}

.chapter-info {
  flex: 1 1 auto;
}

.chapter-name {
  font-size: 15px;
  font-weight: bold;
  color: var(--accent);
  margin-bottom: 4px;
}

.chapter-desc {
  font-size: 12px;
  color: #888;
  line-height: 1.5;
}

/* Tasks */
.tasks-section {
  margin-top: 4px;
}

.tasks-title {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-row {
  display: grid;
  grid-template-columns: 24px 1fr auto;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 5px 0;
  border-bottom: 1px solid #333;
}

.task-row:last-child {
  border-bottom: none;
}

.task-row--done .task-desc {
  color: #666;
  text-decoration: line-through;
}

.task-check {
  font-size: 14px;
  text-align: center;
}

.task-desc {
  color: var(--text-primary);
}

.task-progress {
  font-size: 11px;
  color: var(--warn);
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.sub-progress {
  white-space: nowrap;
}

/* Chapter complete */
.chapter-complete {
  margin-top: 16px;
  padding: 12px 16px;
  background: var(--accent-subtle);
  border: 1px solid var(--accent);
  color: var(--accent);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.complete-icon {
  margin-right: 4px;
}

.advance-btn {
  background: var(--accent);
  color: var(--bg-panel);
  border: none;
  padding: 6px 16px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  border-radius: 3px;
}

.advance-btn:hover {
  opacity: 0.85;
}

.empty-hint {
  color: #555;
  font-size: 12px;
  padding: 8px 0;
}
</style>
