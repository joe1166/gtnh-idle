---
name: gtnh-idle-dev-principles
description: gtnh-idle 项目核心开发原则：模块化解耦、代码精简
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c4fa4bcd-b737-4dea-938b-bdba04dd3524
---

## 核心开发原则

### 底层系统模块化、解耦
- stores、db、types 等底层模块独立，不直接依赖 UI
- 数据流单向：配置 → store → 组件，组件不直接修改 store 状态
- 新功能优先考虑复用已有 store/系统，而不是新增耦合

### 代码精简
- 不引入不必要的抽象层
- 三个相似逻辑 → 合并为一个泛化实现，而不是留三个独立分支
- 不用设计模式填充代码，简洁优先

### 架构保持渲染层独立
- 逻辑层（stores/data）和渲染层（components）分离
- 方便将来迁移到其他平台（Unity/Godot）
- 核心游戏逻辑不绑定任何特定渲染框架

### 技术决策原则
- 遇到"这个能用 Web 解决吗"的疑问 → 先尝试 Web，除非遇到真实瓶颈
- 新功能先想复用现有系统，其次才考虑新增文件/模块