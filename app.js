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
      // include the sidebar image src so drops use the exact file (handles GIFs, PNGs, SVGs)
      const imgEl = item.querySelector('img')
      const src = imgEl ? (imgEl.getAttribute('src') || imgEl.src) : (item.dataset.src || '')
      const payload = {type,id,haunt,label,src}
      // set JSON payload but also set a text/plain fallback because some browsers/contexts
      // may not expose custom mime types on drop. Also set effectAllowed for clarity.
      try{
        e.dataTransfer.setData('application/json', JSON.stringify(payload))
      }catch(e){ /* ignore */ }
      try{
        e.dataTransfer.setData('text/plain', JSON.stringify(payload))
      }catch(e){ /* ignore */ }
      try{ e.dataTransfer.setDragImage(item,20,20); e.dataTransfer.effectAllowed = 'copyMove' }catch(err){}
    })
  })
}

function handleHouseDrop(e){
  e.preventDefault()
  // try multiple drag data types (application/json, text/plain, text)
  let data = ''
  try{ data = e.dataTransfer.getData('application/json') || '' }catch(e){ data = '' }
  if(!data){
    try{ data = e.dataTransfer.getData('text/plain') || '' }catch(e){ data = '' }
  }
  if(!data){
    try{ data = e.dataTransfer.getData('text') || '' }catch(e){ data = '' }
  }

  // if still empty, try asynchronous string retrieval from DataTransferItemList (best-effort)
  if(!data && e.dataTransfer.items && e.dataTransfer.items.length){
    const first = e.dataTransfer.items[0]
    if(first.kind === 'string'){
      // getAsString is async; we handle it by parsing inside the callback and returning early
      first.getAsString(s=>{
        try{ const payload = JSON.parse(s); _placeFromPayload(e, payload); }catch(err){ /* ignore */ }
      })
      return
    }
  }

  if(!data) return
  let payload = null
  try{ payload = JSON.parse(data) }catch(err){
    // not valid JSON — abort
    return
  }
  // If this payload describes a placed instance (dragging an existing image), reposition the element
  if(payload.instanceId){
    const existing = document.querySelector(`[data-instance-id="${payload.instanceId}"]`)
    if(existing){
      const area = $('#house-img')
      const rect = area.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const px = Math.round((x / rect.width) * 10000) / 100
      const py = Math.round((y / rect.height) * 10000) / 100
      existing.style.left = px + '%'
      existing.style.top = py + '%'
      // restore width if payload has one
      if(payload.width) existing.style.width = payload.width
      computeHaunt()
      saveLayout()
    }
    return
  }

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

  // (no special-case assets here) placed assets are handled uniformly below
  // create an image element for the placed asset (prefer PNG, fallback to SVG/GIF/JPG)
  const img = document.createElement('img')
  img.className = 'placed-img'
  img.dataset.furnId = payload.id
  img.dataset.haunt = payload.haunt
  img.draggable = true
  // assign a unique instance id so we can identify this specific placed element for repositioning
  const instanceId = payload.instanceId || (`inst-${Date.now().toString(36)}-${Math.floor(Math.random()*10000)}`)
  img.dataset.instanceId = instanceId
  img.style.left = leftPct + '%'
  img.style.top = topPct + '%'

  // prefer PNG files when available; try a simple fallback chain
  const tryExt = ['png','svg','gif','jpg']
  let extIndex = 0
  const setSrc = ()=>{
    // if the drag payload supplied an explicit src, use that first (supports GIFs)
    if(extIndex === 0 && payload.src){
      img.src = payload.src
      return
    }
    // try assets/<id>.<ext>
    img.src = `assets/${payload.id}.${tryExt[extIndex]}`
  }
  img.addEventListener('error', ()=>{
    extIndex++
    if(extIndex < tryExt.length) setSrc()
    else if(payload.src && payload.src !== img.src){
      // as a last resort try the payload.src (if provided and different)
      img.src = payload.src
    }
  })
  // start by preferring png (index 0)
  setSrc()

  // remove on right-click
  img.addEventListener('contextmenu', (ev)=>{ ev.preventDefault(); img.remove(); computeHaunt(); saveLayout(); })

  // allow dragging the placed image to reposition it later
  img.addEventListener('dragstart', (e)=>{
    // build a payload that identifies this instance for repositioning
    const pd = {type: 'placed', id: img.dataset.furnId, haunt: Number(img.dataset.haunt||0), instanceId: img.dataset.instanceId, width: img.style.width || '', src: img.src}
    try{ e.dataTransfer.setData('application/json', JSON.stringify(pd)) }catch(err){}
    try{ e.dataTransfer.setData('text/plain', JSON.stringify(pd)) }catch(err){}
    try{ e.dataTransfer.setDragImage(img, img.width/2, img.height/2); e.dataTransfer.effectAllowed = 'move' }catch(err){}
  })
  // click to select (show resize controls)
  img.addEventListener('click', (ev)=>{ ev.stopPropagation(); selectPlacedItem(img) })

  // apply saved width if present on payload
  if(payload.width) img.style.width = payload.width

  overlay.appendChild(img)
}

function computeHaunt(){
  let total = 0
  $all('[data-furn-id]').forEach(it=> total += Number(it.dataset.haunt || 0))
  const hauntValueEl = $('#haunt-value')
  const fill = $('#haunt-fill')
  hauntValueEl.textContent = total
  const pct = Math.min(100, Math.round(total * 2))
  fill.style.width = pct + '%'
}

function saveLayout(){
  const items = $all('[data-furn-id]').map(it=>{
    return {id: it.dataset.furnId || it.getAttribute('data-furn-id') || it.dataset.furnId, instanceId: it.dataset.instanceId || it.getAttribute('data-instance-id') || '', haunt: Number(it.dataset.haunt||0), left: it.style.left || '', top: it.style.top || '', width: it.style.width || ''}
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
        // pass instanceId through so restored elements keep their identity
        placeAssetAt({id:it.id,haunt:it.haunt, width: it.width || '', instanceId: it.instanceId || ''}, left, top)
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

// --- selection and resize controls (created lazily) ---
let selectedItem = null
let resizeControls = null

function createResizeControls(overlay){
  if(resizeControls) return
  const wrap = document.createElement('div')
  wrap.className = 'resize-controls'
  wrap.style.position = 'absolute'
  wrap.style.display = 'none'
  wrap.style.zIndex = 120

  const inc = document.createElement('button')
  inc.className = 'resize-btn inc'
  inc.textContent = '+'
  inc.title = 'Büyüt'
  inc.addEventListener('click', (e)=>{ e.stopPropagation(); adjustSelectedWidth(1.12) })

  const dec = document.createElement('button')
  dec.className = 'resize-btn dec'
  dec.textContent = '−'
  dec.title = 'Küçült'
  dec.addEventListener('click', (e)=>{ e.stopPropagation(); adjustSelectedWidth(0.88) })

  wrap.appendChild(inc)
  wrap.appendChild(dec)
  overlay.appendChild(wrap)
  resizeControls = wrap
}

function selectPlacedItem(el){
  if(!el) return
  const overlay = $('#overlay')
  if(!resizeControls) createResizeControls(overlay)
  if(selectedItem === el) return
  deselectPlacedItem()
  selectedItem = el
  el.classList.add('selected')
  updateResizeControlsPosition()
  resizeControls.style.display = 'flex'
}

function deselectPlacedItem(){
  if(!selectedItem) return
  selectedItem.classList.remove('selected')
  selectedItem = null
  if(resizeControls) resizeControls.style.display = 'none'
}

function updateResizeControlsPosition(){
  if(!selectedItem || !resizeControls) return
  const overlay = $('#overlay')
  const rect = selectedItem.getBoundingClientRect()
  const orect = overlay.getBoundingClientRect()
  // preferred position: top-right of the selected image
  let left = (rect.right - orect.left) + 8
  let top = (rect.top - orect.top) - 8
  // clamp inside overlay bounds
  const wrapW = resizeControls.offsetWidth || 80
  const wrapH = resizeControls.offsetHeight || 40
  const maxLeft = Math.max(4, overlay.clientWidth - wrapW - 4)
  const maxTop = Math.max(4, overlay.clientHeight - wrapH - 4)
  left = Math.min(Math.max(4, left), maxLeft)
  top = Math.min(Math.max(4, top), maxTop)
  resizeControls.style.left = left + 'px'
  resizeControls.style.top = top + 'px'
}

function adjustSelectedWidth(factor){
  if(!selectedItem) return
  const cur = parseFloat(getComputedStyle(selectedItem).width) || selectedItem.naturalWidth || 40
  const nw = Math.max(16, Math.round(cur * factor))
  selectedItem.style.width = nw + 'px'
  updateResizeControlsPosition()
  saveLayout()
}

window.addEventListener('resize', ()=>{ if(selectedItem) updateResizeControlsPosition() })
window.addEventListener('scroll', ()=>{ if(selectedItem) updateResizeControlsPosition() })

// hide resize controls when clicking anywhere outside the selected item or the controls
document.addEventListener('click', (e)=>{
  if(!selectedItem) return
  if(resizeControls && (resizeControls.contains(e.target) || selectedItem.contains(e.target))) return
  deselectPlacedItem()
})
