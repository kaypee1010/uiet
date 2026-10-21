  /* RPE Unit 4 playbook: the simulated journal finder and the copy button (runs after the deck and live kits).
     Every journal, publisher and number here is invented for practice. Names reach the DOM through textContent only. */
  (function(){
    var sim=document.querySelector('[data-sim]');
    var STOP=('a an the and or of in on for to with by from at as is are was were be been this that these those we our it its '+
      'using use used than only about such which who whom into over under between among across per not without also can may '+
      'study studies result results paper show shows find found new two three one data analysis research effect effects').split(' ');
    function terms(t){return (t.toLowerCase().match(/[a-z]{3,}/g)||[]).filter(function(w){return STOP.indexOf(w)<0;});}
    var SAMPLES=[
      {k:'Education technology',t:'Calibrated risk alerts in learning analytics. Dashboards flag students who may fail a course. We study confidence calibration of student performance prediction with logistic regression and gradient boosting, and show that calibrated alerts help advisors reach the right students.'},
      {k:'Agriculture',t:'Alternate wetting and drying irrigation in rice. Field trials across two seasons compare continuous flooding with alternate wetting and drying. Water use fell while grain yield held steady, and farmers needed a simple field tube to decide when to irrigate the paddy.'},
      {k:'Public health',t:'Mobile phone reminders and infant vaccination in rural districts. A cluster trial sent voice reminders to mothers before each due dose. Completion of the infant immunisation schedule rose, and community health workers reported fewer missed visits.'},
      {k:'Humanities',t:'Remembering Partition through oral narrative. Life story interviews with women from Punjab reveal how memory, migration and loss are retold across generations, and how silence itself becomes part of the narrative and of family history.'}];
    var J=[
      ['Learning Signals','Northfield Press','Hybrid','student learn analytic predict dashboard course advisor educat'],
      ['Computers in Teaching Review','Lumen Academic','Gold OA','student learn educat teach course classroom technology predict'],
      ['Campus Learning Letters','Society journal','Diamond OA','student course educat learn university advisor'],
      ['Applied Prediction Methods','Lumen Academic','Hybrid','predict regression boost calibrat confidence model machine'],
      ['Furrow and Field','Northfield Press','Hybrid','field crop yield irrigat farmer season trial soil'],
      ['Water for Crops Review','Lumen Academic','Gold OA','water irrigat crop flood wett dry yield'],
      ['Paddy Systems Research','Society journal','Diamond OA','rice paddy irrigat grain yield farmer flood'],
      ['Rural Care Research','Northfield Press','Gold OA','rural district community health worker mother visit'],
      ['Vaccine Outreach Letters','Lumen Academic','Hybrid','vaccinat immunisation infant dose reminder schedule'],
      ['Village Health Notes','Society journal','Diamond OA','community health rural mobile phone reminder worker'],
      ['Oral Memory Review','Northfield Press','Hybrid','memory oral narrative interview life story silence'],
      ['Monsoon Letters','Lumen Academic','Subscription','partition punjab migration women history literature narrative'],
      ['Five Rivers Humanities Journal','Society journal','Diamond OA','punjab partition history family generation memory'],
      ['Omni-Scholar Journal of All Sciences','Unknown publisher','“Open access”','student rural women field health mobile water memory predict trial course',
        ['Promises peer review in 72 hours','“Impact Factor 9.8” from an unknown index','Editor writes from a free webmail address']]
    ].map(function(r){return {name:r[0],pub:r[1],model:r[2],kw:r[3].split(' '),flags:r[4]||null};});
    var SHELVES=[['all','All publishers (web search)'],['Northfield Press','Northfield Press only'],['Lumen Academic','Lumen Academic only']];
    if(sim){
      var text=sim.querySelector('[data-sim-text]'),out=sim.querySelector('[data-sim-out]'),shelf='all';
      var pick=sim.querySelector('[data-sim-pick]'),shelfBox=sim.querySelector('[data-sim-shelf]');
      function chip(box,label,on,fn){var b=document.createElement('button');b.type='button';b.className='chip';b.textContent=label;
        b.setAttribute('aria-pressed',on?'true':'false');b.addEventListener('click',function(){
          box.querySelectorAll('.chip').forEach(function(x){x.setAttribute('aria-pressed','false');});b.setAttribute('aria-pressed','true');fn();});box.appendChild(b);}
      SAMPLES.forEach(function(s,i){chip(pick,s.k,i===0,function(){text.value=s.t;run();});});
      SHELVES.forEach(function(s,i){chip(shelfBox,s[1],i===0,function(){shelf=s[0];run();});});
      text.value=SAMPLES[0].t;
      var timer;text.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(run,250);});
      function run(){
        var have=terms(text.value);
        var list=J.filter(function(j){return shelf==='all'||j.pub===shelf;}).map(function(j){
          var hit=j.kw.filter(function(k){return have.some(function(w){return w.indexOf(k)===0;});});
          var sc=j.flags?Math.min(0.78,hit.length*0.26):hit.length/7;
          return {j:j,hit:hit,sc:Math.min(0.96,sc)};}).filter(function(r){return r.sc>0;})
          .sort(function(a,b){return b.sc-a.sc||a.j.name.localeCompare(b.j.name);}).slice(0,4);
        out.textContent='';
        if(!list.length){var e=document.createElement('li');e.className='sim-none';e.textContent='No journal on this shelf matches these words. Try another shelf or add key terms.';out.appendChild(e);return;}
        list.forEach(function(r,i){
          var li=document.createElement('li');li.className='sim-row'+(r.j.flags?' sim-flag':'');
          var h=document.createElement('div');h.className='sim-head';
          var n=document.createElement('b');n.textContent=(i+1)+'. '+r.j.name;
          var pct=document.createElement('span');pct.className='num sim-pct';pct.textContent=Math.round(r.sc*100)+'% match';
          h.appendChild(n);h.appendChild(pct);li.appendChild(h);
          var bar=document.createElement('div');bar.className='sim-bar';var f=document.createElement('span');bar.appendChild(f);li.appendChild(bar);
          var m=document.createElement('p');m.className='small sim-meta';
          m.textContent=r.j.pub+' · '+r.j.model+' · matched: '+r.hit.slice(0,3).join(', ');li.appendChild(m);
          if(r.j.flags){var fl=document.createElement('p');fl.className='sim-flags';fl.textContent='Red flags: '+r.j.flags.join(' · ');li.appendChild(fl);}
          out.appendChild(li);
          requestAnimationFrame(function(){f.style.transform='scaleX('+r.sc.toFixed(3)+')';});
        });
      }
      run();
    }
    /* copy the sample abstract for the live demo */
    document.querySelectorAll('[data-copy]').forEach(function(b){
      var src=document.querySelector(b.getAttribute('data-copy')),msg=b.parentNode.querySelector('[data-copy-msg]');
      b.addEventListener('click',function(){
        var t=src?src.textContent:'';
        function ok(){if(msg)msg.textContent='Copied. Paste it into the finder.';}
        function sel(){var r=document.createRange();r.selectNodeContents(src);var s=getSelection();s.removeAllRanges();s.addRange(r);if(msg)msg.textContent='Selected. Press Ctrl+C to copy.';}
        if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok,sel);}else{sel();}
      });
    });
  })();
  /* Stay in touch: QR for the contact card (the qrcode encoder is inlined after the main script) */
  window.addEventListener('load',function(){
    var cq=document.getElementById('connectQr');if(!cq||typeof qrcode!=='function')return;
    try{var q=qrcode(0,'M');q.addData('https://kpsingh.in/uiet/connect');q.make();cq.innerHTML=q.createSvgTag({cellSize:4,margin:0,scalable:true});
      var sv=cq.querySelector('svg');if(sv){sv.setAttribute('role','img');sv.setAttribute('aria-label','QR code for kpsingh.in/uiet/connect');}}catch(e){}
  });
  /* Read a journal page: six hotspots on an invented journal home page */
  (function(){
    var box=document.querySelector('[data-anat]');if(!box)return;
    var C=[['Aims & scope','Does your paper fit? Scope decides desk rejection, so read it first.'],
      ['Editorial board','Real people? Search two names on their university pages.'],
      ['Indexing claims','Badges prove nothing. Search the journal in Scopus or Web of Science yourself.'],
      ['Fees (APC)','The fee should be stated clearly before you submit, not after acceptance.'],
      ['Review speed','Review in days instead of weeks is a classic red flag.'],
      ['Recent issues','Open two recent papers. Is the quality one you would cite?']];
    var call=box.querySelector('[data-anat-call]');
    box.querySelectorAll('[data-spot]').forEach(function(b){b.addEventListener('click',function(){
      var i=+b.getAttribute('data-spot');box.querySelectorAll('[data-spot]').forEach(function(x){x.classList.toggle('on',x===b);});
      b.classList.add('seen');call.textContent='';var h=document.createElement('b');h.textContent=(i+1)+'. '+C[i][0];var p=document.createElement('p');p.textContent=C[i][1];
      call.appendChild(h);call.appendChild(p);});});
  })();
  /* Spot the red flags: click each suspicious phrase in an invented email */
  (function(){
    var box=document.querySelector('[data-mail]');if(!box)return;
    var cnt=document.querySelector('[data-mail-count]'),last=document.querySelector('[data-mail-last]'),n=0;
    box.querySelectorAll('[data-flag]').forEach(function(b){b.addEventListener('click',function(){
      if(!b.classList.contains('found')){b.classList.add('found');n++;cnt.textContent=n;if(window.KP&&KP.replay)KP.replay(cnt);}
      last.textContent='· '+b.getAttribute('data-flag');});});
  })();
