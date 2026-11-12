// Trusted backend: re-validates prices/stock/coupons, creates orders, Paymob payment + webhook.
// Requires Firebase Blaze plan. Secrets: firebase functions:secrets:set PAYMOB_API_KEY PAYMOB_INTEGRATION_ID PAYMOB_HMAC PAYMOB_IFRAME_ID
const {onCall,onRequest,HttpsError}=require('firebase-functions/v2/https');
const admin=require('firebase-admin');admin.initializeApp();const db=admin.firestore();
const R='europe-west1',SECRETS=['PAYMOB_API_KEY','PAYMOB_INTEGRATION_ID','PAYMOB_HMAC','PAYMOB_IFRAME_ID'];
const orderNo=()=>'TZ-'+Date.now().toString(36).toUpperCase()+Math.floor(Math.random()*900+100);

exports.createOrder=onCall({region:R,secrets:SECRETS},async req=>{
  const {items,customer,payment,coupon,vcashSender}=req.data||{};
  if(!Array.isArray(items)||!items.length||items.length>30)throw new HttpsError('invalid-argument','Cart invalid');
  const c=customer||{};for(const k of['name','phone','email','gov','city','address'])if(!c[k]||String(c[k]).length>300)throw new HttpsError('invalid-argument','Missing '+k);
  if(!/^01[0-9]{9}$/.test(c.phone))throw new HttpsError('invalid-argument','Invalid phone');
  if(!['cod','online','vcash'].includes(payment))throw new HttpsError('invalid-argument','Invalid payment');
  if(payment==='vcash'&&!/^01[0-9]{9}$/.test(String(vcashSender||'')))throw new HttpsError('invalid-argument','Invalid wallet number');
  const settings=(await db.doc('settings/store').get()).data()||{shippingFee:80,freeShippingOver:15000};
  const number=orderNo();let order;
  await db.runTransaction(async tx=>{
    const refs=items.map(i=>db.doc('products/'+String(i.id)));const snaps=await Promise.all(refs.map(r=>tx.get(r)));
    let sub=0;const lines=[];
    snaps.forEach((s,n)=>{const q=Math.floor(+items[n].qty);if(!s.exists||!(q>0))throw new HttpsError('failed-precondition','Product unavailable');
      const p=s.data();if(p.stock<q)throw new HttpsError('failed-precondition','Insufficient stock: '+p.name_en);
      sub+=p.price*q;lines.push({id:s.id,qty:q,price:p.price,name_en:p.name_en,name_ar:p.name_ar,image:(p.images||[])[0]||''});
      tx.update(refs[n],{stock:p.stock-q,sold:(p.sold||0)+q})});
    let disc=0;if(coupon){const cs=await tx.get(db.doc('coupons/'+String(coupon).toUpperCase()));const cd=cs.data();
      if(cd&&cd.active&&(!cd.expiresAt||cd.expiresAt>Date.now())&&sub>=(cd.minOrder||0)){disc=cd.type==='percent'?Math.round(sub*cd.value/100):cd.value;disc=Math.min(disc,sub)}}
    const ship=(sub-disc>=settings.freeShippingOver)?0:settings.shippingFee;
    order={orderNumber:number,uid:req.auth?req.auth.uid:null,items:lines,customer:c,payment,vcashSender:payment==='vcash'?String(vcashSender):null,paid:false,status:'pending',subtotal:sub,discount:disc,shipping:ship,total:sub-disc+ship,createdAt:Date.now()};
    tx.set(db.doc('orders/'+number),order);
  });
  let paymentUrl=null;
  if(payment==='online'){paymentUrl=await paymobUrl(order)} // order stays UNPAID until webhook confirms
  return {orderNumber:number,paymentUrl};
});

async function paymobUrl(o){
  const k=process.env.PAYMOB_API_KEY;if(!k)throw new HttpsError('failed-precondition','Online payment not configured');
  const j=async(u,b)=>(await fetch('https://accept.paymob.com/api/'+u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)})).json();
  const {token}=await j('auth/tokens',{api_key:k});
  const ord=await j('ecommerce/orders',{auth_token:token,delivery_needed:false,amount_cents:o.total*100,currency:'EGP',merchant_order_id:o.orderNumber,items:[]});
  const bd={apartment:'NA',email:o.customer.email,floor:'NA',first_name:o.customer.name,street:o.customer.address,building:'NA',phone_number:o.customer.phone,shipping_method:'NA',postal_code:'NA',city:o.customer.city,country:'EG',last_name:'.',state:o.customer.gov};
  const pk=await j('acceptance/payment_keys',{auth_token:token,amount_cents:o.total*100,expiration:3600,order_id:ord.id,billing_data:bd,currency:'EGP',integration_id:+process.env.PAYMOB_INTEGRATION_ID});
  return `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${pk.token}`;
}
// Paymob "Transaction processed callback" URL -> https://<region>-<project>.cloudfunctions.net/paymobWebhook?hmac=...
exports.paymobWebhook=onRequest({region:R,secrets:SECRETS},async(req,res)=>{
  const crypto=require('crypto'),o=(req.body||{}).obj||{};
  const f=[o.amount_cents,o.created_at,o.currency,o.error_occured,o.has_parent_transaction,o.id,o.integration_id,o.is_3d_secure,o.is_auth,o.is_capture,o.is_refunded,o.is_standalone_payment,o.is_voided,o.order&&o.order.id,o.owner,o.pending,o.source_data&&o.source_data.pan,o.source_data&&o.source_data.sub_type,o.source_data&&o.source_data.type,o.success].join('');
  const h=crypto.createHmac('sha512',process.env.PAYMOB_HMAC).update(f).digest('hex');
  if(h!==req.query.hmac)return res.status(403).send('bad hmac');
  const no=o.order&&o.order.merchant_order_id;if(o.success===true&&no){await db.doc('orders/'+no).update({paid:true,status:'confirmed',paymobTx:o.id})}
  res.send('ok')});

exports.trackOrder=onCall({region:R},async req=>{
  const {orderNumber,phone}=req.data||{};const s=await db.doc('orders/'+String(orderNumber)).get();
  if(!s.exists||s.data().customer.phone!==String(phone))throw new HttpsError('not-found','Order not found');return s.data()});
