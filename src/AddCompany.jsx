import React,{useState}from'react';import*as XLSX from'xlsx';import{X,Upload,Globe2,Sparkles,LoaderCircle}from'lucide-react';
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
function parseWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result),
          worksheet = workbook.Sheets[workbook.SheetNames[0]],
          matrix = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
          }),
          headerIndex = matrix.findIndex(
            (row) => row.includes("Plan") && row.includes("Tier"),
          );
        if (headerIndex < 0)
          throw Error("Could not find Plan and Tier columns in the first worksheet");
        const headers = matrix[headerIndex].map((value) => String(value).trim()),
          rows = matrix.slice(headerIndex + 1).map((row) =>
            Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
          ),
          groups = [];
        let current = null;
        for (const row of rows) {
          const plan = String(row.Plan || "").trim(),
            tier = String(row.Tier || "").trim();
          if (/total/i.test(plan) || !tier) continue;
          if (plan) {
            current = {
              name: plan,
              year: Number(
                (plan.match(/20\d{2}/) || [new Date().getFullYear()])[0],
              ),
              tiers: [],
            };
            groups.push(current);
          }
          if (!current) continue;
          const premium = Number(
              String(row["Monthly Premium"] || 0).replace(/[$,]/g, ""),
            ),
            percentage = Number(
              String(row["ER %"] || 0).replace("%", ""),
            );
          current.tiers.push({
            tier: tier.replace(/^EE\+(?=\S)/, "EE + "),
            premium,
            erPercent: percentage > 1 ? percentage / 100 : percentage,
            enrolled: Number(row["# Enrolled"] || 0),
          });
        }
        const benefits = {};
        for (const plan of groups) {
          const type = /dental/i.test(plan.name)
            ? "dental"
            : /vision/i.test(plan.name)
              ? "vision"
              : "health";
          (benefits[type] ??= { years: [], plans: [] }).plans.push(plan);
          if (!benefits[type].years.includes(plan.year))
            benefits[type].years.push(plan.year);
        }
        if (!groups.length) throw Error("No plan rate rows were found in the workbook");
        resolve(benefits);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
export default function AddCompany({close,add}){const[url,setUrl]=useState(''),[renewal,setRenewal]=useState(''),[file,setFile]=useState(null),[profile,setProfile]=useState(null),[generating,setGenerating]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');let generate=async()=>{setGenerating(true);setProfile(null);setError('');try{let r=await fetch('/api/company-profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})}),j=await r.json();if(!r.ok)throw Error(j.error);setProfile(j)}catch(e){setError(e.message)}finally{setGenerating(false)}};let submit=async e=>{e.preventDefault();if(!profile)return setError('Generate company information before adding it');setSaving(true);setError('');try{let benefits=file?await parseWorkbook(file):{};await add({id:slug(profile.name),name:profile.name,website:profile.website||url,description:profile.description||'',industry:profile.industry||'',headquarters:profile.headquarters||'',employeeRange:profile.employeeRange||'',employeeCount:0,renewalDate:renewal||'2099-12-31',renewalLabel:renewal?new Date(`${renewal}T12:00:00`).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):'Not set',benefits});close()}catch(e){setError(e.message||'Could not add company')}finally{setSaving(false)}};return <div className="modalBackdrop"><form className="addModal" onSubmit={submit}><button type="button" className="modalClose" onClick={close}><X/></button><div className="modalHeading"><span><Sparkles/></span><div><h2>Add company</h2><p>Generate the company profile before it can be added.</p></div></div><label className="field">Company website<div><Globe2/><input required placeholder="https://company.com" value={url} onChange={e=>{setUrl(e.target.value);setProfile(null);setError('')}}/><button type="button" onClick={generate} disabled={generating||!url}>Generate info</button></div></label>{profile&&<div className="profilePreview"><b>{profile.name}</b><p>{profile.description}</p><span>{[profile.industry,profile.headquarters,profile.employeeRange].filter(Boolean).join(' · ')}</span></div>}<label className="field">Renewal date<input type="date" value={renewal} onChange={e=>setRenewal(e.target.value)}/></label><label className="upload"><Upload/><b>{file?file.name:'Upload benefit spreadsheet'}</b><span>Excel .xlsx or .xls · first worksheet</span><input type="file" accept=".xlsx,.xls" onChange={e=>setFile(e.target.files[0])}/></label>{error&&<p className="formError">{error}</p>}<div className="modalActions"><button type="button" className="outline" onClick={close}>Cancel</button><button className="primary" disabled={saving||!profile}>{saving?<LoaderCircle/>:'Add company'}</button></div>{generating&&<div className="generationLoading"><LoaderCircle/><b>Researching company website</b><span>Reading the site and generating a company profile…</span></div>}</form></div>}
