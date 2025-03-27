interface FoodInfo {
  name: string;
  description: string;
}

interface FoodTable {
  id: number;
  name: string;
  description: string;
  count: number;
  created_at?: string;
}

export type { FoodInfo, FoodTable };
