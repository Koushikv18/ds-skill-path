import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

const FALLBACK_TASK = {
  title: 'Explore product sales',
  prompt: "A `df` DataFrame with columns product, category, units_sold, price is already loaded. Compute total revenue per product (units_sold * price), then print the top 3 products by revenue.",
  setup_code: `import pandas as pd

df = pd.DataFrame({
    "product": ["Notebook", "Pen", "Backpack", "Mug", "Laptop Stand"],
    "category": ["Stationery", "Stationery", "Bags", "Home", "Office"],
    "units_sold": [120, 340, 45, 90, 30],
    "price": [12.5, 3.0, 45.0, 9.0, 28.0],
})
`,
  starter_code: '# Write your solution below.\n# df is already available.\n\n',
  difficulty: 'Basic',
  grading_notes: 'Correct answer computes revenue = units_sold * price per row, sorts descending, and prints/returns the top 3 products with their revenue.',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { module_title, module_description, difficulty, is_capstone } = body;

    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ task: FALLBACK_TASK }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Create one synthetic Python/pandas practice task for a data science learner working on this module:
Title: ${module_title ?? 'Data analysis'}
Description: ${module_description ?? 'Practice pandas fundamentals.'}
Target difficulty: ${difficulty ?? 'Basic'}
${is_capstone ? 'This is a capstone: make it a slightly larger, multi-step task combining a few concepts.' : ''}

Respond with ONLY valid JSON (no markdown fences) with these exact fields:
{
  "title": "short task title",
  "prompt": "1-3 sentence task description explaining what the learner must compute or produce, referencing the df variable",
  "setup_code": "Python code that imports pandas/numpy and creates a variable named df (or other needed variables) with realistic synthetic data. Must be runnable standalone.",
  "starter_code": "A short comment-only or minimal starter the learner edits, NOT the solution",
  "difficulty": "Basic, Intermediate, or Advanced",
  "grading_notes": "what a correct solution must do, for a grader to check against"
}

The task must be solvable using only pandas and numpy (already available), printing results with print(). Keep setup_code data small (under 20 rows).`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await resp.json();
    const content = data?.content?.[0]?.text ?? '{}';
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    let task;
    try {
      task = JSON.parse(cleaned);
    } catch {
      task = FALLBACK_TASK;
    }
    return new Response(JSON.stringify({ task }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error', task: FALLBACK_TASK }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
