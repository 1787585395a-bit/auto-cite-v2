# Auto-Cite V2

基于 Qwen API 的英文论文脚注翻译与插入系统，当前版本按纯 Web 端使用方式维护。

## 当前能力

- 英文输入支持 `DOCX` 和 `PDF`
- 中文译文 `DOCX` 可选
- 已有中文译文时：对齐脚注并写回中文文档
- 没有中文译文时：先自动生成中文主体，再插入译后脚注
- 输出统一为 `DOCX`
- 生成对照表 `alignment_table.json/xlsx` 便于人工复核

## 项目结构

```text
Auto_cite_V2/
├─ src/                  # Python 核心模块
├─ scripts/              # 命令行入口
├─ frontend/             # Web 前端与 Node API
├─ outputs/              # 运行输出
└─ tests/                # 测试素材
```

## 后端依赖

```bash
pip install -r requirements.txt
```

在根目录 `.env` 中配置：

```env
DASHSCOPE_API_KEY=your-api-key-here
```

## Web 端开发

```bash
cd frontend
npm install
npm run web:dev
```

启动后：

- 前端：`http://localhost:5173`
- API：`http://localhost:8081`

## Web 端生产

```bash
cd frontend
npm run build
npm run start
```

## 命令行用法

已有中文译文：

```bash
python scripts/run_full_pipeline.py ^
  --english english.docx ^
  --chinese chinese.docx ^
  --output outputs/result.docx
```

自动生成中文译文：

```bash
python scripts/run_full_pipeline.py ^
  --english english.pdf ^
  --output outputs/result.docx
```

仅生成对照表：

```bash
python scripts/generate_table_only.py ^
  --english english.docx ^
  --chinese chinese.docx
```

## 说明

- PDF 输入当前主要用于英文源文档读取，输出仍统一为 `DOCX`
- 自动翻译模式依赖大模型保留脚注标记，因此建议保留人工复核环节
- 每次 Web 任务会写入独立输出目录，避免并发任务互相覆盖
