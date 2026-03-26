import { Citation, SystemLog, DocumentFile } from '../types';

function inferProgress(message: string): number | null {
  if (message.includes('[STEP 1]')) return 10;
  if (message.includes('[STEP 2]')) return 25;
  if (message.includes('[STEP 3A]')) return 45;
  if (message.includes('[STEP 3B]')) return 60;
  if (message.includes('[STEP 3]')) return 40;
  if (message.includes('[STEP 4]')) return 72;
  if (message.includes('[STEP 5]')) return 85;
  if (message.includes('[STEP 6]')) return 93;
  if (message.includes('[DONE]')) return 98;
  if (message.includes('[BATCH 1/')) return 35;
  if (message.includes('[BATCH 2/')) return 45;
  if (message.includes('[BATCH 3/')) return 55;
  if (message.includes('[BATCH 4/')) return 65;
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
    onLog: (message: string, level?: string) => void,
  ): Promise<{ citations: Citation[]; logs: SystemLog[]; outputPath?: string }> {
    if (!referenceDoc) {
      throw new Error('Reference document is required');
    }

    const formData = new FormData();
    formData.append('referenceDoc', referenceDoc.file);
    if (targetDoc) {
      formData.append('targetDoc', targetDoc.file);
    }
    formData.append('citationStyle', citationStyle);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseURL}/process-stream`);

      const collectedLogs: SystemLog[] = [];
      let chunkBuffer = '';
      let sseEventBuffer = '';
      let lastProgress = 0;
      let settled = false;

      const handleEvent = (eventType: string, dataStr: string) => {
        if (settled) {
          return;
        }

        try {
          const data = JSON.parse(dataStr);

          if (eventType === 'log') {
            const msg = data.message || '';
            const level = data.level || 'INFO';
            onLog(msg, level);

            collectedLogs.push({
              id: `log-${collectedLogs.length}`,
              timestamp: new Date().toISOString(),
              level: level as 'INFO' | 'ERROR' | 'WARN',
              module: 'Python',
              message: msg,
            });

            const progress = inferProgress(msg);
            if (progress !== null && progress > lastProgress) {
              lastProgress = progress;
              onProgress(progress);
            }
          } else if (eventType === 'done') {
            settled = true;
            onProgress(100);
            resolve({
              citations: data.citations || [],
              logs: collectedLogs,
              outputPath: data.downloadUrl || data.outputPath,
            });
          } else if (eventType === 'error') {
            settled = true;
            reject(new Error(data.message));
          }
        } catch (error) {
          // Ignore malformed partial SSE fragments.
        }
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState >= 3 && xhr.status === 200) {
          const newText = xhr.responseText.slice(chunkBuffer.length);
          chunkBuffer = xhr.responseText;
          sseEventBuffer += newText;

          let boundary: number;
          while ((boundary = sseEventBuffer.indexOf('\n\n')) !== -1) {
            const rawEvent = sseEventBuffer.slice(0, boundary).trim();
            sseEventBuffer = sseEventBuffer.slice(boundary + 2);
            if (!rawEvent) {
              continue;
            }

            const eventMatch = rawEvent.match(/^event: (\w+)\ndata: (.+)$/s);
            if (!eventMatch) {
              continue;
            }

            const [, eventType, dataStr] = eventMatch;
            handleEvent(eventType, dataStr);
          }
        }
      };

      xhr.onerror = () => {
        console.error('Stream request failed, falling back to mock');
        this.mockProcessing(onProgress, onLog).then(resolve).catch(reject);
      };

      xhr.send(formData);
    });
  }

  async getBackendStatus(): Promise<{ loaded: boolean; version?: string }> {
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
    onLog: (message: string, level?: string) => void,
  ): Promise<{ citations: Citation[]; logs: SystemLog[]; outputPath?: string }> {
    const mockSteps = [
      '[STEP 1] Reading English source...',
      '[STEP 2] Detecting English footnotes...',
      '[STEP 3A] Translating Chinese body...',
      '[STEP 3B] Translating footnotes...',
      '[STEP 4] Saving review artifacts...',
      '[STEP 5] Building translated DOCX draft...',
      '[STEP 6] Validating output...',
      '[DONE] Processing complete.',
    ];

    return new Promise((resolve) => {
      let index = 0;
      const logs: SystemLog[] = [];

      const tick = () => {
        if (index >= mockSteps.length) {
          onProgress(100);
          resolve({ citations: this.generateMockCitations(), logs });
          return;
        }

        const message = mockSteps[index++];
        onLog(message);
        logs.push({
          id: `log-${index}`,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          module: 'Python',
          message,
        });

        const progress = inferProgress(message);
        if (progress !== null) {
          onProgress(progress);
        }

        setTimeout(tick, 400);
      };

      tick();
    });
  }

  private generateMockCitations(): Citation[] {
    return [
      {
        id: 'fn_01',
        anchorNumber: 1,
        originalContext: 'The concept of da-sein suggested by Heidegger[1] is complex.',
        originalFootnote: 'Heidegger, M. Being and Time. 1927.',
        translatedFootnote: '海德格尔. 存在与时间[M]. 1927.',
        targetSentence: '海德格尔提出的此在概念非常复杂。',
        confidence: 0.98,
        status: 'pending',
        isOrphaned: false,
      },
      {
        id: 'fn_02',
        anchorNumber: 2,
        originalContext: 'Statistical analysis shows a significant deviation[2] in the results.',
        originalFootnote: 'Smith, J. Statistical Methods. 2020, p. 45.',
        translatedFootnote: 'Smith J. 统计方法[M]. 2020:45.',
        targetSentence: '结果中的统计分析显示出明显的偏差。',
        confidence: 0.89,
        status: 'pending',
        isOrphaned: false,
      },
    ];
  }
}

export const backendService = new BackendService();
