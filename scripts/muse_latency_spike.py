#!/usr/bin/env python3
"""Small real-API spike; credentials are parsed as data, never executed/logged."""
import argparse
import asyncio
import datetime
import json
import os
from pathlib import Path
import statistics
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/research'
LOG = OUT / 'muse-call-log.jsonl'


def key():
    value = os.environ.get('MODEL_API_KEY', '')
    if not value:
        for line in (ROOT / '.env.local').read_text().splitlines():
            name, sep, candidate = line.strip().partition('=')
            if sep and name == 'MODEL_API_KEY':
                value = candidate.strip().strip('\"\'')
    if not value or value == 'your_key_here':
        raise SystemExit('MODEL_API_KEY is missing or placeholder; value not displayed.')
    return value


def ledger():
    records = [json.loads(s) for s in LOG.read_text().splitlines()]
    known = sum(r.get('estimated_cost_usd') or 0 for r in records)
    unknown = sum(r.get('estimated_cost_usd') is None for r in records)
    lines = ['# Muse API cost ledger', '',
             'Costs are estimates from response usage and published Standard prices, not billing receipts.',
             'Actual grant application, prior/shared usage, and current Billing balance are unverified.',
             'The $150 remainder below assumes the full grant is applied and no other usage exists.', '',
             '[Official pricing](https://dev.meta.ai/docs/pricing-rate-limits): Spark input $1.25/M, cached input $0.15/M, output $4.25/M; Voice Transcribe $0.18/hour.', '',
             f'Known estimated spend: **${known:.8f}**. Conditional $150 remainder: **${150-known:.8f}**.',
             f'Calls/sessions with unknown cost: **{unknown}**. These are excluded from the known total; it is not a complete total if nonzero.', '',
             '| Time UTC | Test | Model | Seconds | Status | Estimated USD |',
             '| --- | --- | --- | --- | --- | --- |']
    for r in records:
        c = r.get('estimated_cost_usd')
        lines.append(f"| {r['timestamp']} | {r['test']} | {r['model']} | {r.get('seconds','—')} | {r['status']} | {f'{c:.8f}' if c is not None else 'unknown'} |")
    lines += ['', 'Per-call usage and request IDs: [sanitized log](muse-call-log.jsonl). Reasoning tokens are included in completion tokens, not charged twice. Audio costs use processed whole seconds when available; sent duration alone is an estimate. Failed requests without usage remain unknown rather than assumed free.', '']
    (OUT / 'muse-cost-ledger.md').write_text('\n'.join(lines))


def record(r):
    r.setdefault('timestamp', datetime.datetime.now(datetime.timezone.utc).isoformat())
    OUT.mkdir(parents=True, exist_ok=True)
    with LOG.open('a') as f:
        f.write(json.dumps(r) + '\n')
    ledger()


CASES = [
    ('on_agenda', False, ['1: We need to decide whether to release Friday.', '2: The rollback test passed. Let us compare the remaining risks.']),
    ('sustained_drift', True, ['1: Let us decide whether to release Friday.', '2: Changing subjects, my holiday hotel was wonderful.', '3: Which beaches did you visit?', '4: Let us compare hotel loyalty points and plan our holidays now.']),
    ('brief_aside', False, ['1: The rollback test passed.', '2: My coffee is cold. Anyway, what is the last release blocker?']),
    ('quoted_example', False, ['1: Our drift detection test quotes "let us talk about holiday hotels".', '2: That quote belongs in the release test suite.']),
    ('missing_owner', True, ['1: We should validate the rollback before release.', '2: Someone should do that tomorrow.']),
    ('confirmed_action', False, ['1: Alex, will you validate rollback by Thursday?', '2: I am Alex. Yes, I own rollback validation by Thursday.', '3: Thanks. Now let us review the release checklist.']),
    ('sustained_drift_2', True, ['1: We are deciding release risks.', '2: Forget that, what sports car would you buy?', '3: I like convertibles. What about engine sizes?', '4: Let us compare car prices for a while.']),
    ('on_agenda_2', False, ['1: Release risk is the migration.', '2: We can use a feature flag and staged rollout.']),
    ('missing_date', True, ['1: Priya, do you own the deployment checklist?', '2: Yes, I will update it.', '3: Okay, moving on.']),
    ('resolved_decision', False, ['1: Shall we delay release until rollback validation?', '2: Agreed, delay until validation.', '3: Confirmed. Now let us review the next risk.']),
]


def check_budget(projected, run_spend, limit):
    records = [json.loads(s) for s in LOG.read_text().splitlines()] if LOG.exists() else []
    if any(r.get('estimated_cost_usd') is None for r in records):
        raise SystemExit('Unknown prior cost: reconcile ledger before further calls.')
    total=sum(r.get('estimated_cost_usd', 0) for r in records)
    today=datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    daily=sum(r.get('estimated_cost_usd', 0) for r in records if r['timestamp'].startswith(today))
    if run_spend+projected > limit or total+projected > 90 or daily+projected > 10:
        raise SystemExit('Conservative run/day/development budget would be exceeded; no call sent.')


def run_reasoning(budget):
    schema = {'type': 'object', 'properties': {
        'intervene': {'type': 'boolean'}, 'kind': {'type': 'string', 'enum': ['none', 'redirect', 'clarify']},
        'spoken_text': {'type': 'string'}, 'evidence_turn_ids': {'type': 'array', 'items': {'type': 'integer'}}},
        'required': ['intervene', 'kind', 'spoken_text', 'evidence_turn_ids'], 'additionalProperties': False}
    samples = []
    run_spend = 0
    api_key = key()
    for effort in ['minimal', 'low']:
        for name, expected, turns in CASES:
            body = {'model': 'muse-spark-1.3', 'reasoning_effort': effort, 'max_tokens': 1024,
                    'response_format': {'type': 'json_schema', 'json_schema': {'name': 'moderation', 'strict': True, 'schema': schema}},
                    'messages': [{'role': 'system', 'content': 'You are Rally. Agenda: decide Friday release and its risks. Intervene only on sustained drift or an actionable follow-up missing owner/date. Stay silent on brief asides, quoted examples, ongoing relevant debate, or already confirmed outcomes. No timer or cooldown blocks this test. Keep speech to one short question. Cite input turn IDs. Do not invent commitments.'},
                                 {'role': 'user', 'content': '\n'.join(turns)}]}
            encoded=json.dumps(body).encode()
            # Conservative byte-count proxy for input tokens, plus full output cap.
            projected=(len(encoded)*1.25+body['max_tokens']*4.25)/1_000_000
            check_budget(projected,run_spend,budget)
            req = urllib.request.Request('https://api.meta.ai/v1/chat/completions', data=encoded, headers={'Authorization': 'Bearer '+api_key, 'Content-Type': 'application/json'})
            t = time.perf_counter()
            r = {'test': f'{effort}/{name}', 'model': body['model'], 'estimated_cost_usd': None}
            try:
                with urllib.request.urlopen(req, timeout=30) as response:
                    data = json.load(response)
                    r.update(status=response.status, request_id=response.headers.get('x-request-id'), usage=data.get('usage', {}))
                u = r['usage']
                if 'prompt_tokens' in u and 'completion_tokens' in u:
                    cached = u.get('prompt_tokens_details', {}).get('cached_tokens', 0)
                    r['estimated_cost_usd'] = ((u['prompt_tokens']-cached)*1.25 + cached*.15 + u['completion_tokens']*4.25)/1_000_000
                choice = data['choices'][0]
                r['finish_reason']=choice.get('finish_reason')
                if not choice['message'].get('content'):
                    raise ValueError('No visible decision; inspect recorded finish_reason and token usage.')
                decision = json.loads(choice['message']['content'])
                ids = decision.get('evidence_turn_ids')
                valid = (set(decision) == set(schema['required']) and type(decision['intervene']) is bool
                         and decision['kind'] in ['none', 'redirect', 'clarify'] and isinstance(decision['spoken_text'], str)
                         and isinstance(ids, list) and all(type(i) is int and 1 <= i <= len(turns) for i in ids)
                         and choice.get('finish_reason') == 'stop'
                         and (not decision['intervene'] or bool(ids) and bool(decision['spoken_text'].strip())))
                r.update(decision=decision, valid=valid, expected_intervene=expected, correct=valid and decision['intervene']==expected)
            except urllib.error.HTTPError as e:
                r.update(status=e.code, request_id=e.headers.get('x-request-id'))
            except Exception as e:
                r.setdefault('status', 'error')
                r['error_type'] = type(e).__name__
            r['seconds'] = round(time.perf_counter()-t, 3)
            record(r)
            run_spend+=r.get('estimated_cost_usd') or projected
            samples.append(r)
            print(json.dumps({k:r.get(k) for k in ['test','status','seconds','correct','estimated_cost_usd']}), flush=True)
            if r['status'] in [401,403,429] or r.get('error_type'):
                break
        if samples[-1]['status'] != 200:
            break
    lines = ['# Rally measured latency results', '',
             'Real API calls from this server on October 28, 2026. Inputs are purpose-written text fixtures, not microphone/transcription output. Sequential requests, no automatic retries. Timings include HTTP connection/network, complete response, JSON parsing and basic validation; they exclude ASR and speech playback.', '',
             'Model: `muse-spark-1.3`, Standard mode, max_tokens 1024. Compact agenda and recent turns, JSON schema output. Timing clock: Python perf_counter. Fresh urllib request per sample; no explicit persistent connection. These are short-context smoke tests, not a production latency guarantee.', '',
             '| Effort | Completed | Valid | Expected behavior | Median seconds | Max seconds | Within 5 sec |',
             '| --- | --- | --- | --- | --- | --- | --- |']
    for effort in ['minimal','low']:
        rs = [r for r in samples if r['test'].startswith(effort+'/')]
        good = [r for r in rs if r.get('valid')]
        ts = [r['seconds'] for r in good]
        lines.append(f"| {effort} | {sum(r['status']==200 for r in rs)}/{len(rs)} | {len(good)} | {sum(bool(r.get('correct')) for r in rs)}/{len(rs)} | {statistics.median(ts) if ts else 'n/a'} | {max(ts) if ts else 'n/a'} | {sum(t<=5 for t in ts)}/{len(rs)} |")
    lines += ['', 'Expected-behavior checks test intervene-versus-silent only, plus basic field/evidence validity. They do not establish full wording quality, robust commitment correctness, realistic long-context performance, speaker identity, or live interruption quality.', '',
              'ASR finalization, actual audible playback, host cancel, real room acoustics, overlap, and Teams transport remain unmeasured. The end-to-end ≤5-second acceptance gate has NOT passed on reasoning results alone.', '',
              'See [per-call log](muse-call-log.jsonl) for timings, decisions and usage; [cost ledger](muse-cost-ledger.md) for estimates and conditional credit remainder.', '']
    (OUT/'latency-results.md').write_text('\n'.join(lines))


async def asr_check(budget):
    import websockets
    run_spend=0
    for mode in ['ENDPOINTING', 'DIARIZATION']:
        check_budget(.0001,run_spend,budget)
        t=time.perf_counter()
        r={'test': f'asr-silence/{mode}', 'model':'muse-voice-transcribe-1.0', 'estimated_cost_usd':None}
        processed=None
        try:
            async with websockets.connect('wss://api.meta.ai/v1/asr/realtime', open_timeout=15, close_timeout=3) as ws:
                await ws.send(json.dumps({'authorization':{'accessToken':'Bearer '+key()}, 'model':r['model'], 'audioEncoding':'PCM_24KHZ', 'mode':mode, 'partialMode':'CUMULATIVE', 'emitAudioProgress':True}))
                ack=json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
                if not ack.get('sessionId'):
                    raise ValueError('No session acknowledgment')
                r['session_id']=ack['sessionId']
                r['handshake_seconds']=round(time.perf_counter()-t,3)
                async def receive():
                    nonlocal processed
                    async for msg in ws:
                        if isinstance(msg, str):
                            event=json.loads(msg)
                            if isinstance(event.get('audioProcessedMs'), (int,float)):
                                processed=max(processed or 0,event['audioProcessedMs'])
                            if event.get('type')=='error':
                                raise ValueError('ASR error event')
                receiver=asyncio.create_task(receive())
                start=time.perf_counter()
                try:
                    for i in range(25):
                        await ws.send(bytes(3840))
                        await asyncio.sleep(max(0,start+(i+1)*.08-time.perf_counter()))
                    await ws.send(json.dumps({'type':'endStream'}))
                    await asyncio.wait_for(receiver,timeout=15)
                finally:
                    if not receiver.done():
                        receiver.cancel()
                        await asyncio.gather(receiver,return_exceptions=True)
                r['status']='session_completed'
                r['audio_sent_seconds']=2
                r['audio_processed_ms']=processed
                # If progress is missing, sent audio is a labeled conservative estimate.
                r['estimated_cost_usd']= ((int(processed/1000) if processed is not None else 2)*.18/3600)
                r['cost_basis']='reported_processed_whole_seconds' if processed is not None else 'sent_audio_estimate_not_billing'
        except Exception as e:
            r.update(status='error',error_type=type(e).__name__)
        r['seconds']=round(time.perf_counter()-t,3)
        record(r)
        run_spend+=r.get('estimated_cost_usd') or .0001
        print(json.dumps(r),flush=True)


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--asr-check',action='store_true')
    parser.add_argument('--budget-usd',type=float,default=.15)
    args=parser.parse_args()
    if args.asr_check:
        asyncio.run(asr_check(args.budget_usd))
    else:
        run_reasoning(args.budget_usd)
