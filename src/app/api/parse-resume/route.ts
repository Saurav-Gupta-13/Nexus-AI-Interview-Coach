import { NextRequest, NextResponse } from 'next/server';
import PDFParser from 'pdf2json';
import Groq from 'groq-sdk';
import { checkRateLimit } from '@/lib/ratelimit';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const isAllowed = await checkRateLimit(ip);
    
    if (!isAllowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get('resume') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // pdf2json uses an event-based approach, so we wrap it in a Promise
    const text: string = await new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(null, 1);
      
      pdfParser.on('pdfParser_dataError', (errData) => {
        reject(errData.parserError);
      });
      
      pdfParser.on('pdfParser_dataReady', () => {
        resolve(pdfParser.getRawTextContent());
      });

      pdfParser.parseBuffer(buffer);
    });

    // Remove the excessive line breaks pdf2json can produce
    const cleanedText = text.replace(/\r\n/g, ' ').replace(/\n/g, ' ').trim();
    
    // Validate if the document is actually a resume using Groq JSON mode
    const validationPrompt = `You are a strict, expert document classifier. 
Your only job is to determine if the following extracted text from a PDF is genuinely a Resume or Curriculum Vitae.
A resume MUST contain typical sections like work experience, education, skills, or professional summary. 
If the text is a legal document, legal brief, contract, invoice, menu, essay, or any other non-resume document, you MUST classify it as false.
Respond strictly in JSON format with the following schema:
{
  "isResume": boolean,
  "reason": "short explanation of what the document actually appears to be"
}

Text to analyze:
"""
${cleanedText.substring(0, 2000)}
"""`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: validationPrompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.0,
      max_tokens: 150,
      response_format: { type: 'json_object' },
    });

    try {
      const responseContent = chatCompletion.choices[0]?.message?.content || '{}';
      const result = JSON.parse(responseContent);
      
      if (result.isResume === false) {
        return NextResponse.json(
          { error: 'Invalid Document', details: `This does not appear to be a Resume. AI Detection: ${result.reason}` },
          { status: 400 }
        );
      }
    } catch (e) {
      console.error("Failed to parse Groq validation JSON:", e);
      // If JSON fails, let it pass to avoid blocking legitimate users due to AI error, but log it.
    }
    
    return NextResponse.json({ text: cleanedText });
  } catch (error: any) {
    console.error('Error parsing PDF:', error);
    return NextResponse.json(
      { error: 'Failed to parse PDF', details: error.message },
      { status: 500 }
    );
  }
}
