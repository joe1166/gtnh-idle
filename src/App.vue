<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { t } from './data/i18n'
import { useGameLoop } from './composables/useGameLoop'
import { useSaveLoad } from './composables/useSaveLoad'
import { useOfflineProgress } from './composables/useOfflineProgress'
import { useGameStore } from './stores/gameStore'
import { useMineStore } from './stores/mineStore'
import { useExploreStore } from './stores/exploreStore'
import { useDevConsole } from './composables/useDevConsole'
import { PANEL_DEFS } from './data/panelConfig'
import type { OfflineReport } from './composables/useOfflineProgress'

import TopBar from './components/layout/TopBar.vue'
import ToastContainer from './components/ToastContainer.vue'
import SideNav from './components/layout/SideNav.vue'
import WorldPanel from './components/panels/WorldPanel.vue'
import SteamPanel from './components/panels/SteamPanel.vue'
import PowerPanel from './components/panels/PowerPanel.vue'
import MiningPanel from './components/panels/MiningPanel.vue'
import CraftingPanel from './components/panels/CraftingPanel.vue'
import InventoryPanel from './components/panels/InventoryPanel.vue'
import ChapterPanel from './components/panels/ChapterPanel.vue'
import TechPanel from './components/panels/TechPanel.vue'
import RolePanel from './components/panels/RolePanel.vue'
import OfflineModal from './components/modals/OfflineModal.vue'
import SaveModal from './components/modals/SaveModal.vue'
import StatsModal from './components/modals/StatsModal.vue'
import IncompatibleSaveModal from './components/modals/IncompatibleSaveModal.vue'
import DevConsole from './components/modals/DevConsole.vue'
import MineOverlay from './components/mine/MineOverlay.vue'
import ExploreOverlay from './components/overlays/ExploreOverlay.vue'

const { initGame, start } = useGameLoop()
const { load, save } = useSaveLoad()
const { simulate } = useOfflineProgress()
const gameStore = useGameStore()
const mineStore    = useMineStore()
const exploreStore = useExploreStore()
const { toggle: toggleDevConsole } = useDevConsole()

// 默认激活 order 最小的面板（由配置决定，不硬编码具体 id）
const defaultPanelId = PANEL_DEFS.reduce((min, p) => p.order < min.order ? p : min).id
const activePanel = ref(defaultPanelId)

// 世界面板全屏，不需要内边距
const isPanelFullBleed = computed(() => activePanel.value === 'world' || activePanel.value === 'role')

// 离线弹窗
const showOfflineModal = ref(false)
const offlineReport = ref<OfflineReport | null>(null)

// 存档不兼容弹窗
const showIncompatibleModal = ref(false)

// 统计弹窗 & 设置弹窗
const showStatsModal    = ref(false)
const showSettingsModal = ref(false)

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === '`') toggleDevConsole()
}

let loopId: ReturnType<typeof setInterval>

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKeydown)
  // 1. 初始化游戏数据（注册静态数据到各store）
  initGame()

  // 2. 尝试加载存档
  const saveResult = load()

  // 版本不兼容：显示提示弹窗，不启动游戏循环
  if (saveResult.incompatible) {
    showIncompatibleModal.value = true
    return
  }

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
  window.removeEventListener('keydown', onGlobalKeydown)
  clearInterval(loopId)
  save()  // 退出时保存
})
</script>

<template>
  <!-- 整体布局：顶栏 + 左导航 + 主面板 -->
  <div class="app-container">
    <TopBar />
    <div class="main-layout">
      <SideNav
        v-model="activePanel"
        @open-stats="showStatsModal = true"
        @open-settings="showSettingsModal = true"
      />
      <main class="panel-container" :class="{ 'panel-container--full-bleed': isPanelFullBleed }">
        <WorldPanel v-if="activePanel === 'world'" />
        <SteamPanel v-if="activePanel === 'steam'" />
        <PowerPanel v-if="activePanel === 'power'" />
        <MiningPanel v-if="activePanel === 'mining'" />
        <CraftingPanel v-if="activePanel === 'crafting'" />
        <InventoryPanel v-if="activePanel === 'inventory'" />
        <RolePanel v-if="activePanel === 'role'" />
        <ChapterPanel v-if="activePanel === 'chapter'" />
        <TechPanel v-if="activePanel === 'tech'" />
      </main>
    </div>

    <!-- 离线模拟进度遮罩（模拟期间显示） -->
    <div v-if="gameStore.isSimulatingOffline" class="sim-overlay">
      <div class="sim-box">
        <p>{{ t('offline.sim_overlay_label') }}</p>
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
    <StatsModal
      :show="showStatsModal"
      @close="showStatsModal = false"
    />
    <SaveModal
      :show="showSettingsModal"
      @close="showSettingsModal = false"
    />
    <IncompatibleSaveModal :show="showIncompatibleModal" />
    <DevConsole />

    <!-- 矿洞小游戏全屏覆盖层 -->
    <MineOverlay v-if="mineStore.entered" />

    <!-- 遗迹探索全屏覆盖层 -->
    <ExploreOverlay v-if="exploreStore.entered" />
  </div>
</template>

<style>
/* 全局布局 */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-base);
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
/* 世界面板全屏无内边距 */
.panel-container--full-bleed {
  padding: 0;
  overflow: hidden;
}
.sim-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.8);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.sim-box {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  padding: 32px; border-radius: 8px; text-align: center;
  min-width: 300px;
}
.sim-bar {
  height: 8px; background: #333; border-radius: 4px; margin: 12px 0; overflow: hidden;
}
.sim-bar > div {
  height: 100%; background: var(--accent); transition: width 0.3s;
}
</style>
