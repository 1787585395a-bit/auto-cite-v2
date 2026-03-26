import React, { ReactNode } from 'react';

import { WorkflowStep } from '../types';

interface LayoutProps {
  children: ReactNode;
  currentStep: WorkflowStep;
  onNavigate: (step: WorkflowStep) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="min-h-screen overflow-x-hidden">{children}</main>
    </div>
  );
};
