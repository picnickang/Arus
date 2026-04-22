/**
 * Circuit Breakers for External Integrations
 *
 * Provides protection against cascading failures when external services
 * (StormGeo, OpenAI, MQTT, Redis, etc.) are unavailable or experiencing issues.
 *
 * Key Features:
 * - Automatic circuit opening after threshold failures
 * - Graceful degradation with fallback support
 * - Half-open testing for service recovery
 * - Integration with existing error-handling circuit breaker infrastructure
 *
 * Usage:
 *   const result = await withOpenAIProtection(
 *     () => openai.chat.completions.create(...),
 *     () => Promise.resolve({ fallbackResponse: true })
 *   );
 */

import { circuitBreaker, safeExternalOperation } from "../error-handling";

export async function withOpenAIProtection<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return safeExternalOperation("OpenAI", operation, fallback);
}

export async function withStormGeoProtection<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return safeExternalOperation("StormGeo-API", operation, fallback);
}

export async function withWeatherApiProtection<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return safeExternalOperation("WeatherAPI", operation, fallback);
}

export async function withMqttProtection<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return safeExternalOperation("MQTT-Broker", operation, fallback);
}

export async function withRedisProtection<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return safeExternalOperation("Redis-Cache", operation, fallback);
}

export async function withGitHubProtection<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return safeExternalOperation("GitHub-API", operation, fallback);
}

export async function withAquametroProtection<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return safeExternalOperation("Aquametro-FMCC", operation, fallback);
}

export function getCircuitBreakerStatus(serviceName: string) {
  return circuitBreaker.getStatus(serviceName);
}

export function getAllCircuitBreakerStatuses(): Record<
  string,
  { state: string; failures: number }
> {
  const services = [
    "OpenAI",
    "StormGeo-API",
    "WeatherAPI",
    "MQTT-Broker",
    "Redis-Cache",
    "GitHub-API",
    "Aquametro-FMCC",
    "database",
  ];

  const statuses: Record<string, { state: string; failures: number }> = {};
  for (const service of services) {
    const status = circuitBreaker.getStatus(service);
    statuses[service] = {
      state: status.state,
      failures: status.failures,
    };
  }
  return statuses;
}

export { circuitBreaker, safeExternalOperation };
console.log(
  "[External Circuit Breakers] Wrappers available: OpenAI, StormGeo, WeatherAPI, MQTT, Redis, GitHub, Aquametro"
);
