// Claude implementation of AIProvider. Structured output via a forced tool call, then zod validation.
import Anthropic from "@anthropic-ai/sdk";
import { PermanentAiError } from "./provider.js";
import { EVIDENCE_SYSTEM, QUESTIONS_SYSTEM, fence } from "./prompts.js";
import { ExtractionSchema, QuestionsSchema, jsonSchema } from "./schemas.js";
import { SCHEMAS, TOOLS } from "../writing/schemas.js";
import { WRITING_SYSTEM, buildWritingPrompt } from "../writing/prompts.js";
/** Turns strings that are really JSON arrays/objects back into arrays/objects (recursively). Returns { value, changed }. */
export function unstringify(value) {
    if (typeof value === "string") {
        const t = value.trim();
        if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}"))) {
            try {
                const inner = unstringify(JSON.parse(t));
                return { value: inner.value, changed: true };
            }
            catch { /* ordinary text that merely looks like JSON */ }
        }
        return { value, changed: false };
    }
    if (Array.isArray(value)) {
        let changed = false;
        const out = value.map((v) => { const r = unstringify(v); changed ||= r.changed; return r.value; });
        return { value: out, changed };
    }
    if (value && typeof value === "object") {
        let changed = false;
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            const r = unstringify(v);
            changed ||= r.changed;
            let inner = r.value;
            // Double wrapping: { questions: '{"questions":[...]}' } decodes to { questions: { questions: [...] } }; unwrap the repeat.
            if (r.changed && inner && typeof inner === "object" && !Array.isArray(inner)) {
                const keys = Object.keys(inner);
                if (keys.length === 1 && keys[0] === k)
                    inner = inner[k];
            }
            out[k] = inner;
        }
        return { value: out, changed };
    }
    return { value, changed: false };
}
export class AnthropicProvider {
    name = "anthropic";
    model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 240_000, maxRetries: 1 });
    async call(tool, schema, system, user, maxTokens) {
        let message;
        try {
            message = await this.client
                .messages.stream({
                model: this.model,
                max_tokens: maxTokens,
                system,
                tools: [{ name: tool, description: "Return the structured result.", input_schema: jsonSchema(schema) }],
                tool_choice: { type: "tool", name: tool },
                messages: [{ role: "user", content: user }],
            })
                .finalMessage();
        }
        catch (err) {
            const status = err.status;
            if (status === 401 || status === 403)
                throw new PermanentAiError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local.");
            if (status === 400 || status === 404)
                throw new PermanentAiError(`The AI request was refused (${status}): ${err.message.slice(0, 200)}`);
            throw err;
        }
        if (message.stop_reason === "max_tokens")
            throw new Error("The AI answer was cut off (too long).");
        const block = message.content.find((b) => b.type === "tool_use");
        if (!block)
            throw new Error("The AI did not return structured output.");
        let parsed = schema.safeParse(block.input);
        if (!parsed.success) {
            // The model sometimes sends a list or object as JSON TEXT. Repair that once and validate again; nothing else is altered.
            const fixed = unstringify(block.input);
            if (fixed.changed) {
                const again = schema.safeParse(fixed.value);
                if (again.success)
                    parsed = again;
            }
        }
        if (!parsed.success)
            throw new Error(`The AI output failed validation: ${parsed.error.issues[0]?.message ?? "unknown"} (at ${(parsed.error.issues[0]?.path ?? []).join(".") || "top level"})`);
        return { data: parsed.data, usage: { inputTokens: message.usage.input_tokens ?? null, outputTokens: message.usage.output_tokens ?? null } };
    }
    extractEvidence(input) {
        const user = [
            `TODAY'S DATE: ${input.today || new Date().toISOString().slice(0, 10)}`,
            `TARGET ROLE: ${input.target.role}`,
            `LOCATION: ${input.target.location}`,
            `CLIENT'S STATED GOAL: ${input.target.goal}`,
            "",
            input.documentsText,
            input.answersText ? `\n${input.answersText}` : "",
            input.note ? `\nNOTE FROM REVIEWER: ${input.note}` : "",
        ].join("\n");
        return this.call("record_evidence", ExtractionSchema, EVIDENCE_SYSTEM, user, 16000);
    }
    generateQuestions(input) {
        const user = [
            `TARGET ROLE: ${input.target.role} (${input.target.location})`,
            "",
            "CLAIMS:",
            ...input.claims.map((c) => `${c.id} [${c.category}; ${c.status}; relevance ${c.relevance}] ${c.claim}`),
            "",
            "FINDINGS:",
            ...input.findings.map((f) => `${f.id} [${f.kind}; ${f.severity}${f.essential ? "; ESSENTIAL" : ""}] ${f.title}. ${f.detail}`),
            input.answersText ? `\n${input.answersText}` : "",
        ].join("\n");
        return this.call("record_questions", QuestionsSchema, QUESTIONS_SYSTEM, user, 4000);
    }
    /** Stage 2: write one deliverable (cv, linkedin, cover_letter, interview_pack) from verified evidence. */
    writeDeliverable(input) {
        return this.call(TOOLS[input.kind], SCHEMAS[input.kind], WRITING_SYSTEM, buildWritingPrompt(input), 12000);
    }
}
export { fence };
