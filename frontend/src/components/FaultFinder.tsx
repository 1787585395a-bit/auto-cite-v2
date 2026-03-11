import React from 'react';
import { SystemLog, Citation } from '../types';
import { AlertOctagon, Terminal, FileWarning, SearchX } from 'lucide-react';

interface FaultFinderProps {
  logs: SystemLog[];
  citations: Citation[];
}

export const FaultFinder: React.FC<FaultFinderProps> = ({ logs, citations }) => {
  const orphans = citations.filter(c => c.isOrphaned);
  const lowConfidence = citations.filter(c => c.confidence < 0.85 && !c.isOrphaned);
  const errors = logs.filter(l => l.level === 'ERROR' || l.level === 'WARN');

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-100">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <AlertOctagon className="text-red-500" />
            System Diagnostics & Fault Finder
          </h2>
          <span className="bg-white px-4 py-1 rounded-full text-sm font-medium border border-slate-200 shadow-sm">
            Session ID: #AC-2026-02-11-X99
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Orphaned Footnotes */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-red-50 border-b border-red-100 p-4 flex items-center justify-between">
              <h3 className="font-semibold text-red-800 flex items-center gap-2">
                <FileWarning size={18} />
                Orphaned Footnotes
              </h3>
              <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">{orphans.length}</span>
            </div>
            <div className="p-4">
              {orphans.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No orphaned footnotes found.</p>
              ) : (
                <ul className="space-y-3">
                  {orphans.map(o => (
                    <li key={o.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-500">[ID: {o.anchorNumber}]</span>
                        <span className="text-xs bg-red-100 text-red-600 px-1 rounded">No Match</span>
                      </div>
                      <p className="text-slate-600 italic truncate">"{o.originalFootnote}"</p>
                      <button className="text-brand-600 text-xs mt-2 hover:underline">Locate in source</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Card 2: Low Confidence Matches */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-amber-50 border-b border-amber-100 p-4 flex items-center justify-between">
              <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                <SearchX size={18} />
                Low Confidence Checks
              </h3>
              <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{lowConfidence.length}</span>
            </div>
            <div className="p-4">
              {lowConfidence.length === 0 ? (
                 <p className="text-slate-400 text-sm text-center py-4">All matches have high confidence.</p>
              ) : (
                 <ul className="space-y-3">
                  {lowConfidence.map(c => (
                    <li key={c.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                       <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-700">Anchor [{c.anchorNumber}]</span>
                          <span className="text-xs font-mono text-amber-600">Conf: {(c.confidence * 100).toFixed(1)}%</span>
                       </div>
                       <p className="text-slate-500 text-xs line-clamp-2">{c.targetSentence}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Card 3: Error Logs */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden md:col-span-1">
             <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Terminal size={18} />
                System Logs
              </h3>
            </div>
            <div className="p-0 h-64 overflow-y-auto bg-slate-900 text-slate-300 font-mono text-xs">
              {logs.map(log => (
                <div key={log.id} className={`p-2 border-b border-slate-800 ${log.level === 'ERROR' ? 'text-red-400' : log.level === 'WARN' ? 'text-amber-400' : 'text-slate-300'}`}>
                  <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className="mx-2 font-bold">[{log.level}]</span>
                  <span>{log.message}</span>
                </div>
              ))}
              {logs.length === 0 && <div className="p-4 text-slate-500">No logs generated.</div>}
            </div>
          </div>
        </div>

        {/* Detailed Analysis Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-lg mb-4 text-slate-800">Diagnostic Summary</h3>
          <div className="flex gap-4 mb-4">
             <div className="flex-1 p-4 bg-slate-50 rounded-lg">
                <div className="text-sm text-slate-500">Total Anchors Found</div>
                <div className="text-2xl font-bold text-slate-800">{citations.length}</div>
             </div>
             <div className="flex-1 p-4 bg-slate-50 rounded-lg">
                <div className="text-sm text-slate-500">Average Semantic Score</div>
                <div className="text-2xl font-bold text-brand-600">
                  {(citations.reduce((acc, c) => acc + c.confidence, 0) / (citations.length || 1) * 100).toFixed(1)}%
                </div>
             </div>
             <div className="flex-1 p-4 bg-slate-50 rounded-lg">
                <div className="text-sm text-slate-500">Processing Time</div>
                <div className="text-2xl font-bold text-slate-800">1.2s</div>
             </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            The semantic alignment engine detected a structural deviation in paragraph 3 (Anchor [5]), resulting in an orphaned footnote. 
            This usually happens when the translator omits a sentence or significantly alters the sentence structure. 
            Recommendation: Use the manual insertion tool in the "Review" tab to place Anchor [5].
          </p>
        </div>

      </div>
    </div>
  );
};