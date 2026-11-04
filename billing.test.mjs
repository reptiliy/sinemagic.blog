import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import Stripe from 'stripe';
import {moneyCents,handleBillingWebhook} from './billing.mjs';

test('currency conversion keeps integer cents and rejects invalid amounts',()=>{
 assert.equal(moneyCents('5'),500);
 assert.equal(moneyCents('5.1'),510);
 assert.equal(moneyCents('5.09'),509);
 for(const value of ['-1','1.999','NaN','1e3','1,50',null])assert.throws(()=>moneyCents(value));
});
test('Stripe webhook rejects forged signatures and accepts verified irrelevant events',async()=>{
 process.env.STRIPE_SECRET_KEY='sk_test_cms_fixture';
 process.env.STRIPE_WEBHOOK_SECRET='whsec_cms_fixture';
 const body=JSON.stringify({id:'evt_fixture',type:'not.a.billing.event',data:{object:{}}});
 async function deliver(signature){
  const req=Readable.from([Buffer.from(body)]);
  req.method='POST';req.headers={'stripe-signature':signature};
  const res={status:null,writeHead(status){this.status=status;return this},end(){}};
  await handleBillingWebhook(req,res,'stripe');return res.status;
 }
 assert.equal(await deliver('forged'),400);
 const signature=Stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET});
 assert.equal(await deliver(signature),200);
});
test('PayPal webhook cannot accept payments without merchant credentials',async()=>{
 delete process.env.PAYPAL_CLIENT_ID;
 const req=Readable.from([Buffer.from('{}')]);req.method='POST';req.headers={};
 const res={status:null,writeHead(status){this.status=status;return this},end(){}};
 await handleBillingWebhook(req,res,'paypal');
 assert.equal(res.status,503);
});
