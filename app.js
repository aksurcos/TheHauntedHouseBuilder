// Drag-and-drop onto single house image, placement overlay, persist placements
const STORAGE_KEY = 'haunted-house-placements-v1'

function $(sel){return document.querySelector(sel)}
function $all(sel){return Array.from(document.querySelectorAll(sel))}

function initToolItems(){
  $all('.tool-item').forEach(item=>{
    item.addEventListener('dragstart', (e)=>{
      const type = item.dataset.type
      const id = item.dataset.id
      const haunt = Number(item.dataset.haunt || 0)
      const label = item.querySelector('.tool-label')?.textContent || id
      const payload = {type,id,haunt,label}
      e.dataTransfer.setData('application/json', JSON.stringify(payload))
      try{ e.dataTransfer.setDragImage(item,20,20) }catch(err){}
    })
  })
}

function handleHouseDrop(e){
  e.preventDefault()
  const data = e.dataTransfer.getData('application/json')
  if(!data) return
  const payload = JSON.parse(data)
  if(payload.type !== 'furniture' && payload.type !== 'asset') return
  const area = $('#house-img')
  const rect = area.getBoundingClientRect()
  // use clientX/Y to get position within image
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const px = Math.round((x / rect.width) * 10000) / 100 // percent with 2 decimals
  const py = Math.round((y / rect.height) * 10000) / 100
  placeAssetAt(payload, px, py)
  computeHaunt()
  saveLayout()
}

function placeAssetAt(payload, leftPct, topPct){
  const overlay = $('#overlay')

  // special case: blackcat uses a PNG and a continuous right->left walking animation at the bottom
  if(String(payload.id) === 'blackcat'){
    const cat = document.createElement('img')
    cat.className = 'cat-walker'
    cat.dataset.furnId = payload.id
    cat.dataset.haunt = payload.haunt
    // use the project-relative GIF in assets (blackcat.gif)
    cat.src = 'assets/blackcat.gif'

    // make the GIF responsive: compute size and animation duration from overlay width
    cat.style.left = '-20%'
    cat.style.bottom = '4%'
    try{
      const rect = overlay.getBoundingClientRect()
      // width ~20% of overlay, clamped between 36 and 140px
      const w = Math.round(Math.max(36, Math.min(140, rect.width * 0.20)))
      cat.style.width = w + 'px'
      // duration proportional to overlay width (in seconds), clamped
      const duration = Math.max(3, Math.min(12, Math.round((rect.width / 100) * 10) / 10))
      cat.style.animation = `cat-walk-ltr ${duration}s linear 1 forwards`
    }catch(err){
      cat.style.animation = 'cat-walk-ltr 8s linear 1 forwards'
    }

    // allow manual removal by right-click while it's walking
    cat.addEventListener('contextmenu', (ev)=>{ ev.preventDefault(); cat.remove(); computeHaunt(); saveLayout(); })

    // remove the cat automatically when its walk animation ends (disappear on the left)
    cat.addEventListener('animationend', ()=>{ 
      // ensure we remove the node and update saved layout/haunt
      if(cat.parentElement) cat.remove();
      computeHaunt();
      saveLayout();
    })

    overlay.appendChild(cat)
    // update haunt display immediately (cat contributes while present)
    computeHaunt()
    // do not save a transient walking cat to the persistent layout; it will be removed on animationend
    return
  }

  const item = document.createElement('div')
  item.className = 'placed-item'
  item.dataset.furnId = payload.id
  item.dataset.haunt = payload.haunt


  // choose an icon per asset id so each placed item shows correctly
  let icon = '☠️'
  switch(String(payload.id)){
    case 'ghost': icon = '👻'; break;
    case 'candle': icon = '🕯️'; break;
    case 'bug': icon = '🐛'; break;
    case 'spider': icon = '�️'; break;
    case 'blackcat': icon = '🐈‍⬛'; break;
    case 'tombstone': icon = '🪦'; break;
    case 'skull': icon = '☠️'; break;
    default: icon = '❓';
  }
  item.innerHTML = `<span class="icon">${icon}</span>`
  // remove on right-click
  item.addEventListener('contextmenu', (ev)=>{ ev.preventDefault(); item.remove(); computeHaunt(); saveLayout(); })
  overlay.appendChild(item)
}

function computeHaunt(){
  let total = 0
  $all('.placed-item, .cat-walker').forEach(it=> total += Number(it.dataset.haunt || 0))
  const hauntValueEl = $('#haunt-value')
  const fill = $('#haunt-fill')
  hauntValueEl.textContent = total
  const pct = Math.min(100, Math.round(total * 2))
  fill.style.width = pct + '%'
}

function saveLayout(){
  const items = $all('.placed-item, .cat-walker').map(it=>{
    // cat-walker is an img; placed-item is a div with style left/top
    return {id: it.dataset.furnId || it.getAttribute('data-furn-id') || it.dataset.furnId, haunt: Number(it.dataset.haunt||0), left: it.style.left || '', top: it.style.top || ''}
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function loadLayout(){
  const raw = localStorage.getItem(STORAGE_KEY)
  if(!raw) return
  try{
    const items = JSON.parse(raw)
    const overlay = $('#overlay')
    overlay.innerHTML = ''
    items.forEach(it=>{
      const left = parseFloat(it.left) || 0
      const top = parseFloat(it.top) || 0
      placeAssetAt({id:it.id,haunt:it.haunt}, left, top)
    })
    computeHaunt()
  }catch(err){console.warn('Failed to load placements',err)}
}

function clearLayout(){
  localStorage.removeItem(STORAGE_KEY)
  $('#overlay').innerHTML = ''
  computeHaunt()
}

function init(){
  initToolItems()
  const overlay = $('#overlay')
  const houseArea = $('#house-img')
  // allow drop on overlay (positioned over image)
  overlay.addEventListener('dragover', e=>e.preventDefault())
  overlay.addEventListener('drop', handleHouseDrop)

  $('#save-btn').addEventListener('click', ()=>{ saveLayout(); alert('Layout saved locally.') })
  $('#load-btn').addEventListener('click', ()=>{ loadLayout(); alert('Layout loaded.') })
  $('#clear-btn').addEventListener('click', ()=>{ if(confirm('Clear the house and saved layout?')) clearLayout() })

  // initial load
  loadLayout()
  computeHaunt()
}

window.addEventListener('DOMContentLoaded', init)
