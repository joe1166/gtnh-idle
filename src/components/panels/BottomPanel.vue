<template>
  <div class="bottom-panel-wrapper">
    <!-- ── 页签栏（始终显示） ── -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === tab.id && !collapsed }"
        @click="handleTabClick(tab.id)"
      >
        {{ t(tab.locKey) }}
      </button>
    </div>

    <!-- ── 面板内容区（折叠时隐藏） ── -->
    <div v-show="!collapsed" class="panel-content">
      <BiomeSwitchPanel v-if="activeTab === 'biome'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { t } from '../../data/i18n'
import BiomeSwitchPanel from './BiomeSwitchPanel.vue'

interface Tab {
  id: string
  locKey: string
}

const tabs: Tab[] = [
  { id: 'biome', locKey: 'panel.biome.title' },
]

const activeTab  = ref('biome')
const collapsed  = ref(true)

function handleTabClick(tabId: string) {
  if (collapsed.value) {
    // 收起状态 → 展开并激活对应页签
    collapsed.value = false
    activeTab.value = tabId
  } else if (activeTab.value === tabId) {
    // 同页签点击 → 收起
    collapsed.value = true
  } else {
    // 切换到另一页签
    activeTab.value = tabId
  }
}
</script>

<style scoped>
.bottom-panel-wrapper {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.tab-bar {
  display: flex;
  justify-content: center;
  gap: 2px;
  pointer-events: all;
  background: rgba(15, 15, 15, 0.85);
  backdrop-filter: blur(4px);
}

.tab-btn {
  flex: 1;
  padding: 6px 16px;
  background: rgba(20, 20, 20, 0.9);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  color: #888;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.tab-btn:hover {
  background: rgba(35, 35, 35, 0.9);
  color: #ccc;
}

.tab-btn--active {
  background: rgba(12, 12, 12, 0.95);
  color: #e8e8e8;
  border-color: var(--border-strong);
}

.panel-content {
  pointer-events: all;
  width: 100%;
  background: rgba(12, 12, 12, 0.92);
  border-top: 1px solid var(--border);
}

/* 让子面板内容填满宽度 */
.panel-content :deep(.biome-panel-wrapper) {
  position: static;
}
</style>
