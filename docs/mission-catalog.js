// 여러 반의 작품을 같은 장소 목록에서 선택한다. 업로드는 config.apiUrl만 사용한다.
window.loadMissionCatalog = async function(placeId) {
  const config=window.MATHTOUR_CONFIG || {};
  const urls=[config.apiUrl,...(config.sharedSources || []).map(source=>source.apiUrl)].filter(Boolean);
  const sources=[...new Set(urls)];
  const examples=(config.exampleMissions || []).filter(m=>m.placeId===placeId).map(m=>({...m,exampleUrl:m.url,sourceApi:null}));
  if(!sources.length)return {ok:true,missions:examples,partial:false,unconfigured:true};
  const results=await Promise.allSettled(sources.map(async apiUrl=>{
    const url=new URL(apiUrl,location.href);url.searchParams.set('action','mission_list');url.searchParams.set('placeId',placeId);
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
    const data=await response.json();if(!response.ok||!data.ok||!Array.isArray(data.missions))throw new Error('mission_list_failed');
    return data.missions.map(m=>({...m,sourceApi:apiUrl,exampleUrl:undefined}));
  }));
  const successful=results.filter(result=>result.status==='fulfilled');
  if(!successful.length&&!examples.length)throw new Error('mission_list_failed');
  return {ok:true,missions:[...examples,...successful.flatMap(result=>result.value)],partial:successful.length!==results.length};
};

window.loadExampleMission = async function(placeId, id, url) {
  const allowed=(window.MATHTOUR_CONFIG?.exampleMissions || []).some(m=>m.placeId===placeId&&m.id===id&&m.url===url);
  const target=new URL(url,location.href);
  if(!allowed||target.origin!==location.origin)throw new Error('invalid_example');
  const response=await fetch(target.href,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('example_load_failed');
  return {ok:true,html:await response.text()};
};
