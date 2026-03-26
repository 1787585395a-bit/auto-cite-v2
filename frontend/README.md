# Auto-Cite Frontend

纯 Web 端前端，基于 `React + Vite + TypeScript + Tailwind CSS`。

## 运行方式

```bash
npm install
npm run web:dev
```

这会同时启动：

- 前端开发服务器：`http://localhost:5173`
- Web API 服务：`http://localhost:8081`

生产模式：

```bash
npm run build
npm run start
```

## 说明

- 英文输入支持 `DOCX` 和 `PDF`
- 中文 `DOCX` 译文是可选的
- 如果未上传中文译文，后端会先自动生成中文主体，再插入脚注
- 最终输出统一为 `DOCX`
