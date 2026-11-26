(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const themeButton = $('[data-theme-toggle]');
  const setTheme = (theme) => {
    document.body.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('sir-theme', theme);
    if (themeButton) {
      $('.theme-label', themeButton).textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
      themeButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
      $('.theme-icon', themeButton).textContent = theme === 'dark' ? '☼' : '◐';
    }
  };
  setTheme(localStorage.getItem('sir-theme') || 'light');
  themeButton?.addEventListener('click', () => setTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));

  const rowsHost = $('#fragment-rows');
  if (!rowsHost) return;
  const examples = {
    compatible: [{root:3,left:2,right:5},{root:2,left:1,right:null},{root:5,left:4,right:null}],
    unseen: [{root:10,left:6,right:14},{root:6,left:4,right:8},{root:14,left:12,right:17}],
    conflict: [{root:10,left:5,right:15},{root:5,left:12,right:null}]
  };
  let fragments = [];
  const addRow = (fragment = {root:'',left:null,right:null}) => {
    fragments.push({root:fragment.root ?? '',left:fragment.left ?? '',right:fragment.right ?? ''});
    renderRows();
  };
  function renderRows() {
    rowsHost.innerHTML = '';
    fragments.forEach((f, i) => {
      const row = document.createElement('div'); row.className = 'fragment-row';
      row.innerHTML = `<span class="fragment-id">T${String(i+1).padStart(2,'0')}</span><input aria-label="Fragment ${i+1} root ID" data-field="root" type="number" step="1" placeholder="e.g. 12"><input aria-label="Fragment ${i+1} left child ID, optional" data-field="left" type="number" step="1" placeholder="empty"><input aria-label="Fragment ${i+1} right child ID, optional" data-field="right" type="number" step="1" placeholder="empty"><button class="remove-row" type="button" aria-label="Remove fragment ${i+1}">×</button>`;
      ['root','left','right'].forEach((key) => { const input = $(`[data-field="${key}"]`, row); if (f[key] !== '' && f[key] != null) input.value = f[key]; input.addEventListener('input', () => { fragments[i][key] = input.value; updateCount(); }); });
      $('.remove-row', row).addEventListener('click', () => { fragments.splice(i,1); renderRows(); });
      rowsHost.append(row);
    });
    updateCount();
  }
  function updateCount() { const el = $('#input-count'); if (el) el.textContent = `${fragments.length} FRAGMENT${fragments.length === 1 ? '' : 'S'}`; }
  const parsed = () => fragments.map((f,i) => ({root:toId(f.root,`Fragment ${i+1} root`),left:toOptionalId(f.left,`Fragment ${i+1} left child`),right:toOptionalId(f.right,`Fragment ${i+1} right child`)}));
  function toId(v,label) { if (v === '' || v == null || !Number.isSafeInteger(Number(v))) throw new Error(`${label} must be a whole number.`); return Number(v); }
  function toOptionalId(v,label) { if(v === '' || v == null) return null; return toId(v,label); }
  $('#add-fragment').addEventListener('click', () => addRow());
  $('#load-example').addEventListener('click', () => setFragments(examples.compatible));
  function setFragments(data) { fragments = data.map(x => ({root:x.root,left:x.left ?? '',right:x.right ?? ''})); renderRows(); $('#input-error').textContent=''; }
  $$('.mode-tab').forEach(btn => btn.addEventListener('click', () => {
    $$('.mode-tab').forEach(b => b.classList.toggle('selected', b === btn));
    $('#builder-mode').classList.toggle('hidden', btn.dataset.mode !== 'builder'); $('#paste-mode').classList.toggle('hidden', btn.dataset.mode !== 'paste');
  }));
  $('#parse-paste').addEventListener('click', () => {
    try {
      const text = $('#paste-input').value.trim(); if (!text) throw new Error('Paste at least one fragment first.');
      const data = text.split(/\r?\n/).filter(Boolean).map((line,i) => { const cols=line.trim().split(/[\s,]+/); if(cols.length!==3) throw new Error(`Line ${i+1} needs exactly three values: root left right.`); return {root:toId(cols[0],`Line ${i+1} root`),left:cols[1]==='-'?null:toId(cols[1],`Line ${i+1} left child`),right:cols[2]==='-'?null:toId(cols[2],`Line ${i+1} right child`)}; });
      if(data.length>100) throw new Error('The limit is 100 fragments.'); setFragments(data); $$('.mode-tab').forEach(b => b.classList.toggle('selected',b.dataset.mode==='builder')); $('#builder-mode').classList.remove('hidden'); $('#paste-mode').classList.add('hidden');
    } catch(e) { $('#input-error').textContent=e.message; }
  });

  // The C service is the source of truth for every recovery decision.
  async function recoverFragments(input) {
    const response = await fetch('/api/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fragments: input }),
    });
    let result;
    try { result = await response.json(); }
    catch { throw new Error('The backend returned an unreadable response.'); }
    if (!response.ok || !result.ok) throw new Error(result.reason || 'Recovery failed.');
    return result;
  }
  function recoverInBrowser(input) {
    if(!input.length) throw new Error('Add at least one fragment.');
    if(input.length>100) throw new Error('The limit is 100 fragments.');
    const roots=new Map(), values=new Set();
    input.forEach((f,i)=>{
      if(roots.has(f.root)) throw new Error(`Duplicate fragment root ID ${f.root}.`);
      roots.set(f.root,i);
      if(f.left===f.root||f.right===f.root||(f.left!=null&&f.left===f.right)) throw new Error(`Fragment ${i+1} repeats an ID within its nodes.`);
      for(const v of [f.root,f.left,f.right]) if(v!=null){ if(values.has(v)) throw new Error(`Duplicate node ID ${v}. Student IDs must be unique.`); values.add(v); }
      if(f.left!=null&&f.left>=f.root) throw new Error(`Fragment ${i+1} is not a BST: left child ${f.left} must be less than root ${f.root}.`);
      if(f.right!=null&&f.right<=f.root) throw new Error(`Fragment ${i+1} is not a BST: right child ${f.right} must be greater than root ${f.root}.`);
    });
    const childIds=new Set(input.flatMap(f=>[f.left,f.right].filter(v=>v!=null)));
    const candidates=input.map((f,i)=>i).filter(i=>!childIds.has(input[i].root));
    if(candidates.length!==1) throw new Error(candidates.length===0?'No final root candidate: fragments contain a structural cycle.':'More than one root candidate: fragments are disconnected.');
    const used=new Set(), log=[];
    const build=(idx,min=-Infinity,max=Infinity)=>{
      if(used.has(idx)) throw new Error(`Fragment rooted at ${input[idx].root} would be used more than once.`);
      const f=input[idx]; used.add(idx);
      const node={value:f.root,left:null,right:null,fragment:idx};
      for(const side of ['left','right']){
        const id=f[side]; if(id==null) continue;
        if(roots.has(id)){
          const childIndex=roots.get(id); const child=input[childIndex];
          log.push(`Matched ${side} leaf ${id} of fragment ${f.root} with fragment root ${id}.`);
          node[side]=build(childIndex,side==='left'?min:f.root,side==='right'?max:f.root);
        } else node[side]={value:id,left:null,right:null,fragment:idx};
      }
      return node;
    };
    const rootIndex=candidates[0];
    let tree;
    try { tree=build(rootIndex); } catch(e) { throw e; }
    if(used.size!==input.length){ const missing=input.map((f,i)=>used.has(i)?null:f.root).filter(x=>x!=null); throw new Error(`Disconnected or unused fragment${missing.length>1?'s':''}: root${missing.length>1?'s':''} ${missing.join(', ')}.`); }
    const validate=(n,min=-Infinity,max=Infinity)=>{if(!n)return true;if(!(n.value>min&&n.value<max)) throw new Error(`Ordering conflict at ID ${n.value}: expected a value strictly between ${min===-Infinity?'−∞':min} and ${max===Infinity?'∞':max}.`);validate(n.left,min,n.value);validate(n.right,n.value,max);return true;};
    validate(tree);
    const order=[]; const walk=n=>{if(!n)return;walk(n.left);order.push(n.value);walk(n.right);};walk(tree);
    log.push(`All ${input.length} fragment${input.length===1?'':'s'} used exactly once.`); log.push('Full-tree BST range validation passed.'); log.push('Inorder traversal generated.');
    return {ok:true,root:tree.value,tree,inorder:order,used:used.size,total:input.length,log};
  }
  $('#recover-button').addEventListener('click', async () => {
    $('#input-error').textContent='';
    try { const input=parsed(); const result=await recoverFragments(input); displayResult(result); }
    catch(e){ displayFailure(e.message); }
  });
  function displayResult(r) {
    $('#empty-result').classList.add('hidden'); $('#result-content').classList.remove('hidden'); $('#result-status').textContent=r.ok?'RECOVERY SUCCESSFUL':'IMPOSSIBLE'; $('#result-status').className=`status-pill ${r.ok?'success':'failure'}`; $('#result-title').textContent=r.ok?'RECOVERY SUCCESSFUL':'RECOVERY FAILED'; $('#root-value').textContent=r.ok?r.root:'—'; $('#tree-node-count').textContent=`${r.nodeCount || r.inorder.length} NODES`; $('#inorder-output').textContent=`[${r.inorder.join(', ')}]`; $('#valid-check').textContent='✓ VALID BST'; $('#valid-check').classList.remove('invalid'); $('#used-output').textContent=`${r.used} / ${r.total}`; $('#failure-reason').classList.add('hidden'); drawTree(r.tree); renderLog(r.log); 
  }
  function displayFailure(message) {
    $('#empty-result').classList.add('hidden'); $('#result-content').classList.remove('hidden'); $('#result-status').textContent='IMPOSSIBLE'; $('#result-status').className='status-pill failure'; $('#result-title').textContent='RECOVERY FAILED'; $('#root-value').textContent='—'; $('#tree-node-count').textContent=''; $('#tree-visual').innerHTML='<div class="empty-result"><div class="empty-icon">!</div><h3>No valid merged tree.</h3></div>'; $('#inorder-output').textContent='Unavailable'; $('#valid-check').textContent='✕ NOT RECOVERED'; $('#valid-check').classList.add('invalid'); $('#used-output').textContent='—'; const reason=$('#failure-reason'); reason.textContent=message; reason.classList.remove('hidden'); renderLog([message],true);
  }
  function renderLog(items,warning=false){const ol=$('#recovery-log');ol.innerHTML='';items.forEach((line,i)=>{const li=document.createElement('li');li.textContent=line;if(warning&&i===0)li.classList.add('log-warn');ol.append(li);});}
  function drawTree(root){
    const levels=[];const visit=(n,depth=0,pos=0)=>{if(!n)return;levels[depth]??=[];levels[depth].push({node:n,pos});visit(n.left,depth+1,pos*2);visit(n.right,depth+1,pos*2+1);};visit(root);
    const depth=levels.length, width=Math.max(320,Math.pow(2,Math.min(depth,8))*44), height=Math.max(150,depth*58), parts=[];
    const coords=new Map(); for(let d=0;d<levels.length;d++){const slots=Math.pow(2,d); for(const item of levels[d]){const x=width*(item.pos+.5)/slots,y=25+d*52;coords.set(item.node,{x,y});}}
    const edges=[];const edgeWalk=n=>{if(!n)return;const a=coords.get(n);for(const c of [n.left,n.right])if(c){const b=coords.get(c);edges.push(`<line class="tree-edge" x1="${a.x}" y1="${a.y+14}" x2="${b.x}" y2="${b.y-14}"/>`);edgeWalk(c);}};edgeWalk(root);
    const nodes=[];const nodeWalk=n=>{if(!n)return;const p=coords.get(n);nodes.push(`<circle class="tree-node" cx="${p.x}" cy="${p.y}" r="15"/><text class="tree-node-text" x="${p.x}" y="${p.y+1}">${n.value}</text>`);nodeWalk(n.left);nodeWalk(n.right);};nodeWalk(root);
    $('#tree-visual').innerHTML=`<svg class="tree-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Merged binary search tree">${edges.join('')}${nodes.join('')}</svg>`;
  }
  
  setFragments(examples.compatible);
})();
