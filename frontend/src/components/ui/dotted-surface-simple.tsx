import React from 'react';

export function DottedSurface({ className }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 -z-10 ${className || ''}`}
      style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.03) 1px, transparent 1px)',
        backgroundSize: '30px 30px'
      }}
    >
      <div className="text-xs text-slate-400 p-2">
        背景测试 - 如果看到这个说明组件已加载
      </div>
    </div>
  );
}
