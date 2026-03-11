import { Citation, SystemLog } from '../types';

export const mockCitations: Citation[] = [
  {
    id: 'fn_01',
    anchorNumber: 1,
    originalContext: "The concept of da-sein suggested by Heidegger[1] is complex.",
    originalFootnote: "Heidegger, M. Being and Time. 1927.",
    translatedFootnote: "海德格尔. 存在与时间. 1927.",
    targetSentence: "海德格尔提出的此在概念非常复杂。",
    confidence: 0.98,
    status: 'pending',
    isOrphaned: false
  },
  {
    id: 'fn_02',
    anchorNumber: 2,
    originalContext: "Statistical analysis shows a significant deviation[2] in the results.",
    originalFootnote: "Smith, J. Statistical Methods. 2020, p. 45.",
    translatedFootnote: "史密斯, J. 统计方法. 2020, 45页.",
    targetSentence: "结果中的统计分析显示出明显的偏差。",
    confidence: 0.89,
    status: 'pending',
    isOrphaned: false
  },
  {
    id: 'fn_03',
    anchorNumber: 3,
    originalContext: "As noted in previous studies[3], this effect is minimal.",
    originalFootnote: "Doe, A. et al. Journal of Science. 2019.",
    translatedFootnote: "Doe, A. 等. 科学期刊. 2019.",
    targetSentence: "正如之前的研究所指出的，这种影响微乎其微。",
    confidence: 0.92,
    status: 'pending',
    isOrphaned: false
  },
  {
    id: 'fn_04',
    anchorNumber: 4,
    originalContext: "The mechanism was first described in the late 19th century[4].",
    originalFootnote: "Brown, L. History of Mechanics. 1899.",
    translatedFootnote: "布朗, L. 力学史. 1899.",
    targetSentence: "该机制最早是在十九世纪末被描述的。", // A bit ambiguous for matching
    confidence: 0.65, // Low confidence example
    status: 'manual_review',
    isOrphaned: false
  },
  {
    id: 'fn_05',
    anchorNumber: 5,
    originalContext: "This paragraph was completely removed in the Chinese translation for brevity[5].",
    originalFootnote: "Editor's Note: Original text redundant.",
    translatedFootnote: "编者注: 原文冗余.",
    targetSentence: "",
    confidence: 0.0,
    status: 'pending',
    isOrphaned: true
  }
];

export const generateMockLogs = (): SystemLog[] => [
  { id: '1', timestamp: new Date().toISOString(), level: 'INFO', module: 'PARSER', message: 'Reference document parsed successfully. 5 anchors found.' },
  { id: '2', timestamp: new Date().toISOString(), level: 'INFO', module: 'PARSER', message: 'Target document parsed. Structure analyzed.' },
  { id: '3', timestamp: new Date().toISOString(), level: 'INFO', module: 'SEMANTIC_ALIGN', message: 'Embedding generation complete for 5 chunks.' },
  { id: '4', timestamp: new Date().toISOString(), level: 'WARN', module: 'SEMANTIC_ALIGN', message: 'Low confidence match for Anchor [4]. Similarity score: 0.65.' },
  { id: '5', timestamp: new Date().toISOString(), level: 'ERROR', module: 'SEMANTIC_ALIGN', message: 'Orphaned footnote detected [5]. No semantic equivalent found in target.' },
  { id: '6', timestamp: new Date().toISOString(), level: 'INFO', module: 'FORMATTER', message: 'Citations converted to GB/T 7714 standard.' },
];

export const simulateProcessing = (onProgress: (p: number) => void): Promise<{ citations: Citation[], logs: SystemLog[] }> => {
  return new Promise((resolve) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      onProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        resolve({
          citations: mockCitations,
          logs: generateMockLogs()
        });
      }
    }, 500);
  });
};