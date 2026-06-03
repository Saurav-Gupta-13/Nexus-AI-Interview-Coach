import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { checkRateLimit } from '@/lib/ratelimit';

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
    const { jobDescription, previousQuestion, previousAnswer, resumeText, questionIndex = 0 } = await req.json();

    if (!jobDescription) {
      return NextResponse.json({ error: "Job description is required" }, { status: 400 });
    }

    let prompt = '';

    if (questionIndex === 0) {
      // First question generation: Icebreaker based on Resume
      prompt = `
You are an expert technical interviewer. Based on the following Job Description and the Candidate's Resume, generate ONE highly relevant interview question to start the interview. 
Since this is Question 1, it should be a relatively easy "Icebreaker" or "Background" question. Ask them about a specific project, skill, or past experience from their Resume that relates to the Job Description. DO NOT ask a hard technical or coding question yet.

Return ONLY a valid JSON object in the following format:
{
  "question": "The interview question",
  "isCodingQuestion": false // Always false for the first question
}

Job Description:
${jobDescription}

Candidate's Resume Text:
${resumeText || 'No resume provided. Ask a general background question about their experience.'}
      `;
    } else {
      // Follow-up question generation with progressive difficulty
      let difficultyInstruction = '';
      if (questionIndex === 1 || questionIndex === 2) {
        difficultyInstruction = 'This is Question ' + (questionIndex + 1) + '. Ask a theoretical or behavioral question. DO NOT ask a coding question.';
      } else if (questionIndex === 3) {
        difficultyInstruction = 'This is Question 4. You MUST ask a strict, hands-on CODING QUESTION (e.g. data structures, algorithms, or practical implementation). Determine if it should be "easy", "medium", or "hard" based on their resume.';
      } else if (questionIndex === 4) {
        difficultyInstruction = 'This is Question 5, the final question. Ask an advanced system design or architecture question. DO NOT ask a coding question.';
      }

      prompt = `
You are an expert technical interviewer. Based on the Job Description, the Candidate's Resume, the previous question you asked, and the candidate's answer, generate ONE logical follow-up question or a new topic question.
${difficultyInstruction}

Return ONLY a valid JSON object in the following format:
{
  "question": "The interview question",
  "isCodingQuestion": ${questionIndex === 3 ? "true" : "false"}, // Strict boolean
  "difficulty": "easy" // IF AND ONLY IF isCodingQuestion is true, provide the difficulty ("easy", "medium", or "hard"). Otherwise omit or set to null.
}

Job Description: ${jobDescription}
Candidate's Resume Text: ${resumeText || 'No resume provided.'}
Previous Question: ${previousQuestion}
Candidate's Answer: ${previousAnswer}
      `;
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const content = chatCompletion.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error("No response from Groq");
    }

    const parsedResponse = JSON.parse(content);

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error('Error generating question:', error);
    return NextResponse.json(
      { error: 'Failed to generate question' },
      { status: 500 }
    );
  }
}
