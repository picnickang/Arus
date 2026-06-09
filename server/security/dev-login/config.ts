export function isDevLoginEnabled(): boolean {
  if (process.env["NODE_ENV"] === "production") {
    return false;
  }
  if (process.env["ARUS_DEV_LOGIN"] === "0") {
    return false;
  }
  if (process.env["NODE_ENV"] === "test") {
    return process.env["ARUS_DEV_LOGIN"] === "1";
  }
  return process.env["NODE_ENV"] === "development" || process.env["ARUS_DEV_LOGIN"] === "1";
}
