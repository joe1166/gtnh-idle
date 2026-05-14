<template>
  <Teleport to="body">
    <div v-if="isOpen" class="dev-console">
      <div class="dev-header">
        <span class="dev-title">&#9881; Dev Console</span>
        <button class="dev-close" @click="close()">&#x2715;</button>
      </div>

      <!-- ── Tabs ── -->
      <div class="dev-tabs">
        <button :class="{ active: tab === 'flags' }" @click="tab = 'flags'">功能</button>
        <button :class="{ active: tab === 'console' }" @click="tab = 'console'">控制台</button>
      </div>

      <!-- ── 功能开关 ── -->
      <div v-if="tab === 'flags'" class="dev-body">
        <label class="dev-row">
          <input type="checkbox" v-model="highlightHitAreas" />
          <span>高亮热区轮廓</span>
        </label>
        <label class="dev-row">
          <input type="checkbox" v-model="mineReveal" />
          <span>矿透</span>
        </label>
      </div>

      <!-- ── 命令行 ── -->
      <div v-if="tab === 'console'" class="dev-body dev-console-body">
        <div class="dev-output" ref="outputEl">
          <div v-for="(line, i) in outputLines" :key="i" :class="'dev-line ' + (line.startsWith('✓') ? 'dev-ok' : line.startsWith('✗') ? 'dev-err' : line.startsWith('> ') ? 'dev-cmd' : '')">{{ line }}</div>
        </div>
        <div class="dev-cmd-row">
          <span class="dev-prompt">&gt;</span>
          <input
            ref="cmdInput"
            v-model="cmdLine"
            class="dev-cmd-input"
            placeholder="help"
            @keydown.enter="execCmd()"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useDevConsole } from '../../composables/useDevConsole'

const { isOpen, highlightHitAreas, mineReveal, runCommand } = useDevConsole()

const tab = ref<'flags' | 'console'>('flags')
const cmdLine = ref('')
const outputLines = ref<string[]>([])
const cmdInput = ref<HTMLInputElement | null>(null)
const outputEl = ref<HTMLElement | null>(null)

function close() { isOpen.value = false }

function execCmd() {
  const input = cmdLine.value.trim()
  if (!input) return
  outputLines.value.push(`> ${input}`)
  const result = runCommand(input)
  outputLines.value.push(...result.split('\n'))
  cmdLine.value = ''
  nextTick(() => {
    outputEl.value?.scrollTo(0, outputEl.value.scrollHeight)
  })
}

watch(tab, (val) => {
  if (val === 'console') nextTick(() => cmdInput.value?.focus())
})
</script>

<style scoped>
.dev-console {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 9999;
  background: rgba(8, 8, 8, 0.96);
  border: 1px solid #4a9eff;
  border-radius: 6px;
  width: 360px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  color: #ccc;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dev-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  background: rgba(74, 158, 255, 0.12);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  flex-shrink: 0;
}

.dev-title { color: #4a9eff; font-weight: bold; }

.dev-close {
  background: none;
  border: none;
  color: #555;
  cursor: pointer;
  font-size: 11px;
}
.dev-close:hover { color: #ccc; }

/* ── Tabs ── */
.dev-tabs {
  display: flex;
  background: rgba(74, 158, 255, 0.08);
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  flex-shrink: 0;
}
.dev-tabs button {
  flex: 1;
  background: none;
  border: none;
  color: #777;
  font-size: 12px;
  padding: 5px 8px;
  cursor: pointer;
  font-family: inherit;
}
.dev-tabs button:hover { color: #ccc; }
.dev-tabs button.active { color: #4a9eff; background: rgba(74, 158, 255, 0.12); }

/* ── 功能面板 ── */
.dev-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── 命令行 ── */
.dev-console-body {
  padding: 8px;
  gap: 6px;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dev-output {
  flex: 1;
  overflow-y: auto;
  max-height: 260px;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.dev-line {
  color: #ccc;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.4;
}
.dev-line.dev-ok { color: #6f9; }
.dev-line.dev-err { color: #f66; }
.dev-line.dev-cmd { color: #4a9eff; }

.dev-cmd-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 3px;
  padding: 3px 6px;
}

.dev-prompt { color: #4a9eff; font-weight: bold; flex-shrink: 0; }

.dev-cmd-input {
  flex: 1;
  background: none;
  border: none;
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  outline: none;
  caret-color: #4a9eff;
}
.dev-cmd-input::placeholder { color: #555; }

/* ── 功能行 ── */
.dev-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #ccc;
  user-select: none;
}
.dev-row input[type="checkbox"] { accent-color: #4a9eff; cursor: pointer; width: 13px; height: 13px; }
.dev-row:hover span { color: #fff; }
</style>