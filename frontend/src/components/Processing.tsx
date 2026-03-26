import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Loader2, Terminal } from 'lucide-react';

interface ProcessingProps {
  isStopping: boolean;
  onStop: () => void;
  progress: number;
  logs: string[];
}

export const Processing: React.FC<ProcessingProps> = ({ isStopping, onStop, progress, logs }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  const steps = [
    { label: 'Read source material', threshold: 10 },
    { label: 'Detect footnotes', threshold: 25 },
    { label: 'Translate or align notes', threshold: 60 },
    { label: 'Write the DOCX output', threshold: 85 },
    { label: 'Validate final document', threshold: 95 },
  ];

  const activeStep =
    progress >= 100
      ? 'Final package complete'
      : steps.find((step) => progress < step.threshold)?.label || steps[steps.length - 1].label;

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="relative min-h-screen overflow-hidden px-6 pb-12 pt-24 md:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="ambient-grid absolute inset-0 opacity-30" />
        <div className="absolute left-[-10%] top-[8%] h-72 w-72 rounded-full bg-white/[0.06] blur-3xl" />
        <div className="absolute right-[-14%] top-[28%] h-96 w-96 rounded-full bg-white/[0.04] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <section className="upload-surface h-full p-6 md:p-10">
          <div className="flex h-full flex-col gap-8">
            <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.32em] text-white/42">Processing</p>
                <h1 className="max-w-md text-2xl font-medium leading-tight text-white md:text-3xl">
                  Building the translated DOCX without breaking the footnote structure.
                </h1>
            </div>

            <div className="line-panel px-6 py-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-center">
                <div className="relative inline-flex h-24 w-24 items-center justify-center self-start">
                  <svg className="h-full w-full -rotate-90 transform">
                    <circle
                      className="text-white/10"
                      strokeWidth="6"
                      stroke="currentColor"
                      fill="transparent"
                      r="42"
                      cx="48"
                      cy="48"
                    />
                    <circle
                      className="text-white transition-all duration-500 ease-out"
                      strokeWidth="6"
                      strokeDasharray={264}
                      strokeDashoffset={264 - (264 * progress) / 100}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="42"
                      cx="48"
                      cy="48"
                    />
                  </svg>
                  <span className="absolute text-lg font-medium text-white">{progress}%</span>
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-white">Current focus</p>
                    <p className="mt-1 text-lg text-white/78">{activeStep}</p>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => {
                const previousThreshold = steps[index - 1]?.threshold ?? 0;
                const done = progress >= step.threshold;
                const active = !done && progress >= previousThreshold;

                return (
                  <div
                    key={step.label}
                    className="flex items-center gap-3 border-b border-white/8 pb-4 last:border-b-0 last:pb-0"
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border transition duration-300 ${
                        done
                          ? 'border-white bg-white text-black'
                          : active
                            ? 'border-white/20 bg-white/10 text-white'
                            : 'border-white/10 bg-white/[0.03] text-white/36'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <Loader2 size={16} className={active ? 'animate-spin' : ''} />
                      )}
                    </div>

                    <span
                      className={`text-sm ${
                        done ? 'font-medium text-white' : active ? 'text-white/82' : 'text-white/40'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto pt-2">
              <button
                type="button"
                onClick={onStop}
                disabled={isStopping}
                className={`pill-inner-dark w-full justify-center ${isStopping ? 'cursor-not-allowed opacity-55' : ''}`}
              >
                {isStopping ? 'Stopping...' : 'Stop Processing'}
              </button>
            </div>
          </div>
        </section>

        <section className="line-panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
            <Terminal size={15} className="text-white/54" />
            <span className="text-xs uppercase tracking-[0.28em] text-white/42">
              Python processing log
            </span>
            <div
              className={`ml-auto h-2 w-2 rounded-full ${
                progress < 100 ? 'animate-pulse bg-emerald-400' : 'bg-white/28'
              }`}
            />
          </div>

          <div className="h-[440px] overflow-y-auto px-5 py-4 font-mono text-xs">
            {logs.length === 0 && <span className="text-white/42">Waiting for processing to start...</span>}

            <div className="space-y-2">
              {logs.map((line, index) => {
                const isError = line.includes('[ERROR]');
                const isOk = line.includes('[OK]');
                const isWarning = line.includes('[WARNING]') || line.includes('[FALLBACK');
                const isBatch = line.includes('[BATCH');
                const isStep = line.includes('[STEP') || line.includes('[DONE]');

                return (
                  <div
                    key={`${line}-${index}`}
                    className={`leading-relaxed ${
                      isError
                        ? 'text-red-300'
                        : isOk
                          ? 'text-emerald-300'
                          : isWarning
                            ? 'text-amber-300'
                            : isBatch
                              ? 'text-sky-300'
                              : isStep
                                ? 'font-medium text-white'
                                : 'text-white/58'
                    }`}
                  >
                    <span className="mr-2 select-none text-white/24">&gt;</span>
                    {line}
                  </div>
                );
              })}
            </div>
            <div ref={logEndRef} />
          </div>
        </section>
      </div>
    </div>
  );
};
