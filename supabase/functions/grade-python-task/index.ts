import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { prompt, grading_notes, code, stdout, had_error } = body;

    if (had_error) {
      return new Response(JSON.stringify({
        passed: false,
        feedback: "The code raised an error before finishing. Fix the error and run it again before submitting.",
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!anthropicApiKey) {
      // Deterministic-ish fallback: pass if there's any non-empty output.
      const passed = Boolean(stdout && stdout.trim().length > 0);
      return new Response(JSON.stringify({
        passed,
        feedback: passed
          ? "Output looks present. (AI grading is unavailable right now, so this is a basic check only.)"
          : "No output was printed. Make sure your solution prints its result, then submit again.",
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const gradingPrompt = `You are grading a learner's Python/pandas solution for a data science course.

Task: ${prompt}
What a correct solution must do: ${grading_notes}

Learner's code:
\`\`\`python
${code}
\`\`\`

Captured stdout when the code ran:
\`\`\`
${stdout ?? '(no output)'}
\`\`\`

Decide if this solution correctly and substantially satisfies the task. Minor style differences are fine; the result must be correct. Respond with ONLY valid JSON, no markdown fences:
{"passed": true or false, "feedback": "2-3 sentences of specific, constructive feedback"}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 300,
        messages: [{ role: 'user', content: gradingPrompt }],
      }),
    });
    const data = await resp.json();
    const content = data?.content?.[0]?.text ?? '{}';
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    let verdict;
    try {
      verdict = JSON.parse(cleaned);
    } catch {
      verdict = { passed: false, feedback: 'Could not evaluate the submission automatically. Try again.' };
    }
    return new Response(JSON.stringify(verdict), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
