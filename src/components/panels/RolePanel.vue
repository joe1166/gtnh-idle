<template>
  <div class="role-panel">
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'tools' }"
        @click="activeTab = 'tools'"
      >
        {{ t('panel.role.tab_tools') }}
      </button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'equip' }"
        @click="activeTab = 'equip'"
      >
        {{ t('panel.role.tab_equip') }}
      </button>
    </div>

    <div class="panel-body">
      <div v-if="activeTab === 'tools'" class="panel-fill panel-fill--tools">
        <ToolPanel />
      </div>
      <div v-else class="panel-fill panel-fill--equip">
        <EquipmentPanel />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { t } from '../../data/i18n'
import ToolPanel from './ToolPanel.vue'
import EquipmentPanel from './EquipmentPanel.vue'

const activeTab = ref<'tools' | 'equip'>('tools')
</script>

<style scoped>
.role-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tab-bar {
  display: flex;
  width: 100%;
  background: var(--bg-panel);
}

.tab-btn {
  flex: 1;
  border: none;
  border-right: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  padding: 10px 12px;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 13px;
  text-transform: uppercase;
}

.tab-btn:last-child {
  border-right: none;
}

.tab-btn--active {
  color: var(--accent);
  background: var(--accent-bg);
}

.panel-body {
  flex: 1;
  min-height: 0;
  background: transparent;
  overflow: auto;
}

.panel-fill {
  width: 100%;
  height: auto;
  min-height: 0;
}

.panel-fill--equip {
  height: 100%;
}
</style>
