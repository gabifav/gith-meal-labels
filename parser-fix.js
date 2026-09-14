// GITH WhatsApp parser improvements
(function(){
  function uniq(a){return [...new Set(a)]}
  function cleanMealName(text){
    let s=text;
    // Remove non-label chatter / logistics.
    s=s.replace(/(?:^|[.!?]\s+)(?:i\s+)?(?:will|i'll|we'll|we will|can|could|should|going to)\s+(?:drop|deliver|bring|pick|collect|come|arrive|leave)\b[\s\S]*$/i,' ')
      .replace(/(?:^|[.!?]\s+)drop\s*off\b[\s\S]*$/i,' ')
      .replace(/\b(?:this|tomorrow|today)\s+(?:morning|afternoon|evening)\b[\s\S]*$/i,' ');
    // Anything after a completed dietary sentence is not part of the meal name.
    s=s.split(/[.!?]/)[0];
    // Sticker-friendly wording: no commas and no unnecessary recipe prose.
    s=s.replace(/,/g,' ')
      .replace(/\bserved\s+with\s+rice\b/ig,'& Rice')
      .replace(/\bwith\s+rice\b/ig,'& Rice')
      .replace(/\band\s+rice\b/ig,'& Rice')
      .replace(/\bminced\s+pork\b/ig,'Pork')
      .replace(/\bstir[ -]?fried\b/ig,'Stir Fry')
      .replace(/\bred\s+lentils?\b/ig,'Lentil')
      .replace(/\blentils\b/ig,'Lentil')
      .replace(/\bwith\s+(?:mixed\s+)?vegetables?\b/ig,'')
      .replace(/\bvegetables\b/ig,'Veg')
      .replace(/\bvegetable\b/ig,'Veg')
      .replace(/\s*&\s*/g,' & ')
      .replace(/\s{2,}/g,' ')
      .replace(/^[-–—:;& ]+|[-–—:;& ]+$/g,'')
      .trim();
    if(typeof window.fitShorten==='function') s=window.fitShorten(s);
    return s.replace(/,/g,'').replace(/\s{2,}/g,' ').trim();
  }
  function dietaryCodes(text){
    const t=text.toLowerCase(); const out=[];
    if(/\bvegan\b|\bvg\b/.test(t)) out.push('VG');
    else if(/\bvegetarian\b|\bveg\b/.test(t)) out.push('V');
    if(/\bgluten(?:[ -]?free)?\b|\bcoeliac\b|\bgf\b/.test(t) && /\bfree\b|\bgf\b|\bcoeliac\b/.test(t)) out.push('GF');
    if(/\blactose(?:[ -]?free)?\b|\blf\b/.test(t) && /\bfree\b|\blf\b/.test(t)) out.push('LF');
    if(/\bdairy[ -]?free\b|\bdf\b/.test(t)) out.push('DF');
    if(/\bnut[ -]?free\b|\bnf\b/.test(t)) out.push('NF');
    if(/\bpescatarian\b|\bpesc\b/.test(t)) out.push('PESC');
    if(/\bdiabetic\b|\bdiab\b/.test(t)) out.push('DIAB');
    if(/\bno\s+pasta\b/.test(t)) out.push('NO PASTA');
    if(/\bnightshade[ -]?free\b|\bno\s+nightshades?\b/.test(t)) out.push('NO NIGHTSHADE');
    return uniq(out);
  }
  window.parseWhatsApp=function(){
    const raw=document.getElementById('waPaste').value.trim();
    if(!raw)return alert('Paste the WhatsApp meal message first.');
    const found=[];
    for(let line of raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)){
      line=line.replace(/^[•*\-–—]+\s*/,'');
      let qty=null, body=line, m;
      if((m=body.match(/^(\d{1,3})\s*(?:x|×)?\s*(.+)$/i))){qty=+m[1];body=m[2]}
      else if((m=body.match(/(?:\s|^)(?:x|×)\s*(\d{1,3})\s*$/i))){qty=+m[1];body=body.slice(0,m.index)}
      else if((m=body.match(/(?:\s|^)[\-–—:]?\s*(\d{1,3})\s*(?:meals?|labels?)?\s*$/i))){qty=+m[1];body=body.slice(0,m.index)}
      if(!qty||qty>500)continue;
      const codes=dietaryCodes(body);
      // Meal is the first sentence; dietaries and delivery chatter are metadata, not the meal title.
      let mealPart=body.split(/[.!?]/)[0];
      // If dietary wording appears in the first sentence, cut it away.
      mealPart=mealPart.replace(/\b(?:vegan|vegetarian|pescatarian|coeliac|gluten(?:[ -]?free)?|lactose(?:[ -]?free)?|dairy[ -]?free|nut[ -]?free|no\s+pasta|nightshade[ -]?free)\b[\s\S]*$/i,'');
      const meal=cleanMealName(mealPart);
      if(meal)found.push({meal,dietary:codes.join(' • ')||'Regular / No instruction',qty});
    }
    if(!found){document.getElementById('parseResult').innerHTML='<b>Nothing recognised.</b>';return}
    window._waFound=found;
    window.refreshPreview();
  };
  const b=document.getElementById('parseBtn'); if(b)b.onclick=window.parseWhatsApp;
})();