import { createHash } from 'node:crypto';
import fs from 'node:fs';
import readline from 'node:readline';

const ledger = process.env.MCP_TEST_LEDGER;
if (!ledger || !ledger.startsWith('/')) {
  throw new Error('MCP_TEST_LEDGER must be an absolute isolated test path');
}
const digest = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const record = (value) =>
  fs.appendFileSync(ledger, JSON.stringify(value) + '\n', { mode: 0o600 });

record({
  event: 'server_start',
  pid: process.pid,
  server: 'retail-00b-03v-fixture',
  cwd: process.cwd(),
});

const tools = [
  {
    name: 'fixture_read',
    description: 'Read one fixed fixture record; this has no business data.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'fixture_write',
    description: 'Append one harmless test-only effect receipt.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        value: {
          type: 'string',
          minLength: 1,
          maxLength: 64,
          pattern: '^[A-Z0-9_-]+$',
        },
      },
      required: ['value'],
      additionalProperties: false,
    },
  },
];

const input = readline.createInterface({ input: process.stdin });
for await (const line of input) {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    continue;
  }
  if (request.id === undefined) continue;

  let result;
  if (request.method === 'initialize') {
    result = {
      protocolVersion: request.params.protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'retail-00b-03v-fixture', version: '1.0.0' },
    };
  } else if (request.method === 'ping') {
    result = {};
  } else if (request.method === 'tools/list') {
    record({
      event: 'tools_list',
      request_id: request.id,
      tool_names: tools.map((tool) => tool.name),
    });
    result = { tools };
  } else if (request.method === 'tools/call') {
    const name = request.params?.name;
    const args = request.params?.arguments ?? {};
    if (!tools.some((tool) => tool.name === name)) {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32602, message: 'Unknown fixture tool' },
        }) + '\n',
      );
      continue;
    }

    let text;
    if (name === 'fixture_read') {
      text = JSON.stringify({
        fixture: 'RETAIL-00B-03V-ONLY',
        revision: 1,
      });
    } else {
      text = JSON.stringify({
        outcome: 'fixture_write_completed',
        arguments_digest: digest(args),
      });
    }
    const resultDigest = digest({ content: [{ type: 'text', text }] });
    record({
      event: 'tool_execution',
      request_id: request.id,
      method: 'tools/call',
      tool_name: name,
      argument_keys: Object.keys(args).sort(),
      arguments_digest: digest(args),
      execution_result: 'completed',
      result_digest: resultDigest,
    });
    result = { content: [{ type: 'text', text }] };
  } else {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32601, message: 'Unsupported fixture method' },
      }) + '\n',
    );
    continue;
  }

  process.stdout.write(
    JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n',
  );
}
