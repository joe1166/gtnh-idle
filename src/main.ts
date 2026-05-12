import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/global.css'
import { useTaskStore } from './stores/taskStore'
import { useProgressionStore } from './stores/progressionStore'
import { db } from './data/db'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

// Debug: 在浏览器控制台输入 debugTasks() 回车
window.debugTasks = () => {
  const ts = useTaskStore()
  const ps = useProgressionStore()
  const chapter = ps.currentChapter

  console.log('=== 章节状态 ===')
  console.log('currentChapterId:', ps.currentChapterId)
  console.log('chapterCompleted:', ps.chapterCompleted)
  console.log('chapter taskIds:', chapter?.taskIds)

  console.log('\n=== 已完成任务 ===')
  console.table([...ts.completedTaskIds])

  console.log('\n=== craftCounts ===')
  console.table(Object.fromEntries(Object.entries(ts.craftCounts ?? {})))

  console.log('\n=== 当前章节所有任务（含过滤后可见性）===')
  if (!chapter) {
    console.log('无章节')
  } else {
    const rows: Record<string, any>[] = []
    for (const id of chapter.taskIds) {
      const t = db.get('tasks', id)
      if (!t) continue
      const prereqs = t.prereqTaskId ? t.prereqTaskId.split(',') : []
      const prereqsDone = prereqs.map((p: string) => ({ task: p, done: ts.completedTaskIds.includes(p) }))
      const isVisible = !t.prereqTaskId || prereqs.every((p: string) => ts.completedTaskIds.includes(p))
      rows.push({
        id: t.id,
        type: t.type,
        prereq: t.prereqTaskId || '-',
        visible: isVisible ? '✅' : '❌',
        completed: ts.completedTaskIds.includes(t.id) ? '✅' : '❌',
        'prereq detail': prereqsDone.map((x: any) => `${x.task}:${x.done ? '✅' : '❌'}`).join(', '),
      })
    }
    console.table(rows)
  }

  console.log('\n=== 所有任务（不限章节）===')
  const all = db.table('tasks').map(t => {
    const prereqs = t.prereqTaskId ? t.prereqTaskId.split(',') : []
    const isVisible = !t.prereqTaskId || prereqs.every((p: string) => ts.completedTaskIds.includes(p))
    return {
      id: t.id,
      type: t.type,
      prereq: t.prereqTaskId || '-',
      visible: isVisible ? '✅' : '❌',
      completed: ts.completedTaskIds.includes(t.id) ? '✅' : '❌',
    }
  })
  console.table(all)
}