import React, { useState } from 'react';
import { Citation } from '../types';
import { Check, X, MoveVertical, AlertCircle, Edit2, ExternalLink } from 'lucide-react';

interface ReviewerProps {
  citations: Citation[];
  onUpdateCitation: (id: string, updates: Partial<Citation>) => void;
  onConfirmAll: () => void;
}

export const Reviewer: React.FC<ReviewerProps> = ({ citations, onUpdateCitation, onConfirmAll }) => {
  const [activeCitationId, setActiveCitationId] = useState<string | null>(citations[0]?.id || null);

  const activeCitation = citations.find(c => c.id === activeCitationId);
  const orphanCount = citations.filter(c => c.isOrphaned).length;
  const pendingCount = citations.filter(c => c.status === 'pending' || c.status === 'manual_review').length;

  const handleStatusChange = (id: string, status: Citation['status']) => {
    onUpdateCitation(id, { status });
    // Auto advance to next pending
    const currentIndex = citations.findIndex(c => c.id === id);
    if (currentIndex < citations.length - 1) {
       setActiveCitationId(citations[currentIndex + 1].id);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-sm font-medium text-slate-600">{pendingCount} Pending Review</span>
          </div>
          <div className="h-4 w-px bg-slate-300"></div>
          <div className="flex items-center gap-2">
             <span className="w-3 h-3 rounded-full bg-red-500"></span>
             <span className="text-sm font-medium text-slate-600">{orphanCount} Orphans</span>
          </div>
        </div>
        <button 
          onClick={onConfirmAll}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Check size={16} />
          Complete & Export
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Source Document (Read Only) */}
        <div className="w-1/2 bg-slate-50 border-r border-slate-200 flex flex-col">
           <div className="p-2 bg-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">Reference Document (English)</div>
           <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {citations.filter(c => !c.isOrphaned).map(c => (
                <div 
                  key={`src-${c.id}`}
                  onClick={() => setActiveCitationId(c.id)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer relative
                    ${activeCitationId === c.id 
                      ? 'bg-white border-brand-500 ring-1 ring-brand-500 shadow-md' 
                      : 'bg-white/50 border-slate-200 hover:border-slate-300'}
                  `}
                >
                  <span className="absolute -left-2 -top-2 w-6 h-6 bg-slate-700 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                    {c.anchorNumber}
                  </span>
                  <p className="text-slate-800 text-sm leading-relaxed">
                     ... {c.originalContext.replace(`[${c.anchorNumber}]`, '')} <sup className="text-brand-600 font-bold">[{c.anchorNumber}]</sup> ...
                  </p>
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 italic">
                    {c.originalFootnote}
                  </div>
                </div>
              ))}
           </div>
        </div>

        {/* Right: Target Document (Editable Insertion) */}
        <div className="w-1/2 bg-white flex flex-col">
           <div className="p-2 bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">Target Document (Chinese)</div>
           <div className="flex-1 overflow-y-auto p-8 space-y-6 relative">
              
              {/* Active Citation Detail Overlay */}
              {activeCitation && (
                <div className="sticky top-0 z-10 mb-6 bg-slate-900 text-white p-4 rounded-xl shadow-xl border-l-4 border-brand-500">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">Citation Match #{activeCitation.anchorNumber}</h3>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${activeCitation.confidence > 0.85 ? 'bg-green-500' : 'bg-amber-500'}`}>
                      Confidence: {(activeCitation.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-sm text-slate-300 mb-4">
                    <span className="font-semibold text-slate-400 block text-xs uppercase mb-1">Proposed Translation:</span>
                    {activeCitation.translatedFootnote}
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleStatusChange(activeCitation.id, 'accepted')}
                      className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors
                        ${activeCitation.status === 'accepted' ? 'bg-green-600 text-white' : 'bg-slate-700 hover:bg-green-600/80'}
                      `}
                    >
                      <Check size={16} /> Accept
                    </button>
                    <button 
                      onClick={() => handleStatusChange(activeCitation.id, 'manual_review')}
                      className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-brand-600 transition-colors"
                      title="Edit Location"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleStatusChange(activeCitation.id, 'rejected')}
                      className={`px-4 py-2 rounded-lg transition-colors ${activeCitation.status === 'rejected' ? 'bg-red-600' : 'bg-slate-700 hover:bg-red-600'}`}
                      title="Reject"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Document Flow Simulation */}
              {citations.filter(c => !c.isOrphaned).map(c => (
                 <div 
                  key={`target-${c.id}`}
                  className={`p-4 rounded-lg border-l-4 transition-all pl-6 relative
                    ${c.id === activeCitationId ? 'bg-blue-50 border-brand-500' : 'border-transparent'}
                    ${c.status === 'accepted' ? 'opacity-60' : ''}
                  `}
                >
                  <p className="text-slate-800 text-base leading-relaxed">
                    {c.targetSentence.split('。')[0]}
                    
                    {/* The Insertion Point Indicator */}
                    <span className={`inline-flex items-center justify-center px-1 mx-1 rounded cursor-grab active:cursor-grabbing hover:scale-110 transition-transform
                      ${c.confidence > 0.8 ? 'bg-brand-100 text-brand-700 border border-brand-200' : 'bg-amber-100 text-amber-700 border border-amber-200 animate-pulse'}
                    `}>
                      <sup className="font-bold text-xs mr-1">[{c.anchorNumber}]</sup>
                      <MoveVertical size={10} />
                    </span>

                    。
                  </p>
                  {c.confidence < 0.8 && (
                     <div className="flex items-center gap-2 mt-2 text-xs text-amber-600 font-medium">
                        <AlertCircle size={12} />
                        Low confidence match. Please verify position.
                     </div>
                  )}
                </div>
              ))}

           </div>
        </div>

      </div>
    </div>
  );
};