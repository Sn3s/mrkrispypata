export function inventoryStatus(stock: number, threshold: number): 'Critical' | 'Low' | 'Healthy' {
  if (stock < threshold * 0.25) return 'Critical';
  if (stock < threshold) return 'Low';
  return 'Healthy';
}
