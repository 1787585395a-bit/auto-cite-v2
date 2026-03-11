import React, { useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, Terminal } from 'lucide-react';

interface ProcessingProps {
  progress: number;
  logs: string[];
}

export const Processing: React.FC<ProcessingProps> = ({ progress, logs }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  const steps = [
    { label: "读取文档", threshold: 10 },
    { label: "AI识别脚注", threshold: 25 },
    { label: "分批对齐处理", threshold: 78 },
    { label: "插入脚注", threshold: 90 },
    { label: "验证结果", threshold: 95 },
  ];

  // 日志滚动到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-2xl flex flex-col gap-4">

        {/* 进度卡片 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200">
          <div className="flex items-center gap-6">
            {/* 圆形进度 */}
            <div className="relative inline-flex items-center justify-center w-16 h-16 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle className="text-slate-100" strokeWidth="6" stroke="currentColor" fill="transparent" r="28" cx="32" cy="32" />
                <circle
                  className="text-black transition-all duration-500 ease-out"
                  strokeWidth="6"
                  strokeDasharray={176}
                  strokeDashoffset={176 - (176 * progress) / 100}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="28"
                  cx="32"
                  cy="32"
                />
              </svg>
              <span className="absolute text-sm font-bold text-black">{progress}%</span>
            </div>

            {/* 步骤列表 */}
            <div className="flex-1 grid grid-cols-1 gap-2">
              {steps.map((step, idx) => {
                const done = progress >= step.threshold;
                const active = !done && progress >= (steps[idx - 1]?.threshold ?? 0);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300
                      ${done ? 'bg-black text-white' : active ? 'bg-slate-200 text-black' : 'bg-slate-100 text-slate-300'}`}>
                      {done
                        ? <CheckCircle2 size={12} />
                        : <Loader2 size={12} className={active ? 'animate-spin' : ''} />}
                    </div>
                    <span className={`text-sm ${done ? 'text-black font-semibold' : active ? 'text-black' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 日志面板 */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800">
            <Terminal size={14} className="text-slate-400" />
            <span className="text-xs font-mono text-slate-400">Python 输出日志</span>
            <div className={`ml-auto w-2 h-2 rounded-full ${progress < 100 ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
          </div>
          <div className="h-64 overflow-y-auto p-4 font-mono text-xs space-y-1">
            {logs.length === 0 && (
              <span className="text-slate-500">等待处理开始...</span>
            )}
            {logs.map((line, i) => {
              const isError = line.includes('[ERROR]');
              const isOk = line.includes('[OK]');
              const isWarning = line.includes('[WARNING]') || line.includes('[FALLBACK');
              const isBatch = line.includes('[批次') || line.includes('[阶段');
              const isStep = line.includes('[步骤');
              return (
                <div key={i} className={`leading-relaxed
                  ${isError ? 'text-red-400' :
                    isOk ? 'text-green-400' :
                    isWarning ? 'text-yellow-400' :
                    isBatch ? 'text-blue-300' :
                    isStep ? 'text-white font-semibold' :
                    'text-slate-400'}`}>
                  <span className="text-slate-600 select-none mr-2">&gt;</span>
                  {line}
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
};
