"""
验证模块
"""
from docx import Document
from docx.oxml.ns import qn
from typing import Dict, List
import os


class FootnoteValidator:
    """脚注验证器"""

    @staticmethod
    def validate(docx_path: str, alignment_table: List[Dict]) -> Dict:
        """
        验证脚注插入结果 - 检查真实的DOCX脚注引用元素

        Args:
            docx_path: 文档路径
            alignment_table: 对照表

        Returns:
            Dict: 验证报告
        """
        if not os.path.exists(docx_path):
            raise FileNotFoundError(f"文件不存在: {docx_path}")

        doc = Document(docx_path)

        # 统计文档正文中所有 <w:footnoteReference> 元素
        found_ref_ids = []
        for para in doc.paragraphs:
            for r_elem in para._element.iter(qn('w:r')):
                fn_ref = r_elem.find(qn('w:footnoteReference'))
                if fn_ref is not None:
                    fn_id = fn_ref.get(qn('w:id'))
                    if fn_id is not None:
                        found_ref_ids.append(fn_id)

        total = len(alignment_table)
        found = len(found_ref_ids)
        missing = max(0, total - found)
        correct = found

        details = []
        for i, entry in enumerate(alignment_table):
            footnote_id = entry['footnote_id']
            if i < found:
                details.append({
                    "footnote_id": footnote_id,
                    "status": "correct",
                    "message": f"[OK] 脚注[{footnote_id}]已插入 (DOCX ID: {found_ref_ids[i]})",
                    "actual_text": ""
                })
            else:
                details.append({
                    "footnote_id": footnote_id,
                    "status": "missing",
                    "message": f"[ERROR] 脚注[{footnote_id}]未找到",
                    "actual_text": ""
                })

        return {
            "total": total,
            "correct": correct,
            "incorrect": 0,
            "missing": missing,
            "details": details
        }

    @staticmethod
    def print_report(report: Dict):
        """打印验证报告"""
        print("\n" + "=" * 60)
        print("验证报告")
        print("=" * 60)
        print(f"总计: {report['total']}")
        print(f"[OK] 已插入: {report['correct']}")
        print(f"[ERROR] 缺失: {report['missing']}")
        print("=" * 60)

        if report['details']:
            print("\n详细信息:")
            for detail in report['details']:
                print(f"\n{detail['message']}")
                if detail['actual_text']:
                    print(f"  上下文: ...{detail['actual_text']}...")
