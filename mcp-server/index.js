#!/usr/bin/env node
// Minimal MCP (Model Context Protocol) stdio server for ChamTax's lottery
// tax calculator — zero external dependencies on purpose (this repo avoids
// adding dependencies that aren't load-bearing, see the root package.json).
//
// Speaks newline-delimited JSON-RPC 2.0 over stdin/stdout per the MCP spec.
// Run it directly (`node index.js`) or point an MCP-aware client at it —
// see README.md for how to register it with Claude Desktop / Cursor / etc.

const readline = require('readline');
const { calculateTakeHome, SUPPORTED_COUNTRIES } = require('./tax-data.js');

const SERVER_INFO = { name: 'chamtax-lottery-tax', version: '1.0.0' };
const TOOL = {
  name: 'calculate_lottery_takehome',
  description:
    'Estimate the after-tax take-home amount from a US lottery (Powerball / Mega Millions style) ' +
    'win for a given country of tax residence. Pass the actual payout amount you want evaluated ' +
    '(e.g. the lump-sum cash value), not an announced annuity total — announced jackpots are ' +
    'typically ~1.7-2.2x the lump-sum cash value. This is a simplified, informational estimate, ' +
    'NOT tax or legal advice, and several countries\' rates are marked as unverified approximations ' +
    'in the output notes. Full interactive version with per-country legal citations: https://chamtax.com',
  inputSchema: {
    type: 'object',
    properties: {
      amountUsd: {
        type: 'number',
        description: 'Payout amount in USD to evaluate (e.g. lump-sum cash value), not an announced annuity total.',
      },
      country: {
        type: 'string',
        description: 'Country of tax residence.',
        enum: SUPPORTED_COUNTRIES,
      },
      stateCode: {
        type: 'string',
        description: 'US state code (e.g. "CA", "NY"). Only used when country is "us". Defaults to the 50-state average.',
      },
      krwPerUsd: {
        type: 'number',
        description:
          'USD-to-KRW exchange rate. Only used when country is "kr", since Korea\'s tax brackets are defined ' +
          'in absolute KRW amounts (every other supported country uses a flat rate, so it is currency-invariant). ' +
          'Defaults to an approximate, deliberately-stale placeholder if omitted.',
      },
    },
    required: ['amountUsd', 'country'],
  },
};

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function handleToolsCall(id, params) {
  const { name, arguments: args } = params || {};
  if (name !== TOOL.name) {
    replyError(id, -32602, `Unknown tool "${name}". Available tools: ${TOOL.name}`);
    return;
  }
  try {
    const result = calculateTakeHome(
      args && args.amountUsd,
      args && args.country,
      args && args.stateCode,
      args && args.krwPerUsd
    );
    reply(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
  } catch (err) {
    reply(id, { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true });
  }
}

function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      reply(id, {
        protocolVersion: (params && params.protocolVersion) || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;
    case 'notifications/initialized':
      return; // notification, no response expected
    case 'tools/list':
      reply(id, { tools: [TOOL] });
      return;
    case 'tools/call':
      handleToolsCall(id, params);
      return;
    case 'ping':
      reply(id, {});
      return;
    default:
      if (id !== undefined) replyError(id, -32601, `Method not found: ${method}`);
      return; // unknown notification — ignore silently
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch (err) {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }
  try {
    handleMessage(msg);
  } catch (err) {
    if (msg && msg.id !== undefined) replyError(msg.id, -32603, `Internal error: ${err.message}`);
  }
});
