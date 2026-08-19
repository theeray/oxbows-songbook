const focusSongScreen=document.getElementById('song');
const fullscreenBtn=document.getElementById('fullscreenBtn');
let focusModeActive=false;

function focusSongIsEditable(){
  if(!current || !M[current]) return false;
  return M[current].type==='editable' || M[current].type==='editable_source';
}

function syncFullscreenButton(){
  if(!fullscreenBtn) return;
  fullscreenBtn.style.display=focusSongIsEditable()?'inline-flex':'none';
  fullscreenBtn.textContent=focusModeActive?'✕ Exit':'⛶ Full Screen';
}

function forceTwoColumnsForFocus(){
  if(!focusSongIsEditable()) return;
  two=true;
  if(colBtn){
    colBtn.textContent='2 Columns';
    colBtn.classList.add('primary');
  }
  rerenderCurrent();
}

async function enterFocusMode(){
  if(!focusSongIsEditable()) return;
  focusModeActive=true;
  focusSongScreen.classList.add('focusMode');
  document.body.classList.add('focusModeActive');
  forceTwoColumnsForFocus();
  syncFullscreenButton();

  // Native fullscreen when the browser supports it. The CSS focus mode remains
  // active as a fallback on iPhone/iPad Safari versions that do not allow it.
  try{
    const request=focusSongScreen.requestFullscreen || focusSongScreen.webkitRequestFullscreen;
    if(request && !document.fullscreenElement && !document.webkitFullscreenElement){
      const result=request.call(focusSongScreen,{navigationUI:'hide'});
      if(result && result.catch) result.catch(()=>{});
    }
  }catch(e){}
}

async function leaveFocusMode(exitNative=true){
  focusModeActive=false;
  focusSongScreen.classList.remove('focusMode');
  document.body.classList.remove('focusModeActive');
  syncFullscreenButton();
  if(exitNative){
    try{
      if(document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      else if(document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    }catch(e){}
  }
}

async function toggleFocusMode(){
  if(focusModeActive) await leaveFocusMode(true);
  else await enterFocusMode();
}

fullscreenBtn.addEventListener('click',toggleFocusMode);

// Keep the feature limited to transposable pages, and keep performance mode
// active while moving forward/back through a set list.
const openSongBeforeFocusMode=openSong;
openSong=function(songName){
  openSongBeforeFocusMode(songName);
  if(focusModeActive){
    if(focusSongIsEditable()){
      focusSongScreen.classList.add('focusMode');
      forceTwoColumnsForFocus();
    }else{
      leaveFocusMode(true);
    }
  }
  syncFullscreenButton();
};

function nativeFullscreenEnded(){
  if(focusModeActive && !document.fullscreenElement && !document.webkitFullscreenElement){
    // Escaping native fullscreen should also restore the normal app chrome.
    leaveFocusMode(false);
  }
}
document.addEventListener('fullscreenchange',nativeFullscreenEnded);
document.addEventListener('webkitfullscreenchange',nativeFullscreenEnded);

// Re-assert the two-column layout after rotation/resizing while in focus mode.
window.addEventListener('resize',()=>{
  if(focusModeActive && focusSongIsEditable()) forceTwoColumnsForFocus();
});

syncFullscreenButton();
