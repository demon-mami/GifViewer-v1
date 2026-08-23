(() => {
  const ACTIONS = [
    ["idle","IDLE",180],
    ["running-right","RUN →",180],
    ["running-left","RUN ←",180],
    ["waving","WAVE",250],
    ["jumping","JUMP",200],
    ["failed","FAILED",180],
    ["waiting","WAIT",180],
    ["running","RUN",180],
    ["review","REVIEW",180]
  ];
  const PROFILES = {
    default:[6,8,8,4,5,8,6,6,6],
    v2idle7:[7,8,8,4,5,8,6,6,6],
    expressive8:[8,8,8,4,8,8,6,8,8],
    all8:[8,8,8,8,8,8,8,8,8]
  };
  const ROWS_11 = new Set(["aemeath-pixel","gugahd","nyan-cat"]);
  const SHOW_ID = new Set(["arona-v1","arona","asuka","soryu-asuka-langley"]);
  const SOURCE = [
    ["aemeath-pixel","Aemeath","v2idle7"],
    ["anya","Anya"],
    ["arona-v1","Arona"],
    ["arona","Arona"],
    ["asuka","Asuka"],
    ["ayaka","Ayaka"],
    ["bocchi","bocchi"],
    ["chibi-ram","Ram / ラム","expressive8"],
    ["cloud-strife","Cloud Strife"],
    ["cute-rem","Rem","expressive8"],
    ["deku","Deku"],
    ["dodoco-alice","Dodoco Alice / 艾莉丝"],
    ["dodoco-andersdotter","Dodoco Andersdotter / 安德斯多特"],
    ["dodoco-nicole","Dodoco Nicole / 尼可"],
    ["doro","Doro"],
    ["druidika","Druidika"],
    ["eren","Eren"],
    ["feifei","Feifei"],
    ["furina-genshin","Furina"],
    ["furina","furina芙宁娜"],
    ["gengar","Gengar"],
    ["green-slime","Green Slime"],
    ["guga","咕嘎"],
    ["gugahd","咕嘎咕嘎-HD","v2idle7"],
    ["himiko","Himiko"],
    ["hutao-cute","Taotao"],
    ["hutao","胡桃"],
    ["kupobyte","kupoByte"],
    ["lacepuff","Lacepuff"],
    ["little-black-mage","Little Black Mage"],
    ["maple-beginner","Maple Beginner"],
    ["march-7th","March 7th"],
    ["mellow-duck","Mellow Duck","all8"],
    ["mika-v2","Mika v2"],
    ["nahida","纳西妲"],
    ["nyan-cat","Nyan Cat","v2idle7"],
    ["orange-mushroom","Orange Mushroom"],
    ["phoebe","Phoebe / 菲比"],
    ["plana","Plana"],
    ["rei-chibi","Rei Chibi"],
    ["rei","Rei"],
    ["sakurakinomoto","Sakura Kinomoto"],
    ["shinji","碇シンジ"],
    ["shiroko","Shiroko"],
    ["shogun-dango","将军团子"],
    ["snowball-seal","雪球"],
    ["soryu-asuka-langley","Asuka"],
    ["teemo","Teemo"],
    ["tsuyu","Tsuyu"],
    ["umaru","Umaru"],
    ["usachi","乌萨奇"],
    ["usagi-spencer","Usagi","all8"],
    ["white-hat-mage","菲比啾比"],
    ["yuuka","Yuuka"],
    ["yuuki-asuna","Yuuki Asuna"]
  ];
  window.PETS_DATA = SOURCE.map(([id,displayName,profile="default"],index) => {
    const counts = PROFILES[profile];
    return {
      index,id,displayName,
      sourceZip:`${id}.codex-pet.zip`,
      sheet:`https://codex-pets.net/assets/pets/${id}/spritesheet.webp`,
      rows:ROWS_11.has(id)?11:9,
      cols:8,
      showIdHint:SHOW_ID.has(id),
      actions:ACTIONS.map(([key,label,ms],i)=>({
        key,label,ms,frames:Array.from({length:counts[i]},(_,n)=>n)
      }))
    };
  });
})();
