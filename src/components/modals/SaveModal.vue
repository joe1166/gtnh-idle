<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-box">
        <!-- Header -->
        <div class="modal-header">
          <span class="header-title">💾 存档管理</span>
          <button class="close-x" @click="emit('close')">✕</button>
        </div>

        <!-- Last save time -->
        <div class="last-save-info">
          上次存档：{{ lastSaveLabel }}
        </div>

        <!-- 手动存档 -->
        <div class="section">
          <button class="action-btn action-btn--primary" @click="handleSave">
            立即存档
          </button>
          <span v-if="justSaved" class="save-ok">✓ 已保存</span>
        </div>

        <div class="divider"></div>

        <!-- 导出存档 -->
        <div class="section">
          <div class="section-title">导出存档</div>
          <button class="action-btn" @click="handleExport">生成存档码</button>
          <div v-if="exportedCode" class="export-area">
            <textarea
              class="code-textarea"
              readonly
              :value="exportedCode"
              @click="($event.target as HTMLTextAreaElement).select()"
              rows="4"
            ></textarea>
            <button class="action-btn action-btn--small" @click="copyCode">
              {{ copied ? '✓ 已复制' : '复制' }}
            </button>
          </div>
        </div>

        <div class="divider"></div>

        <!-- 导入存档 -->
        <div class="section">
          <div class="section-title">导入存档</div>
          <textarea
            class="code-textarea"
            v-model="importCode"
            placeholder="在此粘贴存档码..."
            rows="4"
          ></textarea>
          <div class="import-actions">
            <button
              class="action-btn action-btn--primary"
              :disabled="!importCode.trim()"
              @click="handleImport"
            >
              导入并刷新
            </button>
            <span v-if="importError" class="import-error">{{ importError }}</span>
          </div>
        </div>

        <div class="divider"></div>

        <!-- 删除存档 -->
        <div class="section">
          <div class="section-title delete-title">危险操作</div>
          <button
            v-if="!confirmDelete"
            class="action-btn action-btn--danger"
            @click="confirmDelete = true"
          >
            删除存档
          </button>
          <div v-else class="confirm-delete">
            <span class="confirm-text">确定要删除所有存档吗？此操作不可撤销。</span>
            <div class="confirm-buttons">
              <button class="action-btn action-btn--danger" @click="handleDelete">确认删除</button>
              <button class="action-btn" @click="confirmDelete = false">取消</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useGameStore } from '../../stores/gameStore'
import { useSaveLoad } from '../../composables/useSaveLoad'
import { fmtTime } from '../../utils/format'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const gameStore = useGameStore()
const { save, exportSave, importSave, deleteSave } = useSaveLoad()

const exportedCode = ref('')
const importCode = ref('')
const importError = ref('')
const confirmDelete = ref(false)
const justSaved = ref(false)
const copied = ref(false)

// Reset state when modal opens
watch(
  () => props.show,
  (val) => {
    if (val) {
      exportedCode.value = ''
      importCode.value = ''
      importError.value = ''
      confirmDelete.value = false
      justSaved.value = false
      copied.value = false
    }
  }
)

const lastSaveLabel = computed(() => {
  const sec = gameStore.secondsSinceLastSave
  if (sec < 5) return '刚刚'
  return `${fmtTime(sec)}前`
})

function handleSave() {
  save()
  justSaved.value = true
  setTimeout(() => { justSaved.value = false }, 2000)
}

function handleExport() {
  exportedCode.value = exportSave()
}

async function copyCode() {
  if (!exportedCode.value) return
  try {
    await navigator.clipboard.writeText(exportedCode.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Fallback: select the textarea
    const ta = document.querySelector('.export-area .code-textarea') as HTMLTextAreaElement | null
    ta?.select()
  }
}

function handleImport() {
  importError.value = ''
  const code = importCode.value.trim()
  if (!code) return
  const ok = importSave(code)
  if (!ok) {
    importError.value = '存档码无效，请检查后重试。'
  }
  // On success, importSave calls location.reload()
}

function handleDelete() {
  deleteSave()
  confirmDelete.value = false
  emit('close')
  location.reload()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  font-family: 'Consolas', 'Courier New', monospace;
}

.modal-box {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  padding: 20px 24px;
  min-width: 380px;
  max-width: 520px;
  width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  color: var(--text-primary);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.header-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
}

.close-x {
  background: none;
  border: none;
  color: #666;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.15s;
}

.close-x:hover {
  color: var(--text-primary);
}

.last-save-info {
  font-size: 11px;
  color: #666;
  margin-bottom: 14px;
}

.divider {
  height: 1px;
  background: var(--border-color);
  margin: 14px 0;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 12px;
  color: #888;
  margin-bottom: 2px;
}

.delete-title {
  color: var(--accent-red);
}

.action-btn {
  background: #333;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px 14px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
  align-self: flex-start;
}

.action-btn:hover:not(:disabled) {
  background: #444;
}

.action-btn:disabled {
  color: #555;
  cursor: not-allowed;
}

.action-btn--primary {
  background: #2a3a2a;
  border-color: var(--accent-green);
  color: var(--accent-green);
}

.action-btn--primary:hover:not(:disabled) {
  background: #334433;
}

.action-btn--danger {
  background: #3a2020;
  border-color: var(--accent-red);
  color: var(--accent-red);
}

.action-btn--danger:hover:not(:disabled) {
  background: #4a2a2a;
}

.action-btn--small {
  padding: 3px 10px;
  font-size: 11px;
  align-self: auto;
}

.export-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.code-textarea {
  background: #1a1a1a;
  border: 1px solid var(--border-color);
  color: #aaa;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 10px;
  padding: 8px;
  resize: vertical;
  width: 100%;
  box-sizing: border-box;
  outline: none;
  word-break: break-all;
}

.code-textarea:focus {
  border-color: var(--accent-green);
}

.code-textarea::placeholder {
  color: #444;
}

.import-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.import-error {
  font-size: 11px;
  color: var(--accent-red);
}

.save-ok {
  font-size: 12px;
  color: var(--accent-green);
  align-self: center;
}

.confirm-delete {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgba(244, 67, 54, 0.08);
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.confirm-text {
  font-size: 12px;
  color: #ccc;
}

.confirm-buttons {
  display: flex;
  gap: 8px;
}
</style>
