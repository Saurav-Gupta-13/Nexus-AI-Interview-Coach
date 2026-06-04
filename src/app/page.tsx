import InterviewRoom from '@/components/InterviewRoom';
import { Bot } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white selection:bg-indigo-500/30 overflow-x-hidden relative font-outfit">
      
      {/* Ambient Animated Background Glows */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px] animate-pulse mix-blend-screen" style={{ animationDelay: '2s' }} />
      </div>

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full py-4 text-center bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 shadow-2xl">
        <div className="inline-flex items-center justify-center space-x-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/30 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
            Nexus AI Interviewer
          </h1>
        </div>
        <p className="text-slate-400 text-sm md:text-base font-medium tracking-wide max-w-2xl mx-auto">
          Autonomous coding & behavioral coach.
        </p>
      </header>

      {/* Main Content */}
      <div className="w-full px-4 md:px-8 pt-32 pb-4 flex flex-col justify-start min-h-screen">
        <InterviewRoom />
      </div>
    </main>
  );
}
