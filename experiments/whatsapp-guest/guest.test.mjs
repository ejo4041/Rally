import test from 'node:test';import assert from 'node:assert/strict';import {callLink} from './guest.mjs';
test('only direct WhatsApp call links reach the browser',()=>{
 for(const kind of ['voice','video'])assert.equal(callLink(`https://call.whatsapp.com/${kind}/Abcdefghij123_-`),`https://call.whatsapp.com/${kind}/Abcdefghij123_-`);
 for(const value of ['http://call.whatsapp.com/voice/Abcdefghij','https://evil.example/voice/Abcdefghij','https://call.whatsapp.com.evil.example/voice/Abcdefghij','https://user@call.whatsapp.com/voice/Abcdefghij','https://call.whatsapp.com:444/voice/Abcdefghij','https://call.whatsapp.com/voice/a','https://call.whatsapp.com/voice/Abcdefghij?next=https://evil.example','https://call.whatsapp.com/voice/Abcdefghij#x'])assert.throws(()=>callLink(value));
});
