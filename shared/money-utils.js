function toCents(dollars) {
  if (dollars === null || dollars === void 0 || !Number.isFinite(dollars)) {
    return 0;
  }
  return Math.round(dollars * 100);
}
function toDollars(cents) {
  if (cents === null || cents === void 0 || !Number.isFinite(cents)) {
    return 0;
  }
  return Math.round(cents) / 100;
}
function addDollars(a, b) {
  return toDollars(toCents(a) + toCents(b));
}
function multiplyDollars(dollars, quantity) {
  return toDollars(toCents(dollars) * quantity);
}
function percentageDollars(dollars, percentage) {
  const centsAmount = toCents(dollars);
  const percentageCents = Math.round(centsAmount * (percentage / 100));
  return toDollars(percentageCents);
}
export {
  addDollars,
  multiplyDollars,
  percentageDollars,
  toCents,
  toDollars
};
