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

  const handleStartProcessing = async () => {
    // 切换到处理页面，清空旧日志
    setState(prev => ({ ...prev, step: WorkflowStep.PROCESSING, processingProgress: 0, systemLogs: [] }));

    try {
      // 调用后端服务
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

      // 保存输出路径（带sessionId的下载URL）
      if (result.outputPath) {
        setOutputPath(result.outputPath);
      }

      // 处理完成，切换到导出页面
      setState(prev => ({
        ...prev,
        citations: result.citations,
        systemLogs: result.logs,
        step: WorkflowStep.EXPORT
      }));

      // 自动触发浏览器下载，无需用户手动点击
      try {
        await triggerDownload(result.outputPath || undefined);
      } catch (error) {
        // 自动下载失败不弹框，用户可手动点击按钮重试
        console.error('Auto-download failed:', error);
      }
    } catch (error) {
      console.error('Processing failed:', error);
      alert('处理失败: ' + (error as Error).message + '\n\n如果Express服务器未运行，将使用Mock数据。');
      // 即使失败也切换到导出页面（使用Mock数据）
      setState(prev => ({ ...prev, step: WorkflowStep.EXPORT }));
    }
  };

  const triggerDownload = async (downloadUrl?: string) => {
    // 优先使用后端返回的带sessionId的URL，否则回退默认接口
    const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:8081';
    const url = downloadUrl
      ? (import.meta.env.PROD ? downloadUrl : `http://localhost:8081${downloadUrl}`)
      : `${baseUrl}/api/download`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`服务器返回 ${response.status}，请重试`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'result.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      throw error;
    }
  };

  const handleDownload = async () => {
    try {
      await triggerDownload(outputPath || undefined);
    } catch (error) {
      alert('下载失败: ' + (error as Error).message);
    }
  };

  return (
    <Layout
      currentStep={state.step}
      onNavigate={(step) => setState(prev => ({ ...prev, step }))}
    >
      {/* 上传配置页面 */}
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

      {/* 处理进度页面 */}
      {state.step === WorkflowStep.PROCESSING && (
        <Processing
          progress={state.processingProgress}
          logs={state.systemLogs.map(l => l.message)}
        />
      )}

      {/* 完成页面 */}
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
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl hover:bg-slate-800 font-bold shadow-lg transition-transform hover:-translate-y-1"
              >
                <Download size={20} /> 下载 .docx
              </button>
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
