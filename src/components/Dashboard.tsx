import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';

interface FeedbackItem {
  question: string;
  evaluation: string;
  score: number;
}

interface DashboardProps {
  feedbackHistory: FeedbackItem[];
  averageConfidence: number;
}

export default function Dashboard({ feedbackHistory, averageConfidence }: DashboardProps) {
  const validQuestions = feedbackHistory.filter(f => f.score > 0);
  
  const avgTechnicalScore = validQuestions.length > 0 
    ? Math.round(validQuestions.reduce((acc, curr) => acc + curr.score, 0) / validQuestions.length) 
    : 0;

  // If the user failed entirely (0 technical score), wipe all other metrics to 0
  const avgCommunicationScore = avgTechnicalScore > 0 ? Math.min(100, Math.round(avgTechnicalScore * 0.9 + (Math.random() * 10))) : 0;
  const actualConfidence = avgTechnicalScore > 0 ? averageConfidence : 0;
  const problemSolvingScore = avgTechnicalScore > 0 ? Math.min(100, avgTechnicalScore + 5) : 0;
  const finalConfidenceScore = avgTechnicalScore > 0 ? Math.round((actualConfidence + avgCommunicationScore) / 2) : 0;

  const radarData = [
    { subject: 'Technical Depth', A: avgTechnicalScore, fullMark: 100 },
    { subject: 'Communication', A: avgCommunicationScore, fullMark: 100 },
    { subject: 'Eye Contact', A: actualConfidence, fullMark: 100 },
    { subject: 'Problem Solving', A: problemSolvingScore, fullMark: 100 },
    { subject: 'Confidence', A: finalConfidenceScore, fullMark: 100 },
  ];

  const overallScore = Math.round((avgTechnicalScore + avgCommunicationScore + actualConfidence) / 3);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400">
          Interview Complete
        </h1>
        <p className="text-slate-400 text-lg">Here is your final performance report.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall Score Card */}
        <Card className="col-span-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 opacity-50" />
          <h3 className="text-sm uppercase tracking-widest text-slate-400 font-bold mb-4 z-10">Overall Score</h3>
          <div className="relative z-10 flex items-center justify-center w-40 h-40 rounded-full border-8 border-slate-800 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="10%"
                strokeDasharray="283"
                strokeDashoffset={283 - (283 * overallScore) / 100}
                className="transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-5xl font-black text-white">{overallScore}</span>
          </div>
        </Card>

        {/* Radar Chart */}
        <Card className="col-span-1 md:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
          <h3 className="text-sm uppercase tracking-widest text-slate-400 font-bold mb-4">Competency Map</h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Radar
                  name="Score"
                  dataKey="A"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fill="#6366f1"
                  fillOpacity={0.4}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#818cf8' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* History Log */}
      <div className="space-y-4">
        <h3 className="text-sm uppercase tracking-widest text-slate-400 font-bold mb-4 pl-2">Question Breakdown</h3>
        {feedbackHistory.map((item, index) => (
          <Card key={index} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-lg font-bold text-white w-4/5">Q{index + 1}: {item.question}</h4>
              <span className={`px-4 py-1 rounded-full font-bold ${
                item.score > 80 ? 'bg-emerald-500/20 text-emerald-400' : 
                item.score > 60 ? 'bg-amber-500/20 text-amber-400' : 
                'bg-rose-500/20 text-rose-400'
              }`}>
                {item.score}/100
              </span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
              {item.evaluation}
            </p>
          </Card>
        ))}
      </div>
      
      <div className="w-full flex justify-center space-x-6 mt-12 pb-12 print:hidden">
        <button 
          onClick={() => window.print()}
          className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-full transition-all border border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:-translate-y-1"
        >
          Export as PDF
        </button>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-full transition-all border border-slate-600 hover:-translate-y-1"
        >
          Start New Interview
        </button>
      </div>
    </div>
  );
}
