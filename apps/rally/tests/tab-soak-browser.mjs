import assert from 'node:assert/strict';
import {runNativeCapture} from './native-tab-browser.mjs';
const minutes=Number(process.env.RALLY_TEST_SOAK_MINUTES||30);
assert.ok(Number.isInteger(minutes)&&minutes>=1&&minutes<=55,'Choose a whole duration from 1 to 55 minutes');
await runNativeCapture({soakMs:minutes*60000,reportFile:'test-results/tab-soak-browser.json',target:'local background capture soak'});
