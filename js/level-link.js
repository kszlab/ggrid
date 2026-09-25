/* Open a catalog level by its stable ID. Uses the normal game and theme loaders. */
(async()=>{
 const params=new URLSearchParams(location.search),id=params.get('level');
 if(!id)return;
 try{
  await Promise.all([LevelLibrary.init(),ScenarioMode.ready]);
  const level=LevelLibrary.all().find(l=>l.levelId===id&&LevelLibrary.compatible(l));
  if(!level)throw Error('Ismeretlen pálya: '+id);
  const themeId=params.get('theme');
  if(themeId&&!ScenarioMode.freeThemes.some(t=>t.id===themeId))throw Error('Ismeretlen téma: '+themeId);
  sizeEl.value=level.board.width+'x'+level.board.height;
  difficultyEl.value=String(level.analysis.testDifficultyClass);
  if(themeId){document.querySelector('#freeTheme').value=themeId;await ScenarioMode.loadFreeTheme(themeId)}
  applyLibraryLevel(LevelLibrary.toGame(level));AppUI.enterGame();
 }catch(error){console.error('Level link',error);toast.textContent=error.message}
})();
