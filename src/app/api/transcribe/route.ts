import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { File } from 'buffer';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // The Blob from formData is actually already a File-like object that Groq accepts
    const transcription = await groq.audio.transcriptions.create({
      file: file as any, // Cast to any to satisfy TS, it accepts the Next.js File object
      model: 'whisper-large-v3',
      prompt: 'Interview response, clear professional English.',
      response_format: 'json',
      language: 'en',
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error('Error in transcribe route:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
