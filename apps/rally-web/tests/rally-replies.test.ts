import test from 'node:test';
import assert from 'node:assert/strict';
import {rallyRepliesHTML} from '../src/rally-replies.ts';
import type {Meeting} from '../src/api.ts';
test('Rally response text escapes markup and only claims current confirmed playback state',()=>{
 const m={interventions:[{id:'one',at:1000,text:'<script>attack</script>',kind:'clarify'},{id:'two',at:2000,text:'Ship Monday.',kind:'clarify'}],speechStatus:{interventionId:'two',state:'canceled',destination:'teams'}} as Meeting;
 const html=rallyRepliesHTML(m);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('Response text'));assert.ok(html.includes('Canceled or interrupted · Teams'));assert.ok(!html.includes('Playback complete'));
 m.speechStatus!.state='playing';assert.ok(rallyRepliesHTML(m).includes('Speaking · Teams'));
});
