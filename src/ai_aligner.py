"""
AI对齐模块 - 阿里云百炼API版本（两阶段分批处理）
"""
import dashscope
from dashscope import Generation
from src.config import config
import json
import re
import time
import os


class AIAligner:
    """使用阿里云百炼API进行文档对齐（两阶段分批）"""

    def __init__(self):
        print(f"[OK] AIAligner初始化完成，使用模型: {config.MODEL_NAME}")

    def generate_alignment_table(self, english_text, chinese_text, english_footnotes):
        """
        生成脚注对照表 - 两阶段分批处理，解决token截断问题

        阶段1：识别所有脚注（输出小，不截断）
        阶段2：分批（每批10个）请求对齐信息（每批输出可控）

        Args:
            english_text: 英文文档全文
            chinese_text: 中文文档全文
            english_footnotes: 英文脚注字典（可为空，AI自动识别）

        Returns:
            List[Dict]: 对照表列表
        """
        print(f"\n开始生成对照表（两阶段分批处理）...")
        print(f"英文文档长度: {len(english_text)} 字符")
        print(f"中文文档长度: {len(chinese_text)} 字符")

        # 阶段1：识别所有脚注
        print("\n[阶段1] 识别英文文档中的所有脚注...")
        footnotes_list = self._detect_footnotes(english_text)
        print(f"[OK] 识别到 {len(footnotes_list)} 个脚注")

        if not footnotes_list:
            print("[WARNING] 未识别到任何脚注")
            return []

        # 阶段2：分批对齐
        print(f"\n[阶段2] 分批处理对齐（每批10个）...")
        all_results = []
        batch_size = 10

        for i in range(0, len(footnotes_list), batch_size):
            batch = footnotes_list[i:i + batch_size]
            batch_num = i // batch_size + 1
            total_batches = (len(footnotes_list) + batch_size - 1) // batch_size
            id_start = batch[0]['id']
            id_end = batch[-1]['id']
            print(f"\n[批次 {batch_num}/{total_batches}] 处理脚注 {id_start} - {id_end}...")

            try:
                batch_results = self._align_batch(english_text, chinese_text, batch)
                all_results.extend(batch_results)
                print(f"[OK] 批次{batch_num}完成，获得 {len(batch_results)} 条记录")
            except Exception as e:
                print(f"[WARNING] 批次{batch_num}失败: {str(e)}，跳过")

            # 批次间速率限制（最后一批不需要等待）
            if i + batch_size < len(footnotes_list):
                time.sleep(config.RATE_LIMIT_DELAY)

        print(f"\n[OK] 两阶段处理完成，共生成 {len(all_results)} 条对照记录")
        return all_results

    def _detect_footnotes(self, english_text):
        """
        阶段1：识别英文文档中的所有脚注

        只输出脚注编号和原文内容，输出极小（每条约50-150 tokens），
        50个脚注约3000-5000 tokens，远低于4096限制。

        Returns:
            List[Dict]: [{"id": "1", "content": "..."}, ...]
        """
        prompt = f"""请识别以下英文学术文献中的所有脚注。

## 英文文档
{english_text}

---

## 任务说明
脚注通常出现在：
- 文档末尾（以数字编号）
- 页面底部
- 正文中的上标数字引用（如1, 2, 3...）

## 输出格式
请输出JSON数组，每个元素只包含脚注编号和原文内容：

[
  {{"id": "1", "content": "完整的英文脚注原文"}},
  {{"id": "2", "content": "完整的英文脚注原文"}}
]

只返回JSON数组，不要其他内容。"""

        response_text = self._call_api(prompt)

        # 保存识别阶段的原始响应
        os.makedirs("outputs", exist_ok=True)
        with open("outputs/raw_response_detect.txt", "w", encoding="utf-8") as f:
            f.write(response_text)

        return self._parse_simple_list(response_text)

    def _align_batch(self, english_text, chinese_text, batch):
        """
        阶段2：对一批脚注进行中英对齐

        每批10个脚注，输出约10 × 300 tokens = 3000 tokens，在4096限制内安全。

        Args:
            english_text: 英文文档全文
            chinese_text: 中文文档全文
            batch: 本批脚注列表 [{"id": "1", "content": "..."}]

        Returns:
            List[Dict]: 本批对照记录
        """
        footnotes_desc = "\n".join([
            f'脚注{fn["id"]}: {fn["content"]}' for fn in batch
        ])
        ids_desc = ", ".join([fn["id"] for fn in batch])
        batch_count = len(batch)

        prompt = f"""你是专业的学术文献跨语言对齐专家。

以下是英文文档中已识别的部分脚注（共{batch_count}个，编号 {ids_desc}）：

{footnotes_desc}

---

## 英文文档
{english_text}

## 中文文档
{chinese_text}

---

## 任务
只处理上面列出的{batch_count}个脚注（编号 {ids_desc}），为每个脚注完成：
1. 将英文脚注翻译为符合GB/T 7714标准的中文格式
2. 在中文文档中找到对应句子和精确插入位置

## 输出格式
[
  {{
    "footnote_id": "脚注编号",
    "english_footnote": "英文脚注原文",
    "chinese_footnote": "GB/T 7714格式中文脚注",
    "english_sentence": "包含该脚注引用的完整英文句子",
    "chinese_sentence": "对应的完整中文句子",
    "chinese_word": "脚注应插入位置的中文词语（2-6字）",
    "context_before": "该词语前面的5个字符",
    "context_after": "该词语后面的5个字符",
    "word_occurrence": 1,
    "confidence": 0.95
  }}
]

## 重要规则
1. context_before和context_after必须来自中文文档原文，用于唯一定位词语
2. 如果同一个词在句子中出现多次，word_occurrence填写第几次出现
3. 只返回这{batch_count}个脚注的JSON数组，不要其他内容
4. 确保JSON格式正确，可被json.loads()解析

直接输出JSON数组。"""

        response_text = self._call_api(prompt)
        return self._parse_response(response_text)

    def _parse_simple_list(self, response_text):
        """解析阶段1的简单脚注列表"""
        try:
            cleaned = response_text.strip()
            cleaned = re.sub(r'^```json\s*', '', cleaned, flags=re.MULTILINE)
            cleaned = re.sub(r'^```\s*', '', cleaned, flags=re.MULTILINE)
            cleaned = re.sub(r'\s*```$', '', cleaned, flags=re.MULTILINE)
            cleaned = cleaned.strip()

            # 修复不完整JSON
            if not cleaned.endswith(']'):
                last_complete = cleaned.rfind('}')
                if last_complete > 0:
                    cleaned = cleaned[:last_complete + 1] + '\n]'
                    print("[WARNING] 识别阶段JSON不完整，已修复")

            data = json.loads(cleaned)
            if not isinstance(data, list):
                raise ValueError("响应不是JSON数组")

            # 确保每条记录有id和content字段
            result = []
            for entry in data:
                if 'id' in entry and 'content' in entry:
                    result.append({'id': str(entry['id']), 'content': entry['content']})
                else:
                    print(f"[WARNING] 跳过缺少字段的记录: {entry}")

            return result

        except json.JSONDecodeError as e:
            print(f"[ERROR] 识别阶段JSON解析失败: {str(e)}")
            print(f"原始响应前500字符: {response_text[:500]}")
            raise Exception(f"脚注识别失败: {str(e)}")

    def _call_api(self, prompt):
        """调用阿里云百炼API，带重试机制"""
        for attempt in range(config.MAX_RETRIES):
            try:
                if attempt > 0:
                    time.sleep(config.RATE_LIMIT_DELAY)

                response = Generation.call(
                    model=config.MODEL_NAME,
                    messages=[{'role': 'user', 'content': prompt}],
                    result_format='message',
                    temperature=config.GENERATION_CONFIG['temperature'],
                    max_tokens=config.GENERATION_CONFIG['max_tokens'],
                    top_p=config.GENERATION_CONFIG['top_p']
                )

                if response.status_code == 200:
                    return response.output.choices[0].message.content
                else:
                    raise Exception(f"API返回错误: {response.code} - {response.message}")

            except Exception as e:
                print(f"[WARNING] API调用失败: {str(e)} (尝试 {attempt + 1}/{config.MAX_RETRIES})")
                if attempt == config.MAX_RETRIES - 1:
                    raise
                time.sleep(config.RETRY_DELAY)

        raise Exception("API调用失败，已达最大重试次数")

    def _parse_response(self, response_text):
        """解析API返回的JSON对照表"""
        try:
            # 保存原始响应（追加模式，记录每批）
            os.makedirs("outputs", exist_ok=True)
            with open("outputs/raw_response.txt", "a", encoding="utf-8") as f:
                f.write("\n---BATCH---\n")
                f.write(response_text)

            cleaned = response_text.strip()
            cleaned = re.sub(r'^```json\s*', '', cleaned, flags=re.MULTILINE)
            cleaned = re.sub(r'^```\s*', '', cleaned, flags=re.MULTILINE)
            cleaned = re.sub(r'\s*```$', '', cleaned, flags=re.MULTILINE)
            cleaned = cleaned.strip()

            if not cleaned.endswith(']'):
                last_complete = cleaned.rfind('}')
                if last_complete > 0:
                    cleaned = cleaned[:last_complete + 1] + '\n]'
                    print("[WARNING] JSON不完整，已自动修复")

            data = json.loads(cleaned)

            if not isinstance(data, list):
                raise ValueError("响应不是JSON数组")

            required_fields = [
                'footnote_id', 'chinese_word', 'context_before',
                'context_after', 'chinese_sentence'
            ]
            for i, entry in enumerate(data):
                missing_fields = [f for f in required_fields if f not in entry]
                if missing_fields:
                    print(f"[WARNING] 第{i+1}条记录缺少字段: {missing_fields}")

            return data

        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON解析失败: {str(e)}")
            print(f"原始响应前500字符: {response_text[:500]}")
            raise Exception(f"JSON解析失败: {str(e)}")

        except Exception as e:
            print(f"[ERROR] 解析响应失败: {str(e)}")
            raise
