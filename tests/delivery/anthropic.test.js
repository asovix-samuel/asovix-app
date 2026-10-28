import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goodExtraction } from './helpers.js';
import { AnthropicProvider } from '../../lib/delivery/ai/anthropic.js';
import { PermanentAiError } from '../../lib/delivery/ai/provider.js';
import { ExtractionSchema, QuestionsSchema, jsonSchema } from '../../lib/delivery/ai/schemas.js';

// The real model is not called here (no key in tests). These check the request we would send and how replies are validated.
function providerWith(streamImpl) {
  process.env.ANTHROPIC_API_KEY = 'sk-test-not-real';
  const p = new AnthropicProvider();
  p.client = { messages: { stream: streamImpl } };
  return p;
}
const reply = (input, extra = {}) => ({ finalMessage: async () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 't', input }], usage: { input_tokens: 10, output_tokens: 5 }, ...extra }) });

test('the structured-output schemas are valid JSON Schema objects the API accepts', () => {
  for (const s of [ExtractionSchema, QuestionsSchema]) {
    const js = jsonSchema(s);
    assert.equal(js.type, 'object');
    assert.equal(js.$schema, undefined);
    assert.ok(js.properties);
  }
});

test('request: forced tool call, streaming, document text fenced as untrusted, usage returned', async () => {
  let seen;
  const p = providerWith((req) => { seen = req; return reply(goodExtraction()); });
  const out = await p.extractEvidence({ target: { role: 'R', location: 'L', goal: 'G' }, documentsText: '<untrusted document>x</untrusted>', answersText: '' });
  assert.deepEqual(seen.tool_choice, { type: 'tool', name: 'record_evidence' });
  assert.match(seen.system, /UNTRUSTED DATA/);
  assert.match(seen.messages[0].content, /<untrusted document>/);
  assert.equal(out.usage.inputTokens, 10);
  assert.equal(out.data.claims.length, 5);
});

test('a malformed or truncated reply is rejected rather than trusted', async () => {
  const bad = providerWith(() => reply({ profile: 'nope' }));
  await assert.rejects(() => bad.extractEvidence({ target: { role: 'R', location: 'L', goal: 'G' }, documentsText: 'x', answersText: '' }), /failed validation/);
  const cut = providerWith(() => reply(goodExtraction(), { stop_reason: 'max_tokens' }));
  await assert.rejects(() => cut.extractEvidence({ target: { role: 'R', location: 'L', goal: 'G' }, documentsText: 'x', answersText: '' }), /cut off/);
});

test('a rejected API key is a permanent error (not retried); other errors stay retryable', async () => {
  const denied = providerWith(() => ({ finalMessage: async () => { throw Object.assign(new Error('bad key'), { status: 401 }); } }));
  await assert.rejects(() => denied.generateQuestions({ target: { role: 'R', location: 'L' }, claims: [], findings: [], answersText: '' }), PermanentAiError);
  const flaky = providerWith(() => ({ finalMessage: async () => { throw Object.assign(new Error('overloaded'), { status: 529 }); } }));
  await assert.rejects(() => flaky.generateQuestions({ target: { role: 'R', location: 'L' }, claims: [], findings: [], answersText: '' }), (e) => !(e instanceof PermanentAiError));
  delete process.env.ANTHROPIC_API_KEY;
});

test('a list the model sends as JSON text is repaired once; genuine text that merely looks like JSON is left alone', async () => {
  const { unstringify } = await import('../../lib/delivery/ai/anthropic.js');
  const q = { questions: [{ topic_key: 'a', text: 'Q?', why: 'w', linked_ids: ['c1'] }] };
  // via the provider: questions arrive as a string
  const p = providerWith(() => reply({ questions: JSON.stringify(q.questions) }));
  const out = await p.generateQuestions({ target: { role: 'R', location: 'L' }, claims: [], findings: [], answersText: '' });
  assert.equal(out.data.questions.length, 1);
  assert.equal(out.data.questions[0].topic_key, 'a');
  // the helper only converts strings that really parse
  assert.equal(unstringify('[not json').changed, false);
  assert.equal(unstringify('plain text').value, 'plain text');
  assert.deepEqual(unstringify('{"a":1}').value, { a: 1 });
  delete process.env.ANTHROPIC_API_KEY;
});

test('a doubly wrapped answer (the whole result sent as text inside its own field) is unwrapped', async () => {
  const inner = { questions: [{ topic_key: 'a', text: 'Q?', why: 'w', linked_ids: ['c1'] }] };
  const p = providerWith(() => reply({ questions: JSON.stringify(inner) }));
  const out = await p.generateQuestions({ target: { role: 'R', location: 'L' }, claims: [], findings: [], answersText: '' });
  assert.equal(out.data.questions.length, 1);
  delete process.env.ANTHROPIC_API_KEY;
});
