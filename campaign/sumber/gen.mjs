import fs from 'node:fs';
const OUT = process.argv[2];
const FOTO = 'file:///Users/dani/Projects/scntr/assets/velour-night.jpg';

const SHELL = (w,h,isi,extra='') => `<!doctype html><html lang="id"><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Instrument+Sans:wght@400;500;600&display=swap">
<style>
:root{--ink:#0B0B0D;--bone:#F3F1EC;--mute:#9A9AA1;--dim:#66666E;--line:#2A2A2F;
--fresh:#57A47C;--clean:#6D9DD1;--bold:#C8483E;--velour:#F3F1EC;
--display:"Archivo","Helvetica Neue",Arial,sans-serif;--body:"Instrument Sans","Helvetica Neue",Arial,sans-serif;}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{background:var(--ink);color:var(--bone);font-family:var(--body);-webkit-font-smoothing:antialiased}
.card{width:${w}px;height:${h}px;position:relative;display:flex;flex-direction:column;padding:80px}
.logo{font-family:var(--display);font-size:26px;font-weight:600;letter-spacing:.38em;color:var(--dim)}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;
 border-top:1px solid var(--line);padding-top:28px}
.harga{font-family:var(--display);font-size:30px;font-weight:600}
.url{font-family:var(--display);font-size:26px;font-weight:500;color:var(--mute)}
${extra}
</style><div class="card">${isi}</div></html>`;

const SITUASI = [
  {file:'scntr-situasi-1', varian:'FRESH',  warna:'fresh',
   atas:'Buat hari yang', besar:'dimulai jam 6 pagi.',
   isi:'Kuliah pagi, gym, motoran. Wangi yang bikin kamu kelihatan bangun tepat waktu — walaupun engga.'},
  {file:'scntr-situasi-2', varian:'CLEAN',  warna:'clean',
   atas:'Buat hari yang', besar:'harus rapi.',
   isi:'Interview, meeting, ketemu klien. Wangi sabun mahal yang bilang “aku niat” tanpa perlu ngomong.'},
  {file:'scntr-situasi-3', varian:'BOLD',   warna:'bold',
   atas:'Buat malam yang', besar:'butuh kesan pertama.',
   isi:'Kondangan, ulang tahun, ketemu calon mertua. Sekali papasan, orang inget kamu.'},
  {file:'scntr-situasi-4', varian:'VELOUR NIGHT', warna:'velour',
   atas:'Buat hari yang', besar:'engga ada acaranya.',
   isi:'Ngantor, nongkrong, lembur. Wangi harian yang tenang dan engga pasaran.'},
];

const kartuSituasi = s => SHELL(1080,1350,`
  <div class="logo">S C N T R</div>
  <div class="isi">
    <p class="atas">${s.atas}</p>
    <h1>${s.besar}</h1>
    <div class="bar"><span></span><div>
      <p class="varian">${s.varian}</p>
      <p class="ket">${s.isi}</p>
    </div></div>
  </div>
  <div class="foot"><div class="harga">Rp 169.000 · 50 ml</div><div class="url">scntr.pages.dev</div></div>`,
`.isi{flex:1;display:flex;flex-direction:column;margin-top:96px}
.atas{font-family:var(--display);font-size:44px;font-weight:400;color:var(--mute);letter-spacing:-.02em}
h1{font-family:var(--display);font-size:104px;font-weight:600;letter-spacing:-.035em;line-height:1.02;margin-top:4px;text-wrap:balance}
.bar{display:flex;gap:28px;margin-top:auto;margin-bottom:104px}
.bar>span{width:5px;background:var(--${s.warna});border-radius:3px;flex:0 0 5px}
.varian{font-family:var(--display);font-size:34px;font-weight:700;letter-spacing:.05em;color:var(--${s.warna})}
.ket{font-size:30px;line-height:1.5;color:var(--mute);margin-top:14px;max-width:26ch}`);

const kartuEdukasi = SHELL(1080,1350,`
  <div class="logo">S C N T R</div>
  <div class="isi">
    <h1>Wangi kamu cepat hilang? Bukan parfumnya.</h1>
    <ol>
      <li><b>Kulitmu kering.</b><span>Wangi butuh minyak buat nempel. Semprot habis mandi, pas badan masih lembap.</span></li>
      <li><b>Kamu gosok pergelangan.</b><span>Digosok itu mematahkan molekulnya. Semprot, lalu biarkan kering sendiri.</span></li>
      <li><b>Salah titik.</b><span>Leher, belakang telinga, dada. Titik yang hangat dan bergerak, bukan baju.</span></li>
    </ol>
  </div>
  <div class="foot"><div class="harga">Rp 169.000 · 50 ml</div><div class="url">scntr.pages.dev</div></div>`,
`.isi{flex:1;margin-top:80px}
h1{font-family:var(--display);font-size:68px;font-weight:600;letter-spacing:-.035em;line-height:1.07;text-wrap:balance;max-width:16ch}
ol{list-style:none;margin-top:72px;counter-reset:n}
li{counter-increment:n;display:grid;grid-template-columns:88px 1fr;gap:0 24px;margin-bottom:44px}
li::before{content:counter(n);font-family:var(--display);font-size:26px;font-weight:600;color:var(--mute);
 width:64px;height:64px;border:1px solid var(--line);border-radius:50%;display:flex;align-items:center;justify-content:center}
li b{font-family:var(--display);font-size:33px;font-weight:600;align-self:center}
li span{grid-column:2;font-size:27px;line-height:1.45;color:var(--mute);margin-top:8px;max-width:34ch}`);

const story = SHELL(1080,1920,`
  <div class="shade"></div>
  <div class="atas"><div class="logo">S C N T R</div></div>
  <div class="bawah">
    <h1>Wangi yang kerja keras diam-diam.</h1>
    <p class="sub">Eau de parfum · 50 ml · Rp 169.000</p>
    <div class="cta">scntr.pages.dev</div>
    <p class="ong">Beli 2 varian, ongkirnya gratis.</p>
  </div>`,
`.card{padding:0;background:#000 url('${FOTO}') center/cover no-repeat}
.shade{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(11,11,13,.80) 0%,rgba(11,11,13,.12) 28%,rgba(11,11,13,.50) 48%,rgba(11,11,13,.94) 62%,rgba(11,11,13,.99) 78%,rgba(11,11,13,1) 100%)}
.atas{position:relative;padding:120px 80px 0}
.bawah{position:relative;margin-top:auto;padding:0 80px 150px}
h1{font-family:var(--display);font-size:104px;font-weight:600;letter-spacing:-.035em;line-height:1.02;text-wrap:balance;max-width:12ch}
.sub{font-size:32px;color:var(--mute);margin-top:34px}
.cta{margin-top:64px;background:var(--bone);color:#0B0B0D;font-family:var(--display);font-size:38px;font-weight:600;
 text-align:center;padding:34px;border-radius:22px}
.ong{font-size:28px;color:var(--mute);margin-top:28px;text-align:center}`);

fs.mkdirSync(OUT,{recursive:true});
for(const s of SITUASI) fs.writeFileSync(`${OUT}/${s.file}.html`, kartuSituasi(s));
fs.writeFileSync(`${OUT}/scntr-edukasi-1.html`, kartuEdukasi);
fs.writeFileSync(`${OUT}/scntr-story-1.html`, story);
console.log('template ditulis ulang');
