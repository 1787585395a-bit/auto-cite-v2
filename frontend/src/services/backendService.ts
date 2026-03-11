import { Citation, SystemLog, DocumentFile } from '../types';

// 根据Python输出的关键词推断进度（0-95，最后5%等完成事件）
function inferProgress(message: string): number | null {
    if (message.includes('[步骤1]') || message.includes('读取文档')) return 5;
    if (message.includes('[OK] 英文文档') || message.includes('[OK] 中文文档')) return 10;
    if (message.includes('[步骤2]') || message.includes('AI生成对照表')) return 15;
    if (message.includes('[阶段1]') || message.includes('识别英文文档')) return 18;
    if (message.includes('[OK] 识别到')) return 25;
    if (message.includes('[阶段2]') || message.includes('分批处理')) return 28;
    if (message.includes('[批次 1/')) return 30;
    if (message.includes('[批次 2/')) return 38;
    if (message.includes('[批次 3/')) return 46;
    if (message.includes('[批次 4/')) return 54;
    if (message.includes('[批次 5/')) return 62;
    if (message.includes('[批次 6/')) return 70;
    if (message.includes('[批次 7/')) return 75;
    if (message.includes('[步骤3]') || message.includes('保存对照表')) return 78;
    if (message.includes('[OK] Excel已保存') || message.includes('[OK] JSON已保存')) return 82;
    if (message.includes('[步骤4]') || message.includes('插入脚注')) return 85;
    if (message.includes('[OK] 成功插入')) return 90;
    if (message.includes('[步骤5]') || message.includes('验证结果')) return 93;
    if (message.includes('处理完成')) return 95;
    return null;
}

class BackendService {
    private baseURL = import.meta.env.PROD
        ? '/api'
        : 'http://localhost:8081/api';

    async processDocuments(
        referenceDoc: DocumentFile | null,
        targetDoc: DocumentFile | null,
        citationStyle: string,
        onProgress: (progress: number) => void,
        onLog: (message: string, level?: string) => void
    ): Promise<{ citations: Citation[], logs: SystemLog[], outputPath?: string }> {

        if (!referenceDoc || !targetDoc) {
            throw new Error('Both documents are required');
        }

        const formData = new FormData();
        formData.append('referenceDoc', referenceDoc.file);
        formData.append('targetDoc', targetDoc.file);
        formData.append('citationStyle', citationStyle);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${this.baseURL}/process-stream`);

            const collectedLogs: SystemLog[] = [];
            let buffer = '';
            let lastProgress = 0;

            xhr.onreadystatechange = () => {
                if (xhr.readyState >= 3 && xhr.status === 200) {
                    // 处理新到的文本块
                    const newText = xhr.responseText.slice(buffer.length);
                    buffer = xhr.responseText;

                    const parts = newText.split('\n\n');
                    parts.forEach(part => {
                        const eventMatch = part.match(/^event: (\w+)\ndata: (.+)$/s);
                        if (!eventMatch) return;
                        const [, eventType, dataStr] = eventMatch;
                        try {
                            const data = JSON.parse(dataStr);
                            if (eventType === 'log') {
                                const msg: string = data.message || '';
                                const level: string = data.level || 'INFO';
                                onLog(msg, level);
                                collectedLogs.push({
                                    id: `log-${collectedLogs.length}`,
                                    timestamp: new Date().toISOString(),
                                    level: level as 'INFO' | 'ERROR' | 'WARN',
                                    module: 'Python',
                                    message: msg
                                });
                                // 根据关键词更新进度
                                const p = inferProgress(msg);
                                if (p !== null && p > lastProgress) {
                                    lastProgress = p;
                                    onProgress(p);
                                }
                            } else if (eventType === 'done') {
                                onProgress(100);
                                resolve({
                                    citations: data.citations || [],
                                    logs: collectedLogs,
                                    outputPath: data.outputPath
                                });
                            } else if (eventType === 'error') {
                                reject(new Error(data.message));
                            }
                        } catch (e) {
                            // 忽略解析失败的块
                        }
                    });
                }
            };

            xhr.onerror = () => {
                console.error('Stream request failed, falling back to mock');
                this.mockProcessing(onProgress, onLog).then(resolve).catch(reject);
            };

            xhr.send(formData);
        });
    }

    async getBackendStatus(): Promise<{ loaded: boolean, version?: string }> {
        try {
            const response = await fetch(`${this.baseURL}/status`);
            if (response.ok) {
                const data = await response.json();
                return { loaded: true, version: data.version };
            }
        } catch (error) {
            console.error('Backend not available:', error);
        }
        return { loaded: false };
    }

    private mockProcessing(
        onProgress: (progress: number) => void,
        onLog: (message: string, level?: string) => void
    ): Promise<{ citations: Citation[], logs: SystemLog[], outputPath?: string }> {
        const mockSteps = [
            '[步骤1] 读取文档...',
            '[OK] 英文文档: 21 段落',
            '[步骤2] AI生成对照表...',
            '[阶段1] 识别英文文档中的所有脚注...',
            '[OK] 识别到 26 个脚注',
            '[阶段2] 分批处理对齐（每批10个）...',
            '[批次 1/3] 处理脚注 1 - 10...',
            '[批次 2/3] 处理脚注 11 - 20...',
            '[批次 3/3] 处理脚注 21 - 26...',
            '[步骤3] 保存对照表...',
            '[步骤4] 插入脚注...',
            '[OK] 成功插入: 24 个脚注',
            '[步骤5] 验证结果...',
            '处理完成！'
        ];

        return new Promise((resolve) => {
            let i = 0;
            const logs: SystemLog[] = [];
            const tick = () => {
                if (i >= mockSteps.length) {
                    onProgress(100);
                    resolve({ citations: this.generateMockCitations(), logs });
                    return;
                }
                const msg = mockSteps[i++];
                onLog(msg);
                logs.push({ id: `log-${i}`, timestamp: new Date().toISOString(), level: 'INFO', module: 'Python', message: msg });
                const p = inferProgress(msg);
                if (p !== null) onProgress(p);
                setTimeout(tick, 400);
            };
            tick();
        });
    }

    private generateMockCitations(): Citation[] {
        return [
            {
                id: 'fn_01', anchorNumber: 1,
                originalContext: "The concept of da-sein suggested by Heidegger[1] is complex.",
                originalFootnote: "Heidegger, M. Being and Time. 1927.",
                translatedFootnote: "海德格尔. 存在与时间. 1927.",
                targetSentence: "海德格尔提出的此在概念非常复杂。",
                confidence: 0.98, status: 'pending', isOrphaned: false
            },
            {
                id: 'fn_02', anchorNumber: 2,
                originalContext: "Statistical analysis shows a significant deviation[2] in the results.",
                originalFootnote: "Smith, J. Statistical Methods. 2020, p. 45.",
                translatedFootnote: "史密斯, J. 统计方法. 2020, 45页.",
                targetSentence: "结果中的统计分析显示出明显的偏差。",
                confidence: 0.89, status: 'pending', isOrphaned: false
            }
        ];
    }
}

export const backendService = new BackendService();
