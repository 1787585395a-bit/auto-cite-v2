import React, { ReactNode } from 'react';
import { BookOpen, Activity, AlertTriangle, Settings, FileText } from 'lucide-react';
import { WorkflowStep } from '../types';

interface LayoutProps {
  children: ReactNode;
  currentStep: WorkflowStep;
  onNavigate: (step: WorkflowStep) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentStep, onNavigate }) => {
  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-white text-black flex flex-col shadow-xl z-20 border-r border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <BookOpen className="text-black" />
            <span>Auto-Cite Sync</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">v1.0.0 (Alpha)</div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem
            icon={<FileText size={18} />}
            label="Upload / Config"
            active={currentStep === WorkflowStep.UPLOAD || currentStep === WorkflowStep.CONFIG}
            onClick={() => onNavigate(WorkflowStep.UPLOAD)}
          />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <h1 className="text-lg font-semibold text-black">
            {currentStep === WorkflowStep.UPLOAD && "Upload Documents"}
            {currentStep === WorkflowStep.CONFIG && "Configuration"}
            {currentStep === WorkflowStep.PROCESSING && "Processing..."}
            {currentStep === WorkflowStep.REVIEW && "Side-by-Side Reviewer"}
            {currentStep === WorkflowStep.FAULT_FINDING && "System Diagnostics"}
            {currentStep === WorkflowStep.EXPORT && "Export Final Document"}
          </h1>
          <div className="flex gap-2">
             {/* Header actions can go here */}
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-white relative">
          {children}
        </div>
      </main>
    </div>
  );
};

interface NavItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
      ${active
        ? 'bg-black text-white'
        : 'text-slate-600 hover:bg-slate-100 hover:text-black'
      }
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    {icon}
    {label}
  </button>
);