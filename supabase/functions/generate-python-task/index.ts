import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

type PyTask = {
  title: string;
  prompt: string;
  setup_code: string;
  starter_code: string;
  difficulty: string;
  grading_notes: string;
};

const FALLBACK_EXERCISES: PyTask[] = [
  {
    title: "Revenue per product",
    prompt:
      "A `df` DataFrame with columns product, category, units_sold, price is already loaded. Compute total revenue per product (units_sold * price), then print the top 3 products by revenue.",
    setup_code: `import pandas as pd

df = pd.DataFrame({
    "product": ["Notebook", "Pen", "Backpack", "Mug", "Laptop Stand"],
    "category": ["Stationery", "Stationery", "Bags", "Home", "Office"],
    "units_sold": [120, 340, 45, 90, 30],
    "price": [12.5, 3.0, 45.0, 9.0, 28.0],
})
`,
    starter_code: "# df is already available.\n\n",
    difficulty: "Basic",
    grading_notes:
      "Correct answer computes revenue = units_sold * price per row, sorts descending, and prints the top 3 products with their revenue.",
  },
  {
    title: "Category totals",
    prompt:
      "Using the same `df`, group by category and print total units_sold per category, sorted descending.",
    setup_code: `import pandas as pd

df = pd.DataFrame({
    "product": ["Notebook", "Pen", "Backpack", "Mug", "Laptop Stand"],
    "category": ["Stationery", "Stationery", "Bags", "Home", "Office"],
    "units_sold": [120, 340, 45, 90, 30],
    "price": [12.5, 3.0, 45.0, 9.0, 28.0],
})
`,
    starter_code: "# df is already available.\n\n",
    difficulty: "Basic",
    grading_notes:
      'Correct answer uses groupby("category")["units_sold"].sum(), sorted descending, and prints the result.',
  },
  {
    title: "Filter and flag",
    prompt:
      "Using the same `df`, print only the rows where price is above the average price across all products.",
    setup_code: `import pandas as pd

df = pd.DataFrame({
    "product": ["Notebook", "Pen", "Backpack", "Mug", "Laptop Stand"],
    "category": ["Stationery", "Stationery", "Bags", "Home", "Office"],
    "units_sold": [120, 340, 45, 90, 30],
    "price": [12.5, 3.0, 45.0, 9.0, 28.0],
})
`,
    starter_code: "# df is already available.\n\n",
    difficulty: "Basic",
    grading_notes:
      'Correct answer computes df["price"].mean() and filters/prints rows where price is greater than that average.',
  },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { module_title, module_description, is_capstone } = body;
    const count = is_capstone ? 4 : 3;

    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ exercises: FALLBACK_EXERCISES.slice(0, count) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Create a problem set of exactly ${count} synthetic Python/pandas/numpy practice exercises for a data science learner working on this module:
Title: ${module_title ?? "Data analysis"}
Description: ${module_description ?? "Practice pandas fundamentals."}
${is_capstone ? "This is a capstone module: make the exercises progressively larger and combine multiple concepts from the module, building toward a small end-to-end mini-project by the last exercise." : "Order the exercises from easiest to hardest, each focused on a distinct sub-skill within the module topic."}

Respond with ONLY valid JSON (no markdown fences), an array of exactly ${count} objects, each with these exact fields:
{
  "title": "short exercise title",
  "prompt": "1-3 sentence task description explaining what the learner must compute or produce",
  "setup_code": "Python code that imports needed libraries (pandas/numpy only) and creates variables (e.g. df) with realistic synthetic data, under 20 rows, runnable standalone",
  "starter_code": "a short comment-only or minimal starter the learner edits, NOT the solution",
  "difficulty": "Basic, Intermediate, or Advanced",
  "grading_notes": "what a correct solution must do, for a grader to check against"
}

Exercises within the set should reuse the same or a closely related dataset where it makes sense, similar to how a real problem set builds on one dataset. Only pandas and numpy are available (no matplotlib, no file/network access, no sklearn).`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 2200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await resp.json();
    const content = data?.content?.[0]?.text ?? "[]";
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    let exercises: PyTask[];
    try {
      const parsed = JSON.parse(cleaned);
      exercises =
        Array.isArray(parsed) && parsed.length > 0 ? parsed : FALLBACK_EXERCISES.slice(0, count);
    } catch {
      exercises = FALLBACK_EXERCISES.slice(0, count);
    }
    return new Response(JSON.stringify({ exercises }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
        exercises: FALLBACK_EXERCISES,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
