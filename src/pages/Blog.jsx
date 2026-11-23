import {useEffect,useMemo,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,BookOpen,Search,Sparkles} from 'lucide-react';
import {supabase} from '../lib/supabase';
import './blog.css';

const categories=['All','Document & Government','Meta & Social Media','SMM & Growth','Digital Subscriptions','Creative & Design','Travel Tips','Fun & Facts'];
const dateLabel=value=>value?new Date(value).toLocaleDateString('en-BD',{day:'numeric',month:'long',year:'numeric'}):'';
function ArticleBody({content=''}) {
 const normalized = String(content)
  .replace(/\\\\n/g, '\n')
  .replace(/\\n/g, '\n')
  .replace(/\\([*_#-])/g, '$1')
  .replace(/\*\*/g, '');
 const blocks = normalized.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean);
 const nodes = [];
 for (let i=0; i<blocks.length; i++) {
  const s=blocks[i];
  if (s.startsWith('## ')) nodes.push(<h2 key={i}>{s.slice(3)}</h2>);
  else if (s.startsWith('### ')) nodes.push(<h3 key={i}>{s.slice(4)}</h3>);
  else if (/^-\s/m.test(s)) {
   const items=s.split('\n').filter(line=>line.trim().startsWith('- '));
   nodes.push(<ul key={i}>{items.map((line,j)=><li key={j}>{line.trim().slice(2)}</li>)}</ul>);
  } else nodes.push(<p key={i}>{s}</p>);
 }
 return <div className="blog-article-body">{nodes}</div>;
}
export default function Blog(){
 const {slug}=useParams();const[posts,setPosts]=useState([]);const[loading,setLoading]=useState(true);const[category,setCategory]=useState('All');const[query,setQuery]=useState('');const[error,setError]=useState('');
 useEffect(()=>{let live=true;supabase.from('blog_posts').select('id,title,slug,excerpt,content,category,tags,cover_image_url,author,reading_minutes,published_at').eq('status','published').not('published_at','is',null).lte('published_at',new Date().toISOString()).order('published_at',{ascending:false}).then(({data,error})=>{if(!live)return;if(error)setError('পোস্টগুলো এখন লোড করা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।');else setPosts(data||[]);setLoading(false);});return()=>{live=false}},[]);
 const article=slug?posts.find(p=>p.slug===slug):null;
 const filtered=useMemo(()=>posts.filter(p=>(category==='All'||p.category===category)&&(!query||[p.title,p.excerpt,p.category,...(p.tags||[])].join(' ').toLowerCase().includes(query.toLowerCase()))),[posts,category,query]);

 if(slug){return <main className="blog-page"><div className="blog-wrap"><Link to="/blog" className="blog-back"><ArrowLeft size={17}/> সব আর্টিকেল</Link>{loading?<div className="blog-empty">পোস্ট লোড হচ্ছে…</div>:article?<article className="blog-detail"><div className="blog-kicker">{article.category}</div><h1>{article.title}</h1><p className="blog-detail-excerpt">{article.excerpt}</p><div className="blog-meta"><span>{dateLabel(article.published_at)}</span><span>{article.reading_minutes||3} min read</span><span>{article.author}</span></div>{article.cover_image_url&&<img className="blog-cover" src={article.cover_image_url} alt={article.title}/>}<ArticleBody content={article.content}/><div className="blog-detail-cta"><b>আপনার প্রয়োজনীয় সার্ভিস খুঁজছেন?</b><p>Stationery Dot Com-এর সার্ভিসগুলো দেখে নিন অথবা আমাদের সঙ্গে যোগাযোগ করুন।</p><Link className="btn" to="/services">Explore Services <ArrowRight size={16}/></Link></div></article>:<div className="blog-empty"><h2>Article not found</h2><p>এই পোস্টটি আর প্রকাশিত নেই অথবা লিংকটি সঠিক নয়।</p><Link to="/blog" className="btn">Back to Blog</Link></div>}</div></main>}
 return <main className="blog-page"><section className="blog-hero"><div className="blog-wrap"><div className="blog-kicker"><Sparkles size={15}/> SDC KNOWLEDGE HUB</div><h1>Learn Something.<br/><em>Grow Smarter.</em></h1><p>প্রতিদিনের প্রয়োজনীয় তথ্য, practical tips, digital insights আর একটু মজার কনটেন্ট—সব এক জায়গায়।</p><div className="blog-hero-pills"><span><BookOpen size={15}/> Guides & Articles</span><span><Sparkles size={15}/> Tips, Tricks & Facts</span></div></div></section><section className="blog-wrap blog-content"><div className="blog-section-head"><div><div className="blog-kicker">LATEST FROM SDC</div><h2>নতুন আর্টিকেল ও টিপস</h2></div><div className="blog-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search articles…"/></div></div><div className="blog-filters">{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>{error?<div className="blog-empty">{error}</div>:loading?<div className="blog-grid">{[1,2,3].map(n=><div className="blog-skeleton" key={n}/>)}</div>:filtered.length?<div className="blog-grid">{filtered.map((p,i)=><article className={'blog-card '+(i===0?'blog-card-featured':'')} key={p.id}><Link to={'/blog/'+p.slug} className="blog-card-link">{p.cover_image_url?<img src={p.cover_image_url} alt="" loading="lazy"/>:<div className="blog-card-art"><span>SDC</span><BookOpen size={34}/></div>}<div className="blog-card-content"><span className="blog-card-category">{p.category}</span><h3>{p.title}</h3><p>{p.excerpt}</p><div className="blog-card-meta"><span>{dateLabel(p.published_at)}</span><span>{p.reading_minutes||3} min read</span></div><span className="blog-read">Read article <ArrowRight size={15}/></span></div></Link></article>)}</div>:<div className="blog-empty"><BookOpen size={30}/><h3>এখনো কোনো পোস্ট পাওয়া যায়নি</h3><p>অন্য ক্যাটাগরি বা keyword দিয়ে খুঁজে দেখুন।</p></div>}</section><section className="blog-bottom"><div className="blog-wrap"><b>Need help choosing a service?</b><p>আমাদের সার্ভিসগুলো দেখুন অথবা সরাসরি যোগাযোগ করুন।</p><Link to="/services" className="btn">Explore Services <ArrowRight size={16}/></Link></div></section></main>
}