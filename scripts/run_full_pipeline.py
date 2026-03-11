"""
完整流程脚本
"""
import sys
import os
import argparse
import json
import pandas as pd

# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.document_reader import DocumentReader
from src.ai_aligner import AIAligner
from src.footnote_inserter import FootnoteInserter
from src.validator import FootnoteValidator


def main(english_docx, chinese_docx, output_docx):
    """
    执行完整的脚注翻译流程

    Args:
        english_docx: 英文文档路径
        chinese_docx: 中文文档路径
        output_docx: 输出文档路径
    """
    print("\n" + "=" * 60)
    print("脚注翻译系统 V2.0 - Gemini API版本")
    print("=" * 60)

    try:
        # 步骤1: 读取文档
        print("\n[步骤1] 读取文档...")
        english_doc = DocumentReader.read_file(english_docx)
        chinese_doc = DocumentReader.read_file(chinese_docx)

        print(f"[OK] 英文文档: {len(english_doc['paragraphs'])} 段落")
        print(f"[OK] 中文文档: {len(chinese_doc['paragraphs'])} 段落")

        # 步骤2: AI生成对照表（AI会自动识别脚注）
        print("\n[步骤2] AI生成对照表...")
        print("AI将自动识别英文文档中的脚注，这可能需要1-2分钟...")

        aligner = AIAligner()
        alignment_table = aligner.generate_alignment_table(
            english_doc['full_text'],
            chinese_doc['full_text'],
            {}  # 空字典，让AI自动识别脚注
        )

        print(f"[OK] 生成了 {len(alignment_table)} 条对照记录")

        # 步骤3: 保存对照表
        print("\n[步骤3] 保存对照表...")
        os.makedirs("outputs", exist_ok=True)

        # 使用时间戳避免文件冲突
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # 保存为Excel
        df = pd.DataFrame(alignment_table)
        excel_path = f"outputs/alignment_table_{timestamp}.xlsx"
        df.to_excel(excel_path, index=False)
        print(f"[OK] Excel已保存: {excel_path}")

        # 保存固定路径JSON供Express服务器读取
        json_path = "outputs/alignment_table.json"
        with open(json_path, 'w', encoding='utf-8') as jf:
            json.dump(alignment_table, jf, ensure_ascii=False, indent=2)
        print(f"[OK] JSON已保存: {json_path}")

        print("提示: 您可以打开Excel文件审阅对照表")

        # 步骤4: 插入脚注
        print("\n[步骤4] 插入脚注...")
        inserter = FootnoteInserter(chinese_docx)
        result = inserter.insert_from_table(alignment_table)

        print(f"[OK] 成功插入: {len(result['success'])} 个脚注")
        if result['failed']:
            print(f"[WARNING] 失败: {len(result['failed'])} 个脚注")
            for failed in result['failed']:
                print(f"  - 脚注[{failed['id']}]: {failed['reason']}")

        # 保存文档
        inserter.save(output_docx)

        # 步骤5: 验证结果
        print("\n[步骤5] 验证结果...")
        report = FootnoteValidator.validate(output_docx, alignment_table)
        FootnoteValidator.print_report(report)

        # 保存报告
        report_path = "outputs/validation_report.txt"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(f"验证报告\n")
            f.write(f"总计: {report['total']}\n")
            f.write(f"正确: {report['correct']}\n")
            f.write(f"不正确: {report['incorrect']}\n")
            f.write(f"缺失: {report['missing']}\n")
        print(f"[OK] 报告已保存: {report_path}")

        # 步骤6: 总结
        print("\n" + "=" * 60)
        print("处理完成！")
        print("=" * 60)
        print(f"输出文档: {output_docx}")
        print(f"对照表: {excel_path}")
        print(f"验证报告: {report_path}")
        print(f"准确率: {report['correct']}/{report['total']} ({report['correct']/report['total']*100:.1f}%)")

    except Exception as e:
        print(f"\n[ERROR] 错误: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="脚注翻译系统 - 完整流程")
    parser.add_argument("--english", required=True, help="英文文档路径")
    parser.add_argument("--chinese", required=True, help="中文文档路径")
    parser.add_argument("--output", required=True, help="输出文档路径")

    args = parser.parse_args()

    main(args.english, args.chinese, args.output)
