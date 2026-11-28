import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect, test } from 'vitest';
import { mcpDigest } from '../src/mcp-contract.js';
import {
  botHandoffHttpFixture,
  waitFor,
} from './helpers/bot-handoff-http-fixture.js';

type LedgerRow = {
  event: string;
  request_id?: string | number;
  tool_name?: string;
  argument_keys?: string[];
  arguments_digest?: string;
  execution_result?: string;
  result_digest?: string;
  [key: string]: unknown;
};

test('RETAIL-00B-03V uses exact consent and approvals over local stdio MCP', async () => {
  const f = await botHandoffHttpFixture(undefined, {
    MINICLAW_PI_MCP: 'true',
  });
  const ledger = path.join(f.root, 'retail-00b-03v-mcp-ledger.jsonl');
  const serverId = 'retail_00b_03v_fixture';
  const writeToolName = 'mcp__' + serverId + '__fixture_write';
  const readToolName = 'mcp__' + serverId + '__fixture_read';
  const rows = (): LedgerRow[] =>
    fs.existsSync(ledger)
      ? fs
          .readFileSync(ledger, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : [];
  const executions = () =>
    rows().filter((row) => row.event === 'tool_execution');

  try {
    const options = await f.json<any>(await f.call('/api/bot-groups/options'));
    const jid = options.workspaces[0].jid as string;
    await f.json(
      await f.call('/api/mcp-servers', 'POST', {
        id: serverId,
        command: process.execPath,
        args: [path.resolve('tests/fixtures/retail-00b-03v-mcp-server.mjs')],
        env: { MCP_TEST_LEDGER: ledger },
        pi: {
          version: 1,
          enabled: true,
          location: { kind: 'host' },
          tools: ['fixture_read', 'fixture_write'],
        },
      }),
    );

    const createSession = async (name: string) =>
      (
        await f.json<any>(
          await f.call(
            '/api/groups/' + encodeURIComponent(jid) + '/sessions',
            'POST',
            { name, runtime: 'node-durable' },
          ),
        )
      ).session.id as string;
    const sessionWithNoConsent = await createSession('No MCP consent');
    const writeSession = await createSession('Exact MCP write');
    const readSession = await createSession('Exact MCP read');
    const sessionBase = (id: string) =>
      '/api/groups/' + encodeURIComponent(jid) + '/sessions/' + id;
    const noConsentBase = sessionBase(sessionWithNoConsent);
    const writeBase = sessionBase(writeSession);
    const readBase = sessionBase(readSession);
    const runtime = async (base: string) =>
      f.json<any>(await f.call(base + '/runtime'));
    const sendMessage = async (
      sessionId: string,
      content: string,
      requestId = randomUUID(),
    ) =>
      f.json<any>(
        await f.call('/api/messages', 'POST', {
          chatJid: jid,
          agentId: sessionId,
          requestId,
          content,
          followUpBehavior: 'queue',
        }),
      );
    const waitForInputCount = async (base: string, count: number) => {
      let latest: any;
      await waitFor(async () => {
        latest = await runtime(base);
        return (
          latest.inputs?.length === count &&
          latest.inputs.every((input: any) => input.state === 'completed')
        );
      });
      return latest;
    };
    const waitForTerminalInputCount = async (base: string, count: number) => {
      let latest: any;
      await waitFor(async () => {
        latest = await runtime(base);
        return (
          latest.inputs?.length === count &&
          latest.inputs.every((input: any) =>
            ['completed', 'failed', 'cancelled'].includes(input.state),
          )
        );
      });
      return latest;
    };
    const pendingCall = async (base: string, argsDigest: string) => {
      let latest: any;
      await waitFor(async () => {
        latest = await runtime(base);
        return latest.mcp_approvals?.some(
          (approval: any) =>
            approval.state === 'pending' &&
            approval.intent.arguments_digest === argsDigest,
        );
      });
      return latest.mcp_approvals.find(
        (approval: any) =>
          approval.state === 'pending' &&
          approval.intent.arguments_digest === argsDigest,
      );
    };
    const installToolModel = (
      toolName: string,
      args: Record<string, unknown>,
    ) =>
      f.setModel((body) => {
        const lastUser =
          body.messages
            .map((message, index) => (message.role === 'user' ? index : -1))
            .filter((index) => index >= 0)
            .at(-1) ?? -1;
        const result = body.messages
          .slice(lastUser + 1)
          .filter((message) => message.role === 'tool')
          .at(-1);
        if (result) return { text: 'FIXTURE_CALL_FINISHED' };
        expect(body.tools?.map((tool) => tool.function.name)).toContain(
          toolName,
        );
        return { tool: { name: toolName, arguments: args } };
      });
    const activeToolNames = (body: any) =>
      JSON.parse(body.consent.catalog_json).map(
        (entry: any) => entry.identity.original_name,
      );

    // A model-proposed name outside this Session's live tool set cannot start
    // the configured server or produce a fixture effect.
    await f.json(await f.call(noConsentBase + '/runtime'));
    let unauthorizedModelCall = 0;
    f.setModel((body) => {
      const offered = body.tools?.map((tool) => tool.function.name) ?? [];
      expect(offered).not.toContain(writeToolName);
      expect(offered).not.toContain(readToolName);
      if (unauthorizedModelCall++ === 0) {
        return {
          tool: {
            name: writeToolName,
            arguments: { value: 'NO_CONSENT' },
          },
        };
      }
      return { text: 'NO_MCP_CONSENT' };
    });
    await sendMessage(
      sessionWithNoConsent,
      'Attempt an unconsented fixture tool call.',
    );
    const noConsentSnapshot = await waitForInputCount(noConsentBase, 1);
    expect(noConsentSnapshot.inputs[0].state).toBe('completed');
    expect(rows()).toEqual([]);
    expect(unauthorizedModelCall).toBeGreaterThan(0);

    const registerConsent = async (
      base: string,
      tools: string[],
      requestId: string,
    ) => {
      const settings = await f.json<any>(await f.call(base + '/mcp'));
      const server = settings.servers.find(
        (candidate: any) => candidate.server_id === serverId,
      );
      expect(server).toBeTruthy();
      const body = {
        request_id: requestId,
        server_id: server.server_id,
        configuration_digest: server.configuration_digest,
        tools,
        ttl_seconds: 600,
        confirmed_startup_and_restart: true,
      };
      return {
        body,
        response: await f.json<any>(
          await f.call(base + '/mcp/consents', 'POST', body),
        ),
      };
    };

    const consentRequestId = randomUUID();
    const firstWriteConsent = await registerConsent(
      writeBase,
      ['fixture_write'],
      consentRequestId,
    );
    const writeConsent = firstWriteConsent.response.consent;
    expect(writeConsent.state).toBe('active');
    expect(activeToolNames(firstWriteConsent.response)).toEqual([
      'fixture_write',
    ]);
    expect(rows().filter((row) => row.event === 'server_start')).toHaveLength(
      1,
    );
    expect(executions()).toHaveLength(0);
    const repeatedWriteConsent = await f.json<any>(
      await f.call(writeBase + '/mcp/consents', 'POST', firstWriteConsent.body),
    );
    expect(repeatedWriteConsent.consent.id).toBe(writeConsent.id);
    expect(rows().filter((row) => row.event === 'server_start')).toHaveLength(
      1,
    );

    const deniedValue =
      'DENY_' + randomUUID().replaceAll('-', '').toUpperCase();
    installToolModel(writeToolName, { value: deniedValue });
    await sendMessage(writeSession, 'Run fixture write ' + deniedValue);
    const denied = await pendingCall(
      writeBase,
      mcpDigest({ value: deniedValue }),
    );
    expect(denied.intent).toMatchObject({
      session_id: writeSession,
      server_id: serverId,
      original_name: 'fixture_write',
      grant_id: writeConsent.id,
      arguments_digest: mcpDigest({ value: deniedValue }),
      source: { runtime: 'pi-durable' },
    });
    expect(executions()).toHaveLength(0);
    const wrongSessionArguments = await f.call(
      noConsentBase + '/mcp/approvals/' + denied.id + '/arguments',
    );
    expect(wrongSessionArguments.status).toBe(404);
    const wrongSessionDecision = await f.call(
      noConsentBase + '/mcp/approvals/' + denied.id,
      'POST',
      {
        parametersDigest: denied.parameters_digest,
        decision: 'approve',
        requestId: randomUUID(),
      },
    );
    expect(wrongSessionDecision.status).toBe(409);
    const businessApprovalBypass = await f.call(
      writeBase + '/approvals/' + denied.id,
      'POST',
      {
        parametersDigest: denied.parameters_digest,
        decision: 'approve',
        requestId: randomUUID(),
      },
    );
    expect(businessApprovalBypass.status).toBe(409);
    expect(executions()).toHaveLength(0);
    const denyDecision = {
      parametersDigest: denied.parameters_digest,
      decision: 'deny',
      requestId: randomUUID(),
    };
    const denyFirst = await f.call(
      writeBase + '/mcp/approvals/' + denied.id,
      'POST',
      denyDecision,
    );
    expect(denyFirst.status).toBe(200);
    const denyAgain = await f.call(
      writeBase + '/mcp/approvals/' + denied.id,
      'POST',
      denyDecision,
    );
    expect(denyAgain.status).toBe(200);
    const afterDeny = await waitForInputCount(writeBase, 1);
    expect(
      afterDeny.mcp_approvals.find((approval: any) => approval.id === denied.id)
        .state,
    ).toBe('denied');
    expect(executions()).toHaveLength(0);

    const approvedValue =
      'ALLOW_' + randomUUID().replaceAll('-', '').toUpperCase();
    const approvedRequestId = randomUUID();
    const approvedContent = 'Run fixture write ' + approvedValue;
    installToolModel(writeToolName, { value: approvedValue });
    const originalApprovedMessage = await sendMessage(
      writeSession,
      approvedContent,
      approvedRequestId,
    );
    const approved = await pendingCall(
      writeBase,
      mcpDigest({ value: approvedValue }),
    );
    expect(executions()).toHaveLength(0);
    const changedDigest = mcpDigest({ value: approvedValue + '_CHANGED' });
    expect(changedDigest).not.toBe(approved.parameters_digest);
    const changedParametersRequestId = randomUUID();
    const changedDecision = await f.call(
      writeBase + '/mcp/approvals/' + approved.id,
      'POST',
      {
        parametersDigest: changedDigest,
        decision: 'approve',
        requestId: changedParametersRequestId,
      },
    );
    expect(changedDecision.status).toBe(409);
    expect(executions()).toHaveLength(0);
    const exactDecision = {
      parametersDigest: approved.parameters_digest,
      decision: 'approve',
      requestId: randomUUID(),
    };
    expect(
      (
        await f.call(
          writeBase + '/mcp/approvals/' + approved.id,
          'POST',
          exactDecision,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await f.call(
          writeBase + '/mcp/approvals/' + approved.id,
          'POST',
          exactDecision,
        )
      ).status,
    ).toBe(200);
    const afterWrite = await waitForInputCount(writeBase, 2);
    const completedWrite = afterWrite.mcp_approvals.find(
      (approval: any) => approval.id === approved.id,
    );
    expect(completedWrite.state).toBe('completed');
    const writeReceipt = executions()[0];
    expect(writeReceipt).toMatchObject({
      method: 'tools/call',
      tool_name: 'fixture_write',
      argument_keys: ['value'],
      arguments_digest: approved.intent.arguments_digest,
      execution_result: 'completed',
    });
    expect(String(writeReceipt.request_id)).toBeTruthy();
    expect(JSON.stringify(rows())).not.toContain(approvedValue);
    expect(
      f.requests
        .at(-1)
        ?.messages.some(
          (message) =>
            message.role === 'tool' &&
            String(message.content).includes(writeReceipt.arguments_digest),
        ),
    ).toBe(true);
    const repeatedApprovedMessage = await sendMessage(
      writeSession,
      approvedContent,
      approvedRequestId,
    );
    expect(repeatedApprovedMessage.messageId).toBe(
      originalApprovedMessage.messageId,
    );
    expect((await runtime(writeBase)).inputs).toHaveLength(2);
    expect(executions()).toHaveLength(1);

    // A separate exact read grant still waits for its own MCP approval; there is
    // no generic READ_AUTO exception based on the tool name or annotations.
    const readConsentRequestId = randomUUID();
    const firstReadConsent = await registerConsent(
      readBase,
      ['fixture_read'],
      readConsentRequestId,
    );
    const readConsent = firstReadConsent.response.consent;
    expect(readConsent.state).toBe('active');
    expect(activeToolNames(firstReadConsent.response)).toEqual([
      'fixture_read',
    ]);
    expect(executions()).toHaveLength(1);
    const readArgs = {};
    const readDigest = mcpDigest(readArgs);
    installToolModel(readToolName, readArgs);
    await sendMessage(readSession, 'Read the synthetic fixture.');
    const pendingRead = await pendingCall(readBase, readDigest);
    expect(pendingRead.intent).toMatchObject({
      session_id: readSession,
      server_id: serverId,
      original_name: 'fixture_read',
      grant_id: readConsent.id,
      arguments_digest: readDigest,
    });
    expect(executions()).toHaveLength(1);
    const readDecision = {
      parametersDigest: pendingRead.parameters_digest,
      decision: 'approve',
      requestId: randomUUID(),
    };
    expect(
      (
        await f.call(
          readBase + '/mcp/approvals/' + pendingRead.id,
          'POST',
          readDecision,
        )
      ).status,
    ).toBe(200);
    const afterRead = await waitForInputCount(readBase, 1);
    const completedRead = afterRead.mcp_approvals.find(
      (approval: any) => approval.id === pendingRead.id,
    );
    expect(completedRead.state).toBe('completed');
    expect(executions()).toHaveLength(2);
    const readReceipt = executions()[1];
    expect(readReceipt).toMatchObject({
      tool_name: 'fixture_read',
      arguments_digest: readDigest,
      execution_result: 'completed',
    });

    const revokedValue =
      'REVOKED_' + randomUUID().replaceAll('-', '').toUpperCase();
    installToolModel(writeToolName, { value: revokedValue });
    await sendMessage(
      writeSession,
      'Queue a pending tool then revoke ' + revokedValue,
    );
    const pendingRevoked = await pendingCall(
      writeBase,
      mcpDigest({ value: revokedValue }),
    );
    expect(executions()).toHaveLength(2);
    expect(
      (await f.call(writeBase + '/mcp/consents/' + writeConsent.id, 'DELETE'))
        .status,
    ).toBe(200);
    const lateApprovalRequestId = randomUUID();
    const lateApproval = await f.call(
      writeBase + '/mcp/approvals/' + pendingRevoked.id,
      'POST',
      {
        parametersDigest: pendingRevoked.parameters_digest,
        decision: 'approve',
        requestId: lateApprovalRequestId,
      },
    );
    expect(lateApproval.status).toBe(409);
    expect(executions()).toHaveLength(2);
    const noToolsAfterRevoke = await f.json<any>(
      await f.call(writeBase + '/mcp'),
    );
    expect(
      noToolsAfterRevoke.consents.find(
        (consent: any) => consent.id === writeConsent.id,
      ).state,
    ).toBe('revoked');
    await waitForTerminalInputCount(writeBase, 3);

    const postRevokeValue =
      'AFTER_REVOKE_' + randomUUID().replaceAll('-', '').toUpperCase();
    let postRevokeModelAttempt = 0;
    f.setModel((body) => {
      const offered = body.tools?.map((tool) => tool.function.name) ?? [];
      expect(offered).not.toContain(writeToolName);
      expect(offered).not.toContain(readToolName);
      if (postRevokeModelAttempt++ === 0) {
        return {
          tool: {
            name: writeToolName,
            arguments: { value: postRevokeValue },
          },
        };
      }
      return { text: 'REVOKED_MCP_UNAVAILABLE' };
    });
    const postRevokeRequestId = randomUUID();
    await sendMessage(
      writeSession,
      'Attempt fixture write after revocation.',
      postRevokeRequestId,
    );
    const afterRevokeAttempt = await waitForTerminalInputCount(writeBase, 4);
    expect(afterRevokeAttempt.inputs).toHaveLength(4);
    expect(postRevokeModelAttempt).toBeGreaterThan(0);
    expect(rows().filter((row) => row.event === 'server_start')).toHaveLength(
      2,
    );
    expect(executions()).toHaveLength(2);
    expect(JSON.stringify(rows())).not.toContain(postRevokeValue);

    console.info(
      'RETAIL-00B-03V_RECEIPT ' +
        JSON.stringify({
          issue: 17,
          isolation: {
            product_bind: new URL(f.origin).hostname,
            product_port: Number(new URL(f.origin).port),
            test_root: path.basename(f.root),
            mcp_transport: 'stdio',
            sqlite_session_ipc_workspace_isolated: true,
          },
          consent_request_id: consentRequestId,
          consent_id: writeConsent.id,
          consent_scope_session_id: writeSession,
          scope_server_id: serverId,
          scope_tools: ['fixture_write'],
          grant_id: approved.intent.grant_id,
          denied_approval_id: denied.id,
          denied_approval_state: 'denied',
          denial_decision_request_id: denyDecision.requestId,
          business_approval_route_bypass_rejected:
            businessApprovalBypass.status === 409,
          changed_parameter_digest_rejected: true,
          changed_parameters_approval_request_id: changedParametersRequestId,
          approved_request_id: exactDecision.requestId,
          approved_approval_id: approved.id,
          approved_state: completedWrite.state,
          tool_name: writeReceipt.tool_name,
          mcp_jsonrpc_request_id: writeReceipt.request_id,
          arguments_digest: writeReceipt.arguments_digest,
          execution_result: writeReceipt.execution_result,
          result_digest: writeReceipt.result_digest,
          repeated_message_request_id: approvedRequestId,
          duplicate_message_returned_same_id:
            repeatedApprovedMessage.messageId ===
            originalApprovedMessage.messageId,
          read_session_id: readSession,
          read_consent_request_id: readConsentRequestId,
          read_consent_id: readConsent.id,
          read_scope_tools: ['fixture_read'],
          read_grant_id: pendingRead.intent.grant_id,
          read_approval_request_id: readDecision.requestId,
          read_tool_name: readReceipt.tool_name,
          read_mcp_jsonrpc_request_id: readReceipt.request_id,
          read_arguments_digest: readReceipt.arguments_digest,
          read_approval_state: completedRead.state,
          read_result_digest: readReceipt.result_digest,
          read_tool_required_per_call_approval: true,
          revoke_approval_id: pendingRevoked.id,
          late_approval_request_id: lateApprovalRequestId,
          revoked_late_approval_rejected: true,
          post_revoke_request_id: postRevokeRequestId,
          post_revoke_tool_offer_absent: postRevokeModelAttempt > 0,
          post_revoke_attempt_executions: 0,
          total_fixture_calls: executions().length,
          raw_parameters_logged: false,
        }),
    );
  } finally {
    await f.dispose();
  }
}, 180000);
