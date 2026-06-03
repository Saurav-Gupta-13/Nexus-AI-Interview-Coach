import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { question, resumeText, jobDescription } = await req.json();

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const prompt = `You are an expert AI technical interviewer. 
The candidate is currently struggling with this interview question:
"${question}"

Provide a brief, single-sentence hint to nudge them in the right direction without giving away the exact answer. 
Do not write any code for them. Keep it extremely concise and encouraging.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 150,
    });

    const hint = chatCompletion.choices[0]?.message?.content || "Consider breaking the problem down into smaller, testable functions.";

    return NextResponse.json({ hint });
  } catch (error: any) {
    console.error('Groq Hint Generation Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate hint', details: error.message },
      { status: 500 }
    );
  }
}
