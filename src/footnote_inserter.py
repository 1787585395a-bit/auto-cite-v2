"""
脚注插入模块 - 使用真正的DOCX脚注格式
"""
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from lxml import etree
from typing import Dict, List, Tuple, Optional
import copy
import os


FOOTNOTES_RELTYPE = (
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes'
)
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
XML_SPACE = '{http://www.w3.org/XML/1998/namespace}space'


class FootnoteInserter:
    """脚注插入器 - 生成真正的DOCX脚注"""

    def __init__(self, docx_path: str):
        if not os.path.exists(docx_path):
            raise FileNotFoundError(f"文件不存在: {docx_path}")

        self.doc = Document(docx_path)
        self.paragraphs = [para for para in self.doc.paragraphs if para.text.strip()]
        self.ref_style_id, self.text_style_id = self._detect_footnote_styles()

    def _detect_footnote_styles(self) -> Tuple[Optional[str], Optional[str]]:
        """从styles.xml动态检测脚注相关样式ID"""
        ref_style_id = None
        text_style_id = None
        try:
            styles_part = self.doc.part.styles
            for style_elem in styles_part._element.iter(qn('w:style')):
                name_elem = style_elem.find(qn('w:name'))
                if name_elem is None:
                    continue
                name_val = name_elem.get(qn('w:val'), '').lower()
                style_id = style_elem.get(qn('w:styleId'))
                if name_val == 'footnote reference':
                    ref_style_id = style_id
                elif name_val == 'footnote text':
                    text_style_id = style_id
        except Exception:
            pass
        return ref_style_id, text_style_id

    def _get_footnotes_tree(self):
        """获取footnotes.xml的lxml树和Part对象"""
        for rel in self.doc.part.rels.values():
            if rel.reltype == FOOTNOTES_RELTYPE:
                fn_part = rel.target_part
                fn_tree = etree.fromstring(fn_part.blob)
                return fn_tree, fn_part
        raise RuntimeError("DOCX中未找到footnotes.xml关系，请确认文档已包含脚注区域")

    def _get_next_footnote_id(self, fn_tree) -> int:
        """计算下一个可用的DOCX脚注ID（跳过2、3保留ID）"""
        existing_ids = set()
        for fn in fn_tree:
            fn_type = fn.get(f'{{{W}}}type')
            fn_id_str = fn.get(f'{{{W}}}id')
            if fn_type is None and fn_id_str is not None:
                try:
                    existing_ids.add(int(fn_id_str))
                except ValueError:
                    pass
        next_id = max(existing_ids, default=0) + 1
        # 跳过系统保留ID 2和3
        while next_id in (2, 3):
            next_id += 1
        return next_id

    def _add_footnote_to_tree(self, fn_tree, docx_id: int, footnote_text: str):
        """向footnotes.xml树中追加新脚注元素"""
        fn = etree.SubElement(fn_tree, f'{{{W}}}footnote')
        fn.set(f'{{{W}}}id', str(docx_id))

        p = etree.SubElement(fn, f'{{{W}}}p')

        # 段落样式
        pPr = etree.SubElement(p, f'{{{W}}}pPr')
        pStyle = etree.SubElement(pPr, f'{{{W}}}pStyle')
        if self.text_style_id:
            pStyle.set(f'{{{W}}}val', self.text_style_id)
        else:
            pStyle.set(f'{{{W}}}val', 'FootnoteText')

        # 脚注编号引用run
        r_num = etree.SubElement(p, f'{{{W}}}r')
        rPr_num = etree.SubElement(r_num, f'{{{W}}}rPr')
        if self.ref_style_id:
            rStyle_num = etree.SubElement(rPr_num, f'{{{W}}}rStyle')
            rStyle_num.set(f'{{{W}}}val', self.ref_style_id)
        else:
            vertAlign = etree.SubElement(rPr_num, f'{{{W}}}vertAlign')
            vertAlign.set(f'{{{W}}}val', 'superscript')
        etree.SubElement(r_num, f'{{{W}}}footnoteRef')

        # 空格run
        r_space = etree.SubElement(p, f'{{{W}}}r')
        t_space = etree.SubElement(r_space, f'{{{W}}}t')
        t_space.set(XML_SPACE, 'preserve')
        t_space.text = ' '

        # 内容run
        r_text = etree.SubElement(p, f'{{{W}}}r')
        t = etree.SubElement(r_text, f'{{{W}}}t')
        t.set(XML_SPACE, 'preserve')
        t.text = footnote_text

    def _save_footnotes_tree(self, fn_tree, fn_part):
        """将修改后的lxml树序列化回Part的_blob"""
        fn_part._blob = etree.tostring(
            fn_tree,
            xml_declaration=True,
            encoding='UTF-8',
            standalone=True
        )

    def _insert_footnote_at_location(self, para, char_pos: int, docx_fn_id: int):
        """在段落的char_pos位置插入脚注引用标记，不破坏原有格式"""
        p_elem = para._element

        # 遍历所有直接子<w:r>元素，计算累计偏移
        cumulative = 0
        target_run_elem = None
        offset_in_run = 0
        run_position_in_parent = 0

        children = list(p_elem)
        for idx, child in enumerate(children):
            if child.tag != f'{{{W}}}r':
                continue
            t_elem = child.find(f'{{{W}}}t')
            run_text = t_elem.text if (t_elem is not None and t_elem.text) else ''
            run_len = len(run_text)

            if cumulative + run_len >= char_pos:
                target_run_elem = child
                offset_in_run = char_pos - cumulative
                run_position_in_parent = idx
                break
            cumulative += run_len

        if target_run_elem is None:
            # char_pos超过所有run，追加到最后一个<w:r>末尾
            last_run = None
            last_idx = 0
            for idx, child in enumerate(children):
                if child.tag == f'{{{W}}}r':
                    last_run = child
                    last_idx = idx
            if last_run is None:
                raise ValueError("段落中没有可用的run元素")
            target_run_elem = last_run
            t_elem = last_run.find(f'{{{W}}}t')
            offset_in_run = len(t_elem.text) if (t_elem is not None and t_elem.text) else 0
            run_position_in_parent = last_idx

        self._split_run_and_insert_ref(
            p_elem, target_run_elem, run_position_in_parent, offset_in_run, docx_fn_id
        )

    def _split_run_and_insert_ref(self, p_elem, run_elem, run_pos: int, offset: int, docx_fn_id: int):
        """将run_elem在offset处拆分，插入脚注引用run"""
        t_elem = run_elem.find(f'{{{W}}}t')
        original_text = t_elem.text if (t_elem is not None and t_elem.text) else ''
        rPr_elem = run_elem.find(f'{{{W}}}rPr')

        text_before = original_text[:offset]
        text_after = original_text[offset:]

        new_elements = []

        # before-text run
        if text_before:
            r_before = etree.Element(f'{{{W}}}r')
            if rPr_elem is not None:
                r_before.append(copy.deepcopy(rPr_elem))
            t_b = etree.SubElement(r_before, f'{{{W}}}t')
            t_b.set(XML_SPACE, 'preserve')
            t_b.text = text_before
            new_elements.append(r_before)

        # 脚注引用run
        r_ref = etree.Element(f'{{{W}}}r')
        rPr_ref = etree.SubElement(r_ref, f'{{{W}}}rPr')
        if self.ref_style_id:
            rStyle = etree.SubElement(rPr_ref, f'{{{W}}}rStyle')
            rStyle.set(f'{{{W}}}val', self.ref_style_id)
        else:
            vertAlign = etree.SubElement(rPr_ref, f'{{{W}}}vertAlign')
            vertAlign.set(f'{{{W}}}val', 'superscript')
        fn_ref = etree.SubElement(r_ref, f'{{{W}}}footnoteReference')
        fn_ref.set(f'{{{W}}}id', str(docx_fn_id))
        new_elements.append(r_ref)

        # after-text run
        if text_after:
            r_after = etree.Element(f'{{{W}}}r')
            if rPr_elem is not None:
                r_after.append(copy.deepcopy(rPr_elem))
            t_a = etree.SubElement(r_after, f'{{{W}}}t')
            t_a.set(XML_SPACE, 'preserve')
            t_a.text = text_after
            new_elements.append(r_after)

        # 移除原run，在同位置插入新元素
        p_elem.remove(run_elem)
        for i, elem in enumerate(new_elements):
            p_elem.insert(run_pos + i, elem)

    def insert_from_table(self, alignment_table: List[Dict]) -> Dict:
        """根据对照表插入脚注"""
        success = []
        failed = []

        # 阶段1：定位所有插入点
        insertion_plan = []
        for entry in alignment_table:
            try:
                location = self._find_insertion_location(entry)
                if location:
                    insertion_plan.append({
                        'entry': entry,
                        'para_index': location['para_index'],
                        'char_pos': location['char_pos'],
                        'para': location['para']
                    })
                else:
                    failed.append({'id': entry['footnote_id'], 'reason': '定位失败'})
            except Exception as e:
                failed.append({'id': entry['footnote_id'], 'reason': str(e)})

        # 阶段2：降序排列（从后往前插入）
        insertion_plan.sort(key=lambda x: (x['para_index'], x['char_pos']), reverse=True)

        # 阶段3：获取footnotes.xml并插入
        fn_tree, fn_part = self._get_footnotes_tree()
        next_id = self._get_next_footnote_id(fn_tree)

        for plan in insertion_plan:
            entry = plan['entry']
            para = plan['para']
            char_pos = plan['char_pos']
            footnote_text = entry.get('chinese_footnote', '')

            # 跳过系统保留ID
            while next_id in (2, 3):
                next_id += 1
            docx_fn_id = next_id
            next_id += 1

            try:
                self._add_footnote_to_tree(fn_tree, docx_fn_id, footnote_text)
                self._insert_footnote_at_location(para, char_pos, docx_fn_id)
                success.append(entry['footnote_id'])
            except Exception as e:
                failed.append({'id': entry['footnote_id'], 'reason': str(e)})

        self._save_footnotes_tree(fn_tree, fn_part)

        return {'success': success, 'failed': failed}

    def _find_insertion_location(self, entry: Dict) -> Optional[Dict]:
        """5级回退策略查找脚注插入位置"""
        chinese_word = entry.get('chinese_word', '')
        context_before = entry.get('context_before', '')
        context_after = entry.get('context_after', '')
        chinese_sentence = entry.get('chinese_sentence', '')
        occurrence = entry.get('word_occurrence', 1)
        fn_id = entry['footnote_id']

        full_pattern = context_before + chinese_word + context_after
        partial_after = chinese_word + context_after

        # --- 策略1：在句子所在段落内搜索全模式 ---
        if chinese_sentence:
            for i, para in enumerate(self.paragraphs):
                if chinese_sentence in para.text:
                    match_pos = self._find_nth_occurrence(para.text, full_pattern, 1)
                    if match_pos != -1:
                        ins_pos = match_pos + len(context_before) + len(chinese_word)
                        return {'para_index': i, 'char_pos': ins_pos, 'para': para}
                    break

        # --- 策略2：全文搜索全模式（支持word_occurrence）---
        count = 0
        for i, para in enumerate(self.paragraphs):
            if full_pattern in para.text:
                count += 1
                if count == occurrence:
                    match_pos = para.text.find(full_pattern)
                    ins_pos = match_pos + len(context_before) + len(chinese_word)
                    return {'para_index': i, 'char_pos': ins_pos, 'para': para}

        # --- 策略3：在句子段落内搜索 word+context_after ---
        if chinese_sentence and partial_after:
            for i, para in enumerate(self.paragraphs):
                if chinese_sentence in para.text:
                    if partial_after in para.text:
                        match_pos = para.text.find(partial_after)
                        ins_pos = match_pos + len(chinese_word)
                        print(f"[FALLBACK-3] 脚注{fn_id}: word+after部分匹配")
                        return {'para_index': i, 'char_pos': ins_pos, 'para': para}
                    break

        # --- 策略4：在句子段落内仅搜索词语（支持occurrence）---
        if chinese_sentence and chinese_word:
            for i, para in enumerate(self.paragraphs):
                if chinese_sentence in para.text:
                    match_pos = self._find_nth_occurrence(para.text, chinese_word, occurrence)
                    if match_pos != -1:
                        ins_pos = match_pos + len(chinese_word)
                        print(f"[FALLBACK-4] 脚注{fn_id}: 仅词语匹配")
                        return {'para_index': i, 'char_pos': ins_pos, 'para': para}
                    break

        # --- 策略5：bigram模糊句子匹配+词语搜索 ---
        if chinese_sentence and chinese_word:
            def bigram_overlap(a: str, b: str) -> float:
                A = set(a[i:i+2] for i in range(len(a) - 1)) if len(a) > 1 else set()
                B = set(b[i:i+2] for i in range(len(b) - 1)) if len(b) > 1 else set()
                if not A or not B:
                    return 0.0
                return len(A & B) / len(A | B)

            scores = [(bigram_overlap(chinese_sentence, para.text), i)
                      for i, para in enumerate(self.paragraphs)]
            scores.sort(reverse=True)

            for score, i in scores[:3]:
                if score < 0.15:
                    break
                para = self.paragraphs[i]
                match_pos = self._find_nth_occurrence(para.text, chinese_word, occurrence)
                if match_pos != -1:
                    ins_pos = match_pos + len(chinese_word)
                    print(f"[FALLBACK-5] 脚注{fn_id}: 模糊段落匹配(score={score:.2f})")
                    return {'para_index': i, 'char_pos': ins_pos, 'para': para}

        print(f"[ERROR] 脚注{fn_id}: 所有策略均失败 word='{chinese_word}'")
        return None

    def _find_nth_occurrence(self, text: str, pattern: str, n: int) -> int:
        """查找第N次出现的模式位置，返回-1表示未找到"""
        start = 0
        for _ in range(n):
            pos = text.find(pattern, start)
            if pos == -1:
                return -1
            start = pos + 1
        return text.find(pattern, start - 1)

    def save(self, output_path: str):
        """保存文档"""
        self.doc.save(output_path)
        print(f"[OK] 文档已保存: {output_path}")
