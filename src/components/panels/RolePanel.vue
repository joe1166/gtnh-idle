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
      <ToolPanel v-if="activeTab === 'tools'" />
      <EquipmentPanel v-else />
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
}

.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
}

.tab-btn {
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text-secondary);
  padding: 6px 10px;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 12px;
}

.tab-btn--active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.panel-body {
  flex: 1;
  min-height: 0;
}
</style>
