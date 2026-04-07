<template>
  <div class="chapter-panel">
    <div v-if="!chapter" class="empty-hint">
      暂无章节数据。
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

      <!-- 章节解锁目标 -->
      <div v-if="chapter.unlockCondition.type === 'eu_per_sec'" class="unlock-goal">
        <div class="goal-label">章节目标：发电量达到 {{ chapter.unlockCondition.value }} EU/s</div>
        <div class="goal-progress-row">
          <div class="goal-bar-wrap">
            <div
              class="goal-bar-fill"
              :style="{ width: euProgressPct + '%' }"
            ></div>
          </div>
          <span class="goal-nums">
            {{ fmt(powerStore.totalGenPerSec) }} / {{ chapter.unlockCondition.value }} EU/s
          </span>
        </div>
      </div>

      <!-- 任务清单 -->
      <div class="tasks-section">
        <div class="tasks-title">任务清单：</div>
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
                [{{ getTaskCurrent(task) }}/{{ task.para2 ?? task.para1 }}]
              </template>
            </span>
          </div>
        </div>
      </div>

      <!-- 章节已完成 -->
      <div v-if="allTasksDone" class="chapter-complete">
        <span class="complete-icon">🎉</span> 本章所有任务已完成！
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useProgressionStore } from '../../stores/progressionStore'
import { useTaskStore } from '../../stores/taskStore'
import { usePowerStore } from '../../stores/powerStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useMachineStore } from '../../stores/machineStore'
import { t } from '../../data/i18n'
import { fmt } from '../../utils/format'
import { TaskType } from '../../data/types'
import type { TaskWithStatus } from '../../stores/taskStore'

const progressionStore = useProgressionStore()
const taskStore        = useTaskStore()
const powerStore       = usePowerStore()
const inventoryStore   = useInventoryStore()
const machineStore     = useMachineStore()

const chapter = computed(() => progressionStore.currentChapter)

const currentTasks = computed<TaskWithStatus[]>(() => {
  if (!chapter.value) return []
  return taskStore.getTasksWithStatus(chapter.value.taskIds)
})

const euProgressPct = computed(() => {
  const goal = chapter.value?.unlockCondition?.value
  if (!goal) return 0
  return Math.min(100, (powerStore.totalGenPerSec / goal) * 100)
})

const allTasksDone = computed(() =>
  currentTasks.value.length > 0 && currentTasks.value.every((t) => t.completed)
)

function getTaskCurrent(task: TaskWithStatus): string | number {
  switch (task.type) {
    case TaskType.HAVE_ITEM:
      return Math.floor(inventoryStore.getAmount(task.para1))

    case TaskType.PRODUCE_TOTAL:
      return Math.floor(inventoryStore.totalProduced[task.para1] ?? 0)

    case TaskType.BUILD_MACHINE:
      return machineStore.instances.filter((m) => m.defId === task.para1).length

    case TaskType.REACH_EU_PER_SEC:
      return Math.floor(powerStore.totalGenPerSec)

    default:
      return 0
  }
}
</script>

<style scoped>
.chapter-panel {
  font-family: 'Consolas', 'Courier New', monospace;
  color: var(--text-primary);
}

.panel-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
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
  color: var(--accent-green);
  margin-bottom: 4px;
}

.chapter-desc {
  font-size: 12px;
  color: #888;
  line-height: 1.5;
}

/* Unlock goal */
.unlock-goal {
  background: #222;
  border: 1px solid var(--border-color);
  padding: 10px 12px;
  margin-bottom: 16px;
}

.goal-label {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 6px;
}

.goal-progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.goal-bar-wrap {
  flex: 1 1 auto;
  height: 8px;
  background: #333;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.goal-bar-fill {
  height: 100%;
  background: var(--accent-green);
  transition: width 0.4s ease;
}

.goal-nums {
  font-size: 11px;
  color: var(--accent-yellow);
  white-space: nowrap;
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
  color: var(--accent-yellow);
  white-space: nowrap;
}

/* Chapter complete */
.chapter-complete {
  margin-top: 16px;
  padding: 10px 12px;
  background: rgba(76, 175, 80, 0.1);
  border: 1px solid var(--accent-green);
  color: var(--accent-green);
  font-size: 13px;
  text-align: center;
}

.complete-icon {
  margin-right: 6px;
}

.empty-hint {
  color: #555;
  font-size: 12px;
  padding: 8px 0;
}
</style>
