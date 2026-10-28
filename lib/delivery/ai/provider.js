/** An error the caller should not retry (bad key, bad request, missing configuration). */
export class PermanentAiError extends Error {
}
const g = globalThis;
export function aiConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
}
export async function getProvider() {
    if (g.__deliveryProvider)
        return g.__deliveryProvider;
    if (!aiConfigured()) {
        throw new PermanentAiError("AI is not configured: ANTHROPIC_API_KEY is missing from .env.local. Add it, restart, then press Continue.");
    }
    const { AnthropicProvider } = await import("./anthropic.js");
    g.__deliveryProvider = new AnthropicProvider();
    return g.__deliveryProvider;
}
/** Tests inject a scripted provider; pass null to clear. */
export function setProviderForTests(p) {
    g.__deliveryProvider = p;
}
/** Cost from the prices in .env (USD per 1M tokens). Null when prices are not set: we never guess. */
export function estimateCost(u) {
    const pin = Number(process.env.ANTHROPIC_PRICE_INPUT_PER_1M);
    const pout = Number(process.env.ANTHROPIC_PRICE_OUTPUT_PER_1M);
    if (!pin || !pout || u.inputTokens == null || u.outputTokens == null)
        return null;
    return (u.inputTokens * pin + u.outputTokens * pout) / 1_000_000;
}
