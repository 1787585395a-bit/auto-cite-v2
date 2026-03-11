# Auto-Cite 前端

基于React 19 + Vite + TypeScript + Tailwind CSS的脚注翻译系统前端界面。

## 特性

- 🎨 黑白极简设计风格
- 🌊 3D波浪点阵动画背景（Three.js）
- 💧 液态玻璃质感按钮
- 📁 拖拽上传文件（支持PDF和DOCX）
- 🔄 实时处理进度显示
- 📊 双栏对比审查界面
- 🎯 置信度显示
- 🔍 诊断面板

## 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

## 技术栈

- React 19
- Vite 6
- TypeScript 5.8
- Tailwind CSS 3.4
- Three.js（3D动画）
- next-themes（主题管理）
- Lucide React（图标）

## 项目结构

```
frontend/
├── src/
│   ├── components/       # React组件
│   │   ├── ui/          # UI组件（DottedSurface, LiquidButton）
│   │   ├── Layout.tsx
│   │   ├── UploadConfig.tsx
│   │   ├── Processing.tsx
│   │   ├── Reviewer.tsx
│   │   └── FaultFinder.tsx
│   ├── services/        # API服务
│   ├── lib/            # 工具函数
│   ├── App.tsx         # 主应用
│   ├── main.tsx        # 入口文件
│   ├── types.ts        # TypeScript类型
│   └── index.css       # 全局样式
├── electron/           # Electron相关（待添加）
└── package.json
```

## 配色方案

- 主色：黑色 (#000000)
- 背景：白色 (#FFFFFF)
- 边框：slate-200 (#E2E8F0)
- 文字：黑色 (#000000)
- 次要文字：slate-500/600
- 灰度：slate-50 到 slate-900

## 下一步

1. 添加Electron支持
2. 集成Python后端
3. 实现文件上传功能
4. 完善Reviewer和FaultFinder组件
