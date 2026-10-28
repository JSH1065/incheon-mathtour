// 여러 반의 작품을 같은 장소 목록에서 선택한다. 업로드는 config.apiUrl만 사용한다.
window.loadMissionCatalog = async function(placeId) {
  const config=window.MATHTOUR_CONFIG || {};
  const urls=[config.apiUrl,...(config.sharedSources || []).map(source=>source.apiUrl)].filter(Boolean);
  const sources=[...new Set(urls)];
  if(!sources.length)throw new Error('storage_not_configured');
  const results=await Promise.allSettled(sources.map(async apiUrl=>{
    const url=new URL(apiUrl,location.href);url.searchParams.set('action','mission_list');url.searchParams.set('placeId',placeId);
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
    const data=await response.json();if(!response.ok||!data.ok||!Array.isArray(data.missions))throw new Error('mission_list_failed');
    return data.missions.map(m=>({...m,sourceApi:apiUrl}));
  }));
  const successful=results.filter(result=>result.status==='fulfilled');
  if(!successful.length)throw new Error('mission_list_failed');
  return {ok:true,missions:successful.flatMap(result=>result.value),partial:successful.length!==results.length};
};
