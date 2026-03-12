import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { UploadConfig } from './components/UploadConfig';
import { Processing } from './components/Processing';
import { WorkflowStep, AppState } from './types';
import { backendService } from './services/backendService';
import { FileCheck, Download } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    step: WorkflowStep.UPLOAD,
    referenceDoc: null,
    targetDoc: null,
    citationStyle: 'GB/T 7714',
    citations: [],
    processingProgress: 0,
    systemLogs: []
  });
  const [outputPath, setOutputPath] = useState<string | null>(null);

  // 构建完整的下载URL（生产环境用相对路径，开发环境用本地地址）
  const buildDownloadUrl = (downloadUrl?: string | null): string => {
    const fallback = import.meta.env.PROD
      ? '/api/download'
      : 'http://localhost:8081/api/download';
    if (!downloadUrl) return fallback;
    return import.meta.env.PROD
      ? downloadUrl
      : `http://localhost:8081${downloadUrl}`;
  };

  // 同步触发下载：直接用原生 <a> 标签，不走 fetch/blob
  // 这样不依赖用户手势上下文，浏览器不会拦截
  const triggerDownload = (downloadUrl?: string | null) => {
    const url = buildDownloadUrl(downloadUrl);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'result.docx';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleStartProcessing = async () => {
    setState(prev => ({ ...prev, step: WorkflowStep.PROCESSING, processingProgress: 0, systemLogs: [] }));

    try {
      const result = await backendService.processDocuments(
        state.referenceDoc,
        state.targetDoc,
        state.citationStyle,
        (progress) => {
          setState(prev => ({ ...prev, processingProgress: progress }));
        },
        (message, level) => {
          setState(prev => ({
            ...prev,
            systemLogs: [...prev.systemLogs, {
              id: `log-${Date.now()}-${Math.random()}`,
              timestamp: new Date().toISOString(),
              level: (level || 'INFO') as 'INFO' | 'ERROR' | 'WARN',
              module: 'Python',
              message
            }]
          }));
        }
      );

      const dlUrl = result.outputPath || null;
      setOutputPath(dlUrl);

      setState(prev => ({
        ...prev,
        citations: result.citations,
        systemLogs: result.logs,
        step: WorkflowStep.EXPORT
      }));

      // 自动触发下载（同步，不依赖用户手势）
      triggerDownload(dlUrl);

    } catch (error) {
      console.error('Processing failed:', error);
      alert('处理失败: ' + (error as Error).message);
      setState(prev => ({ ...prev, step: WorkflowStep.EXPORT }));
    }
  };

  return (
    <Layout
      currentStep={state.step}
      onNavigate={(step) => setState(prev => ({ ...prev, step }))}
    >
      {(state.step === WorkflowStep.UPLOAD || state.step === WorkflowStep.CONFIG) && (
        <UploadConfig
          referenceDoc={state.referenceDoc}
          targetDoc={state.targetDoc}
          citationStyle={state.citationStyle}
          onSetReference={(file) => setState(prev => ({ ...prev, referenceDoc: file }))}
          onSetTarget={(file) => setState(prev => ({ ...prev, targetDoc: file }))}
          onSetStyle={(style) => setState(prev => ({ ...prev, citationStyle: style }))}
          onStart={handleStartProcessing}
        />
      )}

      {state.step === WorkflowStep.PROCESSING && (
        <Processing
          progress={state.processingProgress}
          logs={state.systemLogs.map(l => l.message)}
        />
      )}

      {state.step === WorkflowStep.EXPORT && (
        <div className="h-full flex flex-col items-center justify-center bg-white p-8">
          <div className="text-center space-y-6 max-w-lg">
            <div className="w-24 h-24 bg-slate-100 text-black rounded-full flex items-center justify-center mx-auto shadow-lg">
              <FileCheck size={48} />
            </div>
            <h2 className="text-3xl font-bold text-black">处理完成！</h2>
            <p className="text-slate-600">
              文档已成功处理，共找到 <strong>{state.citations.length}</strong> 个脚注。
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm text-slate-500">
              下载应已自动开始。如未开始，请点击下方按钮。
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left">
              <h4 className="font-bold text-black mb-2">处理摘要</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex justify-between">
                  <span>引用格式:</span>
                  <span className="font-mono">{state.citationStyle}</span>
                </li>
                <li className="flex justify-between">
                  <span>参考文档:</span>
                  <span className="font-mono text-xs">{state.referenceDoc?.name}</span>
                </li>
                <li className="flex justify-between">
                  <span>目标文档:</span>
                  <span className="font-mono text-xs">{state.targetDoc?.name}</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-4 justify-center">
              {/* 使用原生 <a> 标签，href 直接指向下载接口，最可靠的下载方式 */}
              <a
                href={buildDownloadUrl(outputPath)}
                download="result.docx"
                className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl hover:bg-slate-800 font-bold shadow-lg transition-transform hover:-translate-y-1"
              >
                <Download size={20} /> 下载 .docx
              </a>
              <button
                onClick={() => {
                  setOutputPath(null);
                  setState(prev => ({
                    ...prev,
                    step: WorkflowStep.UPLOAD,
                    referenceDoc: null,
                    targetDoc: null,
                    citations: [],
                    processingProgress: 0
                  }));
                }}
                className="px-6 py-3 rounded-xl text-slate-600 hover:bg-slate-200 font-medium"
              >
                处理新文件
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
