"""
仅生成对照表脚本
"""
import sys
import os
import argparse
import pandas as pd
import json

# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.document_reader import DocumentReader
from src.ai_aligner import AIAligner


def main(english_file, chinese_file):
    """
    仅生成对照表，不插入脚注（支持PDF和DOCX）

    Args:
        english_file: 英文文档路径（PDF或DOCX）
        chinese_file: 中文文档路径（PDF或DOCX）
    """
    print("\n" + "=" * 60)
    print("脚注对照表生成器 - Gemini API版本")
    print("=" * 60)

    try:
        # 检查文件是否存在
        if not os.path.exists(english_file):
            raise FileNotFoundError(f"英文文档不存在: {english_file}")
        if not os.path.exists(chinese_file):
            raise FileNotFoundError(f"中文文档不存在: {chinese_file}")

        print(f"\n英文文档: {english_file}")
        print(f"中文文档: {chinese_file}")

        # 读取文档
        print("\n读取文档...")
        english_doc = DocumentReader.read_file(english_file)
        chinese_doc = DocumentReader.read_file(chinese_file)

        print(f"[OK] 英文文档: {len(english_doc['paragraphs'])} 段落")
        print(f"[OK] 中文文档: {len(chinese_doc['paragraphs'])} 段落")

        # 生成对照表（不需要预先提供脚注，让AI自动识别）
        print("\n生成对照表...")
        print("AI将自动识别英文文档中的脚注，这可能需要1-2分钟...")

        aligner = AIAligner()
        alignment_table = aligner.generate_alignment_table(
            english_doc['full_text'],
            chinese_doc['full_text'],
            {}  # 空字典，让AI自动识别脚注
        )

        print(f"[OK] 生成了 {len(alignment_table)} 条对照记录")

        # 保存结果
        os.makedirs("outputs", exist_ok=True)

        # 保存为Excel
        df = pd.DataFrame(alignment_table)
        excel_path = "outputs/alignment_table.xlsx"
        df.to_excel(excel_path, index=False)
        print(f"[OK] Excel已保存: {excel_path}")

        # 保存为JSON
        json_path = "outputs/alignment_table.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(alignment_table, f, ensure_ascii=False, indent=2)
        print(f"[OK] JSON已保存: {json_path}")

        print("\n" + "=" * 60)
        print("生成完成！")
        print("=" * 60)
        print(f"Excel文件: {excel_path}")
        print(f"JSON文件: {json_path}")
        print("\n提示: 请打开Excel文件审阅对照表")
        print("如果满意，可以运行 run_full_pipeline.py 插入脚注")

    except Exception as e:
        print(f"\n[ERROR] 错误: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="脚注对照表生成器")
    parser.add_argument("--english", required=True, help="英文文档路径")
    parser.add_argument("--chinese", required=True, help="中文文档路径")

    args = parser.parse_args()

    main(args.english, args.chinese)
