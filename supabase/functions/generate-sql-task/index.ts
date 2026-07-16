import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

serve(async (req) => {
  try {
    const body = await req.json();
    if (body.mode === 'feedback') {
      if (!anthropicApiKey) {
        return new Response(JSON.stringify({ feedback: 'The query produced a valid result. A senior analyst would check edge cases, indexes, and readability.' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const prompt = `You are a senior data analyst. Review this SQL query. Be concise and practical.\n\nSchema:\n${body.schema_sql}\n\nQuery:\n${body.query}\n\nResult:\n${JSON.stringify(body.result)}\n\nExpected rows:\n${JSON.stringify(body.expected_result_rows)}\n\nCorrectness:\n${body.correct ? 'correct' : 'incorrect'}\n\nProvide a short advisory note focused on readability, efficiency, and edge cases.`;

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 220,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await resp.json();
      const feedback = data?.content?.[0]?.text ?? 'The query produced a valid result. A senior analyst would check edge cases, indexes, and readability.';
      return new Response(JSON.stringify({ feedback }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
    }

    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ task: { id: 1, title: 'Customers with large orders', prompt: 'Which customers placed orders over $100? Show the customer name and total order amount.', difficulty: 'Basic', schema_sql: `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL, total_amount REAL NOT NULL); INSERT INTO customers (id, name) VALUES (1, 'Ava'), (2, 'Ben'), (3, 'Cleo'); INSERT INTO orders (id, customer_id, total_amount) VALUES (1, 1, 140), (2, 2, 80), (3, 3, 215), (4, 1, 60);`, expected_result_rows: [{ name: 'Ava', total_amount: 140 }, { name: 'Cleo', total_amount: 215 }] } }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
    }

    const prompt = `Create one synthetic SQL practice task for a learner. Output JSON with fields: id, title, prompt, difficulty, schema_sql, expected_result_rows. The difficulty should be one of Basic, Intermediate, or Advanced. Schema should include 2-4 related tables and INSERT statements. The prompt should be solvable with a SQL query. Return only valid JSON.`;
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await resp.json();
    const content = data?.content?.[0]?.text ?? '{}';
    const task = JSON.parse(content);
    return new Response(JSON.stringify({ task }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), { headers: { 'Content-Type': 'application/json' }, status: 500 });
  }
});
