/**
 * Renders an optional, rough budget range for display - never implies more
 * precision than was given (a bare "From £X" or "Up to £X" when only one
 * bound was entered, rather than guessing the other side).
 */
export function formatBudgetRange(
  budgetMin: number | null,
  budgetMax: number | null,
  includesVat: boolean | null,
): string | null {
  if (budgetMin == null && budgetMax == null) return null;

  const formatAmount = (amount: number) =>
    `£${amount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;

  let range: string;
  if (budgetMin != null && budgetMax != null) {
    range = `${formatAmount(budgetMin)} - ${formatAmount(budgetMax)}`;
  } else if (budgetMin != null) {
    range = `From ${formatAmount(budgetMin)}`;
  } else {
    range = `Up to ${formatAmount(budgetMax!)}`;
  }

  if (includesVat == null) return range;
  return `${range} (${includesVat ? "incl." : "excl."} VAT)`;
}
