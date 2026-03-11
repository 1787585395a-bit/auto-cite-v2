"""
文档读取模块
"""
from docx import Document
from typing import Dict, List
import os
import PyPDF2


class DocumentReader:
    """文档读取器（支持DOCX和PDF）"""

    @staticmethod
    def read_pdf(file_path: str) -> Dict:
        """
        读取PDF文档

        Args:
            file_path: 文档路径

        Returns:
            Dict: 包含文档信息的字典
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)

                # 提取所有页面文本
                paragraphs = []
                for page in pdf_reader.pages:
                    text = page.extract_text()
                    if text.strip():
                        paragraphs.append(text.strip())

                # 生成完整文本
                full_text = "\n\n".join(paragraphs)

                return {
                    "paragraphs": paragraphs,
                    "full_text": full_text,
                    "has_footnotes": False,
                    "footnotes": {}
                }
        except Exception as e:
            raise Exception(f"读取PDF失败: {str(e)}")

    @staticmethod
    def read_file(file_path: str) -> Dict:
        """
        自动识别文件类型并读取

        Args:
            file_path: 文档路径

        Returns:
            Dict: 包含文档信息的字典
        """
        if file_path.lower().endswith('.pdf'):
            return DocumentReader.read_pdf(file_path)
        elif file_path.lower().endswith('.docx'):
            return DocumentReader.read_docx(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_path}")

    @staticmethod
    def read_docx(file_path: str) -> Dict:
        """
        读取DOCX文档

        Args:
            file_path: 文档路径

        Returns:
            Dict: 包含文档信息的字典
                - paragraphs: List[str] - 所有段落文本
                - full_text: str - 完整文本
                - has_footnotes: bool - 是否包含脚注
                - footnotes: Dict[str, str] - 脚注ID到内容的映射
        """
        # 检查文件是否存在
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        try:
            # 读取文档
            doc = Document(file_path)

            # 提取段落（过滤空段落）
            paragraphs = [para.text.strip() for para in doc.paragraphs if para.text.strip()]

            # 生成完整文本
            full_text = "\n\n".join(paragraphs)

            # 简化版：暂不提取脚注
            # 后续可扩展从document._element.xml中提取
            footnotes = {}
            has_footnotes = False

            return {
                "paragraphs": paragraphs,
                "full_text": full_text,
                "has_footnotes": has_footnotes,
                "footnotes": footnotes
            }

        except Exception as e:
            raise Exception(f"读取文档失败: {str(e)}")
