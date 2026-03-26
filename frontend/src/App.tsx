import React, { useState } from 'react';
import { Download, FileCheck } from 'lucide-react';

import { Layout } from './components/Layout';
import { Processing } from './components/Processing';
import { UploadConfig } from './components/UploadConfig';
import { backendService, ProcessingCancelledError } from './services/backendService';
import { AppState, DocumentFile, WorkflowStep } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    step: WorkflowStep.UPLOAD,
    referenceDoc: null,
    targetDoc: null,
    citationStyle: 'GB/T 7714',
    citations: [],
    processingProgress: 0,
    systemLogs: [],
  });
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);

  const buildDownloadUrl = (downloadUrl?: string | null): string => {
    const fallback = import.meta.env.PROD ? '/api/download' : 'http://localhost:8081/api/download';
    if (!downloadUrl) {
      return fallback;
    }
    return import.meta.env.PROD ? downloadUrl : `http://localhost:8081${downloadUrl}`;
  };

  const triggerDownload = (downloadUrl?: string | null) => {
    const url = buildDownloadUrl(downloadUrl);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'result.docx';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleStartProcessing = async () => {
    setIsStopping(false);
    setOutputPath(null);
    setState((previousState) => ({
      ...previousState,
      step: WorkflowStep.PROCESSING,
      processingProgress: 0,
      systemLogs: [],
    }));

    try {
      const result = await backendService.processDocuments(
        state.referenceDoc,
        state.targetDoc,
        state.citationStyle,
        (progress) => {
          setState((previousState) => ({ ...previousState, processingProgress: progress }));
        },
        (message, level) => {
          setState((previousState) => ({
            ...previousState,
            systemLogs: [
              ...previousState.systemLogs,
              {
                id: `log-${Date.now()}-${Math.random()}`,
                timestamp: new Date().toISOString(),
                level: (level || 'INFO') as 'INFO' | 'ERROR' | 'WARN',
                module: 'Python',
                message,
              },
            ],
          }));
        },
      );

      const downloadUrl = result.outputPath || null;
      setOutputPath(downloadUrl);

      setState((previousState) => ({
        ...previousState,
        citations: result.citations,
        systemLogs: result.logs,
        step: WorkflowStep.EXPORT,
      }));

      triggerDownload(downloadUrl);
    } catch (error) {
      if (error instanceof ProcessingCancelledError) {
        setState((previousState) => ({
          ...previousState,
          step: WorkflowStep.UPLOAD,
          processingProgress: 0,
          systemLogs: [],
        }));
        return;
      }

      console.error('Processing failed:', error);
      window.alert(`Processing failed: ${(error as Error).message}`);
      setState((previousState) => ({ ...previousState, step: WorkflowStep.UPLOAD }));
    } finally {
      setIsStopping(false);
    }
  };

  const handleStopProcessing = () => {
    if (isStopping) {
      return;
    }

    setIsStopping(true);
    backendService.cancelCurrentProcessing();
  };

  const resetForNextRun = () => {
    setOutputPath(null);
    setState((previousState) => ({
      ...previousState,
      step: WorkflowStep.UPLOAD,
      referenceDoc: null,
      targetDoc: null,
      citations: [],
      processingProgress: 0,
      systemLogs: [],
    }));
  };

  const setReferenceDoc = (file: DocumentFile | null) => {
    setState((previousState) => ({ ...previousState, referenceDoc: file }));
  };

  const setTargetDoc = (file: DocumentFile | null) => {
    setState((previousState) => ({ ...previousState, targetDoc: file }));
  };

  const usingAutoTranslation = !state.targetDoc;

  return (
    <Layout currentStep={state.step} onNavigate={(step) => setState((previousState) => ({ ...previousState, step }))}>
      {(state.step === WorkflowStep.UPLOAD || state.step === WorkflowStep.CONFIG) && (
        <UploadConfig
          referenceDoc={state.referenceDoc}
          targetDoc={state.targetDoc}
          citationStyle={state.citationStyle}
          onSetReference={setReferenceDoc}
          onSetTarget={setTargetDoc}
          onSetStyle={(style) => setState((previousState) => ({ ...previousState, citationStyle: style }))}
          onStart={handleStartProcessing}
        />
      )}

      {state.step === WorkflowStep.PROCESSING && (
        <Processing
          progress={state.processingProgress}
          logs={state.systemLogs.map((log) => log.message)}
          onStop={handleStopProcessing}
          isStopping={isStopping}
        />
      )}

      {state.step === WorkflowStep.EXPORT && (
        <div className="relative min-h-screen overflow-hidden px-6 pb-16 pt-24 md:px-10">
          <div className="pointer-events-none absolute inset-0">
            <div className="ambient-grid absolute inset-0 opacity-30" />
            <div className="absolute left-[-10%] top-[10%] h-72 w-72 rounded-full bg-white/[0.06] blur-3xl" />
            <div className="absolute right-[-12%] bottom-[6%] h-80 w-80 rounded-full bg-white/[0.05] blur-3xl" />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-4xl upload-surface p-6 md:p-10">
            <div className="space-y-8 text-center">
              <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full border border-white/14 bg-white/10 text-white">
                <FileCheck size={36} />
              </div>

              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.32em] text-white/42">Export Ready</p>
                <h1 className="text-3xl font-medium leading-tight text-white md:text-5xl">
                  Your translated DOCX is ready to download.
                </h1>
                <p className="mx-auto max-w-2xl text-sm leading-7 text-white/64 md:text-base">
                  Processed <span className="font-medium text-white">{state.citations.length}</span>{' '}
                  translated footnotes
                  {usingAutoTranslation
                    ? ' and generated the Chinese body before insertion.'
                    : ' and merged them back into your uploaded Chinese draft.'}
                </p>
              </div>

              <div className="grid gap-4 text-left md:grid-cols-3">
                <div className="line-panel px-5 py-5">
                  <p className="text-xs uppercase tracking-[0.32em] text-white/42">Source</p>
                  <p className="mt-3 text-sm font-medium text-white">{state.referenceDoc?.name || 'Not provided'}</p>
                </div>

                <div className="line-panel px-5 py-5">
                  <p className="text-xs uppercase tracking-[0.32em] text-white/42">Chinese body</p>
                  <p className="mt-3 text-sm font-medium text-white">
                    {state.targetDoc?.name || 'Generated automatically'}
                  </p>
                </div>

                <div className="line-panel px-5 py-5">
                  <p className="text-xs uppercase tracking-[0.32em] text-white/42">Citation style</p>
                  <p className="mt-3 text-sm font-medium text-white">{state.citationStyle}</p>
                </div>
              </div>

              <div className="line-panel px-5 py-5 text-sm leading-7 text-white/62">
                Download should begin automatically. If the browser does not trigger it, use the
                manual download button below.
              </div>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a
                  href={buildDownloadUrl(outputPath)}
                  download="result.docx"
                  className="pill-shell"
                >
                  <span className="pill-streak" />
                  <span className="pill-inner-light">
                    <Download size={16} />
                    Download DOCX
                  </span>
                </a>

                <button type="button" onClick={resetForNextRun} className="pill-shell">
                  <span className="pill-streak" />
                  <span className="pill-inner-dark">Process Another File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
