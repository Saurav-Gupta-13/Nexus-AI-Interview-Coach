import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { checkRateLimit } from '@/lib/ratelimit';

// Initialize Groq client
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
    const { question, answer, confidenceScore, code, resumeText, questionIndex = 0 } = await req.json();

    if (!answer) {
      return NextResponse.json({ error: 'No answer provided' }, { status: 400 });
    }

    let difficultyInstruction = '';
    if (questionIndex === 0) {
      difficultyInstruction = 'For the next question (Question 2), ask a foundational/core technical question based on the Job Description to test their basic theoretical knowledge.';
    } else if (questionIndex >= 1) {
      difficultyInstruction = 'For the next question (Question 3 or later), ask an ADVANCED, hard technical question, a system design question, or a coding task. Push their limits.';
    }

    // The Single-Prompt Multi-Agent Pattern
    const prompt = `
You are a senior technical interviewer at a top-tier tech company. You must evaluate this candidate's spoken answer with EXTREME semantic awareness and practical judgment.

Question Asked: "${question}"
Candidate's Spoken Answer: "${answer}"
${code ? `Candidate's Code Submission:\n\`\`\`\n${code}\n\`\`\`\n` : ''}
Candidate's Eye-Contact/Confidence Score (from CV model): ${confidenceScore}/100
Candidate's Resume Text: ${resumeText || 'No resume provided.'}

═══════════════════════════════════════════════
HUMANISTIC SEMANTIC EVALUATION RULES (CRITICAL):
═══════════════════════════════════════════════

1. SEMANTIC MATCHING (Most Important):
   - Focus ENTIRELY on the MEANING and INTENT behind their words, NOT the exact phrasing.
   - If they explain a concept correctly using informal or non-textbook language, that is STILL a correct answer. Give them full credit.
   - Spoken language is messy. Ignore filler words (um, uh, like, basically, you know), false starts, and self-corrections. Extract the core meaning.

2. IRRELEVANCE DETECTION:
   - If the candidate's answer is COMPLETELY unrelated to the question (e.g., talking about cooking when asked about databases), score MUST be 0.
   - If they partially address the question but miss key parts, score proportionally (30-60 range).
   - If they demonstrate strong conceptual understanding even without perfect structure, score generously (70-90 range).

3. PRACTICAL FAIRNESS:
   - Remember these are SPOKEN answers, not written essays. Be forgiving of grammar and structure.
   - If they give a real-world example that demonstrates understanding, that counts as much as a textbook definition.
   - Nervous candidates may ramble — look past the rambling for the core knowledge underneath.
   - For coding questions: focus on logic and approach. Minor syntax errors in spoken code descriptions are expected.

4. SCORING GUIDE:
   - 0-10: Completely irrelevant, nonsensical, or refused to answer
   - 11-30: Vaguely related but fundamentally wrong understanding
   - 31-50: Partially correct, missing critical core concepts
   - 51-70: Decent understanding, but incomplete or slightly off
   - 71-85: Strong conceptual understanding with minor gaps
   - 86-100: Excellent, comprehensive answer demonstrating deep understanding

Evaluate the candidate's response and generate the next question. Return ONLY a valid JSON object in the exact following format:
{
  "score": (0-100 integer. Apply semantic evaluation rules above strictly.),
  "evaluation": "2-3 sentence feedback. Acknowledge what they understood correctly (semantically), then note any missing concepts. Be encouraging but honest.",
  "feedback_tip": "One concise, actionable tip for improvement.",
  "next_question": "A logical follow-up question, or a new topic question to continue the interview. ${difficultyInstruction}",
  "isCodingQuestion": true/false
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

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error('Error in evaluate route:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate answer' },
      { status: 500 }
    );
  }
}
