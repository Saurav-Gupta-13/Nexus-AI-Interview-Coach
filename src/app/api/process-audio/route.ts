import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { checkRateLimit } from '@/lib/ratelimit';

// Use default Node.js runtime for robust audio file processing

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const isAllowed = await checkRateLimit(ip);
    
    if (!isAllowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get('audio') as Blob;
    
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const question = formData.get('question') as string;
    const confidenceScore = parseInt(formData.get('confidenceScore') as string || '0', 10);
    const code = formData.get('code') as string;
    const resumeText = formData.get('resumeText') as string;
    const questionIndex = parseInt(formData.get('questionIndex') as string || '0', 10);

    // 1. Transcribe Audio (Extremely fast via Groq Whisper)
    const transcription = await groq.audio.transcriptions.create({
      file: file as any, // Cast to any for Next.js File object compatibility
      model: 'whisper-large-v3',
      prompt: 'Interview response, clear professional English.',
      response_format: 'json',
      language: 'en',
    });

    const text = transcription.text?.trim() || '';
    const cleanedText = text.toLowerCase();
    
    // Check for empty or generic whisper artifacts
    if (!cleanedText || cleanedText === "thank you." || cleanedText === "thanks for watching." || cleanedText.includes("amara.org")) {
      return NextResponse.json({ error: 'No voice detected. Please check your system microphone settings and speak clearly.' }, { status: 400 });
    }

    // 2. Evaluate & Generate Next Question
    let difficultyInstruction = '';
    if (questionIndex === 0) {
      difficultyInstruction = 'For the next question (Question 2), ask a foundational/core technical question based on the Job Description to test their basic theoretical knowledge.';
    } else if (questionIndex >= 1) {
      difficultyInstruction = 'For the next question (Question 3 or later), ask an ADVANCED, hard technical question, a system design question, or a coding task. Push their limits.';
    }

    const prompt = `
You are an expert technical interviewer evaluating a candidate's answer.
Question Asked: "${question}"
Candidate's Spoken Answer: "${text}"
${code ? "Candidate's Code Submission:\\n```\\n" + code + "\\n```\\n" : ""}
Candidate's Eye-Contact/Confidence Score (from CV model): ${confidenceScore}/100
Job Description: (Provided previously)
Candidate's Resume Text: ${resumeText || 'No resume provided.'}

CRITICAL EVALUATION GUIDELINES:
- Evaluate the candidate "humanistically". Focus on whether they understand the core concepts, logic, and intent.
- DO NOT penalize them for not using exact textbook definitions or specific jargon if their explanation is conceptually correct.
- Candidates often speak conversationally. Forgive minor grammatical errors or conversational filler (ums, ahs).
- If they submitted code, evaluate the logic and problem-solving approach. Minor syntax errors are acceptable if the core logic is sound.

Evaluate the candidate's response and generate the next question. Return ONLY a valid JSON object in the exact following format:
{
  "score": (0-100 integer representing conceptual accuracy, logic, and completeness. Be fair but rigorous.),
  "evaluation": "Detailed technical feedback. Acknowledge what they got right conceptually, and gently point out any missing core logic.",
  "feedback_tip": "One concise tip for improvement.",
  "next_question": "A logical follow-up question, or a new topic question to continue the interview. ${difficultyInstruction}",
  "isCodingQuestion": true/false // Set to true ONLY if 'next_question' requires them to write code
}
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    const responseContent = chatCompletion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error("No response from Groq");
    }

    const parsedResponse = JSON.parse(responseContent);
    parsedResponse.transcribedText = text; // Attach transcript for UI

    return NextResponse.json(parsedResponse);
  } catch (error: any) {
    console.error('Error in process-audio route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process audio' },
      { status: 500 }
    );
  }
}
