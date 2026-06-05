import shutil
import base64
import json
from pathlib import Path
from io import BytesIO
from PIL import Image
from flask import Flask, jsonify, request, render_template_string

app = Flask(__name__)

REF_DIR      = Path(r"D:\시작\gympick\machine_card_image\기존 사진")
TARGET_DIR   = Path(r"D:\시작\gympick\machine_card_image\변경 대상")
OUTPUT_DIR   = Path(r"D:\시작\gympick\machine_card_image\변경 후")
NO_MATCH_DIR = Path(r"D:\시작\gympick\machine_card_image\일치항목 없음")
PROGRESS_FILE = Path(r"D:\시작\gympick\machine_card_image\matching_tool\progress.json")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
NO_MATCH_DIR.mkdir(parents=True, exist_ok=True)

def img_to_b64(path, size=(200, 200), fmt="WEBP"):
    img = Image.open(path).convert("RGB")
    img.thumbnail(size)
    buf = BytesIO()
    img.save(buf, format=fmt, quality=80)
    return base64.b64encode(buf.getvalue()).decode()

def extract_brand(name: str) -> str:
    parts = name.split("_")
    if len(parts) >= 3:
        return "_".join(parts[:-2])
    elif len(parts) == 2:
        return parts[0]
    return name

print("Loading reference thumbnails...")
ref_cards = []
for p in sorted(REF_DIR.glob("*.webp")):
    try:
        b64 = img_to_b64(p, size=(200, 200))
        brand = extract_brand(p.stem)
        ref_cards.append({"name": p.stem, "brand": brand, "b64": b64})
    except Exception as e:
        print(f"  [WARN] {p.name}: {e}")
print(f"Loaded {len(ref_cards)} reference cards\n")

seen = set()
all_brands = []
for c in ref_cards:
    if c["brand"] not in seen:
        seen.add(c["brand"])
        all_brands.append(c["brand"])

target_files = sorted(TARGET_DIR.glob("*.png"))

def load_progress():
    if PROGRESS_FILE.exists():
        try:
            with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            print(f"Resuming from progress.json (idx={data.get('idx',0)})")
            return {
                "idx":        data.get("idx", 0),
                "matched":    data.get("matched", 0),
                "skipped":    data.get("skipped", 0),
                "used_cards": set(data.get("used_cards", [])),
                "brand_order": data.get("brand_order", []),
                "history":    []
            }
        except Exception as e:
            print(f"  [WARN] Could not load progress.json: {e}")
    return {
        "idx": 0, "matched": 0, "skipped": 0,
        "used_cards": set(), "brand_order": [], "history": []
    }

def save_progress():
    data = {
        "idx":        state["idx"],
        "matched":    state["matched"],
        "skipped":    state["skipped"],
        "used_cards": list(state["used_cards"]),
        "brand_order": state["brand_order"]
    }
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

state = load_progress()

def get_brand_order():
    recent = [b for b in state["brand_order"] if b in seen]
    rest   = [b for b in all_brands if b not in set(recent)]
    return recent + rest

@app.route("/")
def index():
    return render_template_string(HTML)

@app.route("/api/state")
def api_state():
    idx   = state["idx"]
    total = len(target_files)
    if idx >= total:
        return jsonify({"done": True, "matched": state["matched"], "skipped": state["skipped"], "total": total})
    p   = target_files[idx]
    b64 = img_to_b64(p, size=(600, 600), fmt="PNG")
    return jsonify({
        "done": False, "idx": idx, "total": total,
        "matched": state["matched"], "skipped": state["skipped"],
        "remaining_cards": len(ref_cards) - len(state["used_cards"]),
        "target_name": p.name, "target_b64": b64
    })

@app.route("/api/cards")
def api_cards():
    available = [c for c in ref_cards if c["name"] not in state["used_cards"]]
    brands    = get_brand_order()
    return jsonify({"cards": available, "brands": brands})

@app.route("/api/match", methods=["POST"])
def api_match():
    idx = state["idx"]
    if idx >= len(target_files):
        return jsonify({"error": "done"})
    ref_name = request.json["ref_name"]
    src = target_files[idx]
    dst = OUTPUT_DIR / (ref_name + ".webp")
    Image.open(src).convert("RGB").save(dst, "WEBP", quality=90)
    brand = extract_brand(ref_name)
    if brand in state["brand_order"]:
        state["brand_order"].remove(brand)
    state["brand_order"].insert(0, brand)
    state["used_cards"].add(ref_name)
    state["history"].append(("match", src, dst, ref_name, brand))
    state["idx"] += 1
    state["matched"] += 1
    save_progress()
    return jsonify({"ok": True})

@app.route("/api/skip", methods=["POST"])
def api_skip():
    idx = state["idx"]
    if idx >= len(target_files):
        return jsonify({"error": "done"})
    src = target_files[idx]
    dst = NO_MATCH_DIR / src.name
    shutil.copy2(src, dst)
    state["history"].append(("skip", src, dst, None, None))
    state["idx"] += 1
    state["skipped"] += 1
    save_progress()
    return jsonify({"ok": True})

@app.route("/api/undo", methods=["POST"])
def api_undo():
    if not state["history"]:
        return jsonify({"error": "nothing to undo"})
    action, src, dst, ref_name, brand = state["history"].pop()
    if dst.exists():
        dst.unlink()
    if action == "match" and ref_name:
        state["used_cards"].discard(ref_name)
        if state["brand_order"] and state["brand_order"][0] == brand:
            state["brand_order"].pop(0)
        state["matched"] -= 1
    else:
        state["skipped"] -= 1
    state["idx"] -= 1
    save_progress()
    return jsonify({"ok": True})

HTML = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>GymPick 매칭 툴</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,sans-serif;background:#f0f0f0;color:#111;display:flex;flex-direction:column;height:100vh;overflow:hidden}
#header{background:#fff;border-bottom:1px solid #ddd;padding:10px 20px;display:flex;align-items:center;gap:14px;flex-shrink:0}
#header h1{font-size:14px;font-weight:600;white-space:nowrap}
.prog-bar{flex:1;height:5px;background:#e0e0e0;border-radius:3px;overflow:hidden}
.prog-fill{height:100%;background:#22c55e;transition:width 0.3s}
#stats{font-size:12px;color:#666;white-space:nowrap}
#top{background:#fff;border-bottom:1px solid #ddd;padding:12px 20px;display:flex;align-items:center;gap:16px;flex-shrink:0}
#target-wrap{width:210px;flex-shrink:0;text-align:center}
#target-img{width:190px;height:190px;object-fit:contain;border-radius:8px;background:#f5f5f5;border:1px solid #eee}
#target-name{font-size:11px;color:#888;margin-top:5px;word-break:break-all}
#top-right{flex:1;display:flex;flex-direction:column;gap:8px}
#search{width:100%;padding:7px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;outline:none}
#search:focus{border-color:#3b82f6}
#selected-info{font-size:13px;color:#555;min-height:18px}
#selected-info span{font-weight:600;color:#16a34a}
#actions{display:flex;gap:8px}
.btn{padding:7px 16px;border-radius:6px;border:1px solid #ddd;background:#f5f5f5;font-size:13px;font-weight:500;cursor:pointer}
.btn:hover{background:#e8e8e8}
.btn-confirm{background:#22c55e;color:#fff;border-color:#22c55e}
.btn-confirm:disabled{background:#ccc;border-color:#ccc;cursor:not-allowed}
.btn-confirm:hover:not(:disabled){background:#16a34a}
#shortcuts{font-size:11px;color:#aaa}
#brand-bar{background:#fff;border-bottom:1px solid #ddd;padding:8px 20px;display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0}
.brand-btn{padding:4px 12px;border-radius:20px;border:1px solid #ddd;background:#f5f5f5;font-size:12px;cursor:pointer;white-space:nowrap;transition:all 0.1s}
.brand-btn:hover{background:#e8e8e8;border-color:#bbb}
.brand-btn.active{background:#3b82f6;color:#fff;border-color:#3b82f6}
.brand-btn.recent{border-color:#f59e0b;background:#fffbeb}
.brand-btn.recent.active{background:#3b82f6;border-color:#3b82f6;color:#fff}
#grid-wrap{flex:1;overflow-y:auto;padding:10px 20px}
#grid-label{font-size:11px;color:#999;margin-bottom:8px}
#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.card{border:2px solid transparent;border-radius:8px;padding:5px;background:#fff;cursor:pointer;transition:border-color 0.1s}
.card:hover{border-color:#93c5fd}
.card.selected{border-color:#22c55e;background:#f0fdf4}
.card img{width:100%;aspect-ratio:1;object-fit:contain;border-radius:4px;background:#f9f9f9}
.card .cname{font-size:10px;color:#555;text-align:center;margin-top:4px;word-break:break-all;line-height:1.3}
#done{display:none;flex:1;align-items:center;justify-content:center;flex-direction:column;gap:12px}
#done h2{font-size:22px;font-weight:500}
#done p{font-size:14px;color:#666}
</style>
</head>
<body>
<div id="header">
  <h1>GymPick 이미지 매칭 툴</h1>
  <div class="prog-bar"><div class="prog-fill" id="prog"></div></div>
  <div id="stats">로딩 중...</div>
</div>
<div id="top">
  <div id="target-wrap">
    <img id="target-img" src="" alt="">
    <div id="target-name"></div>
  </div>
  <div id="top-right">
    <input id="search" type="text" placeholder="머신카드 검색 (예: CYBEX, CHEST, PRIME...)">
    <div id="selected-info">선택된 머신카드: <span id="sel-name">없음</span></div>
    <div id="actions">
      <button class="btn" onclick="undo()">↩ 되돌리기 (Z)</button>
      <button class="btn" onclick="skip()">건너뛰기 (S)</button>
      <button class="btn btn-confirm" id="btn-confirm" onclick="confirm_match()" disabled>확정 (Enter)</button>
    </div>
    <div id="shortcuts">단축키: Enter 확정 &nbsp;|&nbsp; S 건너뛰기 &nbsp;|&nbsp; Z 되돌리기</div>
  </div>
</div>
<div id="brand-bar"></div>
<div id="grid-wrap">
  <div id="grid-label"></div>
  <div id="grid"></div>
</div>
<div id="done">
  <h2>모두 완료!</h2>
  <p id="done-stats"></p>
</div>
<script>
let allCards=[],allBrands=[],selectedName=null,activeBrand=null;
async function loadCards(){const res=await fetch('/api/cards');const data=await res.json();allCards=data.cards;allBrands=data.brands;renderBrands();renderGrid(filteredCards());}
function filteredCards(){let cards=allCards;const q=document.getElementById('search').value.toLowerCase();if(activeBrand)cards=cards.filter(c=>c.brand===activeBrand);if(q)cards=cards.filter(c=>c.name.toLowerCase().includes(q));return cards;}
function renderBrands(){const bar=document.getElementById('brand-bar');bar.innerHTML='';const all=document.createElement('button');all.className='brand-btn'+(!activeBrand?' active':'');all.textContent='전체';all.onclick=()=>{activeBrand=null;renderBrands();renderGrid(filteredCards());};bar.appendChild(all);allBrands.forEach((b,i)=>{const btn=document.createElement('button');const isRecent=i<5&&activeBrand!==b;btn.className='brand-btn'+(activeBrand===b?' active':'')+(isRecent?' recent':'');btn.textContent=b;btn.onclick=()=>{activeBrand=(activeBrand===b)?null:b;document.getElementById('search').value='';renderBrands();renderGrid(filteredCards());};bar.appendChild(btn);});}
function renderGrid(cards){const grid=document.getElementById('grid');const label=document.getElementById('grid-label');label.textContent='남은 머신카드: '+allCards.length+'개'+(cards.length<allCards.length?'  (필터 결과: '+cards.length+'개)':'');grid.innerHTML='';cards.forEach(c=>{const div=document.createElement('div');div.className='card'+(c.name===selectedName?' selected':'');div.id='card-'+c.name;div.innerHTML='<img src="data:image/webp;base64,'+c.b64+'" loading="lazy"><div class="cname">'+c.name+'</div>';div.onclick=()=>selectCard(c.name);grid.appendChild(div);});}
function selectCard(name){if(selectedName){const prev=document.getElementById('card-'+selectedName);if(prev)prev.classList.remove('selected');}selectedName=name;const el=document.getElementById('card-'+name);if(el){el.classList.add('selected');el.scrollIntoView({block:'nearest'});}document.getElementById('sel-name').textContent=name;document.getElementById('btn-confirm').disabled=false;}
async function loadState(){const res=await fetch('/api/state');const d=await res.json();if(d.done){document.getElementById('top').style.display='none';document.getElementById('brand-bar').style.display='none';document.getElementById('grid-wrap').style.display='none';const doneEl=document.getElementById('done');doneEl.style.display='flex';document.getElementById('done-stats').textContent='매칭 성공 '+d.matched+'개  /  건너뜀 '+d.skipped+'개  /  전체 '+d.total+'개';return;}const pct=Math.round((d.idx/d.total)*100);document.getElementById('prog').style.width=pct+'%';document.getElementById('stats').textContent=d.idx+' / '+d.total+'  |  매칭 '+d.matched+'  건너뜀 '+d.skipped;document.getElementById('target-img').src='data:image/png;base64,'+d.target_b64;document.getElementById('target-name').textContent=d.target_name;selectedName=null;document.getElementById('sel-name').textContent='없음';document.getElementById('btn-confirm').disabled=true;}
async function confirm_match(){if(!selectedName)return;await fetch('/api/match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref_name:selectedName})});selectedName=null;await loadCards();await loadState();}
async function skip(){await fetch('/api/skip',{method:'POST'});await loadState();}
async function undo(){await fetch('/api/undo',{method:'POST'});await loadCards();await loadState();}
document.getElementById('search').addEventListener('input',()=>{activeBrand=null;renderBrands();renderGrid(filteredCards());});
document.addEventListener('keydown',e=>{if(e.target.id==='search')return;if(e.key==='Enter')confirm_match();if(e.key==='s'||e.key==='S')skip();if(e.key==='z'||e.key==='Z')undo();});
loadCards();loadState();
</script>
</body>
</html>"""

if __name__ == "__main__":
    print("서버 시작: http://localhost:5000")
    app.run(debug=False, port=5000)
