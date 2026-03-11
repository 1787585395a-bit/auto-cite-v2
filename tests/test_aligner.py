"""
AI对齐模块测试
"""
import sys
import os

# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.ai_aligner import AIAligner
import json


def test_simple_alignment():
    """测试基本对齐功能"""
    print("测试1: 基本对齐功能")

    # 简单的测试数据
    english_text = "This is a test document. It contains a footnote."
    chinese_text = "这是一个测试文档。它包含一个脚注。"
    english_footnotes = {
        "1": "Test footnote content"
    }

    try:
        aligner = AIAligner()
        result = aligner.generate_alignment_table(
            english_text,
            chinese_text,
            english_footnotes
        )

        # 验证返回类型
        assert isinstance(result, list), "返回值应该是列表"
        print("✓ 返回类型正确")

        # 验证必需字段
        if result:
            required_fields = ['footnote_id', 'chinese_word', 'context_before', 'context_after']
            for field in required_fields:
                assert field in result[0], f"缺少必需字段: {field}"
            print("✓ 必需字段存在")

        print("✓ 测试1通过\n")
        return True

    except Exception as e:
        print(f"✗ 测试1失败: {str(e)}\n")
        return False


def test_json_parsing():
    """测试JSON解析"""
    print("测试2: JSON解析")

    aligner = AIAligner()

    # 测试正常JSON
    test_json = '[{"footnote_id": "1", "chinese_word": "测试"}]'
    try:
        result = aligner._parse_response(test_json)
        assert isinstance(result, list), "解析结果应该是列表"
        print("✓ 正常JSON解析成功")
    except Exception as e:
        print(f"✗ 正常JSON解析失败: {str(e)}")
        return False

    # 测试带markdown标记的JSON
    test_json_with_markdown = '```json\n[{"footnote_id": "1"}]\n```'
    try:
        result = aligner._parse_response(test_json_with_markdown)
        assert isinstance(result, list), "解析结果应该是列表"
        print("✓ Markdown包裹的JSON解析成功")
    except Exception as e:
        print(f"✗ Markdown JSON解析失败: {str(e)}")
        return False

    print("✓ 测试2通过\n")
    return True


if __name__ == "__main__":
    print("=" * 60)
    print("AI对齐模块测试")
    print("=" * 60 + "\n")

    results = []
    results.append(test_json_parsing())
    # results.append(test_simple_alignment())  # 需要API调用，可选

    print("=" * 60)
    if all(results):
        print("✓ 所有测试通过")
    else:
        print("✗ 部分测试失败")
    print("=" * 60)
