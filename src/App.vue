<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useGameLoop } from './composables/useGameLoop'
import { useSaveLoad } from './composables/useSaveLoad'
import { useOfflineProgress } from './composables/useOfflineProgress'
import { useGameStore } from './stores/gameStore'
import type { OfflineReport } from './composables/useOfflineProgress'

import TopBar from './components/layout/TopBar.vue'
import ToastContainer from './components/ToastContainer.vue'
import SideNav from './components/layout/SideNav.vue'
import SteamPanel from './components/panels/SteamPanel.vue'
import PowerPanel from './components/panels/PowerPanel.vue'
import MiningPanel from './components/panels/MiningPanel.vue'
import CraftingPanel from './components/panels/CraftingPanel.vue'
import InventoryPanel from './components/panels/InventoryPanel.vue'
import ChapterPanel from './components/panels/ChapterPanel.vue'
import TechPanel from './components/panels/TechPanel.vue'
import OfflineModal from './components/modals/OfflineModal.vue'
import SaveModal from './components/modals/SaveModal.vue'

const { initGame, start } = useGameLoop()
const { load, save } = useSaveLoad()
const { simulate } = useOfflineProgress()
const gameStore = useGameStore()

// 面板切换
const activePanel = ref('chapter')

// 离线弹窗
const showOfflineModal = ref(false)
const offlineReport = ref<OfflineReport | null>(null)

// 存档弹窗
const showSaveModal = ref(false)

let loopId: ReturnType<typeof setInterval>

onMounted(async () => {
  // 1. 初始化游戏数据（注册静态数据到各store）
  initGame()

  // 2. 尝试加载存档
  const saveResult = load()

  // 3. 启动游戏循环
  loopId = start()

  // 4. 如果有存档且离线超过10秒，触发离线模拟
  if (saveResult.success && saveResult.offlineSeconds > 10) {
    const report = await simulate(saveResult.offlineSeconds)
    offlineReport.value = report
    showOfflineModal.value = true
  }
})

onUnmounted(() => {
  clearInterval(loopId)
  save()  // 退出时保存
})
</script>

<template>
  <!-- 整体布局：顶栏 + 左导航 + 主面板 -->
  <div class="app-container">
    <TopBar @open-save="showSaveModal = true" />
    <div class="main-layout">
      <SideNav v-model="activePanel" />
      <main class="panel-container">
        <SteamPanel v-if="activePanel === 'steam'" />
        <PowerPanel v-if="activePanel === 'power'" />
        <MiningPanel v-if="activePanel === 'mining'" />
        <CraftingPanel v-if="activePanel === 'crafting'" />
        <InventoryPanel v-if="activePanel === 'inventory'" />
        <ChapterPanel v-if="activePanel === 'chapter'" />
        <TechPanel v-if="activePanel === 'tech'" />
      </main>
    </div>

    <!-- 离线模拟进度遮罩（模拟期间显示） -->
    <div v-if="gameStore.isSimulatingOffline" class="sim-overlay">
      <div class="sim-box">
        <p>正在模拟离线进度...</p>
        <div class="sim-bar">
          <div :style="{ width: gameStore.offlineSimProgress + '%' }"></div>
        </div>
        <p>{{ gameStore.offlineSimProgress }}%</p>
      </div>
    </div>

    <ToastContainer />
    <OfflineModal
      v-if="offlineReport !== null"
      :show="showOfflineModal"
      :report="offlineReport"
      @close="showOfflineModal = false"
    />
    <SaveModal
      :show="showSaveModal"
      @close="showSaveModal = false"
    />
  </div>
</template>

<style>
/* 全局布局 */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding-top: 48px; /* TopBar height */
}
.main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.panel-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
  padding: 16px;
}
.sim-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.8);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.sim-box {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  padding: 32px; border-radius: 8px; text-align: center;
  min-width: 300px;
}
.sim-bar {
  height: 8px; background: #333; border-radius: 4px; margin: 12px 0; overflow: hidden;
}
.sim-bar > div {
  height: 100%; background: var(--accent-green); transition: width 0.3s;
}
</style>
