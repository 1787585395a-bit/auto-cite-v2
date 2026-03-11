import React, { useState } from 'react';
import { UploadCloud, FileType, CheckCircle, ArrowRight } from 'lucide-react';
import { DocumentFile } from '../types';
import { LiquidButton } from './ui/liquid-glass-button';

interface UploadConfigProps {
  referenceDoc: DocumentFile | null;
  targetDoc: DocumentFile | null;
  citationStyle: string;
  onSetReference: (file: DocumentFile) => void;
  onSetTarget: (file: DocumentFile) => void;
  onSetStyle: (style: string) => void;
  onStart: () => void;
}

export const UploadConfig: React.FC<UploadConfigProps> = ({
  referenceDoc,
  targetDoc,
  citationStyle,
  onSetReference,
  onSetTarget,
  onSetStyle,
  onStart
}) => {
  const [isDragOverRef, setIsDragOverRef] = useState(false);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);
  const refInputRef = React.useRef<HTMLInputElement>(null);
  const targetInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File, type: 'reference' | 'target') => {
    const docFile: DocumentFile = {
      name: file.name,
      size: file.size,
      type: type,
      uploadDate: Date.now(),
      file: file
    };

    if (type === 'reference') onSetReference(docFile);
    else onSetTarget(docFile);
  };

  const handleDrop = (e: React.DragEvent, type: 'reference' | 'target') => {
    e.preventDefault();
    if (type === 'reference') setIsDragOverRef(false);
    else setIsDragOverTarget(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0], type);
    }
  };

  const handleClick = (type: 'reference' | 'target') => {
    if (type === 'reference') {
      refInputRef.current?.click();
    } else {
      targetInputRef.current?.click();
    }
  };

  const isReady = referenceDoc && targetDoc;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">

      {/* Hidden file inputs */}
      <input
        ref={refInputRef}
        type="file"
        accept=".pdf,.docx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file, 'reference');
        }}
      />
      <input
        ref={targetInputRef}
        type="file"
        accept=".docx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file, 'target');
        }}
      />

      {/* Step 1: Upload */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-black flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-black text-sm">1</span>
            Document Upload
          </h2>
          <p className="text-slate-600 ml-10">Upload your source English reference document and the target Chinese translation.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ml-10">
          {/* Reference Doc Upload */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all h-64
              ${referenceDoc ? 'border-black bg-slate-50' : isDragOverRef ? 'border-black bg-slate-50' : 'border-black bg-white hover:border-slate-800'}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsDragOverRef(true); }}
            onDragLeave={() => setIsDragOverRef(false)}
            onDrop={(e) => handleDrop(e, 'reference')}
          >
            {referenceDoc ? (
              <div className="space-y-3">
                <div className="w-16 h-16 bg-slate-100 text-black rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={32} />
                </div>
                <div>
                  <p className="font-semibold text-black">{referenceDoc.name}</p>
                  <p className="text-sm text-slate-500">{(referenceDoc.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => {}} className="text-xs text-slate-600 hover:underline">Remove</button>
              </div>
            ) : (
              <div className="space-y-4 cursor-pointer" onClick={() => handleClick('reference')}>
                <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto group-hover:bg-white">
                  <UploadCloud size={32} />
                </div>
                <div>
                  <p className="font-medium text-black">Reference Document</p>
                  <p className="text-xs text-slate-500 mt-1">Drag & drop or click to browse</p>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mt-2">.docx, .pdf</p>
                </div>
              </div>
            )}
          </div>

          {/* Target Doc Upload */}
          <div
             className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all h-64
              ${targetDoc ? 'border-black bg-slate-50' : isDragOverTarget ? 'border-black bg-slate-50' : 'border-black bg-white hover:border-slate-800'}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsDragOverTarget(true); }}
            onDragLeave={() => setIsDragOverTarget(false)}
            onDrop={(e) => handleDrop(e, 'target')}
          >
             {targetDoc ? (
              <div className="space-y-3">
                <div className="w-16 h-16 bg-slate-100 text-black rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={32} />
                </div>
                <div>
                  <p className="font-semibold text-black">{targetDoc.name}</p>
                  <p className="text-sm text-slate-500">{(targetDoc.size / 1024).toFixed(1)} KB</p>
                </div>
                 <button onClick={() => {}} className="text-xs text-slate-600 hover:underline">Remove</button>
              </div>
            ) : (
              <div className="space-y-4 cursor-pointer" onClick={() => handleClick('target')}>
                <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto">
                  <FileType size={32} />
                </div>
                <div>
                  <p className="font-medium text-black">Target Document (Translation)</p>
                  <p className="text-xs text-slate-500 mt-1">Drag & drop or click to browse</p>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mt-2">.docx</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Step 2: Configuration */}
      <section className="border-t border-slate-200 pt-8">
        <div className="mb-6">
           <h2 className="text-xl font-bold text-black flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-black text-sm">2</span>
            Citation Style Configuration
          </h2>
          <p className="text-slate-600 ml-10">Select how the English references should be formatted in the Chinese document.</p>
        </div>

        <div className="ml-10 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <label className="block text-sm font-medium text-black mb-2">Output Format Standard</label>
          <select
            value={citationStyle}
            onChange={(e) => onSetStyle(e.target.value)}
            className="w-full md:w-1/2 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black outline-none"
          >
            <option value="GB/T 7714">GB/T 7714 (China National Standard)</option>
            <option value="APA">APA 7th Edition (Translated)</option>
            <option value="Chicago">Chicago Manual of Style (Translated)</option>
            <option value="Custom">Custom Template...</option>
          </select>

          {citationStyle === 'Custom' && (
             <div className="mt-4">
                <label className="block text-sm font-medium text-black mb-2">Template String</label>
                <input
                  type="text"
                  defaultValue="[序号] 作者. 书名[M]. 译者, 译. 出版地: 出版社, 年份."
                  className="w-full p-3 border border-slate-300 rounded-lg font-mono text-sm bg-slate-50"
                />
             </div>
          )}

          <div className="mt-4 p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
            <strong>Preview:</strong> [1] 海德格尔. 存在与时间. 1927.
          </div>
        </div>
      </section>

      {/* Action */}
      <div className="flex justify-end pt-4 pb-12">
        <LiquidButton
          onClick={onStart}
          disabled={!isReady}
          size="xxl"
          className={!isReady ? 'opacity-50 cursor-not-allowed' : ''}
        >
          Start Processing
          <ArrowRight size={20} />
        </LiquidButton>
      </div>

    </div>
  );
};