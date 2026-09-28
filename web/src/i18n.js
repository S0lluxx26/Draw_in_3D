import {vi,helpVi,showHelpVi} from './vi.js';
const KEY='draw3d-language-v1';
export function preferredLanguage(saved,browser='en'){return ['en','vi'].includes(saved)?saved:/^vi(?:-|$)/i.test(browser)?'vi':'en';}
let language='en';
try{language=preferredLanguage(globalThis.localStorage?.getItem(KEY),globalThis.navigator?.language);}catch{language=preferredLanguage(null,globalThis.navigator?.language);}
export const currentLanguage=()=>language;
export function translate(text,locale=language){
  if(locale!=='vi'||typeof text!=='string')return text;
  const source=text.trim();let result=Object.hasOwn(vi,source)?vi[source]:undefined;
  if(result===undefined){
    const shortcut=source.match(/^(.*?) (\((?:Ctrl\+|Shift\+|Alt\+)?[A-Za-z+]+\))$/);
    if(shortcut&&Object.hasOwn(vi,shortcut[1].trim()))result=vi[shortcut[1].trim()]+' '+shortcut[2];
    const count=source.match(/^(\d[\d,.]*) (drones|selected|objects|lines deleted|line deleted|lines erased|line erased)( \(legacy\))?$/);
    if(count)result=count[1]+' '+({drones:'drone',selected:'đã chọn',objects:'đối tượng','lines deleted':'nét đã xóa','line deleted':'nét đã xóa','lines erased':'nét đã tẩy','line erased':'nét đã tẩy'}[count[2]])+(count[3]?' (bản cũ)':'');
    const checkpoint=source.match(/^Tap Checkpoint (\d+) of (\d+)$/);if(checkpoint)result='Chạm điểm kiểm tra '+checkpoint[1]+' / '+checkpoint[2];
    const colour=source.match(/^Colour (#[a-f0-9]+)$/i);if(colour)result='Màu '+colour[1];
    const budget=source.match(/^([\d,.]+) points \/ 4,000 · (\d+) images \/ 6$/);if(budget)result=budget[1]+' điểm / 4.000 · '+budget[2]+' ảnh / 6';
    const plane=source.match(/^(WALL · Z|FLOOR · Y|SIDE · X|VIEW OFFSET)(.*)$/);if(plane)result=({'WALL · Z':'TƯỜNG · Z','FLOOR · Y':'SÀN · Y','SIDE · X':'BÊN · X','VIEW OFFSET':'ĐỘ LỆCH GÓC NHÌN'}[plane[1]])+plane[2];
    const lights=source.match(/^([\d,.]+) lights\. One canvas\. An open sky\.$/);
    if(lights)result=lights[1]+' ánh đèn. Một vùng vẽ. Bầu trời rộng mở.';
  }
  return result===undefined?text:text.replace(source,result);
}
// Translate rendered UI only. Keep a source per node/attribute so language switches
// are reversible, including labels that the editor replaces while running.
export function installLanguage(root=document.body){
  const helpSources=new WeakMap();
  const records=new WeakMap(),attributes=['title','aria-label','placeholder'];
  const skip=el=>!el||el.closest('script,style,textarea,kbd,[translate="no"]');
  function value(node,key,read,write){
    const actual=read();let states=records.get(node);if(!states){states=new Map();records.set(node,states);}
    let record=states.get(key);if(!record||actual!==record.rendered)record={source:actual};
    const next=translate(record.source);record.rendered=next;states.set(key,record);if(actual!==next)write(next);
  }
  function visit(node){
    if(node.nodeType===3){if(!skip(node.parentElement))value(node,'text',()=>node.data,v=>node.data=v);return;}
    if(node.nodeType!==1||skip(node))return;
    // Option values must not implicitly follow translated option text.
    if(node.tagName==='OPTION'&&!node.hasAttribute('value'))node.value=node.textContent;
    for(const attr of attributes)if(node.hasAttribute(attr))value(node,attr,()=>node.getAttribute(attr),v=>node.setAttribute(attr,v));
    if(node.matches('[data-language]'))return;
    for(const child of node.childNodes)visit(child);
  }
  const config={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes};
  const observer=new MutationObserver(mutations=>{
    observer.disconnect();
    const nodes=new Set();for(const m of mutations){if(m.type==='childList'){for(const n of m.addedNodes)nodes.add(n);}else nodes.add(m.target);}
    for(const node of nodes)if(node.isConnected)visit(node);
    observer.observe(root,config);
  });
  function apply(next){
    // No data writes, renderer restarts or page reloads are needed for a language change.
    observer.disconnect();language=next==='vi'?'vi':'en';
    document.documentElement.lang=language;document.title=translate('Draw in 3D · Studio');
    for(const [selector,translations] of [['#guide > p',helpVi],['#author-guide li, #author-guide > p',showHelpVi]]){
      root.querySelectorAll(selector).forEach((node,i)=>{if(!translations[i])return;if(!helpSources.has(node))helpSources.set(node,node.innerHTML);node.setAttribute('translate','no');node.innerHTML=language==='vi'?translations[i]:helpSources.get(node);});
    }
    visit(root);root.querySelectorAll('[data-language]').forEach(select=>select.value=language);
    observer.observe(root,config);document.dispatchEvent(new Event('languagechange'));
  }
  root.addEventListener('change',event=>{if(!event.target.matches('[data-language]'))return;apply(event.target.value);try{localStorage.setItem(KEY,language);}catch{}});
  apply(language);
  return {setLanguage:apply,disconnect:()=>observer.disconnect()};
}
