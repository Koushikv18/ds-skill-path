export type Module = {
  id: number;
  level: number;
  order_in_level: number;
  title: string;
  description: string;
  is_capstone: boolean;
};

export const LEVELS = [
  { level: 1, name: "Basic", tagline: "Foundations of data with Python" },
  { level: 2, name: "Intermediate", tagline: "Analysis, stats, and your first models" },
  { level: 3, name: "Advanced", tagline: "Production-grade ML and portfolio work" },
] as const;
