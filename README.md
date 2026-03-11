# 脚注翻译系统 V2.0

基于Gemini API的学术论文脚注自动翻译和插入系统。

## 功能特点

- 使用AI技术精确对齐英文和中文学术文档
- 自动翻译脚注并转换为GB/T 7714格式
- 智能定位脚注插入位置
- 生成详细的对照表供人工审阅
- 完整的验证和报告机制

## 技术栈

- Python 3.9+
- Google Gemini API (gemini-1.5-pro)
- python-docx (文档处理)
- pandas (数据处理)

## 安装步骤

### 1. 环境要求

- Python 3.9 或更高版本
- pip 包管理器

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置API密钥

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，添加你的Gemini API密钥：

```
GEMINI_API_KEY=your-api-key-here
```

## 快速开始

### 准备文档

1. 英文文档（含脚注）：`english.docx`
2. 中文译文（无脚注）：`chinese.docx`

### 方式1：仅生成对照表（推荐先使用）

```bash
python scripts/generate_table_only.py --english english.docx --chinese chinese.docx
```

这将生成：
- `outputs/alignment_table.xlsx` - Excel格式，便于审阅
- `outputs/alignment_table.json` - JSON格式，便于程序读取

打开Excel文件检查对照表，确认AI提取的信息准确。

### 方式2：完整流程

```bash
python scripts/run_full_pipeline.py --english english.docx --chinese chinese.docx --output result.docx
```

这将：
1. 读取两个文档
2. 调用Gemini API生成对照表
3. 保存对照表为Excel
4. 插入脚注到中文文档
5. 验证结果并生成报告
6. 输出最终文档

## 使用指南

### 对照表字段说明

生成的对照表包含以下字段：

- `footnote_id`: 脚注编号
- `english_footnote`: 原始英文脚注
- `chinese_footnote`: GB/T 7714格式中文脚注
- `chinese_word`: 插入位置的中文词语
- `context_before`: 词语前5个字符（用于定位）
- `context_after`: 词语后5个字符（用于定位）
- `word_occurrence`: 词语在句子中第几次出现
- `confidence`: AI的置信度

### 审阅对照表

打开 `outputs/alignment_table.xlsx`，检查：

1. `chinese_footnote` 是否符合GB/T 7714标准
2. `chinese_word` 是否是正确的插入位置
3. `context_before` 和 `context_after` 是否能唯一定位词语

### 处理失败的脚注

如果某些脚注插入失败，检查：

1. `context_before/after` 是否在文档中存在
2. `word_occurrence` 是否正确
3. 手动调整对照表后重新运行

## 配置选项

编辑 `src/config.py` 可以调整：

- `MODEL_NAME`: Gemini模型（默认：gemini-1.5-pro）
- `temperature`: 生成温度（默认：0.3）
- `max_output_tokens`: 最大输出token数（默认：8192）
- `MAX_RETRIES`: API调用最大重试次数（默认：3）

## 故障排除

### 问题1：API调用失败

**错误**: `API配额耗尽`

**解决方案**:
- 检查API密钥是否有效
- 等待配额重置（免费版有速率限制）
- 考虑升级到付费版

### 问题2：JSON解析错误

**错误**: `JSON解析失败`

**解决方案**:
- 检查 `outputs/` 目录下的原始响应
- 可能是prompt需要调整
- 尝试降低文档长度

### 问题3：脚注插入位置不准确

**错误**: 验证报告显示位置不正确

**解决方案**:
- 检查对照表中的 `context_before/after`
- 确认词语在文档中唯一或正确标记了 `word_occurrence`
- 手动调整对照表后重新插入

### 问题4：中文脚注格式不符合标准

**解决方案**:
- 在prompt中强调GB/T 7714标准
- 提供标准格式示例
- 人工审阅后手动调整

## 项目结构

```
Auto_cite_V2/
├── src/
│   ├── config.py           # Gemini API配置
│   ├── document_reader.py  # 文档读取
│   ├── ai_aligner.py       # AI对齐核心
│   ├── footnote_inserter.py # 脚注插入
│   └── validator.py        # 结果验证
├── scripts/
│   ├── run_full_pipeline.py      # 完整流程
│   └── generate_table_only.py    # 仅生成对照表
├── outputs/                # 输出目录
├── requirements.txt        # 依赖包
├── .env                    # API密钥（不提交到git）
└── README.md              # 本文件
```

## 注意事项

1. API密钥安全：不要将 `.env` 文件提交到版本控制
2. 文档格式：仅支持 `.docx` 格式
3. 脚注提取：当前版本需要手动提供脚注字典
4. 处理时间：根据文档长度，可能需要1-5分钟
5. 准确率：建议人工审阅对照表后再插入

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交Issue。
