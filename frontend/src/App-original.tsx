import React, { useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Layout } from './components/Layout';
import { UploadConfig } from './components/UploadConfig';
import { Processing } from './components/Processing';
import { Reviewer } from './components/Reviewer';
import { FaultFinder } from './components/FaultFinder';
import { DottedSurface } from './components/ui/dotted-surface';
import { WorkflowStep, DocumentFile, Citation, AppState } from './types';
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

  const handleStartProcessing = async () => {
    setState(prev => ({ ...prev, step: WorkflowStep.PROCESSING }));
    
    // Use backend service for processing
    try {
      const result = await backendService.processDocuments(
        state.referenceDoc,
        state.targetDoc,
        state.citationStyle,
        (p) => {
          setState(prev => ({ ...prev, processingProgress: p }));
        }
      );

      setState(prev => ({
        ...prev,
        citations: result.citations,
        systemLogs: result.logs,
        step: WorkflowStep.REVIEW
      }));
    } catch (error) {
      console.error('Processing failed:', error);
      // Fallback to mock data or show error
      setState(prev => ({
        ...prev,
        step: WorkflowStep.UPLOAD
      }));
    }
  };

  const handleUpdateCitation = (id: string, updates: Partial<Citation>) => {
    setState(prev => ({
      ...prev,
      citations: prev.citations.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const handleConfirmAll = () => {
    setState(prev => ({ ...prev, step: WorkflowStep.EXPORT }));
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <DottedSurface />
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
        <Processing progress={state.processingProgress} />
      )}

      {state.step === WorkflowStep.REVIEW && (
        <Reviewer 
          citations={state.citations} 
          onUpdateCitation={handleUpdateCitation}
          onConfirmAll={handleConfirmAll}
        />
      )}

      {state.step === WorkflowStep.FAULT_FINDING && (
        <FaultFinder 
          logs={state.systemLogs}
          citations={state.citations}
        />
      )}

      {state.step === WorkflowStep.EXPORT && (
        <div className="h-full flex flex-col items-center justify-center bg-white p-8">
           <div className="text-center space-y-6 max-w-lg">
              <div className="w-24 h-24 bg-slate-100 text-black rounded-full flex items-center justify-center mx-auto shadow-lg">
                <FileCheck size={48} />
              </div>
              <h2 className="text-3xl font-bold text-black">Processing Complete!</h2>
              <p className="text-slate-600">
                Your translated document has been successfully synchronized with {state.citations.filter(c => c.status === 'accepted').length} citations.
                The bibliography has been formatted according to {state.citationStyle}.
              </p>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left">
                 <h4 className="font-bold text-black mb-2">Export Summary</h4>
                 <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex justify-between"><span>Total Citations:</span> <span className="font-mono">{state.citations.length}</span></li>
                    <li className="flex justify-between"><span>Orphans (Appended to End):</span> <span className="font-mono">{state.citations.filter(c => c.isOrphaned).length}</span></li>
                    <li className="flex justify-between"><span>Format:</span> <span className="font-mono">{state.citationStyle}</span></li>
                 </ul>
              </div>

              <div className="flex gap-4 justify-center">
                 <button className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl hover:bg-slate-800 font-bold shadow-lg transition-transform hover:-translate-y-1">
                    <Download size={20} /> Download .docx
                 </button>
                 <button
                  onClick={() => setState(prev => ({...prev, step: WorkflowStep.UPLOAD, referenceDoc: null, targetDoc: null, citations: []}))}
                  className="px-6 py-3 rounded-xl text-slate-600 hover:bg-slate-200 font-medium"
                >
                    Process New File
                 </button>
              </div>
           </div>
        </div>
      )}

    </Layout>
    </ThemeProvider>
  );
};

export default App;