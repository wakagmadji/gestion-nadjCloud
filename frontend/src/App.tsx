/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  LayoutDashboard, FolderOpen, Folder, FileText, Trash2, Settings, User,
  Upload, Plus, Download, Search, ChevronRight, ChevronDown, Menu, X,
  File, FileImage, FileVideo, FileAudio, FileArchive, FileCode, FileSpreadsheet,
  HardDrive, Database, Server, CheckCircle, AlertCircle, Home, MoreVertical
} from "lucide-react";

const API = "http://192.168.43.183:8000";

type FileItem = { id:string; name:string; type:"file"; ext:string; size:string; storage_path:string; modified:string; parentId:string|null; };
type FolderItem = { id:string; name:string; type:"folder"; parentId:string|null; isOpen:boolean; };
type Item = FileItem | FolderItem;

const getFileIcon = (ext?: string) => {
  const e = ext?.toLowerCase() ?? "";
  const cls = "file-type-icon";
  if (["png","jpg","jpeg","gif","webp"].includes(e)) return <FileImage size={16} className={cls} style={{color:"#a78bfa"}}/>;
  if (["mp4","mov","avi","mkv"].includes(e)) return <FileVideo size={16} className={cls} style={{color:"#f87171"}}/>;
  if (["mp3","wav","ogg","flac"].includes(e)) return <FileAudio size={16} className={cls} style={{color:"#34d399"}}/>;
  if (["zip","rar","tar","gz"].includes(e)) return <FileArchive size={16} className={cls} style={{color:"#fb923c"}}/>;
  if (["js","ts","jsx","tsx","py","java","c","cpp","html","css","json"].includes(e)) return <FileCode size={16} className={cls} style={{color:"#5b9cf6"}}/>;
  if (["xls","xlsx","csv"].includes(e)) return <FileSpreadsheet size={16} className={cls} style={{color:"#34d399"}}/>;
  if (["pdf","doc","docx","txt"].includes(e)) return <FileText size={16} className={cls} style={{color:"#fbbf24"}}/>;
  return <File size={16} className={cls} style={{color:"var(--muted)"}}/>;
};

const formatSize = (b:number) => b<1024?`${b} B`:b<1024*1024?`${(b/1024).toFixed(1)} KB`:`${(b/1024/1024).toFixed(1)} MB`;
const formatDate = (iso:string) => new Date(iso).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});

// ─── Modal ────────────────────────────────────────────────────────────────────
const Modal = ({title,onClose,onConfirm,confirmLabel="Confirmer",confirmDanger=false,children}:{
  title:string;onClose:()=>void;onConfirm:()=>void;confirmLabel?:string;confirmDanger?:boolean;children:React.ReactNode;
}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(10,10,20,0.75)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:"16px"}}
    onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:16,padding:"24px",width:"100%",maxWidth:440,boxShadow:"0 24px 60px rgba(0,0,0,0.5)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h3 style={{fontSize:17,color:"var(--text)",fontFamily:"var(--font-display)",fontWeight:700}}>{title}</h3>
        <button className="icon-btn" onClick={onClose}><X size={16}/></button>
      </div>
      {children}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:24}}>
        <button className="btn-ghost" onClick={onClose}>Annuler</button>
        <button className={confirmDanger?"btn-danger":"btn-primary"} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

// ─── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = ({icon,label,value,color}:{icon:React.ReactNode;label:string;value:string|number;color:string}) => (
  <div className="stat-card" style={{"--accent":color} as any}>
    <div className="stat-icon">{icon}</div>
    <div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>
  </div>
);

// ─── App ──────────────────────────────────────────────────────────────────────
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
      const fd=await fr.json(); const fid=await fir.json();
      setItems([
        ...fd.map((f:any)=>({id:f.id,name:f.name,type:"folder",parentId:f.parent_id??null,isOpen:false})),
        ...fid.map((f:any)=>({id:f.id,name:f.name,type:"file",ext:f.ext??f.name.split(".").pop()??"txt",size:formatSize(f.size??0),storage_path:f.storage_path,modified:formatDate(f.created_at),parentId:f.folder_id??null})),
      ]);
    } catch { showToast("Impossible de contacter le serveur NadjCloud",false); }
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
  const navigate = (s:typeof section)=>{setSection(s);setSidebarOpen(false);};

  // ─── Tree Node ──
  const TreeNode = ({item,depth=0}:{item:Item;depth?:number})=>{
    const ch=getChildren(item.id); const isF=item.type==="folder";
    const fo=item as FolderItem;
    return (
      <div>
        <div className={`tree-node ${selectedId===item.id?"tree-selected":""}`}
          style={{paddingLeft:10+depth*14}}
          onClick={()=>{setSelectedId(item.id);if(isF)toggleFolder(item.id);}}>
          <span className="tree-chevron">
            {isF?(fo.isOpen?<ChevronDown size={12}/>:<ChevronRight size={12}/>):<span style={{width:12,display:"inline-block"}}/>}
          </span>
          <span className="tree-file-icon">
            {isF?<Folder size={14} style={{color:"#fbbf24"}}/>:getFileIcon((item as FileItem).ext)}
          </span>
          <span className="tree-label">{item.name}</span>
          <div className="tree-actions">
            <button className="icon-btn" onClick={e=>{e.stopPropagation();openModal(isF?"deleteFolder":"deleteFile",item.id);}}>
              <Trash2 size={12}/>
            </button>
          </div>
        </div>
        {isF&&fo.isOpen&&ch.map(c=><TreeNode key={c.id} item={c} depth={depth+1}/>)}
      </div>
    );
  };

  const NAV = [
    {id:"dashboard",icon:<LayoutDashboard size={18}/>,label:"Dashboard"},
    {id:"files",icon:<FolderOpen size={18}/>,label:"Fichiers"},
    {id:"profile",icon:<User size={18}/>,label:"Profil"},
    {id:"settings",icon:<Settings size={18}/>,label:"Paramètres"},
    {id:"trash",icon:<Trash2 size={18}/>,label:"Corbeille"},
  ];

  const SidebarContent = () => (
    <>
      <div className="sidebar-logo">
        <div className="logo-dot"/>
        <span>NadjCloud</span>
        <span className="api-pill">API</span>
      </div>
      <nav className="sidebar-nav">
        {[
          {id:"dashboard",icon:<LayoutDashboard size={16}/>,label:"Dashboard"},
          {id:"files",icon:<FolderOpen size={16}/>,label:"Fichiers",badge:files.length},
          {id:"trash",icon:<Trash2 size={16}/>,label:"Corbeille"},
        ].map(n=>(
          <button key={n.id} className={`nav-item ${section===n.id?"active":""}`} onClick={()=>navigate(n.id as any)}>
            <span className="nav-icon">{n.icon}</span>{n.label}
            {"badge" in n&&<span className="nav-badge">{n.badge}</span>}
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
          <button className="btn-secondary" style={{flex:1,justifyContent:"center",fontSize:12,gap:5}} onClick={()=>openModal("newFolder")}>
            <Plus size={13}/> Dossier
          </button>
          <button className="btn-secondary" style={{flex:1,justifyContent:"center",fontSize:12,gap:5}} onClick={()=>openModal("uploadFile")}>
            <Upload size={13}/> Fichier
          </button>
        </div>
      )}
      <div className="sidebar-bottom">
        {[{id:"profile",icon:<User size={16}/>,label:"Mon Profil"},{id:"settings",icon:<Settings size={16}/>,label:"Paramètres"}].map(n=>(
          <button key={n.id} className={`nav-item ${section===n.id?"active":""}`} onClick={()=>navigate(n.id as any)}>
            <span className="nav-icon">{n.icon}</span>{n.label}
          </button>
        ))}
        <div className="user-card" style={{marginTop:8}}>
          <div className="avatar">A</div>
          <div><div className="user-name">Administrateur</div><div className="user-role">NadjCloud · v1.0</div></div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0d0f14;--sidebar:#12151c;--card:#181b24;--card2:#1e2230;--border:rgba(255,255,255,0.07);--text:#e8eaf0;--muted:#7a7f96;--accent:#5b9cf6;--accent2:#a78bfa;--green:#34d399;--orange:#fb923c;--font-display:'Syne',sans-serif;--font-body:'DM Sans',sans-serif;--bottom-nav:62px}
        body{background:var(--bg);color:var(--text);font-family:var(--font-body)}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}

        .layout{display:flex;height:100vh;overflow:hidden}

        /* Sidebar */
        .sidebar{width:256px;flex-shrink:0;background:var(--sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
        .sidebar-logo{padding:18px 18px 14px;font-family:var(--font-display);font-size:17px;font-weight:800;letter-spacing:-0.5px;display:flex;align-items:center;gap:9px;border-bottom:1px solid var(--border)}
        .logo-dot{width:9px;height:9px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));flex-shrink:0}
        .api-pill{margin-left:auto;font-size:9px;background:rgba(91,156,246,.15);color:var(--accent);padding:2px 7px;border-radius:99px;font-family:var(--font-body);font-weight:700;letter-spacing:.5px}
        .sidebar-nav{display:flex;flex-direction:column;gap:2px;padding:10px 8px;border-bottom:1px solid var(--border)}
        .nav-item{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted);transition:all .15s;background:none;border:none;width:100%;text-align:left}
        .nav-item:hover{color:var(--text);background:rgba(255,255,255,.05)}
        .nav-item.active{color:var(--text);background:rgba(91,156,246,.15)}
        .nav-item.active .nav-icon{color:var(--accent)}
        .nav-icon{display:flex;align-items:center;flex-shrink:0}
        .nav-badge{margin-left:auto;background:var(--accent);color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:99px}
        .sidebar-files{flex:1;overflow-y:auto;padding:8px 6px}
        .sidebar-files::-webkit-scrollbar{width:3px}
        .sidebar-files::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
        .sidebar-section-title{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);padding:8px 11px 4px}
        .tree-node{display:flex;align-items:center;padding:5px 8px;border-radius:7px;cursor:pointer;font-size:12px;transition:background .12s;gap:4px}
        .tree-node:hover{background:rgba(255,255,255,.05)}
        .tree-node:hover .tree-actions{opacity:1}
        .tree-selected{background:rgba(91,156,246,.15)!important;color:var(--accent)}
        .tree-chevron{display:flex;align-items:center;color:var(--muted);flex-shrink:0}
        .tree-file-icon{display:flex;align-items:center;flex-shrink:0}
        .tree-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tree-actions{opacity:0;transition:opacity .1s;display:flex;gap:2px}
        .icon-btn{background:none;border:none;cursor:pointer;padding:4px;border-radius:5px;color:var(--muted);display:flex;align-items:center;justify-content:center;transition:color .1s,background .1s}
        .icon-btn:hover{color:var(--text);background:rgba(255,255,255,.1)}
        .sidebar-add-btns{display:flex;gap:6px;padding:10px;border-top:1px solid var(--border)}
        .sidebar-bottom{border-top:1px solid var(--border);padding:10px}
        .user-card{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background .15s}
        .user-card:hover{background:rgba(255,255,255,.05)}
        .avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0}
        .user-name{font-size:13px;font-weight:600}
        .user-role{font-size:11px;color:var(--muted)}

        /* Main */
        .main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
        .topbar{display:flex;align-items:center;padding:12px 20px;border-bottom:1px solid var(--border);gap:12px;flex-shrink:0}
        .page-title{font-family:var(--font-display);font-size:18px;font-weight:700;flex:1;white-space:nowrap}
        .search-wrap{position:relative;flex:1;max-width:320px}
        .search-icon-wrap{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted);display:flex}
        .search-input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font-body);font-size:13px;padding:8px 12px 8px 34px;outline:none;transition:border .15s}
        .search-input:focus{border-color:var(--accent)}
        .search-input::placeholder{color:var(--muted)}
        .content{flex:1;overflow-y:auto;padding:20px}
        .content::-webkit-scrollbar{width:5px}
        .content::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}

        /* Stats */
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
        .stat-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px;transition:transform .15s,border-color .15s;animation:fadeIn .3s ease both}
        .stat-card:hover{transform:translateY(-2px);border-color:var(--accent)}
        .stat-icon{width:42px;height:42px;border-radius:10px;background:color-mix(in srgb,var(--accent) 15%,transparent);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--accent)}
        .stat-value{font-family:var(--font-display);font-size:22px;font-weight:700}
        .stat-label{font-size:11px;color:var(--muted);margin-top:2px}

        .section-title{font-family:var(--font-display);font-size:14px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px}
        .section-badge{background:var(--card2);color:var(--muted);font-family:var(--font-body);font-size:10px;font-weight:500;padding:2px 7px;border-radius:99px}
        .recent-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px}
        .recent-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px}
        .activity-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px}
        .activity-item:last-child{border-bottom:none}

        /* Table */
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
        .file-icon-box{width:30px;height:30px;border-radius:7px;background:var(--card2);display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .ext-badge{display:inline-block;padding:2px 7px;border-radius:99px;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:var(--card2);color:var(--muted)}

        /* Folders */
        .folders-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px}
        .folder-card{background:var(--card);border:1px solid var(--border);border-radius:11px;padding:14px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:7px;position:relative}
        .folder-card:hover{border-color:var(--accent2);transform:translateY(-2px)}
        .folder-card.sel{border-color:var(--accent);background:rgba(91,156,246,.08)}
        .folder-icon-wrap{width:40px;height:40px;border-radius:10px;background:rgba(251,191,36,.1);display:flex;align-items:center;justify-content:center}
        .folder-name{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .folder-count{font-size:10px;color:var(--muted)}
        .folder-del{position:absolute;top:7px;right:7px;opacity:0;transition:opacity .1s}
        .folder-card:hover .folder-del{opacity:1}

        /* File cards mobile */
        .file-cards{display:none;flex-direction:column;gap:8px}
        .file-card{background:var(--card);border:1px solid var(--border);border-radius:11px;padding:13px;display:flex;align-items:center;gap:11px}
        .file-card-info{flex:1;min-width:0}
        .file-card-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .file-card-meta{font-size:11px;color:var(--muted);margin-top:3px;display:flex;align-items:center;gap:6px}

        /* Buttons */
        .btn-primary{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s,transform .1s;display:flex;align-items:center;gap:6px;white-space:nowrap}
        .btn-primary:hover{opacity:.85}
        .btn-primary:active{transform:scale(.97)}
        .btn-primary:disabled{opacity:.5;cursor:not-allowed}
        .btn-secondary{background:var(--card2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px 14px;font-family:var(--font-body);font-size:13px;font-weight:500;cursor:pointer;transition:background .15s;display:flex;align-items:center;gap:6px;white-space:nowrap}
        .btn-secondary:hover{background:rgba(255,255,255,.08)}
        .btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:8px;padding:8px 14px;font-family:var(--font-body);font-size:13px;cursor:pointer;transition:color .15s}
        .btn-ghost:hover{color:var(--text)}
        .btn-danger{background:rgba(239,68,68,.2);color:#f87171;border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:8px 14px;font-family:var(--font-body);font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px}
        .btn-danger:hover{background:rgba(239,68,68,.3)}
        .btn-icon{background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:7px 9px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text);transition:background .15s}
        .btn-icon:hover{background:rgba(255,255,255,.08)}

        input[type=text]{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--font-body);font-size:14px;padding:10px 14px;outline:none;transition:border .15s}
        input[type=text]:focus{border-color:var(--accent)}
        input[type=text]::placeholder{color:var(--muted)}

        .upload-zone{border:2px dashed var(--border);border-radius:12px;padding:32px 20px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;user-select:none}
        .upload-zone:hover,.upload-zone.drag{border-color:var(--accent);background:rgba(91,156,246,.06)}
        .upload-zone.has-file{border-color:var(--green);background:rgba(52,211,153,.06)}

        .empty-state{text-align:center;padding:50px 20px;color:var(--muted)}
        .empty-icon{margin-bottom:12px;opacity:.4}

        .breadcrumb{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);margin-bottom:16px;flex-wrap:wrap}
        .breadcrumb-item{cursor:pointer;transition:color .1s;display:flex;align-items:center;gap:4px}
        .breadcrumb-item:hover{color:var(--text)}

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
        .toast-icon{display:flex;align-items:center}

        /* Bottom nav */
        .bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;height:var(--bottom-nav);background:var(--sidebar);border-top:1px solid var(--border);z-index:100;align-items:stretch}
        .bottom-nav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;font-size:10px;color:var(--muted);border:none;background:none;padding:6px 4px;transition:color .15s}
        .bottom-nav-item.active{color:var(--accent)}
        .bottom-nav-item .nav-icon{display:flex}

        /* Mobile overlay */
        .sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200}
        .sidebar-mobile{position:fixed;top:0;left:0;bottom:0;width:280px;background:var(--sidebar);z-index:201;display:flex;flex-direction:column;overflow:hidden}

        .hamburger{display:none;background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;color:var(--text);align-items:center;justify-content:center}
        .hamburger:hover{background:rgba(255,255,255,.08)}

        .file-type-icon{flex-shrink:0}

        /* Responsive */
        @media (max-width:1024px){
          .stats-grid{grid-template-columns:repeat(2,1fr)}
          .recent-grid{grid-template-columns:1fr}
        }
        @media (max-width:768px){
          .sidebar{display:none}
          .hamburger{display:flex}
          .bottom-nav{display:flex}
          .content{padding:14px;padding-bottom:calc(var(--bottom-nav) + 14px)}
          .topbar{padding:10px 14px}
          .page-title{font-size:15px}
          .search-wrap{max-width:none}
          .stats-grid{grid-template-columns:repeat(2,1fr);gap:10px}
          .stat-card{padding:12px}
          .stat-value{font-size:18px}
          .recent-grid{grid-template-columns:1fr}
          .files-table{display:none}
          .file-cards{display:flex}
          .col-type,.col-date{display:none}
          .topbar-actions{display:none}
          .toast{bottom:calc(var(--bottom-nav) + 10px);right:12px;left:12px}
          .mobile-add-btns{display:flex!important}
        }
        @media (min-width:769px){
          .mobile-add-btns{display:none!important}
        }
        @media (max-width:480px){
          .stats-grid{grid-template-columns:1fr 1fr}
          .profile-header{flex-direction:column;text-align:center}
        }
      `}</style>

      <div className="layout">
        {/* Desktop Sidebar */}
        <aside className="sidebar"><SidebarContent/></aside>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen&&(
          <div className="sidebar-overlay" style={{display:"block"}} onClick={()=>setSidebarOpen(false)}>
            <div className="sidebar-mobile" onClick={e=>e.stopPropagation()}>
              <SidebarContent/>
            </div>
          </div>
        )}

        {/* Main */}
        <main className="main">
          <header className="topbar">
            <button className="hamburger" onClick={()=>setSidebarOpen(true)}><Menu size={20}/></button>
            <div className="page-title">{{dashboard:"Dashboard",files:"Fichiers",profile:"Profil",settings:"Paramètres",trash:"Corbeille"}[section]}</div>
            <div className="search-wrap">
              <span className="search-icon-wrap"><Search size={14}/></span>
              <input className="search-input" placeholder="Rechercher..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
            </div>
            {section==="files"&&(
              <div className="topbar-actions" style={{display:"flex",gap:8}}>
                <button className="btn-secondary" onClick={()=>openModal("newFolder")}><Plus size={14}/>Dossier</button>
                <button className="btn-primary" onClick={()=>openModal("uploadFile")}><Upload size={14}/>Téléverser</button>
              </div>
            )}
          </header>

          <div className="content">

            {/* Dashboard */}
            {section==="dashboard"&&(<>
              <div className="stats-grid">
                <StatCard icon={<FileText size={20}/>} label="Fichiers" value={files.length} color="var(--accent)"/>
                <StatCard icon={<Folder size={20}/>} label="Dossiers" value={folders.length} color="var(--accent2)"/>
                <StatCard icon={<HardDrive size={20}/>} label="Stockage" value={`${totalSize} MB`} color="var(--green)"/>
                <StatCard icon={<Database size={20}/>} label="Total" value={items.length} color="var(--orange)"/>
              </div>
              <div className="recent-grid">
                <div className="recent-card">
                  <div className="section-title"><FileText size={14}/>Fichiers récents<span className="section-badge">{files.slice(0,5).length}</span></div>
                  {files.slice(0,5).map(f=>(
                    <div className="activity-item" key={f.id}>
                      <div className="file-icon-box">{getFileIcon(f.ext)}</div>
                      <div style={{flex:1,minWidth:0}}><div style={{fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div><div style={{color:"var(--muted)",fontSize:11}}>{f.size}</div></div>
                      <span style={{color:"var(--muted)",fontSize:11,flexShrink:0}}>{f.modified}</span>
                    </div>
                  ))}
                  {files.length===0&&!loading&&<div className="empty-state"><div className="empty-icon"><FileText size={36}/></div><p>Aucun fichier</p></div>}
                </div>
                <div className="recent-card">
                  <div className="section-title"><Folder size={14}/>Dossiers<span className="section-badge">{folders.length}</span></div>
                  {folders.slice(0,5).map(f=>(
                    <div className="activity-item" key={f.id}>
                      <div className="file-icon-box"><Folder size={16} style={{color:"#fbbf24"}}/></div>
                      <div style={{flex:1,minWidth:0}}><div style={{fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div><div style={{color:"var(--muted)",fontSize:11}}>{items.filter(i=>i.parentId===f.id).length} élément(s)</div></div>
                      <button className="icon-btn" onClick={()=>{navigate("files");setSelectedId(f.id);}}><ChevronRight size={14}/></button>
                    </div>
                  ))}
                  {folders.length===0&&!loading&&<div className="empty-state"><div className="empty-icon"><Folder size={36}/></div><p>Aucun dossier</p></div>}
                </div>
              </div>
              {files.length>0&&(
                <div className="recent-card">
                  <div className="section-title"><HardDrive size={14}/>Répartition par type</div>
                  {Object.entries(files.reduce((acc,f)=>{acc[f.ext]=(acc[f.ext]||0)+1;return acc;},{}as Record<string,number>)).sort((a,b)=>b[1]-a[1]).map(([ext,count])=>(
                    <div key={ext} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5,alignItems:"center"}}>
                        <span style={{display:"flex",alignItems:"center",gap:6}}>{getFileIcon(ext)}<span>.{ext}</span></span>
                        <span style={{color:"var(--muted)"}}>{count} fichier{count>1?"s":""}</span>
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
              <div className="mobile-add-btns" style={{gap:8,marginBottom:14}}>
                <button className="btn-secondary" style={{flex:1,justifyContent:"center"}} onClick={()=>openModal("newFolder")}><Plus size={14}/>Dossier</button>
                <button className="btn-primary" style={{flex:1,justifyContent:"center"}} onClick={()=>openModal("uploadFile")}><Upload size={14}/>Fichier</button>
              </div>
              <div className="breadcrumb">
                <span className="breadcrumb-item" onClick={()=>setSelectedId(null)}><Home size={12}/><span>Accueil</span></span>
                {selectedId&&(()=>{
                  const sel=items.find(i=>i.id===selectedId);if(!sel)return null;
                  const trail:Item[]=[sel];let cur=sel.parentId;
                  while(cur){const p=items.find(i=>i.id===cur);if(!p)break;trail.unshift(p);cur=p.parentId;}
                  return trail.map((t,idx)=>(
                    <span key={t.id} style={{display:"flex",alignItems:"center",gap:4}}>
                      <ChevronRight size={11} style={{opacity:.4}}/>
                      <span className="breadcrumb-item" onClick={()=>setSelectedId(t.id)} style={idx===trail.length-1?{color:"var(--text)"}:{}}>{t.name}</span>
                    </span>
                  ));
                })()}
              </div>

              {displayFolders.length>0&&(<>
                <div className="section-title"><Folder size={14}/>Sous-dossiers<span className="section-badge">{displayFolders.length}</span></div>
                <div className="folders-grid">
                  {displayFolders.map(f=>(
                    <div key={f.id} className={`folder-card ${selectedId===f.id?"sel":""}`} onClick={()=>{setSelectedId(f.id);toggleFolder(f.id);}}>
                      <div className="folder-icon-wrap"><Folder size={20} style={{color:"#fbbf24"}}/></div>
                      <div className="folder-name">{f.name}</div>
                      <div className="folder-count">{items.filter(i=>i.parentId===f.id).length} élément(s)</div>
                      <button className="icon-btn folder-del" onClick={e=>{e.stopPropagation();openModal("deleteFolder",f.id);}}><Trash2 size={12}/></button>
                    </div>
                  ))}
                </div>
              </>)}

              {/* Desktop table */}
              <div className="table-wrap files-table">
                {loading&&<div className="loading-overlay"><div className="spinner" style={{width:30,height:30,borderWidth:3}}/></div>}
                <div className="table-toolbar">
                  <div className="section-title" style={{marginBottom:0}}><FileText size={14}/>Fichiers<span className="section-badge">{displayFiles.length}</span></div>
                </div>
                {displayFiles.length>0?(
                  <table>
                    <thead><tr><th>Nom</th><th className="col-type">Type</th><th>Taille</th><th className="col-date">Modifié</th><th>Actions</th></tr></thead>
                    <tbody>
                      {displayFiles.map(f=>(
                        <tr key={f.id}>
                          <td><div className="file-name-cell"><div className="file-icon-box">{getFileIcon(f.ext)}</div><span style={{fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{f.name}</span></div></td>
                          <td className="col-type"><span className="ext-badge">{f.ext}</span></td>
                          <td style={{color:"var(--muted)"}}>{f.size}</td>
                          <td className="col-date" style={{color:"var(--muted)"}}>{f.modified}</td>
                          <td><div style={{display:"flex",gap:6}}>
                            <button className="btn-icon" title="Télécharger" onClick={()=>downloadFile(f)}><Download size={14}/></button>
                            <button className="btn-icon" title="Supprimer" style={{color:"#f87171"}} onClick={()=>openModal("deleteFile",f.id)}><Trash2 size={14}/></button>
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ):!loading?(<div className="empty-state"><div className="empty-icon"><FileText size={40}/></div><div style={{fontWeight:600}}>Aucun fichier</div><p style={{fontSize:13,marginTop:4}}>Téléversez un fichier pour commencer</p></div>):null}
              </div>

              {/* Mobile file cards */}
              <div className="file-cards">
                {displayFiles.length>0?displayFiles.map(f=>(
                  <div key={f.id} className="file-card">
                    <div className="file-icon-box" style={{width:40,height:40}}>{getFileIcon(f.ext)}</div>
                    <div className="file-card-info">
                      <div className="file-card-name">{f.name}</div>
                      <div className="file-card-meta"><span>{f.size}</span><span>·</span><span>{f.modified}</span></div>
                    </div>
                    <button className="btn-icon" onClick={()=>downloadFile(f)}><Download size={15}/></button>
                    <button className="btn-icon" style={{color:"#f87171"}} onClick={()=>openModal("deleteFile",f.id)}><Trash2 size={15}/></button>
                  </div>
                )):(
                  <div className="empty-state"><div className="empty-icon"><FileText size={40}/></div><div style={{fontWeight:600}}>Aucun fichier</div></div>
                )}
              </div>
            </>)}

            {/* Profile */}
            {section==="profile"&&(<>
              <div className="profile-header">
                <div className="avatar-lg">A</div>
                <div>
                  <div style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:700}}>Administrateur</div>
                  <div style={{color:"var(--muted)",fontSize:13,marginTop:4}}>admin@nadjcloud.io</div>
                  <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                    <span style={{background:"rgba(91,156,246,.15)",color:"var(--accent)",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99}}>Admin</span>
                    <span style={{background:"rgba(52,211,153,.15)",color:"var(--green)",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99}}>Actif</span>
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
                <StatCard icon={<FileText size={20}/>} label="Fichiers" value={files.length} color="var(--accent)"/>
                <StatCard icon={<Folder size={20}/>} label="Dossiers" value={folders.length} color="var(--accent2)"/>
                <StatCard icon={<HardDrive size={20}/>} label="Stockage" value={`${totalSize} MB`} color="var(--green)"/>
              </div>
            </>)}

            {/* Settings */}
            {section==="settings"&&(<>
              <div className="section-title" style={{marginBottom:12}}><Server size={14}/>Backend</div>
              <div className="settings-section">
                {[{icon:<Server size={14}/>,label:"FastAPI",sub:"http://192.168.43.183:8000"},{icon:<Database size={14}/>,label:"MySQL",sub:"filevault"},{icon:<HardDrive size={14}/>,label:"Stockage",sub:"/backend/uploads"}].map((r,i)=>(
                  <div className="settings-row" key={i}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{color:"var(--muted)"}}>{r.icon}</span>
                      <div><div className="settings-label">{r.label}</div><div className="settings-sub">{r.sub}</div></div>
                    </div>
                    <span style={{background:"rgba(52,211,153,.15)",color:"var(--green)",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99,display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                      <CheckCircle size={10}/>Actif
                    </span>
                  </div>
                ))}
              </div>
              <div className="section-title" style={{marginBottom:12}}><Settings size={14}/>Préférences</div>
              <div className="settings-section">
                {[{label:"Mode sombre",sub:"Interface sombre",on:true},{label:"Notifications",sub:"Alertes fichiers",on:true},{label:"Sauvegarde auto",sub:"Toutes les heures",on:false}].map((s,i)=>(
                  <div className="settings-row" key={i}>
                    <div><div className="settings-label">{s.label}</div><div className="settings-sub">{s.sub}</div></div>
                    <div className={`toggle ${s.on?"":"off"}`}/>
                  </div>
                ))}
              </div>
            </>)}

            {/* Trash */}
            {section==="trash"&&(
              <div className="empty-state"><div className="empty-icon"><Trash2 size={48}/></div><div style={{fontWeight:600}}>Corbeille vide</div><p style={{fontSize:13,marginTop:4}}>Les fichiers supprimés apparaîtront ici</p></div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {NAV.map(n=>(
          <button key={n.id} className={`bottom-nav-item ${section===n.id?"active":""}`} onClick={()=>navigate(n.id as any)}>
            <span className="nav-icon">{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* Modals */}
      {modal&&(
        <Modal
          title={modal.type==="newFolder"?"Créer un dossier":modal.type==="uploadFile"?"Téléverser un fichier":modal.type==="deleteFolder"?"Supprimer le dossier":"Supprimer le fichier"}
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
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
                    <div style={{width:48,height:48,borderRadius:12,background:"var(--card2)",display:"flex",alignItems:"center",justifyContent:"center"}}>{getFileIcon(pendingFile.name.split(".").pop())}</div>
                    <div style={{fontWeight:600,fontSize:13}}>{pendingFile.name}</div>
                    <div style={{color:"var(--muted)",fontSize:12}}>{formatSize(pendingFile.size)}</div>
                  </div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
                    <Upload size={36} style={{color:"var(--muted)",opacity:.5}}/>
                    <div style={{fontWeight:600}}>Glissez un fichier ici</div>
                    <div style={{color:"var(--muted)",fontSize:12}}>ou appuyez pour parcourir</div>
                  </div>
                )}
              </div>
              {selectedId&&<div style={{marginTop:10,fontSize:12,color:"var(--muted)",display:"flex",alignItems:"center",gap:5}}><Folder size={12}/>{items.find(i=>i.id===selectedId)?.name??"Racine"}</div>}
            </div>
          )}
          {(modal.type==="deleteFolder"||modal.type==="deleteFile")&&(
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <AlertCircle size={20} style={{color:"#f87171",flexShrink:0,marginTop:1}}/>
              <p style={{color:"var(--muted)",fontSize:14,lineHeight:1.6}}>
                {modal.type==="deleteFolder"?"Ce dossier et tout son contenu seront supprimés définitivement.":"Ce fichier sera supprimé définitivement du serveur."}
              </p>
            </div>
          )}
        </Modal>
      )}

      {/* Toast */}
      {toast&&(
        <div className="toast">
          <span className="toast-icon">{toast.ok?<CheckCircle size={16} style={{color:"var(--green)"}}/>:<AlertCircle size={16} style={{color:"#f87171"}}/>}</span>
          {toast.msg}
        </div>
      )}
    </>
  );
}
