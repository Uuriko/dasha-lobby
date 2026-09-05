(function(global){
'use strict';
var MINT='53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
var TREASURY='DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
var DEFAULT_API='https://lobby.getdasha.com';
var HERO='https://lobby.getdasha.com/client/faucet.avif';
function el(tag,cls,text){
  var n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text!=null)n.textContent=text;
  return n;
}
function apiBase(root){
  var attr=root&&root.getAttribute('data-faucet-api');
  if(attr)return String(attr).replace(/\/$/,'');
  return DEFAULT_API;
}
function fetchJson(url,init){
  return fetch(url,init).then(function(r){
    return r.text().then(function(raw){
      var data=null;
      if(raw){
        try{data=JSON.parse(raw);}
        catch(e){data={error:'non-json response'};}
      }
      return {status:r.status,data:data||{}};
    });
  });
}
function destCopiedOk(got,want){
  return String(got||'').replace(/\s+/g,'')===String(want||'');
}
function jarUi(status){
  if(!status)return null;
  if(status.balanceUi!=null&&status.balanceUi!==''){
    var u=Number(status.balanceUi);
    return isFinite(u)?u:null;
  }
  if(status.balanceRaw==null)return null;
  var n=Number(status.balanceRaw);
  var dec=Number(status.decimals)||6;
  if(!isFinite(n))return null;
  return n/Math.pow(10,dec);
}
function jarLabel(n){
  if(n==null||!isFinite(n))return'';
  if(Math.abs(n-Math.round(n))<1e-9)return String(Math.round(n));
  return String(n);
}
function needSol(status){
  if(!status||status.solLamports==null||status.solLamports==='')return false;
  return Number(status.solLamports)===0;
}
function copyTreasury(btn, after){
  var text=TREASURY;
  function finish(kind){
    if(typeof after==='function')after(kind);
  }
  function ok(){
    if(btn){
      btn.textContent='Copied';
      setTimeout(function(){
        btn.textContent='Copy address';
        finish('ok');
      },1000);
    }else finish('ok');
  }
  function miss(){
    if(btn){
      btn.textContent='Select';
      setTimeout(function(){btn.textContent='Copy address';},1600);
    }
    setTimeout(function(){finish('miss');},1000);
  }
  function select(){
    try{
      var node=document.querySelector&&document.querySelector('.faucet-ca');
      if(node){
        var r=document.createRange();
        r.selectNodeContents(node);
        var s=getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
    }catch(e){}
    miss();
  }
  function legacy(){
    try{
      var ta=document.createElement('textarea');
      ta.value=text;
      ta.setAttribute('readonly','');
      ta.style.cssText='position:fixed;left:-9999px;top:0';
      (document.body||document.documentElement).appendChild(ta);
      ta.select();
      ta.setSelectionRange(0,text.length);
      var done=false;
      try{done=document.execCommand('copy')}catch(e){}
      if(ta.parentNode)ta.parentNode.removeChild(ta);
      return done;
    }catch(e){return false;}
  }
  function timed(p){
    return Promise.race([p,new Promise(function(_,rej){setTimeout(function(){rej(new Error('copy'))},600)})]);
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    timed(navigator.clipboard.writeText(text)).then(ok).catch(function(){legacy()?ok():select();});
  }else if(legacy())ok();
  else select();
}
function destShapeError(dest,four){
  dest=String(dest||'').trim();
  four=String(four||'').trim();
  if(/t\.me|telegram/i.test(dest))return'dest_not_wallet';
  if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(dest))return'dest_not_wallet';
  try{
    var alph='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var val=0n;
    var i;
    for(i=0;i<dest.length;i++){
      var n=alph.indexOf(dest.charAt(i));
      if(n<0)return'dest_not_wallet';
      val=val*58n+BigInt(n);
    }
    var bytes=[];
    while(val>0n){
      bytes.push(Number(val&255n));
      val>>=8n;
    }
    for(i=0;i<dest.length&&dest.charAt(i)==='1';i++)bytes.push(0);
    if(bytes.length!==32)return'dest_not_wallet';
  }catch(e){return'dest_not_wallet';}
  if(dest===MINT)return'dest_mint';
  if(dest===TREASURY)return'dest_treasury';
  if(four&&dest.slice(-4)!==four)return'last-4 does not match';
  return'';
}
function humanError(code){
  var key=String(code||'').trim();
  if(!key||key.charAt(0)==='{')return'claim failed.';
  var map={
    dest_not_wallet:'not a wallet',dest_token:'not a wallet',dest_mint:'that is the mint',dest_treasury:'that is the tip jar',dest_pda:'not a wallet','last-4 does not match':'last 4 miss','valid Solana address required':'not a wallet','bind a destination first':'not a wallet','invalid faucet challenge':'sign-in failed','invalid wallet signature':'sign-in failed','faucet challenge already used':'sign-in failed',siws_domain:'wrong sign-in site','link X first':'link X','prove wallet':'prove wallet',x_too_new:'X too new',x_reauth:'X too new','need Phantom':'need Phantom',daily_cap:'try tomorrow',hourly_cap:'try later','already claimed':'already claimed',confirming:'confirming','claim already sending':'confirming',treasury_empty:'jar empty',faucet_paused:'paused','faucet paused':'paused',treasury_rent:'jar empty',rpc_unavailable:'try again',not_configured:'not ready','non-json response':'claim failed.','sig miss':'sig miss','bad signature':'sig miss',unverified:'sig miss',floor:'too small',cap:'capped',already:'already in',duplicate:'already in','need wallet':'not a wallet',dest_paste:'not a wallet'
  };
  if(map[key])return map[key];
  if(/_/.test(key))return'claim failed.';
  return key;
}
function css(){
  return [
    '#dasha-faucet,.faucet-root{color:#f4eddb;font:16px/1.45 Arial,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center;width:100%;box-sizing:border-box;padding:0 0 3rem}',
    '.faucet-go,.faucet-q{font-family:"Arial Black",Helvetica,Arial,sans-serif;font-weight:900}',
    '.faucet-frame{position:relative;width:100%;margin:0 0 28px}',
    '.faucet-hero{display:block;width:100%;height:auto;max-height:min(38svh,280px);background:#070608;object-fit:contain;box-shadow:8px 8px 0 #ff3b81}',
    '.faucet-tick{position:absolute;width:14px;height:14px;border-color:#dfff00;border-style:solid;pointer-events:none;z-index:2}',
    '.faucet-tick:nth-child(1){top:-6px;left:-6px;border-width:2px 0 0 2px}',
    '.faucet-tick:nth-child(2){top:-6px;right:-6px;border-width:2px 2px 0 0}',
    '.faucet-tick:nth-child(3){bottom:-6px;left:-6px;border-width:0 0 2px 2px}',
    '.faucet-tick:nth-child(4){bottom:-6px;right:-6px;border-width:0 2px 2px 0}',
    '.faucet-card{display:grid;gap:28px;max-width:400px;width:min(400px,calc(100vw - 32px));justify-items:stretch;margin:0 auto;padding:8px 0 12px;animation:faucet-in .28s ease}',
    '.faucet-card.faucet-door{animation:none}',
    '.faucet-card.faucet-door .faucet-go:not(:disabled){opacity:1}',
    '.faucet-q{margin:0;font-size:clamp(28px,7vw,46px);line-height:1.05;text-align:center}',
    '.faucet-note{margin:0;color:rgba(244,237,219,.72);font:15px/1.4 Arial,Helvetica,sans-serif;text-align:center}',
    '.faucet-step{margin:0;color:rgba(244,237,219,.48);font:12px/1 Arial,Helvetica,sans-serif;letter-spacing:.08em;text-transform:uppercase;text-align:center}',
    '.faucet-go{min-height:52px;min-width:52px;width:100%;padding:0 18px;border:0;background:#dfff00;color:#070608;font:900 1rem/1 "Arial Black",Helvetica,Arial,sans-serif;text-transform:uppercase;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;box-shadow:4px 4px 0 #ff3b81}',
    '.faucet-back,.faucet-quiet{border:0;background:transparent;color:rgba(244,237,219,.76);font:700 15px/1.3 Arial,Helvetica,sans-serif;cursor:pointer;padding:8px 0;text-align:center;width:100%}',
    '.faucet-quiet{text-decoration:underline;text-underline-offset:3px;font-weight:400}',
    '.faucet-go:focus-visible{outline:3px solid #dfff00;outline-offset:3px;color:#070608}',
    '.faucet-back:focus-visible,.faucet-quiet:focus-visible{outline:3px solid #dfff00;outline-offset:3px;color:#f4eddb}',
    '.faucet-go:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}',
    '.faucet-send{min-height:56px;font-size:1.12rem}',
    '.faucet-nav{display:flex;flex-direction:column;gap:14px;width:100%;align-items:stretch}',
    '#dasha-faucet,#faucet{padding-bottom:2rem!important}',
    '.faucet-ca{margin:0;padding:16px;border:1px solid rgba(244,237,219,.28);font:14px/1.45 Fragment Mono,ui-monospace,Menlo,Consolas,monospace;word-break:break-all;overflow-wrap:anywhere;user-select:all;color:#f4eddb;text-align:left}',
    '.faucet-warn{color:#ff3b81}',
    '.faucet-field{display:grid;gap:10px;width:100%}',
    '.faucet-root input{width:100%;min-height:52px;padding:12px 14px;box-sizing:border-box;background:#070608;color:#f4eddb;border:1px solid #dfff00;font:15px/1.4 Fragment Mono,ui-monospace,Menlo,Consolas,monospace}',
    '.faucet-root input:focus-visible{outline:3px solid #dfff00;outline-offset:2px}',
    '.faucet-hole{width:36px;height:36px;border-radius:50%;margin:0 auto;background:#070608;box-shadow:inset 0 0 0 3px #dfff00}',
    '@keyframes faucet-in{from{opacity:0}to{opacity:1}}',
    '@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}'
  ].join('');
}
function labeledInput(id,labelText,attrs){
  var wrap=el('div','faucet-field');
  var input=el('input');
  input.id=id;
  input.setAttribute('aria-label',labelText||'Wallet');
  Object.keys(attrs||{}).forEach(function(k){
    if(k==='maxLength')input.maxLength=attrs[k];
    else input.setAttribute(k,attrs[k]);
  });
  wrap.appendChild(input);
  return {wrap:wrap,input:input};
}
function hideLeftover(){
  var node=document.getElementById('dasha-faucet-static');
  if(node)node.hidden=true;
}
function mount(root){
  if(!root)return null;
  hideLeftover();
  var base=apiBase(root);
  var stillUrl=root.getAttribute('data-faucet-still')||HERO;
  var stillSri=root.getAttribute('data-faucet-still-sri')||'';
  root.innerHTML='';
  root.classList.add('faucet-root');
  var style=document.createElement('style');
  style.textContent=css();
  root.appendChild(style);
  var live=el('p','','');
  live.setAttribute('role','status');
  live.setAttribute('aria-live','polite');
  live.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)';
  var stage=el('div','faucet-stage');
  root.appendChild(stage);
  root.appendChild(live);
  var state={
    card:0,shown:-1,me:null,status:null,dest:'',kind:'',sent:null,last4Ok:false,holdCard:false,destError:'',fail:'',fillMiss:'',fillOk:'',fillSig:'',fillSolscan:'',confirmStuck:false
  };
  var xPopup=null;
  var xTimer=0;
  var sendTimer=0;
  var sendWait=0;
  var countdownTimer=0;
  function last4Of(addr){return String(addr||'').slice(-4);}
  function amountUi(){
    var n=state.status&&state.status.amountUi!=null?Number(state.status.amountUi):100;
    return isFinite(n)&&n>0?n:100;
  }
  function jarEmpty(){var s=state.status;if(!s)return false;if(s.funded===true)return false;var n=jarUi(s);if(n!=null&&n>0)return false;return s.funded===false;}
  function isPaused(){
    var s=state.status;
    if(!s)return false;
    if(s.autoPaused||s.paused)return true;
    var err=String(s.error||'');
    return err==='faucet_paused'||err==='faucet paused';
  }
  function sendBlocked(){return jarEmpty()||isPaused();}
  function linked(){return !!(state.me&&state.me.linked);}
  function proven(){return !!(state.dest&&state.kind==='IS_WALLET');}
  function xBlocked(){
    var err=(state.me&&state.me.error)||state.destError||'';
    return err==='x_too_new'||err==='x_reauth';
  }
  function nextClaim(){
    if(state.me&&state.me.claimed)return 5;
    if(!linked()||xBlocked())return 1;
    if(!proven())return 2;
    return 3;
  }
  function openDest(){
    state.holdCard=false;
    state.card=nextClaim();
    paint();
  }
  function openFill(){
    state.holdCard=true;
    state.card=7;
    state.fillMiss='';
    state.fillOk='';
    state.fillSig='';
    state.fillSolscan='';
    paint();
  }
  function hero(){
    var frame=el('div','faucet-frame');
    for(var i=0;i<4;i++)frame.appendChild(el('i','faucet-tick'));
    var img=el('img','faucet-hero');
    img.src=stillUrl;
    img.alt='';
    img.width=1024;
    img.height=1024;
    img.fetchPriority='high';
    if(stillSri){
      img.setAttribute('integrity',stillSri);
      img.crossOrigin='anonymous';
    }
    frame.appendChild(img);
    return frame;
  }
  function primary(label,onClick,extra){
    var b=el('button','faucet-go'+(extra?' '+extra:''),label);
    b.type='button';
    b.addEventListener('click',function(e){
      if(e&&e.preventDefault)e.preventDefault();
      if(e&&e.stopPropagation)e.stopPropagation();
      onClick(b);
    });
    return b;
  }
  function paper(label,onClick){
    var b=el('button','faucet-back',label);
    b.type='button';
    b.addEventListener('click',function(e){
      if(e&&e.preventDefault)e.preventDefault();
      if(e&&e.stopPropagation)e.stopPropagation();
      onClick(b);
    });
    return b;
  }
  function quiet(label,onClick){
    var b=el('button','faucet-quiet',label);
    b.type='button';
    b.addEventListener('click',function(e){
      if(e&&e.preventDefault)e.preventDefault();
      if(e&&e.stopPropagation)e.stopPropagation();
      onClick(b);
    });
    return b;
  }
  function fillError(code){
    var shown=humanError(code);
    if(shown==='link X')return'link X';
    if(shown==='already in'||shown==='already'||shown==='already claimed')return'already in';
    if(shown==='sig miss'||code==='sig miss')return'sig miss';
    if(shown==='jar empty'||shown==='empty')return'jar empty';
    return shown;
  }
  function door(){
    var box=el('div','faucet-card faucet-door');
    box.appendChild(hero());
    box.appendChild(el('p','faucet-q','Once a day.'));
    if(jarEmpty())box.appendChild(el('p','faucet-note','jar empty'));
    else if(isPaused())box.appendChild(el('p','faucet-note','paused'));
    var nav=el('div','faucet-nav');
    var send=primary('Get '+amountUi(),openDest,'faucet-send');
    if(sendBlocked()){
      send.disabled=true;
      send.setAttribute('aria-disabled','true');
    }
    nav.appendChild(send);
    nav.appendChild(quiet('Fill the jar',openFill));
    box.appendChild(nav);
    if(state.fillOk)box.appendChild(el('p','faucet-q',state.fillOk));
    return box;
  }
  function backTo(n){
    return paper('Back',function(){
      state.holdCard=true;
      state.card=n;
      state.fail='';
      state.destError='';
      paint();
    });
  }
  function showErr(code){return el('p','faucet-note faucet-warn',humanError(code));}
  function stepBadge(n,total){return el('p','faucet-step',n+'/'+total);}
  function formatCountdown(ms){
    if(!isFinite(ms)||ms<=0)return'any moment';
    var totalMin=Math.ceil(ms/60000);
    var h=Math.floor(totalMin/60);
    var m=totalMin%60;
    if(h<=0)return m+'m';
    return h+'h '+m+'m';
  }
  function stopCountdown(){if(countdownTimer){clearInterval(countdownTimer);countdownTimer=0;}}
  function mountCountdown(container,nextAt){
    stopCountdown();
    var p=el('p','faucet-note','');
    function tick(){
      var left=nextAt-Date.now();
      p.textContent='next tip in '+formatCountdown(left);
      if(left<=0)stopCountdown();
    }
    tick();
    countdownTimer=setInterval(tick,30000);
    if(countdownTimer&&typeof countdownTimer.unref==='function')countdownTimer.unref();
    container.appendChild(p);
    return p;
  }
  function solscanLink(sig,href){
    var a=el('a','faucet-go','Solscan');
    a.href=href||('https://solscan.io/tx/'+sig);
    a.target='_blank';
    a.rel='noopener noreferrer';
    return a;
  }
  function doneCard(kind){
    stopCountdown();
    var box=el('div','faucet-card');
    box.appendChild(stepBadge(4,4));
    var dest=(state.sent&&state.sent.dest)||(state.me&&state.me.dest)||state.dest;
    var sig=(state.sent&&state.sent.signature)||(state.me&&state.me.signature);
    var href=state.sent&&state.sent.solscan;
    box.appendChild(el('div','faucet-hole',''));
    if(kind==='already claimed'){
      if(dest)box.appendChild(el('p','faucet-q',last4Of(dest)));
      var nextAt=state.me&&Number(state.me.nextAt);
      if(isFinite(nextAt)&&nextAt>0)mountCountdown(box,nextAt);
    }else{
      box.appendChild(el('p','faucet-note',amountUi()+' $dasha'));
      if(dest)box.appendChild(el('p','faucet-q',last4Of(dest)));
    }
    if(sig)box.appendChild(solscanLink(sig,href));
    return box;
  }
  function fillCopy(){
    var box=el('div','faucet-card');
    box.appendChild(el('p','faucet-q','Copy.'));
    var treas=TREASURY;
    var ca=el('p','faucet-ca',treas);
    ca.id='dasha-faucet-jar';
    box.appendChild(ca);
    box.appendChild(primary('Copy address',function(btn){
      if(btn&&btn.disabled)return;
      if(btn)btn.disabled=true;
      copyTreasury(btn, function(){
        state.card=8;
        paint();
      });
    }));
    box.appendChild(backTo(0));
    return box;
  }
  function fillSend(){
    var box=el('div','faucet-card');
    if(state.fillOk){
      box.appendChild(el('p','faucet-q',state.fillOk));
      if(state.fillSig)box.appendChild(solscanLink(state.fillSig,state.fillSolscan));
      box.appendChild(backTo(0));
      return box;
    }
    box.appendChild(el('p','faucet-q','Sig.'));
    var sig=labeledInput('dasha-faucet-sig','Sig',{autocomplete:'off',spellcheck:'false',placeholder:'sig'});
    sig.input.setAttribute('aria-label','Sig');
    var send=primary('Send',function(btn){credit(sig.input.value,btn);});
    sig.input.addEventListener('keydown',function(e){
      if(e.key!=='Enter')return;
      e.preventDefault();
      credit(sig.input.value,send);
    });
    box.appendChild(sig.wrap);
    box.appendChild(send);
    if(state.fillMiss)box.appendChild(el('p','faucet-note faucet-warn',state.fillMiss));
    box.appendChild(backTo(7));
    return box;
  }
  function credit(signature,btn){
    if(btn)btn.disabled=true;
    fetchJson(base+'/faucet/donate',{
      method:'POST',credentials:'include',mode:'cors',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({signature:String(signature||'').trim()})
    }).then(function(res){
      if(btn)btn.disabled=false;
      var d=res.data||{};
      if(d.ok&&(d.landed||d.awarded)){
        state.fillMiss='';
        state.fillOk='in.';
        state.fillSig=d.signature||String(signature||'').trim();
        state.fillSolscan=d.solscan||(state.fillSig?('https://solscan.io/tx/'+state.fillSig):'');
        refreshStatus().then(function(){paint();});
        return;
      }
      if(d.ok&&d.replay&&!d.awarded&&!d.error){
        state.fillMiss=fillError('already');
        paint();
        return;
      }
      state.fillMiss=fillError((d.error||(d.duplicate&&'already')||(d.dust&&'sig miss')||(d.capped&&'capped'))||'sig miss');
      paint();
    }).catch(function(){
      if(btn)btn.disabled=false;
      state.fillMiss='try again';
      paint();
    });
  }
  function paint(){
    var active=typeof document!=='undefined'?document.activeElement:null;
    var typing=active&&stage.contains(active)&&(active.tagName==='INPUT'||active.tagName==='TEXTAREA');
    var cardChanged=state.shown!==state.card;
    if(!cardChanged && state.card===0 && !sendBlocked() && !jarEmpty() && !isPaused())return;
    stage.innerHTML='';
    paintCard();
    state.shown=state.card;
    if(typing&&!cardChanged)return;
    if(!cardChanged)return;
    if(state.card===0)return;
    var focusEl=stage.querySelector('input')||stage.querySelector('button.faucet-go:not(:disabled)');
    if(focusEl&&typeof focusEl.focus==='function')focusEl.focus();
  }
  function stopSendPoll(){
    if(sendTimer){clearInterval(sendTimer);sendTimer=0;}
    if(sendWait){clearTimeout(sendWait);sendWait=0;}
  }
  function startSendPoll(){
    if(state.confirmStuck)return;
    if(!sendTimer)sendTimer=setInterval(function(){claim(true);},2000);
    if(!sendWait){
      sendWait=setTimeout(function(){
        sendWait=0;
        if(state.card===4){
          state.confirmStuck=true;
          if(sendTimer){clearInterval(sendTimer);sendTimer=0;}
          paint();
        }
      },12000);
    }
  }
  function paintCard(){
    if(state.card!==4)stopSendPoll();
    if(state.me&&state.me.claimed&&state.card!==0&&state.card!==7&&state.card!==8){
      stage.appendChild(doneCard('already claimed'));
      return;
    }
    if(state.me&&state.me.confirming&&!state.holdCard&&state.card!==1&&state.card!==2&&state.card!==3&&state.card!==6&&state.card!==7&&state.card!==8){
      state.card=4;
    }
    if(state.card===0){stage.appendChild(door());return;}
    if(state.card===7){stage.appendChild(fillCopy());return;}
    if(state.card===8){stage.appendChild(fillSend());return;}
    if(state.card===1){
      if(linked()&&!xBlocked()){state.card=nextClaim();paintCard();return;}
      var xCard=el('div','faucet-card');
      xCard.appendChild(stepBadge(1,4));
      xCard.appendChild(el('p','faucet-q','Link X.'));
      xCard.appendChild(primary('Link X.',function(){startX();}));
      if(xBlocked()||state.destError)xCard.appendChild(showErr(state.destError||(state.me&&state.me.error)||'x_too_new'));
      xCard.appendChild(backTo(0));
      stage.appendChild(xCard);
      return;
    }
    if(state.card===2){
      if(proven()){state.card=3;paintCard();return;}
      var prove=el('div','faucet-card');
      prove.appendChild(stepBadge(2,4));
      prove.appendChild(el('p','faucet-q','Prove wallet.'));
      if(state.destError==='need Phantom'){
        prove.appendChild(primary('Open in Phantom.',function(){openPhantomBrowse();}));
        prove.appendChild(el('p','faucet-note','Solflare works too.'));
      }else{
        prove.appendChild(primary('Prove wallet.',function(btn){bindSiws(btn);}));
        if(state.destError)prove.appendChild(showErr(state.destError));
      }
      prove.appendChild(backTo(linked()?0:1));
      stage.appendChild(prove);
      return;
    }
    if(state.card===3){
      var sendCard=el('div','faucet-card');
      sendCard.appendChild(stepBadge(3,4));
      sendCard.appendChild(el('p','faucet-q','tip me.'));
      if(state.dest)sendCard.appendChild(el('p','faucet-note',last4Of(state.dest)));
      sendCard.appendChild(primary('tip me',function(){
        state.confirmStuck=false;
        state.card=4;
        paint();
        claim();
      }));
      if(state.destError)sendCard.appendChild(showErr(state.destError));
      if(state.fail)sendCard.appendChild(showErr(state.fail));
      sendCard.appendChild(backTo(0));
      stage.appendChild(sendCard);
      return;
    }
    if(state.card===4){
      var sending=el('div','faucet-card');
      sending.appendChild(stepBadge(3,4));
      sending.appendChild(el('p','faucet-q','confirming'));
      if(state.confirmStuck){
        sending.appendChild(el('p','faucet-note','try again'));
        sending.appendChild(primary('Try again',function(){
          stopSendPoll();
          state.confirmStuck=false;
          state.card=3;
          paint();
        }));
      }else{
        startSendPoll();
      }
      stage.appendChild(sending);
      return;
    }
    if(state.card===6){
      var fail=el('div','faucet-card');
      fail.appendChild(showErr(state.fail||'claim failed.'));
      fail.appendChild(primary('Try again',function(){
        state.fail='';
        state.card=3;
        paint();
      }));
      stage.appendChild(fail);
      live.textContent=humanError(state.fail);
      return;
    }
    if(state.card===5){
      stage.appendChild(doneCard('tipped'));
    }
  }
  function walletSignIn(wallet){
    if(wallet&&typeof wallet.signIn==='function')return function(input){return wallet.signIn(input);};
    var feat=wallet&&wallet.features&&wallet.features['solana:signIn'];
    if(feat&&typeof feat.signIn==='function')return function(input){return feat.signIn(input);};
    if(typeof feat==='function')return feat;
    return null;
  }
  function decodeSignedMessage(value){
    if(value==null)return'';
    if(typeof value==='string')return value;
    try{return new TextDecoder().decode(value instanceof Uint8Array?value:new Uint8Array(value));}
    catch(e){return'';}
  }
  function bindSiws(btn){
    if(!state.me||!state.me.linked){
      showDestError('link X first');
      return;
    }
    var wallet=(global.phantom&&global.phantom.solana)||global.solflare||global.solana;
    if(!wallet||!wallet.connect||(!wallet.signMessage&&!walletSignIn(wallet))){
      showDestError('need Phantom');
      return;
    }
    btn.disabled=true;
    wallet.connect().then(function(connected){
      var publicKey=wallet.publicKey||(connected&&connected.publicKey);
      if(!publicKey)throw new Error('wallet returned no public key');
      publicKey=publicKey.toString();
      return fetchJson(base+'/faucet/wallet/challenge',{
        method:'POST',credentials:'include',mode:'cors',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({publicKey:publicKey})
      }).then(function(res){return {res:res,publicKey:publicKey};});
    }).then(function(pair){
      if(pair.res.status===501||pair.res.status===503){
        btn.disabled=false;
        showDestError(pair.res.data&&pair.res.data.error||'not_configured');
        return;
      }
      var challenge=pair.res.data;
      if(!challenge||!challenge.ok)throw new Error((challenge&&challenge.error)||'invalid faucet challenge');
      var signIn=challenge.siws&&walletSignIn(wallet);
      var signed=signIn?signIn(challenge.siws):wallet.signMessage(new TextEncoder().encode(challenge.message),'utf8');
      return Promise.resolve(signed).then(function(out){
        if(Array.isArray(out))out=out[0];
        var signature=out&&(out.signature||out);
        if(signature&&signature.signature)signature=signature.signature;
        if(!signature)throw new Error('invalid faucet challenge');
        var signedMessage=decodeSignedMessage(out&&out.signedMessage)||challenge.message;
        return fetchJson(base+'/faucet/wallet/verify',{
          method:'POST',credentials:'include',mode:'cors',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            challenge:challenge.challenge,
            publicKey:pair.publicKey,
            signature:toBase58(signature),
            signedMessage:signedMessage
          })
        });
      });
    }).then(function(res){
      btn.disabled=false;
      if(!res)return;
      if(!res.data||!res.data.ok){
        showDestError((res.data&&res.data.error)||'invalid faucet challenge');
        return;
      }
      state.dest=res.data.dest;
      state.kind=res.data.kind||'IS_WALLET';
      state.last4Ok=true;
      state.destError='';
      state.card=3;
      paint();
    }).catch(function(err){
      btn.disabled=false;
      showDestError(err&&err.message);
    });
  }
  function showDestError(code){
    state.destError=code;
    live.textContent=humanError(code);
    paint();
  }
  function bindPaste(dest,four){
    dest=String(dest||'').trim();
    four=String(four||'').trim();
    var shape=destShapeError(dest,four);
    if(shape){showDestError(shape);return;}
    function takeDest(destAddr,kind){
      state.dest=destAddr;
      state.kind=kind||'PASTED';
      state.last4Ok=false;
      state.destError='';
      state.card=2;
      paint();
    }
    function afterWallet(){
      if(!state.me||!state.me.linked){
        showDestError('link X first');
        return Promise.resolve();
      }
      return fetchJson(base+'/faucet/wallet/verify',{
        method:'POST',credentials:'include',mode:'cors',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({dest:dest,last4:four,paste:true})
      }).then(function(res){
        if(!res.data||!res.data.ok){
          showDestError((res.data&&res.data.error)||'dest_not_wallet');
          return;
        }
        takeDest(res.data.dest,res.data.kind||'PASTED');
      });
    }
    fetchJson(base+'/faucet/dest-check',{
      method:'POST',credentials:'include',mode:'cors',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({dest:dest,last4:four})
    }).then(function(res){
      var err=res.data&&res.data.error;
      if(err||(res.data&&res.data.ok===false)){showDestError(err||'dest_not_wallet');return;}
      if(!res.data||res.data.ok!==true){showDestError('dest_not_wallet');return;}
      return afterWallet();
    }).catch(function(){showDestError('dest_not_wallet');});
  }
  function claim(quiet){
    fetchJson(base+'/faucet/claim',{
      method:'POST',credentials:'include',mode:'cors',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({dest:state.dest||''})
    }).then(function(res){
      if(res.status===200&&res.data&&res.data.ok&&res.data.signature){
        stopSendPoll();
        state.confirmStuck=false;
        state.sent=res.data;
        if(res.data.replay){
          state.me=Object.assign({},state.me,{claimed:true,signature:res.data.signature,dest:res.data.dest||state.dest});
          paint();
          return;
        }
        state.card=5;
        paint();
        return;
      }
      if(res.data&&res.data.error==='already claimed'&&res.data.signature){
        stopSendPoll();
        state.confirmStuck=false;
        state.me=Object.assign({},state.me,{claimed:true,signature:res.data.signature,dest:res.data.dest||state.dest});
        paint();
        return;
      }
      if(res.data&&res.data.error==='confirming'&&res.data.signature){
        state.sent=res.data;
        state.card=4;
        if(!quiet)paint();
        else startSendPoll();
        return;
      }
      stopSendPoll();
      state.confirmStuck=false;
      var err=(res.data&&res.data.error)||('claim '+res.status);
      if(err==='x_too_new'||err==='x_reauth'){
        state.destError=err;
        state.card=1;
        paint();
        return;
      }
      state.fail=humanError(err);
      state.card=6;
      paint();
    }).catch(function(){
      stopSendPoll();
      state.confirmStuck=false;
      state.fail='claim failed.';
      state.card=6;
      paint();
    });
  }
  function toBase58(bytes){
    var ALPH='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var src=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    var zeros=0;
    while(zeros<src.length&&src[zeros]===0)zeros++;
    var size=Math.ceil(src.length*138/100)+1;
    var buf=new Uint8Array(size);
    for(var i=0;i<src.length;i++){
      var carry=src[i];
      for(var j=size-1;j>=0;j--){
        carry+=256*buf[j];
        buf[j]=carry%58;
        carry=(carry/58)|0;
      }
    }
    var k=0;
    while(k<size&&buf[k]===0)k++;
    var out='';
    while(zeros--)out+='1';
    for(;k<size;k++)out+=ALPH[buf[k]];
    return out||'1';
  }
  function refreshStatus(){
    return fetchJson(base+'/faucet/status',{credentials:'include',mode:'cors'}).then(function(res){
      if(res&&res.data){
        state.status=res.data;
        if(res.status===501)state.status=Object.assign({treasury:TREASURY},res.data,{configured:false,error:'not_configured'});
      }
      return state.status;
    }).catch(function(){return state.status;});
  }
  function refreshMe(mode){
    return fetchJson(base+'/faucet/me',{credentials:'include',mode:'cors'}).then(function(res){
      var prevLinked=state.me&&state.me.linked;
      var prevClaimed=state.me&&state.me.claimed;
      state.me=res.data||{};
      if(state.me.dest&&state.me.kind==='IS_WALLET'){
        state.dest=state.me.dest;
        state.kind='IS_WALLET';
        state.last4Ok=true;
      }else if(state.me.dest&&!state.dest){
        state.dest=state.me.dest;
      }
      var linkedFlip=prevLinked!==state.me.linked;
      var claimedNow=state.me.claimed&&!prevClaimed;
      if(mode==='poll'&&!linkedFlip&&!claimedNow&&state.card!==4)return state.me;
      if(state.me.claimed&&state.card!==0&&state.card!==7&&state.card!==8){
        state.card=5;
        if(state.me.signature){
          state.sent=state.sent||{signature:state.me.signature,dest:state.me.dest};
        }
      }else if(linkedFlip&&state.card===1){
        if(state.me.error==='x_too_new'||state.me.error==='x_reauth'){
          state.destError=state.me.error;
          state.card=1;
        }else{
          state.destError='';
          state.card=nextClaim();
        }
      }
      paint();
      return state.me;
    });
  }
  function stopXPoll(){
    if(xTimer){clearInterval(xTimer);xTimer=0;}
    xPopup=null;
  }
  function phantomInApp(){
    var ua='';
    try{ua=String((navigator&&navigator.userAgent)||'');}catch(e){ua='';}
    return /Phantom\//i.test(ua)||/\bPhantom\b/i.test(ua);
  }
  function solflareInApp(){
    var ua='';
    try{ua=String((navigator&&navigator.userAgent)||'');}catch(e){ua='';}
    return /Solflare/i.test(ua);
  }
  function xStartHref(){
    return base+'/oauth/x/start?return=/faucet';
  }
  function goSameTab(href){
    var loc=window.location;
    if(loc&&typeof loc.assign==='function')loc.assign(href);
    else if(loc)loc.href=href;
  }
  function phantomBrowseHref(){
    return 'https://phantom.app/ul/browse/'+encodeURIComponent('https://www.getdasha.com/faucet');
  }
  function openPhantomBrowse(){
    goSameTab(phantomBrowseHref());
  }
  function startX(){
    var href=xStartHref();
    var popup=null;
    if(!phantomInApp()&&!solflareInApp()){
      try{popup=window.open(href,'dasha_x','width=520,height=700');}catch(e){popup=null;}
    }
    if(!popup){
      goSameTab(href);
      return;
    }
    xPopup=popup;
    if(xTimer)clearInterval(xTimer);
    xTimer=setInterval(function(){
      if(xPopup&&xPopup.closed){stopXPoll();refreshMe();return;}
      refreshMe('poll');
    },2000);
  }
  function onX(ev){
    if(!ev||!ev.data||ev.data.type!=='dasha-x-linked')return;
    refreshMe();
  }
  function onVis(){
    if(xPopup&&!xPopup.closed)refreshMe('poll');
  }
  function onEnter(e){
    if(!e||e.key!=='Enter'||e.defaultPrevented)return;
    if(e.target&&(e.target.tagName==='TEXTAREA'||e.target.tagName==='BUTTON'||e.target.tagName==='A'))return;
    var go=stage.querySelector('button.faucet-go:not(:disabled)');
    if(!go)return;
    e.preventDefault();
    go.click();
  }
  window.addEventListener('message',onX);
  document.addEventListener('visibilitychange',onVis);
  window.addEventListener('focus',onVis);
  document.addEventListener('keydown',onEnter);
  paint();
  Promise.all([
    fetchJson(base+'/faucet/status',{credentials:'include',mode:'cors'}),
    fetchJson(base+'/faucet/me',{credentials:'include',mode:'cors'})
  ]).then(function(pair){
    state.status=pair[0].data||{};
    if(pair[0].status===501)state.status=Object.assign({treasury:TREASURY},pair[0].data||{},{configured:false,error:'not_configured'});
    state.me=pair[1].data||{};
    if(state.me.dest&&state.me.kind==='IS_WALLET'){
      state.dest=state.me.dest;
      state.kind='IS_WALLET';
      state.last4Ok=true;
    }else if(state.me.dest){
      state.dest=state.me.dest;
    }
    paint();
  }).catch(function(){
    state.status={configured:false,error:'not_configured',treasury:TREASURY};
    paint();
  });
  return {
    destroy:function(){
      stopXPoll();
      stopSendPoll();
      stopCountdown();
      window.removeEventListener('message',onX);
      document.removeEventListener('visibilitychange',onVis);
      window.removeEventListener('focus',onVis);
      document.removeEventListener('keydown',onEnter);
      root.innerHTML='';
    }
  };
}
var api={
  mount:mount,MINT:MINT,TREASURY:TREASURY,destShapeError:destShapeError,humanError:humanError,destCopiedOk:destCopiedOk,apiBase:apiBase,jarUi:jarUi,needSol:needSol,copyTreasury:copyTreasury
};
global.DashaFaucet=api;
function boot(){
  var root=document.getElementById('dasha-faucet');
  if(!root||root.getAttribute('data-faucet-mounted'))return;
  try{
    root.setAttribute('data-faucet-mounted','1');
    mount(root);
  }catch(e){
    try{root.removeAttribute('data-faucet-mounted');}catch(_){}
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();
})(typeof window!=='undefined'?window:this);
