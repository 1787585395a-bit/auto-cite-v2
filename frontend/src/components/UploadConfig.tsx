import React, { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Languages, UploadCloud } from 'lucide-react';

import { DocumentFile } from '../types';

const HERO_VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260217_030345_246c0224-10a4-422c-b324-070b7c0eceda.mp4';

const previewExamples: Record<string, string> = {
  'GB/T 7714':
    '[1] Heidegger, M. Being and Time[M]. Chinese translated edition. Beijing: Commercial Press, 2014.',
  APA: 'Heidegger, M. (1927/2014). Being and Time (Chinese translated edition). Commercial Press.',
  Chicago:
    'Martin Heidegger, Being and Time, Chinese translated edition (Beijing: Commercial Press, 2014).',
  Custom: 'Use your own translated footnote template string for the final DOCX output.',
};

interface UploadConfigProps {
  referenceDoc: DocumentFile | null;
  targetDoc: DocumentFile | null;
  citationStyle: string;
  onSetReference: (file: DocumentFile | null) => void;
  onSetTarget: (file: DocumentFile | null) => void;
  onSetStyle: (style: string) => void;
  onStart: () => void;
}

interface PillButtonProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
  shell?: boolean;
  tone?: 'dark' | 'light';
  type?: 'button' | 'submit';
}

const PillButton: React.FC<PillButtonProps> = ({
  children,
  className = '',
  disabled = false,
  onClick,
  shell = true,
  tone = 'dark',
  type = 'button',
}) => {
  const innerClassName =
    tone === 'light' ? 'pill-inner-light hover:bg-white/90' : 'pill-inner-dark hover:bg-white/[0.08]';

  if (!shell) {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`${innerClassName} ${disabled ? 'cursor-not-allowed opacity-45' : ''} ${className}`}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`pill-shell ${disabled ? 'cursor-not-allowed opacity-45' : ''} ${className}`}
    >
      <span className="pill-streak" />
      <span className={innerClassName}>{children}</span>
    </button>
  );
};

interface UploadSlotProps {
  acceptedLabel: string;
  dragActive: boolean;
  file: DocumentFile | null;
  icon: React.ReactNode;
  marker: string;
  note: string;
  onDragLeave: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onPick: () => void;
  onRemove: () => void;
  title: string;
}

const UploadSlot: React.FC<UploadSlotProps> = ({
  acceptedLabel,
  dragActive,
  file,
  icon,
  marker,
  note,
  onDragLeave,
  onDragOver,
  onDrop,
  onPick,
  onRemove,
  title,
}) => {
  const stateClassName = file
    ? 'border-white/30 bg-white/[0.08]'
    : dragActive
      ? 'border-white/45 bg-white/[0.08]'
      : 'border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]';

  return (
    <div
      className={`line-panel min-h-[176px] border border-dashed p-4 md:min-h-[188px] md:p-5 transition duration-300 ${stateClassName}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {file ? (
        <div className="flex h-full flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white">
              <CheckCircle2 size={20} />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-[0.32em] text-white/45">{title}</p>
                <span className="rounded-full border border-white/12 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-white/45">
                  {marker}
                </span>
              </div>
              <p className="text-base font-medium text-white">{file.name}</p>
              <p className="text-sm text-white/45">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRemove}
            className="text-left text-sm font-medium text-white/70 transition hover:text-white"
          >
            Remove file
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="flex h-full w-full flex-col items-start justify-between text-left"
        >
          <div className="space-y-3.5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/88">
              {icon}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-[0.32em] text-white/45">{title}</p>
                <span className="rounded-full border border-white/12 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-white/45">
                  {marker}
                </span>
              </div>
              <p className="max-w-sm text-sm leading-6 text-white/68">{note}</p>
            </div>
          </div>

          <p className="text-xs uppercase tracking-[0.32em] text-white/40">{acceptedLabel}</p>
        </button>
      )}
    </div>
  );
};

export const UploadConfig: React.FC<UploadConfigProps> = ({
  referenceDoc,
  targetDoc,
  citationStyle,
  onSetReference,
  onSetTarget,
  onSetStyle,
  onStart,
}) => {
  const [isDragOverRef, setIsDragOverRef] = useState(false);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);

  const refInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File, type: 'reference' | 'target') => {
    const docFile: DocumentFile = {
      name: file.name,
      size: file.size,
      type,
      uploadDate: Date.now(),
      file,
    };

    if (type === 'reference') {
      onSetReference(docFile);
      return;
    }

    onSetTarget(docFile);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, type: 'reference' | 'target') => {
    event.preventDefault();

    if (type === 'reference') {
      setIsDragOverRef(false);
    } else {
      setIsDragOverTarget(false);
    }

    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file, type);
    }
  };

  const openPicker = (type: 'reference' | 'target') => {
    const input = type === 'reference' ? refInputRef.current : targetInputRef.current;
    if (!input) {
      return;
    }

    input.value = '';
    input.click();
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isReady = Boolean(referenceDoc);

  return (
    <div className="relative bg-black text-white">
      <input
        ref={refInputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            handleFileSelect(file, 'reference');
          }
        }}
      />

      <input
        ref={targetInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            handleFileSelect(file, 'target');
          }
        }}
      />

      <section id="hero" className="relative isolate min-h-[100svh] overflow-hidden border-b border-white/10">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO_URL}
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="absolute inset-0 bg-black/52" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.76)_72%,#000_100%)]" />

        <nav className="absolute inset-x-0 top-0 z-20 px-6 py-5 md:px-10 xl:px-[120px]">
          <button
            type="button"
            onClick={() => scrollToSection('hero')}
            className="text-sm font-medium tracking-[0.38em] text-white md:text-base"
          >
            AUTO CITE
          </button>
        </nav>

        <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-6 pb-20 pt-24 text-center md:px-10 md:pb-16 xl:px-[120px]">
          <div className="w-full max-w-[760px] space-y-6">
            <h1 className="hero-text-gradient mx-auto max-w-[680px] text-[34px] font-medium leading-[1.18] md:text-[52px]">
              Auto-Cite for research that needs the footnotes to stay intact.
            </h1>
            <p className="mx-auto max-w-[580px] text-[15px] leading-7 text-white/72">
              Upload an English DOCX or PDF, add a Chinese draft if you already have one, and
              export a finished DOCX with translated footnotes.
            </p>

            <PillButton tone="light" onClick={() => scrollToSection('workspace')}>
              Start
            </PillButton>
          </div>
        </div>
      </section>

      <section id="workspace" className="relative z-20 bg-[#030303] px-6 pb-12 pt-12 md:px-10 md:pt-14 xl:px-[120px]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-center gap-4">
            <p className="text-[11px] uppercase tracking-[0.34em] text-white/42">Workspace</p>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="upload-surface overflow-hidden">
            <div className="p-5 md:p-6 lg:p-7">
            <div className="space-y-5">
              <div id="inputs" className="grid gap-3 lg:grid-cols-2">
                <UploadSlot
                  acceptedLabel=".DOCX, .PDF"
                  dragActive={isDragOverRef}
                  file={referenceDoc}
                  icon={<UploadCloud size={20} />}
                  marker="Required"
                  note="English source file."
                  onDragLeave={() => setIsDragOverRef(false)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragOverRef(true);
                  }}
                  onDrop={(event) => handleDrop(event, 'reference')}
                  onPick={() => openPicker('reference')}
                  onRemove={() => onSetReference(null)}
                  title="English source"
                />

                <UploadSlot
                  acceptedLabel=".DOCX"
                  dragActive={isDragOverTarget}
                  file={targetDoc}
                  icon={<Languages size={20} />}
                  marker="Optional"
                  note="Optional Chinese draft."
                  onDragLeave={() => setIsDragOverTarget(false)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragOverTarget(true);
                  }}
                  onDrop={(event) => handleDrop(event, 'target')}
                  onPick={() => openPicker('target')}
                  onRemove={() => onSetTarget(null)}
                  title="Chinese draft"
                />
              </div>

              <div id="styles" className="line-panel px-4 py-3 md:px-5">
                <div className="grid gap-3 md:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] md:items-center">
                  <div className="space-y-2">
                    <label htmlFor="citation-style" className="text-xs uppercase tracking-[0.28em] text-white/45">
                      Footnote Style
                    </label>
                    <select
                      id="citation-style"
                      value={citationStyle}
                      onChange={(event) => onSetStyle(event.target.value)}
                      className="w-full rounded-2xl border border-white/12 bg-black/60 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
                    >
                      <option value="GB/T 7714">GB/T 7714 (China National Standard)</option>
                      <option value="APA">APA 7th Edition (Translated)</option>
                      <option value="Chicago">Chicago Manual of Style (Translated)</option>
                      <option value="Custom">Custom Template...</option>
                    </select>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm leading-6 text-white/70">
                    {previewExamples[citationStyle] || previewExamples['GB/T 7714']}
                  </div>
                </div>
              </div>

              {citationStyle === 'Custom' && (
                <div className="line-panel px-4 py-3 md:px-5">
                  <div className="space-y-2">
                    <label htmlFor="custom-template" className="text-xs uppercase tracking-[0.28em] text-white/45">
                      Template string
                    </label>
                    <input
                      id="custom-template"
                      type="text"
                      defaultValue="[1] Author. Title[M]. Translator. Place: Publisher, Year."
                      className="w-full rounded-2xl border border-white/12 bg-black/60 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-white/10 pt-4">
                <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
                  <PillButton
                    tone="light"
                    shell={false}
                    disabled={!isReady}
                    onClick={onStart}
                    className="w-full justify-center"
                  >
                    Start Processing
                    <ArrowRight size={16} />
                  </PillButton>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
