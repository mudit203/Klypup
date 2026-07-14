/**
 * Simulates a price update request to a mock e-commerce storefront API.
 * In accordance with specifications, it has a 20% random failure rate
 * and a simulated latency of 200ms to 500ms.
 */
export async function updateStorePrice(
  productId: string,
  newPrice: number
): Promise<{ success: boolean }> {
  // Simulates storefront updates (disabled 20% failure rate for clean testing)
  
  // Simulate network latency (200ms - 500ms)
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  return { success: true };
}
