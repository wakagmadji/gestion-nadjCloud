/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

const API = "http://192.168.43.183:8000";

type FileItem = { id:string; name:string; type:"file"; ext:string; size:string; storage_path:string; modified:string; parentId:string|null; };
type FolderItem = { id:string; name:string; type:"folder"; parentId:string|null; isOpen:boolean; };
type Item = FileItem | FolderItem;

const EXT_ICON: Record<string,string> = { pdf:"📄",png:"🖼️",jpg:"🖼️",jpeg:"🖼️",mp4:"🎬",mp3:"🎵",zip:"🗜️",doc:"📝",docx:"📝",xls:"📊",xlsx:"📊",js:"⚡",ts:"⚡",jsx:"⚛️",tsx:"⚛️",json:"📋",txt:"📃",default:"📁" };
const fileIcon = (ext?:string) => EXT_ICON[ext?.toLowerCase()??""] ?? EXT_ICON.default;
const formatSize = (b:number) => b<1024?`${b} B`:b<1024*1024?`${(b/1024).toFixed(1)} KB`:`${(b/1024/1024).toFixed(1)} MB`;
const formatDate = (iso:string) => new Date(iso).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});

const Modal = ({title,onClose,onConfirm,confirmLabel="Confirmer",confirmDanger=false,children}:{title:string;onClose:()=>void;onConfirm:()=>void;confirmLabel?:string;confirmDanger?:boolean;children:React.ReactNode}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(10,10,20,0.75)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:"16px"}}
    onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:16,padding:"24px",width:"100%",maxWidth:440,boxShadow:"0 24px 60px rgba(0,0,0,0.5)"}}>
      <h3 style={{margin:"0 0 20px",fontSize:17,color:"var(--text)",fontFamily:"var(--font-display)"}}>{title}</h3>
      {children}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:24}}>
        <button className="btn-ghost" onClick={onClose}>Annuler</button>
        <button className={confirmDanger?"btn-danger":"btn-primary"} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

const StatCard = ({icon,label,value,color}:{icon:string;label:string;value:string|number;color:string}) => (
  <div className="stat-card" style={{"--accent":color} as any}>
    <div className="stat-icon">{icon}</div>
    <div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>
  </div>
);

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [modal, setModal] = useState<null|{type:"newFolder"|"uploadFile"|"deleteFolder"|"deleteFile";targetId?:string|null}>(null);
  const [inputVal, setInputVal] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [section, setSection] = useState<"dashboard"|"files"|"profile"|"settings"|"trash">("dashboard");
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null);
  const [pendingFile, setPendingFile] = useState<File|null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg:string,ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  const loadData = async () => {
    setLoading(true);
    try {
      const [fr,fir] = await Promise.all([fetch(`${API}/folders`),fetch(`${API}/files`)]);
      const fd = await fr.json(); const fid = await fir.json();
      setItems([
        ...fd.map((f:any)=>({id:f.id,name:f.name,type:"folder",parentId:f.parent_id??null,isOpen:false})),
        ...fid.map((f:any)=>({id:f.id,name:f.name,type:"file",ext:f.ext??f.name.split(".").pop()??"txt",size:formatSize(f.size??0),storage_path:f.storage_path,modified:formatDate(f.created_at),parentId:f.folder_id??null})),
      ]);
    } catch { showToast("Impossible de contacter FastAPI",false); }
    setLoading(false);
  };

  useEffect(()=>{loadData();},[]);

  const files = useMemo(()=>items.filter(i=>i.type==="file") as FileItem[],[items]);
  const folders = useMemo(()=>items.filter(i=>i.type==="folder") as FolderItem[],[items]);
  const getChildren = useCallback((pid:string|null)=>items.filter(i=>i.parentId===pid),[items]);
  const toggleFolder = (id:string) => setItems(p=>p.map(i=>i.id===id&&i.type==="folder"?{...i,isOpen:!(i as FolderItem).isOpen}:i));
  const openModal = (type:any,targetId:string|null=null)=>{setInputVal("");setPendingFile(null);setModal({type,targetId});};
  const closeModal = ()=>{setModal(null);setPendingFile(null);};

  const createFolder = async()=>{
    const name=inputVal.trim()||"Nouveau dossier";
    const res=await fetch(`${API}/folders`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,parent_id:selectedId})});
    if(!res.ok){showToast("Erreur création dossier",false);return;}
    const d=await res.json();
    setItems(p=>[...p,{id:d.id,name:d.name,type:"folder",parentId:d.parent_id??null,isOpen:false}]);
    showToast(`Dossier "${name}" créé ✓`);
  };

  const uploadFile = async()=>{
    if(!pendingFile){showToast("Aucun fichier sélectionné",false);return;}
    setUploading(true);
    const fd=new FormData(); fd.append("file",pendingFile);
    const url=selectedId?`${API}/files/upload?folder_id=${selectedId}`:`${API}/files/upload`;
    const res=await fetch(url,{method:"POST",body:fd});
    if(!res.ok){showToast("Erreur upload",false);setUploading(false);return;}
    const d=await res.json();
    setItems(p=>[...p,{id:d.id,name:d.name,type:"file",ext:d.ext??d.name.split(".").pop()??"txt",size:formatSize(d.size),storage_path:d.storage_path,modified:formatDate(d.created_at),parentId:d.folder_id??null}]);
    showToast(`"${pendingFile.name}" téléversé ✓`);
    setUploading(false);
  };

  const deleteFolder = async(id:string)=>{
    const res=await fetch(`${API}/folders/${id}`,{method:"DELETE"});
    if(!res.ok){showToast("Erreur suppression",false);return;}
    await loadData(); if(selectedId===id)setSelectedId(null); showToast("Dossier supprimé");
  };

  const deleteFile = async(id:string)=>{
    const res=await fetch(`${API}/files/${id}`,{method:"DELETE"});
    if(!res.ok){showToast("Erreur suppression",false);return;}
    setItems(p=>p.filter(i=>i.id!==id)); showToast("Fichier supprimé");
  };

  const downloadFile = (file:FileItem)=>window.open(`${API}/uploads/${file.storage_path}`,"_blank");

  const confirmModal = async()=>{
    if(!modal)return; closeModal();
    if(modal.type==="newFolder") await createFolder();
    else if(modal.type==="uploadFile") await uploadFile();
    else if(modal.type==="deleteFolder"&&modal.targetId) await deleteFolder(modal.targetId);
    else if(modal.type==="deleteFile"&&modal.targetId) await deleteFile(modal.targetId);
  };

  const displayFiles = useMemo(()=>{
    let l=files;
    if(selectedId){const s=items.find(i=>i.id===selectedId);if(s?.type==="folder")l=files.filter(f=>f.parentId===selectedId);}
    if(searchQuery)l=l.filter(f=>f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return l;
  },[files,selectedId,searchQuery,items]);

  const displayFolders = useMemo(()=>{
    let l=folders;
    if(selectedId){const s=items.find(i=>i.id===selectedId);if(s?.type==="folder")l=folders.filter(f=>f.parentId===selectedId);}
    return l;
  },[folders,selectedId,items]);

  const totalSize = useMemo(()=>files.reduce((a,f)=>a+parseFloat(f.size),0).toFixed(1),[files]);

  const navigate = (s: typeof section) => { setSection(s); setSidebarOpen(false); };

  const TreeNode = ({item,depth=0}:{item:Item;depth?:number})=>{
    const ch=getChildren(item.id); const isF=item.type==="folder";
    return (
      <div>
        <div className={`tree-node ${selectedId===item.id?"tree-selected":""}`} style={{paddingLeft:12+depth*14}}
          onClick={()=>{setSelectedId(item.id);if(isF)toggleFolder(item.id);}}>
          <span style={{fontSize:11,width:12,display:"inline-block"}}>{isF?((item as FolderItem).isOpen?"▾":"▸"):""}</span>
          <span style={{marginRight:5}}>{isF?"📂":fileIcon((item as FileItem).ext)}</span>
          <span className="tree-label">{item.name}</span>
          <div className="tree-actions">
            <button className="icon-btn" onClick={e=>{e.stopPropagation();openModal(isF?"deleteFolder":"deleteFile",item.id);}}>🗑</button>
          </div>
        </div>
        {isF&&(item as FolderItem).isOpen&&ch.map(c=><TreeNode key={c.id} item={c} depth={depth+1}/>)}
      </div>
    );
  };

  const NAV = [
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"files",icon:"🗂",label:"Fichiers"},
    {id:"profile",icon:"👤",label:"Profil"},
    {id:"settings",icon:"⚙️",label:"Paramètres"},
    {id:"trash",icon:"🗑",label:"Corbeille"},
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0d0f14;--sidebar:#12151c;--card:#181b24;--card2:#1e2230;--border:rgba(255,255,255,0.07);--text:#e8eaf0;--muted:#7a7f96;--accent:#5b9cf6;--accent2:#a78bfa;--green:#34d399;--orange:#fb923c;--font-display:'Syne',sans-serif;--font-body:'DM Sans',sans-serif;--bottom-nav:60px}
        body{background:var(--bg);color:var(--text);font-family:var(--font-body)}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}
        @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:none}}

        /* ── Layout ── */
        .layout{display:flex;height:100vh;overflow:hidden}

        /* ── Sidebar desktop ── */
        .sidebar{width:256px;flex-shrink:0;background:var(--sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;transition:transform .25s}
        .sidebar-logo{padding:18px 20px 14px;font-family:var(--font-display);font-size:17px;font-weight:800;letter-spacing:-0.5px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)}
        .logo-dot{width:9px;height:9px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2))}
        .sidebar-nav{display:flex;flex-direction:column;gap:2px;padding:10px 8px;border-bottom:1px solid var(--border)}
        .nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted);transition:all .15s;background:none;border:none;width:100%;text-align:left}
        .nav-item:hover{color:var(--text);background:rgba(255,255,255,.05)}
        .nav-item.active{color:var(--text);background:rgba(91,156,246,.15)}
        .sidebar-files{flex:1;overflow-y:auto;padding:8px 6px}
        .sidebar-files::-webkit-scrollbar{width:3px}
        .sidebar-files::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
        .sidebar-section-title{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);padding:8px 12px 4px}
        .tree-node{display:flex;align-items:center;padding:6px 8px;border-radius:7px;cursor:pointer;font-size:12px;transition:background .12s;gap:2px}
        .tree-node:hover{background:rgba(255,255,255,.05)}
        .tree-node:hover .tree-actions{opacity:1}
        .tree-selected{background:rgba(91,156,246,.15)!important;color:var(--accent)}
        .tree-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tree-actions{opacity:0;transition:opacity .1s;display:flex;gap:2px}
        .icon-btn{background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;opacity:.6;transition:opacity .1s,background .1s}
        .icon-btn:hover{opacity:1;background:rgba(255,255,255,.1)}
        .sidebar-add-btns{display:flex;gap:6px;padding:10px;border-top:1px solid var(--border)}
        .sidebar-bottom{border-top:1px solid var(--border);padding:12px}
        .user-card{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background .15s}
        .user-card:hover{background:rgba(255,255,255,.05)}
        .avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0}
        .user-name{font-size:13px;font-weight:600}
        .user-role{font-size:11px;color:var(--muted)}

        /* ── Main ── */
        .main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
        .topbar{display:flex;align-items:center;padding:12px 20px;border-bottom:1px solid var(--border);gap:12px;flex-shrink:0}
        .page-title{font-family:var(--font-display);font-size:18px;font-weight:700;flex:1;white-space:nowrap}
        .search-wrap{position:relative;flex:1;max-width:320px}
        .search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:13px}
        .search-input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font-body);font-size:13px;padding:8px 12px 8px 32px;outline:none;transition:border .15s}
        .search-input:focus{border-color:var(--accent)}
        .search-input::placeholder{color:var(--muted)}
        .content{flex:1;overflow-y:auto;padding:20px}
        .content::-webkit-scrollbar{width:5px}
        .content::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}

        /* ── Stats ── */
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
        .stat-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px;transition:transform .15s,border-color .15s;animation:fadeIn .3s ease both}
        .stat-card:hover{transform:translateY(-2px);border-color:var(--accent)}
        .stat-icon{width:42px;height:42px;border-radius:10px;background:color-mix(in srgb,var(--accent) 15%,transparent);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
        .stat-value{font-family:var(--font-display);font-size:22px;font-weight:700}
        .stat-label{font-size:11px;color:var(--muted);margin-top:2px}

        /* ── Cards ── */
        .section-title{font-family:var(--font-display);font-size:14px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px}
        .section-badge{background:var(--card2);color:var(--muted);font-family:var(--font-body);font-size:10px;font-weight:500;padding:2px 7px;border-radius:99px}
        .recent-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}
        .recent-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px}
        .activity-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px}
        .activity-item:last-child{border-bottom:none}

        /* ── Table ── */
        .table-wrap{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;position:relative}
        .table-toolbar{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);gap:10px;flex-wrap:wrap}
        table{width:100%;border-collapse:collapse}
        thead tr{border-bottom:1px solid var(--border)}
        th{text-align:left;padding:9px 14px;font-size:10px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:var(--muted)}
        td{padding:11px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
        tbody tr{transition:background .1s}
        tbody tr:hover{background:rgba(255,255,255,.03)}
        tbody tr:last-child td{border-bottom:none}
        .file-name-cell{display:flex;align-items:center;gap:9px}
        .file-icon-box{width:30px;height:30px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
        .ext-badge{display:inline-block;padding:2px 7px;border-radius:99px;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:var(--card2);color:var(--muted)}

        /* ── Folders grid ── */
        .folders-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px}
        .folder-card{background:var(--card);border:1px solid var(--border);border-radius:11px;padding:14px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:7px;position:relative}
        .folder-card:hover{border-color:var(--accent2);transform:translateY(-2px)}
        .folder-card.sel{border-color:var(--accent);background:rgba(91,156,246,.08)}
        .folder-icon{font-size:26px}
        .folder-name{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .folder-count{font-size:10px;color:var(--muted)}
        .folder-del{position:absolute;top:7px;right:7px;opacity:0;transition:opacity .1s}
        .folder-card:hover .folder-del{opacity:1}

        /* ── File cards (mobile) ── */
        .file-cards{display:none;flex-direction:column;gap:8px}
        .file-card{background:var(--card);border:1px solid var(--border);border-radius:11px;padding:14px;display:flex;align-items:center;gap:12px}
        .file-card-info{flex:1;min-width:0}
        .file-card-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .file-card-meta{font-size:11px;color:var(--muted);margin-top:3px}
        .file-card-actions{display:flex;gap:6px;flex-shrink:0}

        /* ── Buttons ── */
        .btn-primary{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s,transform .1s;white-space:nowrap}
        .btn-primary:hover{opacity:.85}
        .btn-primary:active{transform:scale(.97)}
        .btn-primary:disabled{opacity:.5;cursor:not-allowed}
        .btn-secondary{background:var(--card2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px 14px;font-family:var(--font-body);font-size:13px;font-weight:500;cursor:pointer;transition:background .15s;display:flex;align-items:center;gap:6px;white-space:nowrap}
        .btn-secondary:hover{background:rgba(255,255,255,.08)}
        .btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:8px;padding:8px 14px;font-family:var(--font-body);font-size:13px;cursor:pointer;transition:color .15s}
        .btn-ghost:hover{color:var(--text)}
        .btn-danger{background:rgba(239,68,68,.2);color:#f87171;border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:8px 14px;font-family:var(--font-body);font-size:13px;cursor:pointer}
        .btn-danger:hover{background:rgba(239,68,68,.3)}
        .btn-icon{background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;cursor:pointer;font-size:15px;line-height:1;transition:background .15s}
        .btn-icon:hover{background:rgba(255,255,255,.08)}

        input[type=text]{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--font-body);font-size:14px;padding:10px 14px;outline:none;transition:border .15s}
        input[type=text]:focus{border-color:var(--accent)}
        input[type=text]::placeholder{color:var(--muted)}

        .upload-zone{border:2px dashed var(--border);border-radius:12px;padding:32px 20px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;user-select:none}
        .upload-zone:hover,.upload-zone.drag{border-color:var(--accent);background:rgba(91,156,246,.06)}
        .upload-zone.has-file{border-color:var(--green);background:rgba(52,211,153,.06)}

        .empty-state{text-align:center;padding:50px 20px;color:var(--muted)}
        .empty-state .emoji{font-size:38px;margin-bottom:10px}

        .breadcrumb{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);margin-bottom:16px;flex-wrap:wrap}
        .breadcrumb span{cursor:pointer;transition:color .1s}
        .breadcrumb span:hover{color:var(--text)}

        .settings-section{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px}
        .settings-row{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);font-size:13px;gap:12px}
        .settings-row:last-child{border-bottom:none}
        .settings-label{font-weight:500}
        .settings-sub{font-size:11px;color:var(--muted);margin-top:2px}
        .toggle{width:38px;height:20px;background:var(--accent);border-radius:99px;position:relative;cursor:pointer;flex-shrink:0}
        .toggle::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .2s}
        .toggle.off{background:var(--card2)}
        .toggle.off::after{left:calc(100% - 17px)}

        .profile-header{display:flex;align-items:center;gap:16px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px}
        .avatar-lg{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;font-family:var(--font-display);flex-shrink:0}

        .spinner{width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        .loading-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(13,15,20,.7);z-index:10;border-radius:12px}
        .toast{position:fixed;bottom:80px;right:16px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px 16px;font-size:13px;display:flex;align-items:center;gap:9px;box-shadow:0 8px 32px rgba(0,0,0,.4);animation:slideIn .2s ease;z-index:1000}

        /* ── Mobile bottom nav ── */
        .bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;height:var(--bottom-nav);background:var(--sidebar);border-top:1px solid var(--border);z-index:100;align-items:stretch}
        .bottom-nav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;font-size:10px;color:var(--muted);border:none;background:none;padding:6px 4px;transition:color .15s}
        .bottom-nav-item.active{color:var(--accent)}
        .bottom-nav-item span:first-child{font-size:18px}

        /* ── Mobile sidebar overlay ── */
        .sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;animation:fadeIn .2s ease}
        .sidebar-mobile{position:fixed;top:0;left:0;bottom:0;width:280px;background:var(--sidebar);z-index:201;display:flex;flex-direction:column;overflow:hidden;animation:slideUp .25s ease;transform:none}

        /* ── Hamburger ── */
        .hamburger{display:none;background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;color:var(--text);font-size:20px}
        .hamburger:hover{background:rgba(255,255,255,.08)}

        /* ── Responsive breakpoints ── */
        @media (max-width: 1024px) {
          .stats-grid{grid-template-columns:repeat(2,1fr)}
          .recent-grid{grid-template-columns:1fr}
        }

        @media (max-width: 768px) {
          .sidebar{display:none}
          .hamburger{display:flex;align-items:center;justify-content:center}
          .bottom-nav{display:flex}
          .content{padding:16px;padding-bottom:calc(var(--bottom-nav) + 16px)}
          .topbar{padding:10px 14px}
          .page-title{font-size:16px}
          .search-wrap{max-width:none}
          .stats-grid{grid-template-columns:repeat(2,1fr);gap:10px}
          .stat-card{padding:12px}
          .stat-value{font-size:18px}
          .recent-grid{grid-template-columns:1fr}
          /* Hide table on mobile, show cards */
          .files-table{display:none}
          .file-cards{display:flex}
          /* Hide some table columns */
          .col-type,.col-date{display:none}
          .table-toolbar{flex-direction:column;align-items:flex-start}
          .folders-grid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}
          .topbar-actions{display:none}
          .toast{bottom:calc(var(--bottom-nav) + 12px);right:12px;left:12px}
          .modal-inner{min-width:unset!important;width:100%}
        }

        @media (max-width: 480px) {
          .stats-grid{grid-template-columns:1fr 1fr}
          .stat-icon{width:36px;height:36px;font-size:17px}
          .profile-header{flex-direction:column;text-align:center}
        }
      `}</style>

      <div className="layout">
        {/* ── Sidebar desktop ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-dot"/>FileVault
            <span style={{marginLeft:"auto",fontSize:9,background:"rgba(91,156,246,.15)",color:"var(--accent)",padding:"2px 6px",borderRadius:99,fontFamily:"var(--font-body)",fontWeight:600}}>API</span>
          </div>
          <nav className="sidebar-nav">
            {[{id:"dashboard",icon:"📊",label:"Dashboard"},{id:"files",icon:"🗂",label:"Fichiers",badge:files.length},{id:"trash",icon:"🗑",label:"Corbeille"}].map(n=>(
              <button key={n.id} className={`nav-item ${section===n.id?"active":""}`} onClick={()=>navigate(n.id as any)}>
                <span>{n.icon}</span>{n.label}
                {"badge" in n&&<span style={{marginLeft:"auto",background:"var(--accent)",color:"#fff",fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:99}}>{n.badge}</span>}
              </button>
            ))}
          </nav>
          {section==="files"&&(
            <div className="sidebar-files">
              <div className="sidebar-section-title">Explorateur</div>
              {loading?<div style={{display:"flex",justifyContent:"center",padding:20}}><div className="spinner"/></div>
               :getChildren(null).length===0?<div style={{padding:"10px 12px",color:"var(--muted)",fontSize:12}}>Aucun élément</div>
               :getChildren(null).map(item=><TreeNode key={item.id} item={item} depth={0}/>)}
            </div>
          )}
          {section==="files"&&(
            <div className="sidebar-add-btns">
              <button className="btn-secondary" style={{flex:1,justifyContent:"center",fontSize:12}} onClick={()=>openModal("newFolder")}>📂 Dossier</button>
              <button className="btn-secondary" style={{flex:1,justifyContent:"center",fontSize:12}} onClick={()=>openModal("uploadFile")}>📤 Fichier</button>
            </div>
          )}
          <div className="sidebar-bottom">
            {[{id:"profile",icon:"👤",label:"Mon Profil"},{id:"settings",icon:"⚙️",label:"Paramètres"}].map(n=>(
              <button key={n.id} className={`nav-item ${section===n.id?"active":""}`} onClick={()=>navigate(n.id as any)}>
                <span>{n.icon}</span>{n.label}
              </button>
            ))}
            <div className="user-card" style={{marginTop:8}}>
              <div className="avatar">A</div>
              <div><div className="user-name">Administrateur</div><div className="user-role">FastAPI · MySQL</div></div>
            </div>
          </div>
        </aside>

        {/* ── Mobile sidebar overlay ── */}
        {sidebarOpen&&(
          <div className="sidebar-overlay" onClick={()=>setSidebarOpen(false)}>
            <div className="sidebar-mobile" onClick={e=>e.stopPropagation()}>
              <div className="sidebar-logo">
                <div className="logo-dot"/>FileVault
                <button className="btn-icon" style={{marginLeft:"auto",fontSize:16}} onClick={()=>setSidebarOpen(false)}>✕</button>
              </div>
              <nav className="sidebar-nav">
                {NAV.map(n=>(
                  <button key={n.id} className={`nav-item ${section===n.id?"active":""}`} onClick={()=>navigate(n.id as any)}>
                    <span>{n.icon}</span>{n.label}
                    {n.id==="files"&&<span style={{marginLeft:"auto",background:"var(--accent)",color:"#fff",fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:99}}>{files.length}</span>}
                  </button>
                ))}
              </nav>
              {section==="files"&&(
                <div className="sidebar-files">
                  <div className="sidebar-section-title">Explorateur</div>
                  {getChildren(null).map(item=><TreeNode key={item.id} item={item} depth={0}/>)}
                </div>
              )}
              {section==="files"&&(
                <div className="sidebar-add-btns">
                  <button className="btn-secondary" style={{flex:1,justifyContent:"center",fontSize:12}} onClick={()=>{openModal("newFolder");setSidebarOpen(false);}}>📂 Dossier</button>
                  <button className="btn-secondary" style={{flex:1,justifyContent:"center",fontSize:12}} onClick={()=>{openModal("uploadFile");setSidebarOpen(false);}}>📤 Fichier</button>
                </div>
              )}
              <div className="sidebar-bottom">
                <div className="user-card">
                  <div className="avatar">A</div>
                  <div><div className="user-name">Administrateur</div><div className="user-role">FastAPI · MySQL</div></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Main ── */}
        <main className="main">
          <header className="topbar">
            <button className="hamburger" onClick={()=>setSidebarOpen(true)}>☰</button>
            <div className="page-title">{{dashboard:"Dashboard",files:"Fichiers",profile:"Profil",settings:"Paramètres",trash:"Corbeille"}[section]}</div>
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input className="search-input" placeholder="Rechercher..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
            </div>
            {section==="files"&&(
              <div className="topbar-actions" style={{display:"flex",gap:8}}>
                <button className="btn-secondary" onClick={()=>openModal("newFolder")}>📂 Dossier</button>
                <button className="btn-primary" onClick={()=>openModal("uploadFile")}>📤 Téléverser</button>
              </div>
            )}
          </header>

          <div className="content">

            {/* Dashboard */}
            {section==="dashboard"&&(<>
              <div className="stats-grid">
                <StatCard icon="📄" label="Fichiers" value={files.length} color="var(--accent)"/>
                <StatCard icon="📂" label="Dossiers" value={folders.length} color="var(--accent2)"/>
                <StatCard icon="💾" label="Stockage" value={`${totalSize} MB`} color="var(--green)"/>
                <StatCard icon="🗂" label="Total" value={items.length} color="var(--orange)"/>
              </div>
              <div className="recent-grid">
                <div className="recent-card">
                  <div className="section-title">Fichiers récents <span className="section-badge">{files.slice(0,5).length}</span></div>
                  {files.slice(0,5).map(f=>(
                    <div className="activity-item" key={f.id}>
                      <span style={{fontSize:17}}>{fileIcon(f.ext)}</span>
                      <div style={{flex:1,minWidth:0}}><div style={{fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div><div style={{color:"var(--muted)",fontSize:11}}>{f.size}</div></div>
                      <span style={{color:"var(--muted)",fontSize:11,flexShrink:0}}>{f.modified}</span>
                    </div>
                  ))}
                  {files.length===0&&!loading&&<div className="empty-state" style={{padding:"20px 0"}}><div className="emoji">📭</div><p>Aucun fichier</p></div>}
                </div>
                <div className="recent-card">
                  <div className="section-title">Dossiers <span className="section-badge">{folders.length}</span></div>
                  {folders.slice(0,5).map(f=>(
                    <div className="activity-item" key={f.id}>
                      <span style={{fontSize:17}}>📂</span>
                      <div style={{flex:1,minWidth:0}}><div style={{fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div><div style={{color:"var(--muted)",fontSize:11}}>{items.filter(i=>i.parentId===f.id).length} élément(s)</div></div>
                      <button className="icon-btn" onClick={()=>{navigate("files");setSelectedId(f.id);}}>→</button>
                    </div>
                  ))}
                  {folders.length===0&&!loading&&<div className="empty-state" style={{padding:"20px 0"}}><div className="emoji">📂</div><p>Aucun dossier</p></div>}
                </div>
              </div>
              {files.length>0&&(
                <div className="recent-card">
                  <div className="section-title">Répartition par type</div>
                  {Object.entries(files.reduce((acc,f)=>{acc[f.ext]=(acc[f.ext]||0)+1;return acc;},{}as Record<string,number>)).sort((a,b)=>b[1]-a[1]).map(([ext,count])=>(
                    <div key={ext} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}>
                        <span>{fileIcon(ext)} .{ext}</span><span style={{color:"var(--muted)"}}>{count} fichier{count>1?"s":""}</span>
                      </div>
                      <div style={{height:4,borderRadius:99,background:"var(--card2)"}}>
                        <div style={{height:"100%",borderRadius:99,width:`${(count/files.length)*100}%`,background:"linear-gradient(90deg,var(--accent),var(--accent2))",transition:"width .5s"}}/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>)}

            {/* Files */}
            {section==="files"&&(<>
              {/* Mobile add buttons */}
              <div style={{display:"flex",gap:8,marginBottom:14}} className="mobile-add-btns">
                <button className="btn-secondary" style={{flex:1,justifyContent:"center"}} onClick={()=>openModal("newFolder")}>📂 Dossier</button>
                <button className="btn-primary" style={{flex:1}} onClick={()=>openModal("uploadFile")}>📤 Fichier</button>
              </div>
              <div className="breadcrumb">
                <span onClick={()=>setSelectedId(null)}>🏠 Accueil</span>
                {selectedId&&(()=>{
                  const sel=items.find(i=>i.id===selectedId);if(!sel)return null;
                  const trail:Item[]=[sel];let cur=sel.parentId;
                  while(cur){const p=items.find(i=>i.id===cur);if(!p)break;trail.unshift(p);cur=p.parentId;}
                  return trail.map((t,idx)=>(
                    <span key={t.id}><span style={{opacity:.4}}> › </span>
                    <span onClick={()=>setSelectedId(t.id)} style={idx===trail.length-1?{color:"var(--text)"}:{}}>{t.name}</span></span>
                  ));
                })()}
              </div>
              {displayFolders.length>0&&(<>
                <div className="section-title">📂 Sous-dossiers <span className="section-badge">{displayFolders.length}</span></div>
                <div className="folders-grid">
                  {displayFolders.map(f=>(
                    <div key={f.id} className={`folder-card ${selectedId===f.id?"sel":""}`} onClick={()=>{setSelectedId(f.id);toggleFolder(f.id);}}>
                      <span className="folder-icon">📂</span>
                      <div className="folder-name">{f.name}</div>
                      <div className="folder-count">{items.filter(i=>i.parentId===f.id).length} élément(s)</div>
                      <button className="icon-btn folder-del" onClick={e=>{e.stopPropagation();openModal("deleteFolder",f.id);}}>🗑</button>
                    </div>
                  ))}
                </div>
              </>)}

              {/* Desktop table */}
              <div className="table-wrap files-table">
                {loading&&<div className="loading-overlay"><div className="spinner" style={{width:30,height:30,borderWidth:3}}/></div>}
                <div className="table-toolbar">
                  <div className="section-title" style={{marginBottom:0}}>📄 Fichiers <span className="section-badge">{displayFiles.length}</span></div>
                </div>
                {displayFiles.length>0?(
                  <table>
                    <thead><tr><th>Nom</th><th className="col-type">Type</th><th>Taille</th><th className="col-date">Modifié</th><th>Actions</th></tr></thead>
                    <tbody>
                      {displayFiles.map(f=>(
                        <tr key={f.id}>
                          <td><div className="file-name-cell"><div className="file-icon-box">{fileIcon(f.ext)}</div><span style={{fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{f.name}</span></div></td>
                          <td className="col-type"><span className="ext-badge">{f.ext}</span></td>
                          <td style={{color:"var(--muted)"}}>{f.size}</td>
                          <td className="col-date" style={{color:"var(--muted)"}}>{f.modified}</td>
                          <td><div style={{display:"flex",gap:6}}>
                            <button className="btn-secondary" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>downloadFile(f)}>⬇</button>
                            <button className="btn-secondary" style={{fontSize:11,padding:"4px 10px",color:"#f87171"}} onClick={()=>openModal("deleteFile",f.id)}>🗑</button>
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ):!loading?(<div className="empty-state"><div className="emoji">📂</div><div style={{fontWeight:600}}>Aucun fichier</div><p>Téléversez un fichier pour commencer</p></div>):null}
              </div>

              {/* Mobile file cards */}
              <div className="file-cards">
                {displayFiles.length>0?(
                  displayFiles.map(f=>(
                    <div key={f.id} className="file-card">
                      <div className="file-icon-box" style={{width:40,height:40,fontSize:18}}>{fileIcon(f.ext)}</div>
                      <div className="file-card-info">
                        <div className="file-card-name">{f.name}</div>
                        <div className="file-card-meta">{f.size} · {f.modified}</div>
                      </div>
                      <div className="file-card-actions">
                        <button className="btn-icon" onClick={()=>downloadFile(f)}>⬇</button>
                        <button className="btn-icon" style={{color:"#f87171"}} onClick={()=>openModal("deleteFile",f.id)}>🗑</button>
                      </div>
                    </div>
                  ))
                ):(
                  <div className="empty-state"><div className="emoji">📂</div><div style={{fontWeight:600}}>Aucun fichier</div><p>Téléversez un fichier pour commencer</p></div>
                )}
              </div>
            </>)}

            {/* Profile */}
            {section==="profile"&&(<>
              <div className="profile-header">
                <div className="avatar-lg">A</div>
                <div>
                  <div style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:700}}>Administrateur</div>
                  <div style={{color:"var(--muted)",fontSize:13,marginTop:4}}>admin@filevault.io</div>
                  <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                    <span style={{background:"rgba(91,156,246,.15)",color:"var(--accent)",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99}}>Admin</span>
                    <span style={{background:"rgba(52,211,153,.15)",color:"var(--green)",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99}}>Actif</span>
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
                <StatCard icon="📄" label="Fichiers" value={files.length} color="var(--accent)"/>
                <StatCard icon="📂" label="Dossiers" value={folders.length} color="var(--accent2)"/>
                <StatCard icon="💾" label="Stockage" value={`${totalSize} MB`} color="var(--green)"/>
              </div>
            </>)}

            {/* Settings */}
            {section==="settings"&&(<>
              <div className="section-title" style={{marginBottom:12}}>Backend</div>
              <div className="settings-section">
                {[{label:"FastAPI",sub:"http://192.168.43.183:8000"},{label:"Base de données",sub:"MySQL · filevault"},{label:"Stockage",sub:"Dossier local · /backend/uploads"}].map((r,i)=>(
                  <div className="settings-row" key={i}>
                    <div><div className="settings-label">{r.label}</div><div className="settings-sub">{r.sub}</div></div>
                    <span style={{background:"rgba(52,211,153,.15)",color:"var(--green)",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99,flexShrink:0}}>Actif</span>
                  </div>
                ))}
              </div>
              <div className="section-title" style={{marginBottom:12}}>Préférences</div>
              <div className="settings-section">
                {[{label:"Mode sombre",sub:"Interface sombre activée",on:true},{label:"Notifications",sub:"Alertes sur les fichiers",on:true},{label:"Sauvegarde auto",sub:"Toutes les heures",on:false}].map((s,i)=>(
                  <div className="settings-row" key={i}>
                    <div><div className="settings-label">{s.label}</div><div className="settings-sub">{s.sub}</div></div>
                    <div className={`toggle ${s.on?"":"off"}`}/>
                  </div>
                ))}
              </div>
            </>)}

            {/* Trash */}
            {section==="trash"&&(
              <div className="empty-state"><div className="emoji">🗑️</div><div style={{fontWeight:600}}>Corbeille vide</div><p>Les fichiers supprimés apparaîtront ici</p></div>
            )}
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="bottom-nav">
        {NAV.map(n=>(
          <button key={n.id} className={`bottom-nav-item ${section===n.id?"active":""}`} onClick={()=>navigate(n.id as any)}>
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* Modals */}
      {modal&&(
        <Modal title={modal.type==="newFolder"?"Créer un dossier":modal.type==="uploadFile"?"Téléverser un fichier":modal.type==="deleteFolder"?"Supprimer le dossier":"Supprimer le fichier"}
          onClose={closeModal} onConfirm={confirmModal}
          confirmLabel={modal.type==="uploadFile"?(uploading?"Envoi...":"Téléverser"):modal.type==="deleteFolder"||modal.type==="deleteFile"?"Supprimer":"Créer"}
          confirmDanger={modal.type==="deleteFolder"||modal.type==="deleteFile"}>
          {modal.type==="newFolder"&&(
            <input type="text" autoFocus placeholder="Nom du dossier..." value={inputVal} onChange={e=>setInputVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&confirmModal()}/>
          )}
          {modal.type==="uploadFile"&&(
            <div>
              <div className={`upload-zone ${dragOver?"drag":""} ${pendingFile?"has-file":""}`}
                onClick={()=>fileInputRef.current?.click()}
                onDragOver={e=>{e.preventDefault();setDragOver(true);}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)setPendingFile(f);}}>
                <input type="file" ref={fileInputRef} style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)setPendingFile(f);}}/>
                {pendingFile?(
                  <div><div style={{fontSize:30,marginBottom:8}}>{fileIcon(pendingFile.name.split(".").pop())}</div>
                  <div style={{fontWeight:600,fontSize:13}}>{pendingFile.name}</div>
                  <div style={{color:"var(--muted)",fontSize:12,marginTop:4}}>{formatSize(pendingFile.size)}</div></div>
                ):(
                  <div><div style={{fontSize:34,marginBottom:10}}>📤</div>
                  <div style={{fontWeight:600}}>Glissez un fichier ici</div>
                  <div style={{color:"var(--muted)",fontSize:12,marginTop:4}}>ou appuyez pour parcourir</div></div>
                )}
              </div>
              {selectedId&&<div style={{marginTop:10,fontSize:12,color:"var(--muted)"}}>📂 Destination : {items.find(i=>i.id===selectedId)?.name??"Racine"}</div>}
            </div>
          )}
          {(modal.type==="deleteFolder"||modal.type==="deleteFile")&&(
            <p style={{color:"var(--muted)",fontSize:14,lineHeight:1.6}}>
              {modal.type==="deleteFolder"?"⚠️ Ce dossier et tout son contenu seront supprimés définitivement.":"Ce fichier sera supprimé définitivement du serveur."}
            </p>
          )}
        </Modal>
      )}

      {toast&&<div className="toast"><span>{toast.ok?"✅":"❌"}</span>{toast.msg}</div>}
    </>
  );
}
