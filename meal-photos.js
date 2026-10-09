(() => {
  'use strict';
  const guide = document.createElement('section');
  guide.className = 'card';
  guide.innerHTML = `<h2>Meal photo guide</h2><p class="note">Add a photo and name to help identify meals. Saved on this device for both Tuesday and Friday. Use a backup to copy your guide to another device.</p>
  <form id="photoForm"><label for="photoName">Meal name</label><input id="photoName" required maxlength="160" placeholder="e.g. Chicken curry & rice"><label for="photoFile">Meal photo</label><input id="photoFile" type="file" accept="image/*"><img id="photoPreview" hidden alt="Selected meal photo" style="max-width:100%;max-height:240px;margin-top:12px;border-radius:12px"><button class="primary" id="savePhoto" type="submit">Save meal photo</button><button class="secondary" id="cancelPhoto" type="button" hidden style="margin-top:8px">Cancel edit</button></form>
  <p id="photoStatus" role="status" class="note"></p><label for="photoSearch">Find a meal</label><input id="photoSearch" type="search" placeholder="Search meal names"><div id="photoGallery" class="photoGallery"></div><div class="actions"><button class="secondary" id="backupPhotos" type="button">Back up photos</button><button class="secondary" id="restorePhotos" type="button">Restore photos</button></div><input id="photoBackup" type="file" accept="application/json,.json" hidden>`;
  document.querySelector('main').insertBefore(guide, document.getElementById('formTitle').closest('section'));
  const style = document.createElement('style');
  style.textContent = '.photoGallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:14px 0}.photoTile{border:2px solid #eceaf2;border-radius:14px;padding:10px;min-width:0}.photoTile img{width:100%;height:180px;object-fit:contain;background:#f6f5fa;border-radius:10px}.photoTile h3{overflow-wrap:anywhere;margin:8px 0}.photoTile .actions{flex-wrap:wrap}.matchedMealPhoto{display:block;width:100%;max-width:260px;max-height:200px;object-fit:contain;border-radius:10px;margin:8px 0}';
  document.head.appendChild(style);
  const el = id => document.getElementById(id);
  let db, entries = [], editingId = null, pendingPhoto = '', reading = false;
  const status = text => el('photoStatus').textContent = text;
  const normal = name => name.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const ready = new Promise((resolve, reject) => {
    const request = indexedDB.open('githMealPhotoGuide', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos', {keyPath:'id'});
    request.onsuccess = () => {db = request.result; resolve();};
    request.onerror = () => reject(request.error);
  });
  async function transact(mode, action) {
    await ready;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', mode);
      action(tx.objectStore('photos'));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Save cancelled'));
    });
  }
  async function reload() {
    await ready;
    entries = await new Promise((resolve, reject) => {
      const req = db.transaction('photos').objectStore('photos').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    renderGallery(); attachPhotos();
  }
  function resetForm() {
    editingId = null; pendingPhoto = ''; el('photoForm').reset();
    el('photoPreview').hidden = true; el('photoPreview').removeAttribute('src');
    el('cancelPhoto').hidden = true; el('savePhoto').textContent = 'Save meal photo';
  }
  function renderGallery() {
    const query = normal(el('photoSearch').value);
    const gallery = el('photoGallery'); gallery.replaceChildren();
    const shown = entries.filter(x => normal(x.name).includes(query)).sort((a,b)=>a.name.localeCompare(b.name));
    if (!shown.length) {const p=document.createElement('p');p.className='note';p.textContent=entries.length?'No matching meals.':'No meal photos yet. Add your first photo above.';gallery.append(p);}
    for (const entry of shown) {
      const tile=document.createElement('article');tile.className='photoTile';
      const img=document.createElement('img');img.src=entry.photo;img.alt=entry.name;img.loading='lazy';
      const heading=document.createElement('h3');heading.textContent=entry.name;
      const actions=document.createElement('div');actions.className='actions';
      const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='Edit';
      edit.onclick=()=>{editingId=entry.id;pendingPhoto=entry.photo;el('photoName').value=entry.name;el('photoFile').value='';el('photoPreview').src=entry.photo;el('photoPreview').hidden=false;el('cancelPhoto').hidden=false;el('savePhoto').textContent='Save changes';el('photoName').focus();};
      const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Remove';
      remove.onclick=async()=>{if(!confirm('Remove photo for '+entry.name+'?'))return;try{await transact('readwrite',s=>s.delete(entry.id));if(editingId===entry.id)resetForm();await reload();status('Photo removed.');}catch(e){status('Could not remove photo. Please try again.');}};
      actions.append(edit,remove);tile.append(img,heading,actions);gallery.append(tile);
    }
  }
  function attachPhotos() {
    document.querySelectorAll('#list .meal').forEach(card=>{
      card.querySelector('.matchedMealPhoto')?.remove();
      const entry=entries.find(x=>normal(x.name)===normal(card.querySelector('h3')?.textContent||''));
      if(entry){const img=document.createElement('img');img.className='matchedMealPhoto';img.src=entry.photo;img.alt=entry.name;img.loading='lazy';card.insertBefore(img,card.querySelector('.meta'));}
    });
  }
  // Observe the meal list so day changes and meal edits keep matching photos current.
  const observer=new MutationObserver(()=>{observer.disconnect();attachPhotos();observer.observe(el('list'),{childList:true});});
  observer.observe(el('list'),{childList:true});
  function resizePhoto(file) {
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file),img=new Image();
      img.onload=()=>{try{const scale=Math.min(1,1200/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',0.82));}catch(e){reject(e);}finally{URL.revokeObjectURL(url);}};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Use a JPG, PNG or another photo supported by this browser.'));};img.src=url;
    });
  }
  el('photoFile').onchange=async()=>{
    const file=el('photoFile').files[0];if(!file)return;
    reading=true;el('savePhoto').disabled=true;
    try{if(!file.type.startsWith('image/'))throw new Error('Choose an image file.');if(file.size>30*1024*1024)throw new Error('Choose a photo smaller than 30 MB.');pendingPhoto=await resizePhoto(file);el('photoPreview').src=pendingPhoto;el('photoPreview').hidden=false;status('Photo ready to save.');}catch(e){el('photoFile').value='';status(e.message);}finally{reading=false;el('savePhoto').disabled=false;}
  };
  el('photoForm').onsubmit=async event=>{
    event.preventDefault();if(reading)return;const name=el('photoName').value.trim();
    if(!name)return status('Enter a meal name.');if(!pendingPhoto)return status('Choose a meal photo first.');
    const duplicate=entries.find(x=>normal(x.name)===normal(name)&&x.id!==editingId);
    if(duplicate&&!confirm('Replace the existing photo for '+duplicate.name+'?'))return;
    el('savePhoto').disabled=true;
    try{const entry={id:editingId||duplicate?.id||crypto.randomUUID(),name,photo:pendingPhoto};await transact('readwrite',s=>{if(duplicate&&duplicate.id!==entry.id)s.delete(duplicate.id);s.put(entry);});resetForm();await reload();status('Meal photo saved.');}catch(e){status('Could not save photo. Device storage may be full or unavailable.');}finally{el('savePhoto').disabled=false;}
  };
  el('cancelPhoto').onclick=resetForm;el('photoSearch').oninput=renderGallery;
  el('backupPhotos').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,photos:entries})],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='GITH-meal-photos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  el('restorePhotos').onclick=()=>el('photoBackup').click();
  el('photoBackup').onchange=async()=>{
    const file=el('photoBackup').files[0];if(!file)return;
    try{if(file.size>50*1024*1024)throw new Error('Backup is too large.');const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.photos)||data.photos.some(x=>!x||typeof x.name!=='string'||!x.name.trim()||x.name.length>160||typeof x.photo!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x.photo)))throw new Error('Choose a valid meal photo backup.');if(!confirm('Restore '+data.photos.length+' photos? Matching meal names will be replaced.'))return;const merged=new Map(entries.map(x=>[normal(x.name),x]));data.photos.forEach(x=>{const name=x.name.trim(),old=merged.get(normal(name));merged.set(normal(name),{id:old?.id||crypto.randomUUID(),name,photo:x.photo});});await transact('readwrite',s=>{s.clear();merged.forEach(x=>s.put(x));});resetForm();await reload();status('Meal photos restored.');}catch(e){status('Could not restore photos: '+e.message);}finally{el('photoBackup').value='';}
  };
  reload().catch(()=>status('Photo storage is unavailable. Please use a browser with device storage enabled.'));
})();
