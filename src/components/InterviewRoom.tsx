'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Loader2, Code2, Play, Square, Flag, Bot, AlertTriangle } from 'lucide-react';
import Dashboard from '@/components/Dashboard';
import { motion, AnimatePresence } from 'framer-motion';

// Declare types for CDN loaded MediaPipe
declare global {
  interface Window {
    FaceMesh: any;
    Camera: any;
  }
}

export default function InterviewRoom() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [confidenceScore, setConfidenceScore] = useState(100);

  // New states for Step 4 & Resume Upload
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);

  const [currentQuestion, setCurrentQuestion] = useState('Loading your first question...');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCodingQuestion, setIsCodingQuestion] = useState(false);
  const [codeContent, setCodeContent] = useState('// Write your code here...');
  const [language, setLanguage] = useState('python');
  const [activeTab, setActiveTab] = useState<'editor' | 'feedback'>('feedback');

  // New states for Live Subtitles
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  // New practical features states
  const [timeLeft, setTimeLeft] = useState(300); 
  const [hintText, setHintText] = useState('');
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [hintRequested, setHintRequested] = useState(false);

  // Pre-Interview Rules & Proctoring States
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [warningsCount, setWarningsCount] = useState(0);
  const missingFaceFramesRef = useRef(0);


  // New states for Step 5 (Dashboard)
  const [isFinished, setIsFinished] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<any[]>([]);
  const [confidenceSum, setConfidenceSum] = useState(0);
  const [confidenceCount, setConfidenceCount] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);

  // Anti-Cheat State
  const [isCheating, setIsCheating] = useState(false);

  const stateRefs = useRef({ isSetupMode, isFinished, showRulesModal });

  useEffect(() => {
    stateRefs.current = { isSetupMode, isFinished, showRulesModal };
  }, [isSetupMode, isFinished, showRulesModal]);

  // Behavioral Anti-Cheat / Proctoring hook
  useEffect(() => {
    if (isSetupMode || isFinished) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsCheating(true);
        setConfidenceScore(0);
        setWarningsCount(prev => prev + 1);
      } else {
        setTimeout(() => setIsCheating(false), 3000);
      }
    };

    const handleBlur = () => {
      setIsCheating(true);
      setConfidenceScore(0);
      setTimeout(() => setIsCheating(false), 3000);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isSetupMode, isFinished]);

  // 3-Strike Termination Hook
  useEffect(() => {
    if (warningsCount >= 3 && !isFinished) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsFinished(true);
      setConfidenceScore(0);
      setFeedbackHistory(prev => [...prev, {
        question: "INTERVIEW TERMINATED (ANTI-CHEAT)",
        evaluation: "User failed anti-cheat proctoring checks (Face removed from camera OR switched tabs) 3 times.",
        score: 0
      }]);
    }
  }, [warningsCount, isFinished]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isSetupMode && !isFinished && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Auto-submit when time is up
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSetupMode, isFinished, timeLeft]);



  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setLiveTranscript(currentTranscript);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const onResults = useCallback((results: any) => {
    if (canvasRef.current && webcamRef.current?.video) {
      canvasRef.current.width = webcamRef.current.video.videoWidth;
      canvasRef.current.height = webcamRef.current.video.videoHeight;
      const canvasCtx = canvasRef.current.getContext('2d');
      if (canvasCtx) {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          missingFaceFramesRef.current = 0; // Reset missing face tracker
          const landmarks = results.multiFaceLandmarks[0];
          
          const nose = landmarks[1];
          const leftEye = landmarks[33];
          const rightEye = landmarks[263];
          const upperLip = landmarks[13];
          const lowerLip = landmarks[14];
          
          const distLeft = Math.abs(nose.x - leftEye.x);
          const distRight = Math.abs(rightEye.x - nose.x);
          
          // Ratios approach 1.0 when perfectly centered horizontally
          const yawRatio = Math.min(distLeft, distRight) / Math.max(distLeft, distRight);
          
          // Add micro-expressions/jitter to simulate active AI processing
          const microJitter = (Math.random() * 15) - 7.5;
          
          // Calculate Target Score (Strict on Yaw)
          let targetScore = (yawRatio * 95) + microJitter;
          
          if (yawRatio < 0.65) {
            targetScore -= 40; // Massive penalty for looking away sideways
          }
          
          // Basic Lip Sync detection (Distance between inner lips)
          const lipDistance = Math.abs(upperLip.y - lowerLip.y);
          // Just add a tiny bonus for active speaking
          if (lipDistance > 0.02) targetScore += 5;
          
          // Clamp score between 0 and 100
          targetScore = Math.max(0, Math.min(100, targetScore));

          // If cheating detected via Anti-Cheat hook, force drop to 0
          if (document.hidden || !document.hasFocus()) {
            targetScore = 0;
          }

          setConfidenceScore((prev) => (prev * 0.5) + (targetScore * 0.5)); // Extremely reactive transition

          // Render subtle facial tracking mesh
          canvasCtx.fillStyle = 'rgba(34, 197, 94, 0.7)'; // Bright Emerald Green dots
          for (const point of landmarks) {
            const x = point.x * canvasRef.current.width;
            const y = point.y * canvasRef.current.height;
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 1.5, 0, 2 * Math.PI);
            canvasCtx.fill();
          }
        } else {
          // No face detected!
          missingFaceFramesRef.current += 1;
          
          const { isSetupMode: setup, isFinished: finished, showRulesModal: rules } = stateRefs.current;
          
          // 30 fps * 1.5 seconds = 45 frames.
          if (missingFaceFramesRef.current > 45 && !setup && !finished && !rules) {
             missingFaceFramesRef.current = 0; // Reset to avoid constant firing
             setWarningsCount(prev => prev + 1);
             setIsCheating(true);
             setTimeout(() => setIsCheating(false), 3000);
          }

          setConfidenceScore((prev) => (prev * 0.9) + (0 * 0.1));
        }
        canvasCtx.restore();
      }
    }
  }, []);

  useEffect(() => {
    // Only initialize the camera AFTER setup is complete and the Webcam is rendered
    if (isSetupMode) return;

    if (!window.FaceMesh || !window.Camera) {
      console.warn("MediaPipe not loaded yet");
      return;
    }

    const faceMesh = new window.FaceMesh({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults(onResults);

    let camera: any = null;

    // Give React a tiny fraction of a second to attach the ref to the DOM
    const timeoutId = setTimeout(() => {
      if (
        typeof window !== 'undefined' &&
        webcamRef.current &&
        webcamRef.current.video
      ) {
        camera = new window.Camera(webcamRef.current.video, {
          onFrame: async () => {
            if (webcamRef.current?.video) {
              try {
                await faceMesh.send({ image: webcamRef.current.video });
              } catch (e) {
                // Ignore errors if faceMesh is already closed
              }
            }
          },
          width: 640,
          height: 480,
        });
        camera.start().then(() => setIsLoaded(true));
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (camera && typeof camera.stop === 'function') {
        camera.stop();
      }
      try {
        faceMesh.close();
      } catch (e) {}
    };
  }, [isSetupMode, onResults]);



  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let options = { mimeType: 'audio/webm' };
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setLiveTranscript('');
      
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Please allow microphone access to start the interview.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      setActiveTab('feedback');
      
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }

      mediaRecorderRef.current.onstop = async () => {
        await processAudio();
      };
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const processAudio = async () => {
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      // 1. Transcribe Audio
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      const { text } = await transcribeRes.json();

      const cleanedText = text?.trim().toLowerCase() || '';
      if (!cleanedText || cleanedText === "thank you." || cleanedText === "thanks for watching." || cleanedText === "thank you" || cleanedText.includes("amara.org")) {
        throw new Error("No voice detected. Please check your system microphone settings and speak clearly.");
      }

      // 2. Evaluate Answer via Groq
      const evaluateRes = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          answer: text,
          confidenceScore: Math.round(confidenceScore),
          code: isCodingQuestion ? codeContent : null,
          resumeText,
          questionIndex
        })
      });

      const evaluation = await evaluateRes.json();
      
      // Inject transcribed text into evaluation to display in UI
      evaluation.transcribedText = text;
      
      // Apply hint penalty if requested
      let finalScore = evaluation.score || 0;
      if (hintRequested) {
        finalScore = Math.min(80, finalScore);
        evaluation.evaluation = "[Penalty Applied: -20% Max Score for using AI Hint] " + evaluation.evaluation;
      }
      
      setFeedback(evaluation);
      
      // Update history and stats
      setFeedbackHistory(prev => [...prev, {
        question: currentQuestion,
        evaluation: evaluation.evaluation,
        score: finalScore
      }]);
      setConfidenceSum(prev => prev + confidenceScore);
      setConfidenceCount(prev => prev + 1);

      // If the AI suggested a next question in the evaluation, we can use it!
      if (questionIndex >= 5) {
        setIsFinished(true);
      } else if (evaluation.next_question) {
        setCurrentQuestion(evaluation.next_question);
        setQuestionIndex(prev => prev + 1);
        setIsCodingQuestion(evaluation.isCodingQuestion || false);
        if (evaluation.isCodingQuestion) {
          setCodeContent('// Write your code here...');
          setActiveTab('editor');
          let codingTimer = 3900; // Hard default: 65 mins
          if (evaluation.difficulty === 'easy') codingTimer = 2100; // 35 mins
          else if (evaluation.difficulty === 'medium') codingTimer = 3000; // 50 mins
          setTimeLeft(codingTimer);
        } else {
          setActiveTab('feedback');
          setTimeLeft(300); // Reset standard 5 min timer
        }
        setHintText('');
        setHintRequested(false);
      }
    } catch (error: any) {
      console.error("Error processing interview:", error);
      alert(error.message || "Failed to process answer.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSkipQuestion = async () => {
    setIsProcessing(true);
    if (isRecording) stopRecording();
    
    if (questionIndex >= 5) {
      setIsFinished(true);
      setIsProcessing(false);
      return;
    }

    // Log as skipped
    setFeedbackHistory(prev => [...prev, {
      question: currentQuestion,
      evaluation: "User completely skipped this question. Proceeding to next topic.",
      score: 0
    }]);

    try {
      const res = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resumeText, questionIndex: questionIndex + 1 })
      });
      const data = await res.json();
      if (data.question) {
        setCurrentQuestion(data.question);
        setQuestionIndex(prev => prev + 1);
        setIsCodingQuestion(data.isCodingQuestion || false);
        setActiveTab(data.isCodingQuestion ? 'editor' : 'feedback');
        setFeedback(null);
        if (data.isCodingQuestion) {
          let codingTimer = 3900; // Hard default
          if (data.difficulty === 'easy') codingTimer = 2100;
          else if (data.difficulty === 'medium') codingTimer = 3000;
          setTimeLeft(codingTimer);
        } else {
          setTimeLeft(300); // Reset standard timer
        }
        setHintText('');
        setHintRequested(false);
      }
    } catch (error) {
      alert("Failed to skip to next question.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGetHint = async () => {
    setIsHintLoading(true);
    setHintRequested(true);
    try {
      const res = await fetch('/api/get-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentQuestion, jobDescription, resumeText })
      });
      const data = await res.json();
      setHintText(data.hint || "Consider breaking the problem down into smaller testable functions.");
    } catch (e) {
      setHintText("Hint generation failed. Trust your instincts!");
    } finally {
      setIsHintLoading(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(''); // Clear previous errors
    
    try {
      const formData = new FormData();
      formData.append('resume', file);

      const res = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || 'Failed to parse resume');
      }

      setResumeText(data.text);
    } catch (error: any) {
      console.error(error);
      setUploadError(error.message || 'Error uploading resume.');
      setResumeText(''); // Clear text on failure
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartInterview = async () => {
    if (!jobDescription.trim()) {
      alert("Please enter a job description first.");
      return;
    }
    
    // Show the rules modal instead of starting directly
    setShowRulesModal(true);
  };

  const handleAgreeAndStart = async () => {
    setShowRulesModal(false);
    setIsGenerating(true);
    setWarningsCount(0);
    try {
      const res = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resumeText, questionIndex: 0 })
      });
      const data = await res.json();
      if (data.question) {
        setCurrentQuestion(data.question);
        setQuestionIndex(1);
        setIsCodingQuestion(data.isCodingQuestion || false);
        setActiveTab(data.isCodingQuestion ? 'editor' : 'feedback');
        setIsSetupMode(false);
        if (data.isCodingQuestion) {
          let codingTimer = 3900; // Hard default
          if (data.difficulty === 'easy') codingTimer = 2100;
          else if (data.difficulty === 'medium') codingTimer = 3000;
          setTimeLeft(codingTimer);
        } else {
          setTimeLeft(300); // Reset standard timer
        }
        setHintText('');
        setHintRequested(false);
      } else {
        alert("Failed to generate question. Please try again.");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isSetupMode) {
    return (
      <div className="w-full flex justify-center font-sans text-slate-100 mt-2 relative z-20">
        
        {/* Pre-Interview Rules Disclaimer Modal */}
        <AnimatePresence>
          {showRulesModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md px-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900 border border-slate-700 p-8 md:p-10 rounded-3xl max-w-2xl w-full shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col items-center text-center relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
                  <span className="text-4xl drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]">👁️</span>
                </div>
                <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Proctoring Active</h2>
                <p className="text-slate-400 mb-8 font-medium">This interview is rigorously monitored by Nexus AI. Please read the rules before proceeding.</p>
                
                <div className="flex flex-col space-y-4 w-full text-left mb-10">
                  <div className="flex items-start space-x-4 bg-white/5 p-5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                    <span className="text-emerald-400 font-bold text-xl mt-1">1.</span>
                    <div>
                      <h3 className="font-bold text-slate-200">Maintain Face Visibility</h3>
                      <p className="text-sm text-slate-400 mt-1">Keep your face centered. If you leave the camera frame 3 times, the interview will automatically terminate and score a 0.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4 bg-white/5 p-5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                    <span className="text-emerald-400 font-bold text-xl mt-1">2.</span>
                    <div>
                      <h3 className="font-bold text-slate-200">No Tab Switching</h3>
                      <p className="text-sm text-slate-400 mt-1">Navigating away from this browser tab will instantly drop your confidence score to 0% and flag your profile.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4 bg-white/5 p-5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                    <span className="text-emerald-400 font-bold text-xl mt-1">3.</span>
                    <div>
                      <h3 className="font-bold text-slate-200">Lip-Sync Verification</h3>
                      <p className="text-sm text-slate-400 mt-1">Our 468-point facial mesh tracks lip articulation. Synthetic audio without matching mouth movement may trigger a deepfake flag.</p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4 w-full">
                  <button onClick={() => setShowRulesModal(false)} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all">
                    Cancel
                  </button>
                  <button onClick={handleAgreeAndStart} disabled={isGenerating} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-[0_0_30px_rgba(79,70,229,0.4)] flex justify-center items-center group">
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center">I Understand & Agree <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span></span>}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-7xl bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-50" />
          <div className="relative z-10 flex flex-col space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-white mb-3 tracking-tight">
                Configure Interview Context
              </h2>
              <p className="text-slate-400 font-medium">Provide the job description and your resume so our AI can tailor the interview questions precisely to your background and the role requirements.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Job Description Column */}
              <div className="flex flex-col space-y-3">
                <label className="text-xs font-black tracking-widest text-indigo-400 uppercase">1. Job Description</label>
                <textarea
                  className="w-full h-72 bg-black/40 border border-white/10 rounded-2xl p-5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all shadow-inner"
                  placeholder="Paste the job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>

              {/* Resume Upload Column */}
              <div className="flex flex-col space-y-3">
                <label className="text-xs font-black tracking-widest text-emerald-400 uppercase">2. Upload Resume (Optional)</label>
                <div className="w-full h-72 bg-black/40 border border-white/10 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center relative group overflow-hidden transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5">
                  {isUploading ? (
                    <div className="flex flex-col items-center animate-pulse">
                      <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
                      <p className="text-emerald-300 font-semibold text-sm tracking-wide">Extracting text via AI...</p>
                    </div>
                  ) : uploadError ? (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300 text-center">
                      <div className="w-14 h-14 bg-rose-500/20 rounded-full flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(244,63,94,0.2)] border border-rose-500/30">
                        <span className="text-rose-400 font-bold text-2xl">✗</span>
                      </div>
                      <p className="text-rose-400 font-bold text-lg">Invalid Document</p>
                      <p className="text-sm text-slate-400 mt-2 font-medium px-4">{uploadError}</p>
                      <label className="mt-4 cursor-pointer text-xs text-rose-300 hover:text-rose-200 underline uppercase tracking-widest font-bold transition-all">
                        Try Again
                        <input type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} />
                      </label>
                    </div>
                  ) : resumeText ? (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                      <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                        <span className="text-emerald-400 font-bold text-2xl">✓</span>
                      </div>
                      <p className="text-emerald-300 font-bold text-lg">Resume Parsed Successfully!</p>
                      <p className="text-sm text-slate-400 mt-2 font-medium">Ready for a hyper-personalized interview.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center animate-in fade-in duration-300">
                      <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mb-3 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                        <span className="text-emerald-400 font-bold tracking-wide">PDF</span>
                      </div>
                      <p className="text-slate-300 font-semibold mb-1 text-lg">Drag & Drop or Click</p>
                      <p className="text-sm text-slate-500 mb-5 font-medium max-w-[80%] mx-auto text-center">We will cross-reference this to generate highly specific questions.</p>
                      <label className="cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-6 py-2.5 rounded-xl text-sm font-bold transition-all uppercase tracking-widest">
                        Select Resume File
                        <input type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 mt-6">
              <button 
                onClick={handleStartInterview}
                disabled={isGenerating || isUploading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.5)] flex justify-center items-center group"
              >
                {isGenerating ? (
                  <span className="flex items-center tracking-widest uppercase text-sm"><Loader2 className="w-5 h-5 animate-spin mr-3" /> Initializing AI...</span>
                ) : (
                  <span className="flex items-center tracking-widest uppercase text-sm">Start Interview Simulator <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span></span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isFinished) {
    const avgConfidence = confidenceCount > 0 ? Math.round(confidenceSum / confidenceCount) : 100;
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 sm:p-8 font-sans text-slate-100 overflow-hidden relative">
        {/* Abstract Background Glows */}
        <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />
        <Dashboard feedbackHistory={feedbackHistory} averageConfidence={avgConfidence} />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center font-sans text-slate-100 overflow-visible relative">
      {/* Abstract Background Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />



      {/* Big Red Flash Warning for Anti-Cheat */}
      <AnimatePresence>
        {isCheating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center bg-rose-600/20 backdrop-blur-md"
          >
            <div className="bg-rose-950/95 text-white px-12 py-12 rounded-3xl shadow-[0_0_150px_rgba(225,29,72,0.8)] border border-rose-500/50 flex flex-col items-center animate-pulse">
              <span className="text-7xl mb-6 drop-shadow-[0_0_20px_rgba(225,29,72,0.8)]">⚠️</span>
              <h2 className="text-5xl font-black tracking-tighter uppercase mb-4 text-rose-500 drop-shadow-[0_0_20px_rgba(225,29,72,0.5)]">Focus Warning</h2>
              <p className="text-rose-100 font-bold text-2xl tracking-wide">Proctoring Violation detected!</p>
              <p className="text-slate-400 mt-3 font-medium">Tab switching or looking away is strictly prohibited.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut", staggerChildren: 0.1 }}
        className="z-10 w-full max-w-[98vw] lg:max-w-[1600px] flex flex-col space-y-8"
      >
        
        {/* Header */}
        <header className="flex justify-between items-center w-full px-6 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="font-bold text-white tracking-widest text-lg">AI</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Nexus Interview Coach
              </h1>
              <p className="text-xs text-indigo-300 uppercase tracking-widest font-semibold">Senior Software Engineer Role</p>
            </div>
          </div>
          
          {/* Timer Display */}
          {!isSetupMode && !isFinished && (
            <div className={`px-5 py-2 rounded-xl flex items-center shadow-inner border transition-colors duration-500 ${
              timeLeft < 60 ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse' : 'bg-white/5 border-white/10 text-emerald-400'
            }`}>
              <span className="font-mono text-2xl font-bold tracking-wider">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}

          <div className="flex items-center space-x-6">
            <div className="flex flex-col items-end">
              <span className={`text-xs uppercase tracking-wider font-bold mb-1 transition-colors ${isCheating ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
                {isCheating ? '⚠️ Focus Warning' : 'Live Confidence'}
                {warningsCount > 0 && <span className="text-rose-400 ml-2 animate-pulse">({warningsCount}/3 Strikes)</span>}
              </span>
              <div className="flex items-center space-x-2">
                <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      confidenceScore > 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-300' : 
                      confidenceScore > 50 ? 'bg-gradient-to-r from-yellow-400 to-amber-300' : 
                      'bg-gradient-to-r from-rose-500 to-red-400'
                    }`}
                    style={{ width: `${confidenceScore}%` }}
                  />
                </div>
                <span className="text-sm font-bold w-10 text-right">{Math.round(confidenceScore)}%</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Split */}
        <div className={`grid grid-cols-1 ${isCodingQuestion ? 'lg:grid-cols-12' : 'lg:grid-cols-12'} gap-8 relative`}>
          
          <div className="lg:col-span-8 flex flex-col space-y-4 h-[520px] transition-all duration-500">
            
            {/* Question Card (Fixed at Top) */}
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden group shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="relative flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping opacity-75" />
                  </div>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-indigo-400 font-bold">Current Question</h3>
                </div>
                
                <div className="flex items-center space-x-3">
                  {isCodingQuestion && (
                    <span className="bg-indigo-500/10 text-indigo-300 text-xs px-3 py-1.5 rounded-lg border border-indigo-500/20 flex items-center font-bold tracking-wide">
                      <Code2 className="w-3.5 h-3.5 mr-2" /> Coding Task
                    </span>
                  )}
                  <span className="bg-slate-800/80 text-slate-300 text-xs px-4 py-1.5 rounded-full border border-slate-700 font-black tracking-[0.1em] shadow-inner">
                    {questionIndex} / 5
                  </span>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                <p className="text-xl font-medium leading-tight text-white drop-shadow-sm">
                  "{currentQuestion}"
                </p>
              </div>
            </div>

            {/* Tab Navigation (Only visible if coding question) */}
            {isCodingQuestion && (
              <div className="flex space-x-2 bg-white/[0.02] p-1.5 rounded-2xl backdrop-blur-2xl border border-white/5 shrink-0 shadow-lg">
                <button 
                  onClick={() => setActiveTab('editor')} 
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'editor' ? 'bg-indigo-600/90 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] border border-indigo-500/50' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'}`}
                >
                  Code Editor
                </button>
                <button 
                  onClick={() => setActiveTab('feedback')} 
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all duration-300 ${activeTab === 'feedback' ? 'bg-emerald-600/90 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-500/50' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'}`}
                >
                  AI Feedback
                </button>
              </div>
            )}

            {/* Dynamic Content Area (Fills remaining height) */}
            <div className="flex-1 min-h-[500px] lg:min-h-[600px] relative overflow-hidden rounded-3xl border border-white/5 shadow-2xl bg-white/[0.01] backdrop-blur-2xl">
              
              {/* CODE EDITOR TAB */}
              {isCodingQuestion && activeTab === 'editor' && (
                <div className="absolute inset-0 flex flex-col p-5 animate-in fade-in zoom-in-95 duration-500">
                  <div className="flex justify-between items-center mb-4 px-1 shrink-0">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Workspace</h3>
                    <select 
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="bg-black/40 text-xs font-bold uppercase tracking-wide text-slate-300 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                    >
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="typescript">TypeScript</option>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                    </select>
                  </div>
                  <div className="flex-1 rounded-xl overflow-hidden border border-slate-800">
                    <Editor
                      height="100%"
                      language={language}
                      theme="vs-dark"
                      value={codeContent}
                      onChange={(val) => setCodeContent(val || '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: 'var(--font-outfit)',
                        padding: { top: 16 }
                      }}
                    />
                    
                    {/* Hint System UI */}
                    <div className="absolute bottom-6 right-6 max-w-sm flex flex-col items-end z-10 pointer-events-auto">
                      {hintText ? (
                        <div className="mb-2 p-4 bg-slate-800/95 backdrop-blur-md border border-amber-500/50 rounded-2xl text-amber-300 text-sm shadow-[0_10px_40px_rgba(245,158,11,0.2)] animate-in fade-in slide-in-from-bottom-4">
                          <span className="font-black text-[10px] uppercase tracking-[0.2em] block mb-2 text-amber-500">AI Hint (Max Score Capped at 80%)</span>
                          {hintText}
                        </div>
                      ) : (
                        <button 
                          onClick={handleGetHint}
                          disabled={isHintLoading}
                          className="px-5 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/50 hover:border-amber-400 rounded-full text-amber-400 text-xs font-bold uppercase tracking-[0.1em] transition-all disabled:opacity-50 shadow-lg hover:shadow-amber-500/20"
                        >
                          {isHintLoading ? 'Generating...' : 'Request Hint'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* FEEDBACK & STATUS TAB */}
              {(!isCodingQuestion || activeTab === 'feedback') && (
                <div className="absolute inset-0 flex flex-col bg-gradient-to-br from-white/[0.02] to-transparent animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto custom-scrollbar">
                  {isProcessing ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                      <div className="relative w-20 h-20 mb-8">
                        <div className="absolute inset-0 border-[3px] border-indigo-500/20 rounded-full animate-[spin_4s_linear_infinite]" />
                        <div className="absolute inset-0 border-[3px] border-transparent border-t-indigo-400 rounded-full animate-[spin_1.5s_ease-in-out_infinite]" />
                        <Loader2 className="absolute inset-0 m-auto w-8 h-8 text-indigo-400 animate-pulse" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Analyzing Intelligence...</h3>
                      <p className="text-sm text-slate-400 font-medium tracking-wide">Evaluating conceptual depth and logic.</p>
                    </div>
                  ) : feedback ? (
                    <div className="p-8 space-y-8">
                      <div className="flex justify-between items-end pb-6 border-b border-white/5">
                        <div>
                          <span className="block text-[10px] uppercase tracking-[0.3em] text-emerald-400 font-bold mb-2">Result</span>
                          <h3 className="text-3xl font-black text-white tracking-tight">Evaluation</h3>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold mb-2">Total Score</span>
                          <span className={`text-4xl font-black text-transparent bg-clip-text drop-shadow-sm ${
                            feedback.score > 80 ? 'bg-gradient-to-br from-emerald-400 to-cyan-400' :
                            feedback.score > 50 ? 'bg-gradient-to-br from-amber-400 to-orange-400' :
                            'bg-gradient-to-br from-rose-500 to-red-500'
                          }`}>
                            {feedback.score}/100
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 shadow-inner">
                        <h4 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-3">Audio Transcription</h4>
                        <p className="text-slate-300 italic text-sm leading-relaxed font-light">
                          "{feedback.transcribedText || 'No audio detected.'}"
                        </p>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <h4 className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-bold mb-3">Technical Assessment</h4>
                          <p className="text-slate-200 leading-relaxed text-sm bg-black/40 p-5 rounded-2xl border border-white/5">{feedback.evaluation}</p>
                        </div>
                        <div>
                          <h4 className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-bold mb-3">Actionable Tip</h4>
                          <p className="text-slate-200 leading-relaxed text-sm bg-black/40 p-5 rounded-2xl border border-white/5">{feedback.feedback_tip}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-40">
                      <Bot className="w-12 h-12 text-slate-500 mb-4 opacity-50" />
                      <p className="text-slate-400 text-sm tracking-wide font-medium">Evaluation pending audio input.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          <div className="lg:col-span-4 relative flex flex-col items-center transition-all duration-500 h-[520px]">
            
            {/* Camera Container with Deep Glow */}
            <div className={`relative w-full h-full rounded-3xl overflow-hidden shadow-2xl transition-all duration-700 bg-black/50 backdrop-blur-2xl ${
              isRecording ? 'shadow-[0_0_80px_-15px_rgba(239,68,68,0.4)] border-rose-500/40' : 
              'shadow-[0_0_80px_-15px_rgba(99,102,241,0.2)] border-white/5'
            } border`}>
              
              {!isLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-slate-950">
                  <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
                  <p className="text-indigo-300 font-medium tracking-wide">Initializing Vision Models...</p>
                </div>
              )}
              
              <Webcam
                ref={webcamRef}
                audio={false}
                mirrored={true}
                className="absolute inset-0 w-full h-full object-cover"
              />
              
              {/* Canvas overlaid precisely on video */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none opacity-80"
                style={{ transform: 'scaleX(-1)' }}
              />

              {/* Recording Overlay UI & Subtitles */}
              {isRecording && (
                <>
                  <div className="absolute top-6 right-6 z-20 flex items-center space-x-3 bg-black/60 backdrop-blur-md border border-rose-500/30 px-4 py-2 rounded-full">
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </div>
                    <span className="text-xs font-bold tracking-widest text-rose-200">RECORDING</span>
                    {/* Fake Audio Visualizer bars */}
                    <div className="flex items-end space-x-1 h-4 ml-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-1 bg-rose-400 rounded-t-sm animate-pulse" style={{ animationDelay: `${i * 150}ms`, height: `${Math.random() * 100}%` }} />
                      ))}
                    </div>
                  </div>
                  
                  {/* Live Subtitles Overlay */}
                  <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-center pointer-events-none">
                    <div className="bg-black/70 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 max-w-full">
                      <p className="text-white font-medium text-center text-sm md:text-base drop-shadow-md">
                        {liveTranscript || "Listening..."}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="absolute -bottom-8 z-30 flex space-x-4">
              {feedbackHistory.length > 0 && !isRecording && !isProcessing && (
                <button 
                  onClick={() => setIsFinished(true)}
                  className="group relative flex items-center justify-center px-6 py-4 rounded-full overflow-hidden transition-all duration-300 bg-slate-800 hover:bg-slate-700 shadow-xl hover:-translate-y-1 border border-slate-600"
                >
                  <Flag className="w-5 h-5 text-slate-300 mr-2 relative z-10" />
                  <span className="text-slate-300 font-bold tracking-wide relative z-10">End Interview</span>
                </button>
              )}
              
              {!isRecording && !isProcessing && (
                <button 
                  onClick={handleSkipQuestion}
                  className="group relative flex items-center justify-center px-6 py-4 rounded-full overflow-hidden transition-all duration-300 bg-slate-800 hover:bg-slate-700 shadow-xl hover:-translate-y-1 border border-slate-600"
                >
                  <span className="text-slate-300 font-bold tracking-wide relative z-10">Skip Question</span>
                </button>
              )}
              
              <button 
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`group relative flex items-center justify-center px-8 py-5 rounded-full overflow-hidden transition-all duration-300 ${
                  isRecording 
                    ? 'bg-rose-500 hover:bg-rose-600 shadow-[0_0_30px_rgba(225,29,72,0.6)] hover:shadow-[0_0_40px_rgba(225,29,72,0.8)] scale-105' 
                    : isProcessing 
                      ? 'bg-slate-700 cursor-not-allowed opacity-80'
                      : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.5)] hover:shadow-[0_0_40px_rgba(79,70,229,0.7)] hover:-translate-y-1'
                }`}
              >
                {/* Button background glow effect */}
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {isRecording ? (
                  <>
                    <div className="w-5 h-5 bg-white rounded-sm mr-3 relative z-10 animate-pulse" />
                    <span className="text-white font-bold tracking-wide relative z-10">End Answer</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-6 h-6 text-white mr-3 relative z-10 group-hover:scale-110 transition-transform" />
                    <span className="text-white font-bold tracking-wide relative z-10">Start Speaking</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}
