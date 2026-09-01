(function(){
  const KEY = "scntr-traffic-events";
  const params = new URLSearchParams(location.search);
  const source = {utm_source:params.get("utm_source")||"direct",utm_medium:params.get("utm_medium")||"none",utm_campaign:params.get("utm_campaign")||"none",referrer:document.referrer||"direct"};
  try{sessionStorage.setItem("scntr-traffic-source",JSON.stringify(source))}catch(e){}
  function getSource(){try{return JSON.parse(sessionStorage.getItem("scntr-traffic-source"))||source}catch(e){return source}}
  function track(name,detail){const event={name,detail:detail||{},source:getSource(),page:location.pathname,at:new Date().toISOString()};try{const events=JSON.parse(localStorage.getItem(KEY)||"[]");events.push(event);localStorage.setItem(KEY,JSON.stringify(events.slice(-1000)))}catch(e){}window.dispatchEvent(new CustomEvent("scntr:track",{detail:event}))}
  window.scntrTrack=track;track("page_view");
  document.addEventListener("click",function(e){const target=e.target.closest("a,button");if(!target)return;const label=(target.getAttribute("aria-label")||target.textContent||"").trim().replace(/\s+/g," ").slice(0,80);if(label)track("click",{label,href:target.getAttribute("href")||""})},{passive:true});
})();
